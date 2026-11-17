<?php

namespace App\Http\Controllers;

use App\Services\Access;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

final class AuthController
{
    public function __construct(private readonly Access $access) {}

    public function requestCode(Request $request): JsonResponse
    {
        if (!$this->access->ready()) {
            return $this->setupError();
        }
        $email = $this->access->email($request->input('email'));
        if (!$this->access->validEmail($email)) {
            return response()->json(['error' => 'Vui lòng nhập email hợp lệ.'], 400);
        }
        $key = 'otp:'.hash('sha256', (string) $request->ip());
        if (!RateLimiter::attempt($key, 30, static fn () => true, 600)) {
            return response()->json(['error' => 'Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.'], 429);
        }
        $now = now()->getTimestampMs();
        if (!in_array($email, $this->access->admins(), true) && !$this->access->hasLearningAccess($email, $now)) {
            return response()->json(['error' => 'Email này chưa có quyền nhận mã OTP. Vui lòng kiểm tra lại email hoặc liên hệ giáo viên FangSchool.'], 403);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $id = bin2hex(random_bytes(32));
        $challenge = [
            'id' => $id, 'signature' => $this->signature($id, $code), 'created_at' => $now,
            'expires_at' => $now + 600_000, 'attempts' => 0, 'used' => false,
        ];
        $challenges = DB::table('otp_challenges');
        $reserved = $challenges->insertOrIgnore(['email' => $email] + $challenge)
            || $challenges->where('email', $email)->where('created_at', '<=', $now - 60_000)->update($challenge);
        if (!$reserved) {
            return response()->json(['message' => 'Mã OTP vừa được yêu cầu. Hãy kiểm tra hộp thư đến hoặc thư rác.']);
        }

        try {
            Http::withToken(config('fangschool.resend_key'))->timeout(10)->acceptJson()
                ->post('https://api.resend.com/emails', [
                    'from' => config('fangschool.mail_from'), 'to' => [$email],
                    'subject' => 'Mã đăng nhập FangSchool', 'html' => view('otp', ['code' => $code])->render(),
                    'text' => "Mã đăng nhập FangSchool\n\n{$code}\n\nMã có hiệu lực trong 10 phút. Vui lòng giữ mã riêng tư. Nếu bạn không yêu cầu mã, hãy bỏ qua email này.",
                ])->throw();
        } catch (\Exception) {
            DB::table('otp_challenges')->where('email', $email)->where('id', $id)->delete();

            return response()->json(['error' => 'Dịch vụ gửi email đang bận. Hãy thử lại sau.'], 503);
        }

        return response()->json(['message' => 'Đã gửi mã OTP. Hãy kiểm tra hộp thư đến hoặc thư rác.']);
    }

    public function verify(Request $request): JsonResponse
    {
        if (!$this->access->ready()) {
            return $this->setupError();
        }

        $invalid = fn () => response()->json(['error' => 'Mã sai, đã hết hạn hoặc email không còn quyền truy cập.'], 401);
        $email = $this->access->email($request->input('email'));
        $code = $request->input('code');
        $now = now()->getTimestampMs();
        if (!$this->access->validEmail($email) || !is_string($code) || !preg_match('/^[0-9]{6}$/D', $code)) {
            return $invalid();
        }
        $admin = in_array($email, $this->access->admins(), true);
        if (!$admin && !$this->access->hasLearningAccess($email, $now)) {
            return $invalid();
        }
        $challenge = DB::table('otp_challenges')->where('email', $email)->first();
        if (!$challenge) {
            return $invalid();
        }

        $matched = hash_equals($challenge->signature, $this->signature($challenge->id, $code));
        $updated = DB::table('otp_challenges')->where('email', $email)->where('id', $challenge->id)
            ->where('used', false)->where('attempts', '<', 5)->where('expires_at', '>', $now)
            ->increment('attempts', 1, ['used' => $matched]);
        if (!$updated || !$matched) {
            return $invalid();
        }

        $this->access->start($request, $email, $admin, $now);

        return response()->json(['admin' => $admin]);
    }

    public function session(Request $request): JsonResponse
    {
        $user = $this->access->identity($request, true);

        return $user ? response()->json($user) : response()->json(['error' => 'Bạn cần xác thực email còn quyền truy cập.'], 401);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->access->logout($request);

        return response()->json(['ok' => true]);
    }

    private function signature(string $id, string $code): string
    {
        return hash_hmac('sha256', $id.':'.$code, config('app.key'));
    }

    private function setupError(): JsonResponse
    {
        return response()->json(['error' => 'Hệ thống xác thực email chưa được cấu hình.'], 503);
    }
}
