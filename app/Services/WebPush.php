<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thông báo đẩy (Web Push) không cần thư viện ngoài:
 * mã hoá nội dung theo RFC 8291 (aes128gcm) và xác thực máy chủ bằng VAPID (RFC 8292, JWT ES256).
 * Khoá VAPID lấy từ FANGSCHOOL_VAPID_PUBLIC/PRIVATE, hoặc tự tạo một lần và lưu ở FANGSCHOOL_VAPID_FILE.
 */
final class WebPush
{
    private const SPKI_PREFIX = '3059301306072a8648ce3d020106082a8648ce3d030107034200';

    /** Chỉ gửi tới máy chủ đẩy của trình duyệt (Chrome/Edge/Firefox/Safari), tránh bị dùng để gọi địa chỉ tuỳ ý. */
    private const PUSH_HOSTS = '/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|([a-z0-9-]+\.)*notify\.windows\.com)$/D';

    private ?array $keys = null;

    public static function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    public static function unb64(string $text): string|false
    {
        return base64_decode(strtr($text, '-_', '+/').str_repeat('=', (4 - strlen($text) % 4) % 4), true);
    }

    /** @return array{public: string, private: string} khoá công khai dạng thô 65 byte, khoá bí mật dạng PEM */
    public function keys(): array
    {
        if ($this->keys) {
            return $this->keys;
        }
        $public = (string) config('fangschool.vapid_public');
        $private = (string) config('fangschool.vapid_private');
        if ($public !== '' && $private !== '') {
            return $this->keys = ['public' => (string) self::unb64($public), 'private' => str_replace('\n', "\n", $private)];
        }
        $file = (string) config('fangschool.vapid_file');
        $read = fn () => is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        $stored = $read();
        if (!is_array($stored) || !isset($stored['public'], $stored['private'])) {
            // Tạo khoá dưới khoá file độc quyền: hai yêu cầu (hoặc app và scheduler) cùng lúc vẫn dùng chung một cặp khoá.
            @mkdir(dirname($file), 0750, true);
            $lock = fopen($file.'.lock', 'c');
            flock($lock, LOCK_EX);
            try {
                $stored = $read();
                if (!is_array($stored) || !isset($stored['public'], $stored['private'])) {
                    $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
                    openssl_pkey_export($key, $pem);
                    $stored = ['public' => self::b64($this->rawPublic($key)), 'private' => $pem];
                    $temporary = $file.'.'.bin2hex(random_bytes(4));
                    file_put_contents($temporary, json_encode($stored));
                    @chmod($temporary, 0600);
                    rename($temporary, $file);
                }
            } finally {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
        }

        return $this->keys = ['public' => (string) self::unb64($stored['public']), 'private' => $stored['private']];
    }

    public function publicKey(): string
    {
        return self::b64($this->keys()['public']);
    }

    private function rawPublic($key): string
    {
        $ec = openssl_pkey_get_details($key)['ec'];

        return "\x04".str_pad($ec['x'], 32, "\0", STR_PAD_LEFT).str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
    }

    /** Mã hoá nội dung cho một thiết bị (RFC 8291). */
    public function encrypt(string $payload, string $userPublic, string $authSecret): string
    {
        $local = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $localPublic = $this->rawPublic($local);
        $peer = openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n"
            .chunk_split(base64_encode(hex2bin(self::SPKI_PREFIX).$userPublic), 64, "\n")."-----END PUBLIC KEY-----\n");
        $shared = openssl_pkey_derive($peer, $local, 32);
        if ($shared === false) {
            throw new \RuntimeException('Khoá thiết bị không hợp lệ.');
        }
        $hmac = fn (string $key, string $data) => hash_hmac('sha256', $data, $key, true);
        $prkKey = $hmac($authSecret, $shared);
        $ikm = $hmac($prkKey, "WebPush: info\0".$userPublic.$localPublic."\x01");
        $salt = random_bytes(16);
        $prk = $hmac($salt, $ikm);
        $cek = substr($hmac($prk, "Content-Encoding: aes128gcm\0\x01"), 0, 16);
        $nonce = substr($hmac($prk, "Content-Encoding: nonce\0\x01"), 0, 12);
        $cipher = openssl_encrypt($payload."\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);

        return $salt.pack('N', 4096).chr(65).$localPublic.$cipher.$tag;
    }

    /** JWT VAPID ký bằng ES256 cho máy chủ đẩy của trình duyệt. */
    public function vapid(string $endpoint): string
    {
        $parts = parse_url($endpoint);
        $audience = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
        $app = (string) config('app.url');
        preg_match('/[^<\s]+@[^>\s]+/', (string) config('fangschool.mail_from'), $mail);
        $subject = str_starts_with($app, 'https://') ? $app : 'mailto:'.($mail[0] ?? 'otp@mail.fangschool.site');
        $data = self::b64(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])).'.'
            .self::b64(json_encode(['aud' => $audience, 'exp' => time() + 12 * 3600, 'sub' => $subject], JSON_UNESCAPED_SLASHES));
        openssl_sign($data, $der, $this->keys()['private'], OPENSSL_ALGO_SHA256);

        return 'vapid t='.$data.'.'.self::b64($this->derToRaw($der)).', k='.$this->publicKey();
    }

    /** Chữ ký ECDSA dạng DER → r||s 64 byte theo JWS. */
    private function derToRaw(string $der): string
    {
        $offset = 2 + (ord($der[1]) & 0x80 ? ord($der[1]) & 0x7f : 0);
        $read = function () use ($der, &$offset): string {
            $length = ord($der[$offset + 1]);
            $value = substr($der, $offset + 2, $length);
            $offset += 2 + $length;

            return str_pad(ltrim($value, "\0"), 32, "\0", STR_PAD_LEFT);
        };

        return $read().$read();
    }

    public function validSubscription(mixed $endpoint, mixed $p256dh, mixed $auth): bool
    {
        if (!is_string($endpoint) || strlen($endpoint) > 1000 || !str_starts_with($endpoint, 'https://')
            || filter_var($endpoint, FILTER_VALIDATE_URL) === false || !is_string($p256dh) || !is_string($auth)
            || isset(parse_url($endpoint)['port']) || isset(parse_url($endpoint)['user'])
            || !preg_match(self::PUSH_HOSTS, strtolower((string) parse_url($endpoint, PHP_URL_HOST)))) {
            return false;
        }
        $key = self::unb64($p256dh);
        $secret = self::unb64($auth);

        return $key !== false && strlen($key) === 65 && $key[0] === "\x04" && $secret !== false && strlen($secret) === 16;
    }

    /** Gửi tới mọi thiết bị của một email. Thiết bị đã huỷ đăng ký (404/410) được xoá. Trả về số thiết bị nhận. */
    public function sendTo(string $email, array $message): int
    {
        $sent = 0;
        $payload = json_encode($message, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        foreach (DB::table('push_subscriptions')->where('email', $email)->get() as $row) {
            if (!$this->validSubscription($row->endpoint, $row->p256dh, $row->auth)) {
                DB::table('push_subscriptions')->where('id', $row->id)->delete();
                continue;
            }
            try {
                $body = $this->encrypt($payload, (string) self::unb64($row->p256dh), (string) self::unb64($row->auth));
                $response = Http::withHeaders([
                    'Authorization' => $this->vapid($row->endpoint), 'Content-Encoding' => 'aes128gcm',
                    'TTL' => '43200', 'Urgency' => 'normal',
                ])->withOptions(['allow_redirects' => false])->withBody($body, 'application/octet-stream')->timeout(10)->post($row->endpoint);
            } catch (\Throwable $error) {
                Log::warning('Không gửi được thông báo đẩy: '.$error->getMessage());
                continue;
            }
            // 404/410: thiết bị đã huỷ đăng ký. 401/403: đăng ký theo khoá VAPID khác, không bao giờ gửi được nữa.
            if (in_array($response->status(), [401, 403, 404, 410], true)) {
                DB::table('push_subscriptions')->where('id', $row->id)->delete();
            } elseif ($response->successful()) {
                DB::table('push_subscriptions')->where('id', $row->id)->update(['last_sent_at' => now()->getTimestampMs()]);
                $sent++;
            } else {
                Log::warning('Máy chủ đẩy từ chối thông báo', ['status' => $response->status(), 'body' => mb_substr($response->body(), 0, 300)]);
            }
        }

        return $sent;
    }
}
