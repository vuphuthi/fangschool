<?php

namespace App\Http\Controllers;

use App\Services\Access;
use App\Services\WebPush;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

/** Bật/tắt thông báo nhắc học trên từng thiết bị. Giờ nhắc dùng chung với email (email_prefs.hour). */
final class PushController
{
    public function __construct(private readonly Access $access, private readonly WebPush $push) {}

    private function user(Request $request): array
    {
        $user = $this->access->identity($request);
        abort_if(!$user, 401, 'Bạn cần xác thực email còn quyền truy cập.');

        return $user;
    }

    public function key(Request $request): JsonResponse
    {
        $this->user($request);

        return response()->json(['key' => $this->push->publicKey()])->header('Cache-Control', 'private, no-store');
    }

    public function subscribe(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $endpoint = $request->input('endpoint');
        $p256dh = $request->input('keys.p256dh');
        $auth = $request->input('keys.auth');
        if (!$this->push->validSubscription($endpoint, $p256dh, $auth)) {
            return response()->json(['error' => 'Thiết bị chưa đăng ký được thông báo.'], 422);
        }
        DB::table('push_subscriptions')->upsert([[
            'email' => $user['email'], 'endpoint_hash' => hash('sha256', $endpoint), 'endpoint' => $endpoint,
            'p256dh' => $p256dh, 'auth' => $auth, 'created_at' => now()->getTimestampMs(),
        ]], ['endpoint_hash'], ['email', 'p256dh', 'auth']);
        // Giữ tối đa 10 thiết bị mỗi người.
        $keep = DB::table('push_subscriptions')->where('email', $user['email'])->orderByDesc('created_at')->limit(10)->pluck('id');
        DB::table('push_subscriptions')->where('email', $user['email'])->whereNotIn('id', $keep)->delete();

        return response()->json(['ok' => true]);
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $endpoint = $request->input('endpoint');
        if (is_string($endpoint)) {
            DB::table('push_subscriptions')->where('email', $user['email'])->where('endpoint_hash', hash('sha256', $endpoint))->delete();
        }

        return response()->json(['ok' => true]);
    }

    public function test(Request $request): JsonResponse
    {
        $user = $this->user($request);
        $key = 'push-test:'.$user['email'];
        abort_if(RateLimiter::tooManyAttempts($key, 5), 429, 'Bạn thử hơi nhiều, đợi vài phút nhé.');
        RateLimiter::hit($key, 600);
        $sent = $this->push->sendTo($user['email'], [
            'title' => 'FangSchool sẽ nhắc bạn như thế này 👋',
            'body' => 'Đến giờ học: 10 phút ôn thẻ, sửa câu sai và học từ mới.',
            'url' => '/#today',
        ]);

        return response()->json(['sent' => $sent], $sent ? 200 : 502);
    }
}
