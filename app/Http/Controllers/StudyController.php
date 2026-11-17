<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\LearnerReports;
use App\Services\SourceInventory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

final class StudyController
{
    public function __construct(private readonly Access $access, private readonly LearnerReports $reports) {}

    public function home(Request $request)
    {
        $user = $this->access->identity($request, true);
        if (!$user) {
            return $this->accessPage($this->access->ready() ? 'login' : 'setup');
        }

        $track = $request->query('track');
        $edition = $request->query('edition');
        $level = $request->query('hsk');
        if ($track === null && $level === null && $edition === null && $user['maxLevel'] === 0) {
            return redirect('/?'.http_build_query(['track' => $user['tracks'][0]] + $request->query()))
                ->header('Cache-Control', 'no-store');
        }

        if ($track !== null) {
            $course = is_string($track) && $level === null && $edition === null ? (Access::TRACKS[$track] ?? 0) : 0;
        } else {
            $level ??= (string) min(2, $user['maxLevel']);
            $course = is_string($level) && preg_match('/^[1-4]$/D', $level) ? (int) $level : 0;
            if ($edition !== null) {
                $course = $edition === '3.0' && in_array($course, [1, 2], true) ? $course + 30 : 0;
            }
        }
        if (!$this->access->canStudy($user, $course)) {
            return $this->accessPage('locked', 403);
        }

        return response()->view('study')->header('Cache-Control', 'private, no-store');
    }

    public function admin(Request $request)
    {
        $user = $this->access->identity($request, true);
        if (!$user) {
            return $this->accessPage($this->access->ready() ? 'login' : 'setup');
        }

        return $user['admin'] ? $this->accessPage('admin') : $this->denied();
    }

    public function dashboard(Request $request)
    {
        $user = $this->access->identity($request, true);
        if (!$user) {
            return $this->accessPage($this->access->ready() ? 'login' : 'setup');
        }

        return $user['admin'] ? $this->accessPage('progress') : $this->denied();
    }

    public function sourcesPage(Request $request)
    {
        $user = $this->access->identity($request, true);
        if (!$user) {
            return $this->accessPage($this->access->ready() ? 'login' : 'setup');
        }

        return $user['admin'] ? $this->accessPage('sources') : $this->denied();
    }

    public function sources(Request $request, SourceInventory $inventory): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || !$user['admin']) {
            return $this->denied($user ? 403 : 401);
        }

        return response()->json($inventory->inventory())->header('Cache-Control', 'private, no-store');
    }

    public function overview(Request $request): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || !$user['admin']) {
            return $this->denied($user ? 403 : 401);
        }

        return response()->json($this->reports->overview())->header('Cache-Control', 'private, no-store');
    }

    public function learnerDetail(Request $request): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || !$user['admin']) {
            return $this->denied($user ? 403 : 401);
        }
        $email = $this->access->email($request->query('email'));
        $level = $request->query('level');
        if (!$this->access->validEmail($email) || !is_string($level) || !preg_match('/^'.Access::COURSE_PATTERN.'$/D', $level)) {
            return response()->json(['error' => 'Chọn email học viên và khóa học hợp lệ.'], 400);
        }
        if (!DB::table('grants')->where('email', $email)->exists()
            && !DB::table('workplace_grants')->where('email', $email)->exists()) {
            return response()->json(['error' => 'Không tìm thấy học viên.'], 404);
        }
        $record = DB::table('learner_progress')->where(['email' => $email, 'level' => (int) $level])->first();
        $state = $record ? json_decode($record->snapshot, flags: JSON_THROW_ON_ERROR) : null;

        return response()->json(['email' => $email, 'level' => (int) $level, 'state' => $state])
            ->header('Cache-Control', 'private, no-store');
    }

    private function accessPage(string $mode, int $status = 200)
    {
        return response()->view('access', ['mode' => $mode], $mode === 'setup' ? 503 : $status)
            ->header('Cache-Control', 'private, no-store');
    }

    public function grants(Request $request): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || !$user['admin']) {
            return $this->denied($user ? 403 : 401);
        }

        if ($request->isMethod('GET')) {
            return response()->json(array_values($this->reports->learners()))->header('Cache-Control', 'private, no-store');
        }

        $email = $this->access->email($request->input('email'));
        $scope = $request->input('scope', 'hsk');
        if (!$this->access->validEmail($email) || in_array($email, $this->access->admins(), true)
            || !in_array($scope, ['hsk', ...array_keys(Access::TRACKS)], true)) {
            return response()->json(['error' => 'Chọn email học viên và phạm vi hợp lệ.'], 400);
        }

        $hsk = $scope === 'hsk';
        $key = $hsk ? ['email' => $email] : ['email' => $email, 'track' => $scope];
        $table = DB::table($hsk ? 'grants' : 'workplace_grants');
        if ($request->isMethod('DELETE')) {
            $table->where($key)->update(['revoked' => true]);

            return response()->json(['ok' => true]);
        }

        $now = now()->getTimestampMs();
        $level = $request->input('maxLevel');
        $expiresAt = $request->input('expiresAt');
        if (!is_int($expiresAt) || $expiresAt <= $now || $expiresAt > $now + 3650 * Access::DAY) {
            return response()->json(['error' => 'Chọn thời điểm hết hạn hợp lệ trong tương lai.'], 400);
        }
        if ($hsk && !in_array($level, [1, 2, 3, 4], true)) {
            return response()->json(['error' => 'Chọn cấp HSK hợp lệ.'], 400);
        }
        $values = ['expires_at' => $expiresAt, 'revoked' => false];
        if ($hsk) {
            $values['max_level'] = $level;
        }
        $table->upsert([$key + $values], array_keys($key), array_keys($values));

        return response()->json(['ok' => true]);
    }

    public function progress(Request $request, int $level): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || !$this->access->canStudy($user, $level)) {
            return $this->denied($user ? 403 : 401);
        }

        $key = ['email' => $user['email'], 'level' => $level];
        $table = DB::table('learner_progress');
        $status = 200;
        if ($request->isMethod('PUT')) {
            if (strlen($request->getContent()) > 800_000) {
                return response()->json(['error' => 'Dữ liệu tiến độ vượt quá dung lượng cho phép.'], 413);
            }
            try {
                $body = json_decode($request->getContent(), flags: JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                $body = null;
            }
            $revision = $body->revision ?? null;
            $state = $body->state ?? null;
            if (!is_int($revision) || $revision < 0 || !is_array($state->attempts ?? null) ||
                !is_array($state->history ?? null) || !is_object($state->words ?? null) ||
                !is_object($state->marks ?? null) || !is_int($state->last ?? null)) {
                return response()->json(['error' => 'Dữ liệu tiến độ không hợp lệ.'], 400);
            }
            $stored = false;
            $previous = function () use (&$stored, $revision, $table, $key) {
                if ($stored === false) {
                    $old = $revision > 0 ? (clone $table)->where($key)->value('snapshot') : null;
                    $stored = $old ? json_decode($old, flags: JSON_THROW_ON_ERROR) : null;
                }

                return $stored;
            };
            if (property_exists($state, 'views')) {
                if (!$this->validViewMap($state->views->questions ?? null, 2500)
                    || !$this->validViewMap($state->views->examPages ?? null, 1000, exam: true)) {
                    return response()->json(['error' => 'Lịch sử xem không hợp lệ.'], 400);
                }
                $views = ['questions' => $state->views->questions, 'examPages' => $state->views->examPages];
            } else {
                $views = $previous()->views ?? null;
            }
            if (property_exists($state, 'study')) {
                if (!$this->validStudy($state->study)) {
                    return response()->json(['error' => 'Dữ liệu thói quen học không hợp lệ.'], 400);
                }
                $study = ['goal' => $state->study->goal, 'days' => $state->study->days, 'srs' => $state->study->srs];
            } else {
                $study = $previous()->study ?? null;
            }
            $content = [
                'attempts' => $state->attempts, 'history' => $state->history, 'words' => $state->words,
                'marks' => $state->marks, 'last' => $state->last,
            ];
            if ($views !== null) {
                $content['views'] = $views;
            }
            if ($study !== null) {
                $content['study'] = $study;
            }
            $snapshot = json_encode($content, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            $written = $revision === 0
                ? $table->insertOrIgnore($key + ['snapshot' => $snapshot, 'revision' => 1])
                : (clone $table)->where($key)->where('revision', $revision)->update(['snapshot' => $snapshot, 'revision' => $revision + 1]);
            $status = $written ? 200 : 409;
        }

        $record = $table->where($key)->first();

        return response()->json([
            'state' => $record ? json_decode($record->snapshot, flags: JSON_THROW_ON_ERROR) : null,
            'revision' => (int) ($record->revision ?? 0),
        ], $status)->header('Cache-Control', 'private, no-store');
    }

    private function validViewMap(mixed $items, int $limit, bool $exam = false): bool
    {
        if (!is_object($items) || count(get_object_vars($items)) > $limit) {
            return false;
        }
        foreach ($items as $key => $time) {
            $key = (string) $key;
            if ($key === '' || strlen($key) > 640 || ($exam && !preg_match('/^[a-z0-9-]+:[0-9]{1,3}$/D', $key))
                || !is_int($time) || $time <= 0 || $time > 8_640_000_000_000_000) {
                return false;
            }
        }

        return true;
    }

    /** Mục tiêu phút/ngày, số phút theo ngày và lịch ôn thẻ (lặp lại ngắt quãng). */
    private function validStudy(mixed $study): bool
    {
        if (!is_object($study) || !in_array($study->goal ?? null, [10, 20, 30], true)
            || !is_object($study->days ?? null) || !is_object($study->srs ?? null)
            || count(get_object_vars($study->days)) > 400 || count(get_object_vars($study->srs)) > 5000) {
            return false;
        }
        foreach ($study->days as $day => $minutes) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', (string) $day) || !is_int($minutes) || $minutes < 0 || $minutes > 1440) {
                return false;
            }
        }
        foreach ($study->srs as $word => $card) {
            $word = (string) $word;
            if ($word === '' || strlen($word) > 160 || !is_object($card)
                || !is_int($card->due ?? null) || !is_int($card->at ?? null) || !is_int($card->step ?? null)
                || $card->step < 1 || $card->step > 365 || $card->due <= 0 || $card->at <= 0
                || (property_exists($card, 'first') && $card->first !== true)
                || count(get_object_vars($card)) > 4) {
                return false;
            }
        }

        return true;
    }

    public function learning(Request $request, int $level)
    {
        $user = $this->access->identity($request);
        if (!$user || !$this->access->canStudy($user, $level)) {
            return $this->denied($user ? 403 : 401);
        }

        return $this->privateFile('learning/'.$level.'.json', 'application/json; charset=utf-8');
    }

    public function audio(Request $request, string $filename)
    {
        return $this->media($request, 'audio', $filename, 'audio/mpeg');
    }

    public function exam(Request $request, string $filename)
    {
        return $this->media($request, 'exams', $filename, str_ends_with($filename, '.pdf') ? 'application/pdf' : 'image/webp');
    }

    private function media(Request $request, string $kind, string $filename, string $mime)
    {
        $user = $this->access->identity($request);
        if (!$user) {
            return $this->denied(401);
        }

        $manifest = File::json(storage_path('app/private/fangschool/manifest.json'));
        $level = $manifest[$kind][$filename] ?? null;
        if ($level === null) {
            abort(404);
        }

        $tracks = $kind === 'audio' ? ($manifest['workplaceAudio'][$filename] ?? []) : [];
        if ($level > $user['maxLevel'] && !array_intersect($tracks, $user['tracks'])) {
            return $this->denied();
        }

        return $this->privateFile($kind.'/'.$filename, $mime);
    }

    private function privateFile(string $file, string $mime)
    {
        $path = storage_path('app/private/fangschool/'.$file);
        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => $mime, 'Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff',
        ])->setPrivate();
    }

    private function denied(int $status = 403): JsonResponse
    {
        return response()->json(['error' => $status === 401
            ? 'Bạn cần xác thực email còn quyền truy cập.' : 'Bạn chưa có quyền cho mục này.'], $status)
            ->header('Cache-Control', 'no-store');
    }
}
