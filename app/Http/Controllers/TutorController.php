<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\WorkersAi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

final class TutorController
{
    private const MODES = [
        'explain' => 'Giải thích ngữ pháp, từ vựng và cách dùng với một hoặc hai ví dụ.',
        'correct' => 'Sửa câu người học đưa ra, giải thích lỗi và gợi ý cách nói tự nhiên.',
        'dialogue' => 'Luyện hội thoại tiếng Trung theo chủ đề đã chọn. Hỏi một câu mỗi lượt.',
    ];

    private const COURSES = [
        1 => 'HSK 1', 2 => 'HSK 2', 3 => 'HSK 3', 4 => 'HSK 4',
        31 => 'HSK 1 bản 3.0', 32 => 'HSK 2 bản 3.0',
        41 => 'Tiếng Trung công xưởng', 42 => 'Tiếng Trung văn phòng',
    ];

    public function __construct(private readonly Access $access, private readonly WorkersAi $ai) {}

    private function viewer(Request $request): array
    {
        $viewer = $this->access->identity($request);
        abort_if(!$viewer, 401, 'Bạn cần xác thực email còn quyền truy cập.');

        return $viewer;
    }

    private function conversations(array $viewer)
    {
        return DB::table('ai_conversations')->where('owner', $this->access->email($viewer['email']));
    }

    private function turns(string $id)
    {
        return DB::table('ai_chat_turns')->where('conversation_id', $id)->orderByDesc('id');
    }

    private function conversationData(object $row): array
    {
        return ['id' => $row->id, 'title' => $row->title, 'updatedAt' => (int) $row->updated_at];
    }

    public function history(Request $request): JsonResponse
    {
        $query = $this->conversations($this->viewer($request));
        $input = $request->validate([
            'id' => 'nullable|uuid',
            'offset' => 'sometimes|integer|min:0',
            'before' => 'sometimes|integer|min:1',
        ]);

        if (!isset($input['id'])) {
            $rows = $query->orderByDesc('updated_at')->orderByDesc('id')
                ->offset((int) ($input['offset'] ?? 0))->limit(31)->get();

            return $this->json(['conversations' => $rows->take(30)->map($this->conversationData(...)), 'hasMore' => $rows->count() > 30]);
        }

        $row = $query->where('id', $input['id'])->first();
        abort_unless($row, 404, 'Không tìm thấy cuộc trò chuyện.');
        $turns = $this->turns($row->id);
        if (isset($input['before'])) {
            $turns->where('id', '<', $input['before']);
        }
        $rows = $turns->limit(41)->get(['id', 'question', 'answer']);

        return $this->json(['conversation' => $this->conversationData($row), 'turns' => $rows->take(40)->reverse()->values(), 'hasMore' => $rows->count() > 40]);
    }

    public function chat(Request $request): JsonResponse
    {
        $viewer = $this->viewer($request);
        abort_unless(WorkersAi::ready(), 503, 'Trợ giảng AI chưa được kết nối.');
        $input = $request->validate([
            'message' => 'required|string|max:500',
            'id' => 'nullable|uuid',
            'mode' => ['required', Rule::in(array_keys(self::MODES))],
            'course' => 'nullable|integer|required_with:lesson',
            'lesson' => 'nullable|integer|min:1',
        ], [
            'message.required' => 'Nhập câu hỏi từ 1 đến 500 ký tự.',
            'message.max' => 'Nhập câu hỏi từ 1 đến 500 ký tự.',
        ]);

        $question = trim($input['message']);
        abort_if($question === '', 422, 'Nhập câu hỏi từ 1 đến 500 ký tự.');
        $context = $this->context($viewer, $input);
        $query = $this->conversations($viewer);
        $id = $input['id'] ?? null;
        $conversation = $id === null ? null : (clone $query)->where('id', $id)->first();
        abort_if($id !== null && !$conversation, 404, 'Không tìm thấy cuộc trò chuyện.');

        $messages = [[
            'role' => 'system',
            'content' => 'Bạn là trợ giảng tiếng Trung FangSchool. '.self::MODES[$input['mode']]
                .' Viết ngắn gọn bằng tiếng Việt, kèm chữ Hán và pinyin có dấu khi phù hợp.'
                .' Dùng văn bản thuần, chia đoạn. Nếu chưa chắc về học liệu, nói rõ. Ngữ cảnh: '.$context,
        ]];
        if ($conversation) {
            foreach ($this->turns($conversation->id)->limit(2)->get()->reverse() as $turn) {
                $messages[] = ['role' => 'user', 'content' => $turn->question];
                $messages[] = ['role' => 'assistant', 'content' => mb_substr($turn->answer, 0, 1600)];
            }
        }

        $messages[] = ['role' => 'user', 'content' => $question];
        try {
            $answer = $this->ai->answer($messages);
        } catch (HttpExceptionInterface $exception) {
            return $this->json(['error' => $exception->getMessage()], $exception->getStatusCode());
        }

        $row = DB::transaction(function () use ($query, $id, $viewer, $question, $answer) {
            $now = now()->getTimestampMs();
            if ($id === null) {
                $id = (string) Str::uuid();
                DB::table('ai_conversations')->insert([
                    'id' => $id, 'owner' => $this->access->email($viewer['email']),
                    'title' => mb_substr(preg_replace('/\s+/u', ' ', $question), 0, 72),
                    'updated_at' => $now,
                ]);
            } else {
                (clone $query)->where('id', $id)->where('updated_at', '<', $now)->update(['updated_at' => $now]);
            }
            $turnId = DB::table('ai_chat_turns')->insertGetId([
                'conversation_id' => $id, 'question' => $question, 'answer' => $answer,
            ]);

            return ['conversation' => $this->conversationData($query->where('id', $id)->first()),
                'turn' => ['id' => $turnId, 'question' => $question, 'answer' => $answer]];
        });

        return $this->json($row);
    }

    private function context(array $viewer, array $input): string
    {
        if (!isset($input['course'])) {
            return 'Hỏi tự do.';
        }

        $course = (int) $input['course'];
        abort_unless(isset(self::COURSES[$course]) && $this->access->canStudy($viewer, $course), 403, 'Bạn chưa có quyền học khóa này.');
        if (!isset($input['lesson'])) {
            return 'Đang học '.self::COURSES[$course].'.';
        }

        $path = storage_path('app/private/fangschool/learning/'.$course.'.json');
        abort_unless(is_readable($path), 503, 'Chưa tải được học liệu.');
        $catalog = json_decode(file_get_contents($path), true);
        foreach ($catalog['lessons'] ?? [] as $lesson) {
            if ((int) $lesson['n'] !== (int) $input['lesson']) {
                continue;
            }
            $examples = collect($lesson['questions'] ?? [])->filter(fn ($item) => !empty($item['zh']))->take(4)
                ->map(fn ($item) => [
                    'zh' => mb_substr($item['zh'], 0, 150),
                    'pinyin' => mb_substr($item['pinyin'] ?? '', 0, 150),
                    'vi' => mb_substr($item['vi'] ?? '', 0, 180),
                ])->values()->all();

            return json_encode([
                'course' => self::COURSES[$course], 'lesson' => $lesson['n'],
                'title' => $lesson['zh'].' · '.$lesson['vi'], 'examples' => $examples,
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        }

        abort(404, 'Không tìm thấy bài trong học liệu.');
    }

    private function json(array $data, int $status = 200): JsonResponse
    {
        return response()->json($data, $status)->header('Cache-Control', 'private, no-store');
    }
}
