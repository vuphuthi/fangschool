<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Bài giao có hạn nộp. Trạng thái từng học viên được tính trực tiếp từ tiến độ đã đồng bộ:
 * - lesson: nộp kiểm tra cuối bài của bài đó sau khi được giao; tiến độ = số câu của bài đã làm.
 * - exam: nộp đề đó sau khi được giao; điểm quy đổi theo từng phần (100 điểm mỗi phần).
 * - set: trả lời đủ các câu trong lượt ôn; điểm = số câu đúng ở lần trả lời gần nhất.
 */
final class Assignments
{
    public const KINDS = ['lesson', 'exam', 'set'];

    public function __construct(private readonly Learning $learning) {}

    public function rows(?string $email = null)
    {
        $query = DB::table('assignments')->orderByDesc('created_at');
        if ($email !== null) {
            $query->whereIn('id', DB::table('assignment_targets')->where('email', $email)->select('assignment_id'));
        }

        return $query->get();
    }

    public function targets(int $id): array
    {
        return DB::table('assignment_targets')->where('assignment_id', $id)->orderBy('email')->pluck('email')->all();
    }

    /** Mô tả ngắn nội dung bài giao. */
    public function describe(object $row): string
    {
        $payload = json_decode($row->payload, true) ?: [];
        $level = (int) $row->level;

        return match ($row->kind) {
            'lesson' => ($payload['lesson'] >= 100 ? 'Ngữ âm '.($payload['lesson'] - 100) : 'Bài '.$payload['lesson']).' · '.($this->learning->lesson($level, (int) $payload['lesson'])['zh'] ?? ''),
            'exam' => $this->learning->paper($level, (string) $payload['paper'])['title'] ?? 'Đề ôn thi',
            default => 'Lượt ôn · '.count($payload['ids'] ?? []).' câu',
        };
    }

    /** Trạng thái của một học viên với một bài giao. */
    public function status(object $row, array $state, int $now): array
    {
        $payload = json_decode($row->payload, true) ?: [];
        $since = (int) $row->created_at;
        $due = (int) $row->due_at;
        $attempts = array_values(array_filter($state['attempts'] ?? [], fn ($a) => is_array($a) && is_string($a['id'] ?? null) && (int) ($a['at'] ?? 0) >= $since && empty($a['skipped'])));
        $history = array_values(array_filter($state['history'] ?? [], fn ($h) => is_array($h) && (int) ($h['at'] ?? 0) >= $since));
        $submittedAt = null;
        $score = null;
        $progress = 0;

        if ($row->kind === 'lesson') {
            $lesson = $this->learning->lesson((int) $row->level, (int) $payload['lesson']);
            $ids = array_column(array_filter($lesson['questions'] ?? [], fn ($q) => empty($q['resource'])), 'id');
            $done = count(array_intersect($ids, array_unique(array_column($attempts, 'id'))));
            $progress = $ids ? intdiv(100 * $done, count($ids)) : 0;
            foreach ($history as $h) {
                if ((int) ($h['final'] ?? 0) === (int) $payload['lesson']) {
                    $submittedAt = (int) $h['at'];
                    $score = (int) ($h['correct'] ?? 0).'/'.(int) ($h['graded'] ?? 0);
                }
            }
            if ($submittedAt) {
                $progress = 100;
            }
        } elseif ($row->kind === 'exam') {
            foreach ($history as $h) {
                if (($h['examCode'] ?? null) === $payload['paper']) {
                    $submittedAt = (int) $h['at'];
                    $sections = $h['sections'] ?? [];
                    $points = array_sum(array_map(fn ($s) => (int) ($s['graded'] ?? $s['total'] ?? 0) ? intdiv(100 * (int) ($s['correct'] ?? 0), (int) ($s['graded'] ?? $s['total'])) : 0, $sections));
                    $score = $points.'/'.(count($sections) * 100);
                    break;
                }
            }
            $opened = array_filter($state['views']['examPages'] ?? [], fn ($at, $key) => str_starts_with((string) $key, $payload['paper'].':') && (int) $at >= $since, ARRAY_FILTER_USE_BOTH);
            $progress = $submittedAt ? 100 : ($opened ? 10 : 0);
        } else {
            $ids = $payload['ids'] ?? [];
            $latest = [];
            foreach ($attempts as $a) {
                if (in_array($a['id'], $ids, true)) {
                    $latest[$a['id']] = $a;
                }
            }
            $progress = $ids ? intdiv(100 * count($latest), count($ids)) : 0;
            if ($ids && count($latest) === count($ids)) {
                $submittedAt = max(array_map(fn ($a) => (int) $a['at'], $latest));
                $score = count(array_filter($latest, fn ($a) => ($a['grade'] ?? null) === true)).'/'.count($ids);
            }
        }

        $key = $submittedAt ? ($submittedAt <= $due ? 'done' : 'late_done') : ($now > $due ? 'late' : ($progress > 0 ? 'doing' : 'none'));

        return ['status' => $key, 'progress' => $progress, 'score' => $score, 'submittedAt' => $submittedAt];
    }

    /** Dữ liệu một bài giao cho trang quản trị (kèm trạng thái từng học viên). */
    public function present(object $row, bool $withPeople, int $now): array
    {
        $people = [];
        $done = 0;
        foreach ($this->targets((int) $row->id) as $email) {
            $status = $this->status($row, $this->learning->state($email, (int) $row->level), $now);
            $done += in_array($status['status'], ['done', 'late_done'], true) ? 1 : 0;
            $people[] = ['email' => $email] + $status;
        }

        return [
            'id' => (int) $row->id, 'title' => $row->title, 'level' => (int) $row->level, 'kind' => $row->kind,
            'payload' => json_decode($row->payload, true), 'what' => $this->describe($row), 'note' => $row->note,
            'dueAt' => (int) $row->due_at, 'remind' => (bool) $row->remind, 'closed' => (bool) $row->closed,
            'createdBy' => $row->created_by, 'createdAt' => (int) $row->created_at,
            'targets' => count($people), 'done' => $done,
        ] + ($withPeople ? ['people' => $people] : []);
    }

    /** Bài giao của một học viên (mọi khóa). */
    public function forLearner(string $email, int $now): array
    {
        $states = $this->learning->states($email);

        return $this->rows($email)->map(fn ($row) => [
            'id' => (int) $row->id, 'title' => $row->title, 'level' => (int) $row->level, 'kind' => $row->kind,
            'payload' => json_decode($row->payload, true), 'what' => $this->describe($row), 'note' => $row->note,
            'dueAt' => (int) $row->due_at, 'closed' => (bool) $row->closed, 'createdBy' => $row->created_by, 'createdAt' => (int) $row->created_at,
        ] + $this->status($row, $states[(int) $row->level] ?? [], $now))->values()->all();
    }
}
