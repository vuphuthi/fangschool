<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class WorkersAi
{
    private const CHAT_MODEL = '@cf/qwen/qwen3.8-27b';
    private const SPEECH_MODEL = '@cf/myshell-ai/melotts';
    private const LISTEN_MODEL = '@cf/openai/whisper-large-v3-turbo';

    public static function ready(): bool
    {
        return preg_match('/\A[a-f0-9]{32}\z/i', (string) config('fangschool.ai_account_id')) === 1
            && filled(config('fangschool.ai_api_token'));
    }

    /**
     * $think = false tắt phần "suy nghĩ" của model: nhanh hơn và tốn khoảng 1/3 hạn mức,
     * hợp với việc ngắn, có khuôn trả lời rõ như chấm bài.
     * $temperature thấp (≈0.1) cho kết quả ổn định giữa các lần gọi, cần cho việc chấm điểm.
     */
    public function answer(array $messages, bool $think = true, int $maxTokens = 800, ?float $temperature = null): string
    {
        $response = $this->run(self::CHAT_MODEL, [
            'messages' => $messages,
            'max_completion_tokens' => $maxTokens,
            'store' => false,
        ] + ($think ? ['reasoning_effort' => 'low'] : ['chat_template_kwargs' => ['enable_thinking' => false]])
          + ($temperature === null ? [] : ['temperature' => $temperature]));
        $answer = $response->json('result.choices.0.message.content') ?? $response->json('result.response');
        abort_unless(is_string($answer) && trim($answer) !== '', 502, 'AI chưa trả về câu trả lời. Vui lòng thử lại.');

        return mb_substr(trim($answer), 0, 4000);
    }

    /** Đọc một câu tiếng Trung, trả về âm thanh WAV. */
    public function speech(string $text): string
    {
        $response = $this->run(self::SPEECH_MODEL, ['prompt' => $text, 'lang' => 'zh']);
        $audio = str_starts_with((string) $response->header('Content-Type'), 'audio/')
            ? $response->body()
            : base64_decode((string) $response->json('result.audio'), true);
        abort_unless(is_string($audio) && strlen($audio) > 44, 502, 'Chưa tạo được giọng đọc. Vui lòng thử lại.');

        return $audio;
    }

    /** Nhận dạng giọng nói tiếng Trung từ bản ghi của trình duyệt (webm, mp4, ogg, wav). */
    public function transcribe(string $audio): string
    {
        // Gợi ý câu giản thể để Whisper trả về chữ giản thể (học liệu và chấm phát âm đều dùng giản thể).
        $response = $this->run(self::LISTEN_MODEL, ['audio' => base64_encode($audio), 'language' => 'zh', 'task' => 'transcribe',
            'initial_prompt' => '以下是普通话的句子，使用简体中文。']);

        return trim((string) $response->json('result.text'));
    }

    private function run(string $model, array $payload): Response
    {
        $url = 'https://api.cloudflare.com/client/v4/accounts/'.config('fangschool.ai_account_id').'/ai/run/'.$model;

        // Cloudflare thỉnh thoảng trả lỗi 5xx tạm thời: thử lại một lần sau 1 giây trước khi báo lỗi.
        for ($attempt = 1; ; $attempt++) {
            try {
                $response = Http::asJson()->acceptJson()->withToken(config('fangschool.ai_api_token'))
                    ->connectTimeout(5)->timeout(90)->post($url, $payload);
            } catch (ConnectionException) {
                throw new HttpException(502, 'Chưa kết nối được Workers AI. Vui lòng thử lại.');
            }
            if ($response->serverError() && $attempt === 1) {
                Log::warning('Workers AI lỗi tạm thời, thử lại', ['model' => $model, 'status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
                usleep(1_000_000);
                continue;
            }
            break;
        }
        if (!$response->successful() && $response->status() !== 429) {
            Log::warning('Workers AI từ chối yêu cầu', ['model' => $model, 'status' => $response->status(), 'body' => mb_substr($response->body(), 0, 500)]);
        }

        if ($response->status() === 429) {
            foreach ((array) $response->json('errors', []) as $error) {
                if ((string) ($error['code'] ?? '') === '3036') {
                    throw new HttpException(429, 'Trợ giảng AI đã hết hạn mức Cloudflare hôm nay. Hạn mức được làm mới lúc 07:00 (giờ Việt Nam).');
                }
            }

            throw new HttpException(429, 'Trợ giảng AI đang bận. Vui lòng thử lại sau.');
        }

        abort_unless($response->successful(), 502, 'Cloudflare từ chối yêu cầu. Vui lòng thử lại sau.');

        return $response;
    }
}
