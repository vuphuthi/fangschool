<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Đọc học liệu của khóa và tiến độ học viên (dùng chung cho bài giao, nhắc học, báo cáo tuần). */
final class Learning
{
    public const COURSES = [1 => 'HSK 1', 2 => 'HSK 2', 3 => 'HSK 3', 4 => 'HSK 4', 31 => 'HSK 1 bản 3.0', 32 => 'HSK 2 bản 3.0', 41 => 'Công xưởng', 42 => 'Văn phòng'];
    public const TZ = 'Asia/Ho_Chi_Minh';

    private array $catalogs = [];

    public function catalog(int $level): ?array
    {
        if (!array_key_exists($level, $this->catalogs)) {
            $path = storage_path('app/private/fangschool/learning/'.$level.'.json');
            $this->catalogs[$level] = is_file($path) ? json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR) : null;
        }

        return $this->catalogs[$level];
    }

    public function lesson(int $level, int $n): ?array
    {
        foreach ($this->catalog($level)['lessons'] ?? [] as $lesson) {
            if ((int) ($lesson['n'] ?? 0) === $n) {
                return $lesson;
            }
        }

        return null;
    }

    public function paper(int $level, string $id): ?array
    {
        foreach ($this->catalog($level)['examCatalog']['papers'] ?? [] as $paper) {
            if (($paper['id'] ?? null) === $id) {
                return $paper;
            }
        }

        return null;
    }

    /** Ảnh chụp tiến độ của một học viên ở một khóa (mảng rỗng nếu chưa có). */
    public function state(string $email, int $level): array
    {
        $raw = DB::table('learner_progress')->where('email', $email)->where('level', $level)->value('snapshot');

        return $raw ? (json_decode($raw, true) ?: []) : [];
    }

    /** Mọi ảnh chụp tiến độ của học viên, theo khóa. */
    public function states(string $email): array
    {
        $states = [];
        foreach (DB::table('learner_progress')->where('email', $email)->get(['level', 'snapshot']) as $row) {
            $states[(int) $row->level] = json_decode($row->snapshot, true) ?: [];
        }

        return $states;
    }

    public static function dayKey(int $ms): string
    {
        return (new \DateTimeImmutable('@'.intdiv($ms, 1000)))->setTimezone(new \DateTimeZone(self::TZ))->format('Y-m-d');
    }

    /** Hoạt động theo ngày (phút học + số câu trả lời) gộp từ mọi khóa. */
    public function activity(array $states): array
    {
        $days = [];
        foreach ($states as $state) {
            foreach ($state['study']['days'] ?? [] as $day => $minutes) {
                if (is_int($minutes) && $minutes > 0) {
                    $days[$day]['minutes'] = ($days[$day]['minutes'] ?? 0) + $minutes;
                }
            }
            foreach ($state['attempts'] ?? [] as $attempt) {
                if (is_int($attempt['at'] ?? null)) {
                    $day = self::dayKey($attempt['at']);
                    $days[$day]['answers'] = ($days[$day]['answers'] ?? 0) + 1;
                    if (($attempt['grade'] ?? null) === true) {
                        $days[$day]['correct'] = ($days[$day]['correct'] ?? 0) + 1;
                    }
                    if (is_bool($attempt['grade'] ?? null)) {
                        $days[$day]['graded'] = ($days[$day]['graded'] ?? 0) + 1;
                    }
                }
            }
        }

        return $days;
    }

    /** Chuỗi ngày học liên tiếp tính đến hôm qua (không tính hôm nay). */
    public function streakBefore(array $days, int $now): int
    {
        $cursor = (new \DateTimeImmutable('@'.intdiv($now, 1000)))->setTimezone(new \DateTimeZone(self::TZ))->modify('-1 day');
        $count = 0;
        while (isset($days[$cursor->format('Y-m-d')])) {
            $count++;
            $cursor = $cursor->modify('-1 day');
        }

        return $count;
    }

    /** Số thẻ từ vựng đến hạn ôn hôm nay (lặp lại ngắt quãng) cộng từ đánh dấu chưa thuộc. */
    public function dueCards(array $states, int $now): int
    {
        $end = (new \DateTimeImmutable('@'.intdiv($now, 1000)))->setTimezone(new \DateTimeZone(self::TZ))->setTime(23, 59, 59)->getTimestamp() * 1000;
        $count = 0;
        foreach ($states as $state) {
            foreach ($state['study']['srs'] ?? [] as $card) {
                // Câu sai đã làm đúng ở 2 ngày khác nhau thì không còn cần ôn.
                if (($card['hits'] ?? 0) >= 2) {
                    continue;
                }
                if (is_int($card['due'] ?? null) && $card['due'] <= $end) {
                    $count++;
                }
            }
            foreach ($state['words'] ?? [] as $id => $word) {
                if ($word === 'unknown' && !isset($state['study']['srs'][$id])) {
                    $count++;
                }
            }
        }

        return $count;
    }
}
