<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\Mailer;
use App\Services\WorkersAi;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

final class AuthController
{
    public function __construct(private readonly Access $access, private readonly Mailer $mailer) {}

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

        // Dựng thư ngoài phần gửi để lỗi mẫu email hiện rõ thay vì bị báo nhầm là "dịch vụ bận".
        $html = view('otp', ['code' => $code, 'email' => $email])->render();
        $text = "Mã đăng nhập FangSchool\n\nMã của bạn: {$code}\n\nMã có hiệu lực 10 phút và chỉ dùng được một lần.\nEmail đăng nhập: {$email}\n\nNếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.\nKhông chia sẻ mã cho bất kỳ ai.\n\nFangSchool";
        if (!$this->mailer->send($email, 'Mã đăng nhập FangSchool', $html, $text)) {
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

        return $user ? response()->json([...$user, 'aiAvailable' => WorkersAi::ready()])->header('Cache-Control', 'private, no-store') : response()->json(['error' => 'Bạn cần xác thực email còn quyền truy cập.'], 401);
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
