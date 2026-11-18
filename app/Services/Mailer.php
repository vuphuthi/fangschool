<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** Gửi email qua Resend (dùng chung cho mã đăng nhập, nhắc học và báo cáo tuần). */
final class Mailer
{
    public function ready(): bool
    {
        return (bool) config('fangschool.resend_key') && (bool) config('fangschool.mail_from');
    }

    /** Trả về true nếu Resend nhận thư. Không ném lỗi; lỗi được ghi log (không kèm nội dung thư). */
    public function send(string $to, string $subject, string $html, string $text): bool
    {
        if (!$this->ready()) {
            return false;
        }
        try {
            Http::withToken(config('fangschool.resend_key'))->timeout(10)->acceptJson()
                ->post('https://api.resend.com/emails', [
                    'from' => config('fangschool.mail_from'), 'to' => [$to],
                    'subject' => $subject, 'html' => $html, 'text' => $text,
                ])->throw();

            return true;
        } catch (\Throwable $error) {
            Log::warning('Không gửi được email "'.$subject.'": '.$error->getMessage());

            return false;
        }
    }
}
