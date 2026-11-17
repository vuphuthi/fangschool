<?php

namespace App\Http\Controllers;

use App\Services\Access;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

final class StudyController
{
    public function __construct(private readonly Access $access) {}

    public function home(Request $request)
    {
        $user = $this->access->identity($request, true);
        if (!$user) {
            return $this->accessPage($this->access->ready() ? 'login' : 'setup');
        }

        $level = $request->query('hsk', (string) min($user['maxLevel'], 2));
        if (!is_string($level) || !preg_match('/^[1-4]$/D', $level) || (int) $level > $user['maxLevel']) {
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

        $grants = DB::table('grants');
        if ($request->isMethod('GET')) {
            return response()->json($grants->orderBy('email')->get()->map(static fn (object $grant) => [
                'email' => $grant->email, 'max_level' => (int) $grant->max_level,
                'expires_at' => (int) $grant->expires_at, 'revoked' => (bool) $grant->revoked,
            ]));
        }

        $email = $this->access->email($request->input('email'));
        if (!$this->access->validEmail($email) || in_array($email, $this->access->admins(), true)) {
            return response()->json(['error' => 'Vui lòng nhập email học viên hợp lệ.'], 400);
        }

        if ($request->isMethod('DELETE')) {
            DB::transaction(function () use ($email, $grants): void {
                $grants->where('email', $email)->update(['revoked' => true]);
                DB::table('access_sessions')->where('email', $email)->delete();
                DB::table('otp_challenges')->where('email', $email)->delete();
            });

            return response()->json(['ok' => true]);
        }

        $now = now()->getTimestampMs();
        $level = $request->input('maxLevel');
        $expiresAt = $request->input('expiresAt');
        if (!in_array($level, [1, 2, 3, 4], true) || !is_int($expiresAt) || $expiresAt <= $now || $expiresAt > $now + 3650 * Access::DAY) {
            return response()->json(['error' => 'Chọn cấp HSK và thời điểm hết hạn hợp lệ trong tương lai.'], 400);
        }

        $grants->upsert([['email' => $email, 'max_level' => $level, 'expires_at' => $expiresAt, 'revoked' => false]],
            ['email'], ['max_level', 'expires_at', 'revoked']);

        return response()->json(['ok' => true]);
    }

    public function progress(Request $request, int $level): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || $level > $user['maxLevel']) {
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
            $snapshot = json_encode([
                'attempts' => $state->attempts, 'history' => $state->history, 'words' => $state->words,
                'marks' => $state->marks, 'last' => $state->last,
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
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

    public function learning(Request $request, int $level)
    {
        return $this->asset($request, 'learning/'.$level.'.json', $level, 'application/json; charset=utf-8');
    }

    public function audio(Request $request, string $filename)
    {
        $level = $this->assetLevel('audio', $filename);
        return $this->asset($request, 'audio/'.$filename, $level, 'audio/mpeg');
    }

    public function exam(Request $request, string $filename)
    {
        $level = $this->assetLevel('exams', $filename);
        return $this->asset($request, 'exams/'.$filename, $level, str_ends_with($filename, '.pdf') ? 'application/pdf' : 'image/webp');
    }

    private function assetLevel(string $type, string $filename): int
    {
        $manifest = File::json(storage_path('app/private/fangschool/manifest.json'));
        return $manifest[$type][$filename] ?? 0;
    }

    private function asset(Request $request, string $file, int $level, string $mime)
    {
        $user = $this->access->identity($request);
        if (!$user) {
            return $this->denied(401);
        }

        $path = storage_path('app/private/fangschool/'.$file);
        if ($level === 0 || !is_file($path)) {
            abort(404);
        }
        if ($level > $user['maxLevel']) {
            return $this->denied();
        }

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
