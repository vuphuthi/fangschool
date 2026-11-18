<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Câu hỏi giáo viên lưu trên máy chủ: nháp chỉ giáo viên thấy, "live" hiện cho học viên của khóa. */
final class TeacherQuestions
{
    public const STATUSES = ['draft', 'live', 'deleted'];
    private const LEVELS = ['Dễ', 'Trung bình', 'Khó'];

    /** Chuẩn hóa và kiểm tra một câu hỏi. Trả về null nếu không hợp lệ. */
    public function normalize(mixed $input): ?array
    {
        if (!is_array($input)) {
            return null;
        }
        $text = fn ($value, int $max) => is_string($value) && mb_strlen(trim($value)) <= $max ? trim($value) : null;
        $prompt = $text($input['prompt'] ?? null, 2000);
        $kind = $input['kind'] ?? null;
        $level = $input['level'] ?? null;
        if (!$prompt || !is_int($kind) || $kind < 0 || $kind > 5 || !in_array($level, self::LEVELS, true)) {
            return null;
        }
        $question = ['prompt' => $prompt, 'kind' => $kind, 'level' => $level];
        foreach (['zh', 'pinyin', 'vi', 'explanation', 'reference', 'audio'] as $field) {
            $value = $text($input[$field] ?? '', 2000);
            if ($value === null) {
                return null;
            }
            if ($value !== '') {
                $question[$field] = $value;
            }
        }
        foreach (['options', 'answers'] as $field) {
            $list = $input[$field] ?? [];
            if (!is_array($list) || count($list) > 8) {
                return null;
            }
            $clean = [];
            foreach ($list as $item) {
                $value = $text($item, 500);
                if ($value === null) {
                    return null;
                }
                if ($value !== '') {
                    $clean[] = $value;
                }
            }
            if ($clean) {
                $question[$field] = array_values(array_unique($clean));
            }
        }
        if (!empty($question['options']) && (empty($question['answers']) || !array_intersect($question['answers'], $question['options']))) {
            return null;
        }
        if (isset($input['slide']) && is_int($input['slide']) && $input['slide'] > 0 && $input['slide'] < 1000) {
            $question['slide'] = $input['slide'];
        }

        return $question;
    }

    public function validId(mixed $id): bool
    {
        return is_string($id) && preg_match('/^[a-z0-9-]{1,100}$/iD', $id) === 1;
    }

    public function forTeacher(int $level): array
    {
        $rows = DB::table('teacher_questions')->where('level', $level)->where('status', '!=', 'deleted')->orderByDesc('updated_at')->get();
        $history = DB::table('teacher_question_history')->whereIn('question_id', $rows->pluck('id'))->orderByDesc('at')->get()->groupBy('question_id');

        return $rows->map(fn ($row) => [
            'id' => $row->id, 'lesson' => (int) $row->lesson, 'status' => $row->status, 'updatedBy' => $row->updated_by,
            'createdAt' => (int) $row->created_at, 'updatedAt' => (int) $row->updated_at,
            'question' => json_decode($row->data, true),
            'history' => ($history[$row->id] ?? collect())->take(8)->map(fn ($h) => [
                'id' => (int) $h->id, 'action' => $h->action, 'status' => $h->status, 'actor' => $h->actor, 'at' => (int) $h->at,
            ])->values()->all(),
        ])->values()->all();
    }

    /** Câu đã xuất bản, đúng định dạng câu hỏi trong app (origin "teacher"). */
    public function live(int $level): array
    {
        return DB::table('teacher_questions')->where('level', $level)->where('status', 'live')->orderBy('created_at')->get()
            ->map(fn ($row) => ['id' => $row->id, 'lesson' => (int) $row->lesson] + json_decode($row->data, true))->values()->all();
    }

    public function save(int $level, ?string $id, int $lesson, array $question, string $status, string $actor, string $action = 'save'): string
    {
        $now = now()->getTimestampMs();
        $id ??= 'gv-'.$level.'-'.bin2hex(random_bytes(6));
        $data = json_encode($question, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        DB::transaction(function () use ($level, $id, $lesson, $data, $status, $actor, $action, $now): void {
            $existing = DB::table('teacher_questions')->where('id', $id)->first();
            if ($existing) {
                DB::table('teacher_questions')->where('id', $id)->update(['lesson' => $lesson, 'data' => $data, 'status' => $status, 'updated_by' => $actor, 'updated_at' => $now]);
            } else {
                DB::table('teacher_questions')->insert(['id' => $id, 'level' => $level, 'lesson' => $lesson, 'data' => $data, 'status' => $status, 'updated_by' => $actor, 'created_at' => $now, 'updated_at' => $now]);
            }
            DB::table('teacher_question_history')->insert([
                'question_id' => $id, 'action' => $existing ? $action : 'create', 'status' => $status, 'data' => $data, 'actor' => $actor, 'at' => $now,
            ]);
        });

        return $id;
    }

    /** Khôi phục nội dung từ một mốc lịch sử (giữ trạng thái hiện tại). */
    public function restore(int $level, string $id, int $historyId, string $actor): bool
    {
        $row = DB::table('teacher_questions')->where('id', $id)->where('level', $level)->first();
        $old = DB::table('teacher_question_history')->where('id', $historyId)->where('question_id', $id)->first();
        if (!$row || !$old) {
            return false;
        }
        $this->save($level, $id, (int) $row->lesson, json_decode($old->data, true), $row->status, $actor, 'restore');

        return true;
    }
}
