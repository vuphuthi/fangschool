<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\Assignments;
use App\Services\Learning;
use App\Services\Mailer;
use App\Services\TeacherQuestions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class TeachingController
{
    public function __construct(
        private readonly Access $access,
        private readonly TeacherQuestions $questions,
        private readonly Assignments $assignments,
        private readonly Learning $learning,
        private readonly Mailer $mailer,
    ) {}

    // ----- Câu hỏi giáo viên -----

    public function teacherQuestions(Request $request, int $level): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }

        return $this->json(['questions' => $this->questions->forTeacher($level)]);
    }

    public function saveTeacherQuestion(Request $request, int $level): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $user = $this->access->identity($request);
        $id = $request->input('id');
        $lesson = $request->input('lesson');
        $status = $request->input('status', 'draft');
        if ($id !== null && !$this->questions->validId($id)) {
            return response()->json(['error' => 'Mã câu hỏi không hợp lệ.'], 400);
        }
        if ($id !== null && ($existing = DB::table('teacher_questions')->where('id', $id)->value('level')) !== null && (int) $existing !== $level) {
            return response()->json(['error' => 'Câu hỏi thuộc khóa khác.'], 409);
        }
        if (!in_array($status, TeacherQuestions::STATUSES, true)) {
            return response()->json(['error' => 'Trạng thái không hợp lệ.'], 400);
        }
        if ($request->filled('restore')) {
            return $this->questions->restore($level, (string) $id, (int) $request->input('restore'), $user['email'])
                ? $this->json(['ok' => true]) : response()->json(['error' => 'Không tìm thấy phiên bản cần khôi phục.'], 404);
        }
        if (!is_int($lesson) || !$this->learning->lesson($level, $lesson)) {
            return response()->json(['error' => 'Chọn bài học hợp lệ.'], 400);
        }
        $question = $this->questions->normalize($request->input('question'));
        if ($question === null) {
            return response()->json(['error' => 'Kiểm tra yêu cầu, dạng câu, độ khó và đáp án (phương án đúng phải nằm trong danh sách phương án).'], 400);
        }
        $saved = $this->questions->save($level, $id, $lesson, $question, $status, $user['email'], $status === 'deleted' ? 'delete' : 'save');

        return $this->json(['id' => $saved]);
    }

    /** Câu đã xuất bản cho học viên có quyền với khóa. */
    public function liveQuestions(Request $request, int $level): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user || !$this->access->canStudy($user, $level)) {
            return $this->denied($user ? 403 : 401);
        }

        return $this->json(['questions' => $this->questions->live($level)]);
    }

    // ----- Bài giao -----

    public function adminAssignments(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $now = now()->getTimestampMs();

        return $this->json(['assignments' => $this->assignments->rows()->map(fn ($row) => $this->assignments->present($row, false, $now))->values()->all()]);
    }

    public function adminAssignment(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $row = DB::table('assignments')->where('id', $id)->first();

        return $row ? $this->json($this->assignments->present($row, true, now()->getTimestampMs())) : response()->json(['error' => 'Không tìm thấy bài giao.'], 404);
    }

    public function createAssignment(Request $request): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $user = $this->access->identity($request);
        $now = now()->getTimestampMs();
        $title = trim((string) $request->input('title'));
        $level = $request->input('level');
        $kind = $request->input('kind');
        $payload = $request->input('payload');
        $dueAt = $request->input('dueAt');
        $emails = array_values(array_unique(array_filter(array_map($this->access->email(...), (array) $request->input('emails', [])), $this->access->validEmail(...))));
        $error = match (true) {
            $title === '' || mb_strlen($title) > 160 => 'Nhập tên bài giao (tối đa 160 ký tự).',
            !is_int($level) || !isset(Learning::COURSES[$level]) => 'Chọn khóa học hợp lệ.',
            !in_array($kind, Assignments::KINDS, true) || !is_array($payload) => 'Chọn nội dung giao.',
            !is_int($dueAt) || $dueAt <= $now || $dueAt > $now + 365 * Access::DAY => 'Chọn hạn nộp trong tương lai (tối đa 1 năm).',
            $emails === [] || count($emails) > 500 => 'Chọn ít nhất một học viên.',
            default => null,
        };
        if ($error === null) {
            $payload = match ($kind) {
                'lesson' => is_int($payload['lesson'] ?? null) && $this->learning->lesson($level, $payload['lesson']) ? ['lesson' => $payload['lesson']] : null,
                'exam' => is_string($payload['paper'] ?? null) && $this->learning->paper($level, $payload['paper']) ? ['paper' => $payload['paper']] : null,
                default => is_array($payload['ids'] ?? null) && count($payload['ids']) > 0 && count($payload['ids']) <= 100
                    && count(array_filter($payload['ids'], fn ($id) => is_string($id) && preg_match('/^[A-Za-z0-9_-]{1,120}$/D', $id))) === count($payload['ids'])
                    ? ['ids' => array_values(array_unique($payload['ids']))] : null,
            };
            $error = $payload === null ? 'Nội dung giao không tồn tại trong khóa này.' : null;
        }
        if ($error) {
            return response()->json(['error' => $error], 400);
        }
        $note = trim((string) $request->input('note', ''));
        $id = DB::transaction(function () use ($title, $level, $kind, $payload, $note, $dueAt, $request, $user, $now, $emails): int {
            $id = DB::table('assignments')->insertGetId([
                'title' => $title, 'level' => $level, 'kind' => $kind, 'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                'note' => $note === '' ? null : mb_substr($note, 0, 1000), 'due_at' => $dueAt, 'remind' => (bool) $request->input('remind', true),
                'closed' => false, 'created_by' => $user['email'], 'created_at' => $now,
            ]);
            DB::table('assignment_targets')->insert(array_map(fn ($email) => ['assignment_id' => $id, 'email' => $email, 'reminded_at' => null], $emails));

            return $id;
        });

        return $this->json(['id' => $id]);
    }

    public function updateAssignment(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $updated = DB::table('assignments')->where('id', $id)->update(['closed' => (bool) $request->input('closed')]);

        return $updated || DB::table('assignments')->where('id', $id)->exists() ? $this->json(['ok' => true]) : response()->json(['error' => 'Không tìm thấy bài giao.'], 404);
    }

    /** Gửi email nhắc những học viên chưa nộp. */
    public function nudgeAssignment(Request $request, int $id): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $row = DB::table('assignments')->where('id', $id)->first();
        if (!$row) {
            return response()->json(['error' => 'Không tìm thấy bài giao.'], 404);
        }
        if (!$this->mailer->ready()) {
            return response()->json(['error' => 'Chưa cấu hình gửi email.'], 503);
        }
        $now = now()->getTimestampMs();
        $sent = 0;
        foreach ($this->assignments->present($row, true, $now)['people'] as $person) {
            if (in_array($person['status'], ['done', 'late_done'], true)) {
                continue;
            }
            if ($this->sendAssignmentEmail($row, $person['email'], $person)) {
                $sent++;
                DB::table('assignment_targets')->where('assignment_id', $id)->where('email', $person['email'])->update(['reminded_at' => $now]);
            }
        }

        return $this->json(['sent' => $sent]);
    }

    public function sendAssignmentEmail(object $row, string $email, array $status): bool
    {
        $data = ['title' => $row->title, 'what' => $this->assignments->describe($row), 'note' => $row->note, 'due' => $this->vnTime((int) $row->due_at),
            'late' => $status['status'] === 'late', 'progress' => $status['progress'], 'url' => rtrim((string) config('app.url'), '/').'/?'.$this->courseQuery((int) $row->level).'#assignments'];

        return $this->mailer->send($email, ($data['late'] ? 'Bài giao đã quá hạn: ' : 'Nhắc nộp bài: ').$row->title,
            view('emails.assignment', $data)->render(),
            "{$row->title}\n{$data['what']}\nHạn nộp: {$data['due']}\nĐã làm: {$status['progress']}%\n\nMở bài: {$data['url']}\n\nFangSchool");
    }

    /** Bài giao của học viên đang đăng nhập. */
    public function myAssignments(Request $request): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user) {
            return $this->denied(401);
        }
        $rows = array_values(array_filter($this->assignments->forLearner($user['email'], now()->getTimestampMs()), fn ($a) => $this->access->canStudy($user, $a['level'])));

        return $this->json(['assignments' => $rows]);
    }

    /** Danh sách học viên có quyền với một khóa (để chọn người nhận bài giao). */
    public function courseLearners(Request $request, int $level): JsonResponse
    {
        if ($denied = $this->requireAdmin($request)) {
            return $denied;
        }
        $now = now()->getTimestampMs();
        $track = array_search($level, Access::TRACKS, true);
        $emails = $track !== false
            ? DB::table('workplace_grants')->where('track', $track)->where('revoked', false)->where('expires_at', '>', $now)->pluck('email')
            : DB::table('grants')->where('revoked', false)->where('expires_at', '>', $now)->where('max_level', '>=', $level > 30 ? $level - 30 : $level)->pluck('email');

        return $this->json(['emails' => $emails->sort()->values()->all()]);
    }

    // ----- Tùy chọn email -----

    public function emailPrefs(Request $request): JsonResponse
    {
        $user = $this->access->identity($request);
        if (!$user) {
            return $this->denied(401);
        }
        if ($request->isMethod('PUT')) {
            $hour = $request->input('hour');
            if (!is_int($hour) || $hour < 6 || $hour > 22) {
                return response()->json(['error' => 'Chọn giờ nhắc từ 6 đến 22.'], 400);
            }
            DB::table('email_prefs')->upsert([[
                'email' => $user['email'], 'streak' => (bool) $request->input('streak'), 'weekly' => (bool) $request->input('weekly'), 'hour' => $hour,
            ]], ['email'], ['streak', 'weekly', 'hour']);
        }
        $row = DB::table('email_prefs')->where('email', $user['email'])->first();

        return $this->json(['streak' => $row ? (bool) $row->streak : true, 'weekly' => $row ? (bool) $row->weekly : false, 'hour' => $row ? (int) $row->hour : 20, 'ready' => $this->mailer->ready()]);
    }

    // ----- Tiện ích -----

    private function requireAdmin(Request $request): ?JsonResponse
    {
        $user = $this->access->identity($request);

        return !$user || !$user['admin'] ? $this->denied($user ? 403 : 401) : null;
    }

    private function denied(int $status): JsonResponse
    {
        return response()->json(['error' => $status === 401 ? 'Bạn cần đăng nhập.' : 'Bạn không có quyền thực hiện thao tác này.'], $status);
    }

    private function json(array $data): JsonResponse
    {
        return response()->json($data)->header('Cache-Control', 'private, no-store');
    }

    public function vnTime(int $ms): string
    {
        return (new \DateTimeImmutable('@'.intdiv($ms, 1000)))->setTimezone(new \DateTimeZone(Learning::TZ))->format('H:i d/m/Y');
    }

    public function courseQuery(int $level): string
    {
        return match (true) {
            $level === 41 => 'track=factory', $level === 42 => 'track=office',
            $level > 30 => 'hsk='.($level - 30).'&edition=3.0', default => 'hsk='.$level,
        };
    }
}
