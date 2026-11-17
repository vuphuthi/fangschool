<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\DB;

final class Access
{
    public const COOKIE = 'fangschool_access';
    public const DAY = 86_400_000;
    public const TTL = 365 * self::DAY;

    public function email(mixed $value): string
    {
        return is_string($value) ? strtolower(trim($value)) : '';
    }

    public function validEmail(string $email): bool
    {
        return strlen($email) <= 254 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public function admins(): array
    {
        $emails = array_map($this->email(...), explode(',', config('fangschool.admin_emails') ?? ''));

        return array_filter($emails, $this->validEmail(...));
    }

    public function ready(): bool
    {
        return $this->admins() !== [] && config('app.key') && config('fangschool.mail_from') && config('fangschool.resend_key');
    }

    public function grant(string $email, int $now): ?object
    {
        return DB::table('grants')->where('email', $email)->where('revoked', false)->where('expires_at', '>', $now)->first();
    }

    public function identity(Request $request, bool $refresh = false): ?array
    {
        $token = $request->cookie(self::COOKIE);
        if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) {
            return null;
        }

        $now = now()->getTimestampMs();
        $session = DB::table('access_sessions')->where('digest', hash('sha256', $token));
        $record = (clone $session)->where('expires_at', '>', $now)->first();
        if (!$record) {
            return null;
        }

        $admin = (bool) $record->admin && in_array($record->email, $this->admins(), true);
        $grant = $admin ? null : $this->grant($record->email, $now);
        if (!$admin && !$grant) {
            return null;
        }

        $expiresAt = (int) $record->expires_at;
        $renewedUntil = $now + self::TTL;
        if ($refresh && $expiresAt < $renewedUntil - self::DAY &&
            $session->where('expires_at', '>', $now)->where('expires_at', '<', $renewedUntil - self::DAY)
                ->update(['expires_at' => $renewedUntil])) {
            $expiresAt = $renewedUntil;
            $this->queueCookie($request, $token);
        }

        return [
            'email' => $record->email,
            'maxLevel' => $admin ? 4 : (int) $grant->max_level,
            'expiresAt' => $admin ? $expiresAt : min($expiresAt, (int) $grant->expires_at),
            'admin' => $admin,
        ];
    }

    public function start(Request $request, string $email, bool $admin, int $now): void
    {
        $this->dropToken($request);
        $token = bin2hex(random_bytes(32));
        DB::table('access_sessions')->insert([
            'digest' => hash('sha256', $token), 'email' => $email, 'admin' => $admin, 'expires_at' => $now + self::TTL,
        ]);
        $request->session()->regenerate();
        $this->queueCookie($request, $token);
    }

    private function queueCookie(Request $request, string $token): void
    {
        Cookie::queue(Cookie::make(
            self::COOKIE, $token, 365 * 1440, '/',
            secure: $request->isSecure() || (bool) config('session.secure'), httpOnly: true, sameSite: 'lax',
        ));
    }

    private function dropToken(Request $request): void
    {
        $token = $request->cookie(self::COOKIE);
        if (is_string($token)) {
            DB::table('access_sessions')->where('digest', hash('sha256', $token))->delete();
        }
    }

    public function logout(Request $request): void
    {
        $this->dropToken($request);
        Cookie::queue(Cookie::forget(self::COOKIE, '/'));
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
