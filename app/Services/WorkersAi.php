<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpKernel\Exception\HttpException;

final class WorkersAi
{
    public static function ready(): bool
    {
        return preg_match('/\A[a-f0-9]{32}\z/i', (string) config('fangschool.ai_account_id')) === 1
            && filled(config('fangschool.ai_api_token'));
    }

    public function answer(array $messages): string
    {
        $url = 'https://api.cloudflare.com/client/v4/accounts/'.config('fangschool.ai_account_id')
            .'/ai/run/@cf/qwen/qwen3.8-27b';

        try {
            $response = Http::asJson()->acceptJson()->withToken(config('fangschool.ai_api_token'))
                ->connectTimeout(5)->timeout(30)->post($url, [
                    'messages' => $messages,
                    'reasoning_effort' => 'low',
                    'max_completion_tokens' => 800,
                    'store' => false,
                ]);
        } catch (ConnectionException) {
            throw new HttpException(502, 'Chưa kết nối được Workers AI. Vui lòng thử lại.');
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
        $answer = $response->json('result.choices.0.message.content') ?? $response->json('result.response');
        abort_unless(is_string($answer) && trim($answer) !== '', 502, 'AI chưa trả về câu trả lời. Vui lòng thử lại.');

        return mb_substr(trim($answer), 0, 4000);
    }
}
