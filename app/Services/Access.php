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
    public const TRACKS = ['factory' => 41, 'office' => 42];
    public const COURSE_PATTERN = '(?:[1-4]|3[12]|4[12])';
    private const HSK_COURSES = [1 => 1, 2 => 2, 3 => 3, 4 => 4, 31 => 1, 32 => 2];

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

    public function workplaceGrants(string $email, int $now)
    {
        return DB::table('workplace_grants')->where('email', $email)
            ->where('revoked', false)->where('expires_at', '>', $now)->orderBy('track')->get();
    }

    public function hasLearningAccess(string $email, int $now): bool
    {
        return $this->grant($email, $now) !== null || $this->workplaceGrants($email, $now)->isNotEmpty();
    }

    public function canStudy(array $user, int $course): bool
    {
        $track = array_search($course, self::TRACKS, true);

        return $track !== false ? in_array($track, $user['tracks'], true)
            : isset(self::HSK_COURSES[$course]) && $user['maxLevel'] >= self::HSK_COURSES[$course];
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
        $workplace = $admin ? collect() : $this->workplaceGrants($record->email, $now);
        if (!$admin && !$grant && $workplace->isEmpty()) {
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
            'maxLevel' => $admin ? 4 : (int) ($grant->max_level ?? 0),
            'tracks' => $admin ? array_keys(self::TRACKS) : $workplace->pluck('track')->all(),
            'expiresAt' => $admin ? $expiresAt : min($expiresAt, max((int) ($grant->expires_at ?? 0), (int) $workplace->max('expires_at'))),
            'admin' => $admin,
            'grants' => $admin ? [] : array_values(array_filter([
                $grant ? ['kind' => 'hsk', 'maxLevel' => (int) $grant->max_level, 'expiresAt' => (int) $grant->expires_at] : null,
                ...$workplace->map(fn ($row) => ['kind' => 'track', 'track' => $row->track, 'expiresAt' => (int) $row->expires_at])->all(),
            ])),
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
