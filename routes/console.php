<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Schedule::call(function (): void {
    $now = now()->getTimestampMs();
    DB::table('access_sessions')->where('expires_at', '<=', $now)->delete();
    DB::table('otp_challenges')->where('expires_at', '<=', $now)->delete();
})->daily()->name('prune-fangschool-expired-auth');

Illuminate\Support\Facades\Artisan::command('fangschool:import-site-data {file : Đường dẫn bản sao SQLite của FangSchool Site}', function (): int {
    $path = realpath($this->argument('file'));
    if ($path === false || !is_file($path) || !is_readable($path)) {
        $this->error('Không đọc được tệp SQLite.');

        return 1;
    }

    $sources = [
        'grants' => ['grants', ['email', 'max_level', 'expires_at', 'revoked']],
        'workplace_grants' => ['workplace_grants', ['email', 'track', 'expires_at', 'revoked']],
        'learner_progress' => ['learner_progress', ['email', 'level', 'snapshot', 'revision']],
        'learner_progress_hsk4' => ['learner_progress', ['email', 'level', 'snapshot', 'revision']],
        'learner_progress_hsk30' => ['learner_progress', ['email', 'level', 'snapshot', 'revision']],
        'learner_progress_workplace' => ['learner_progress', ['email', 'level', 'snapshot', 'revision']],
    ];

    try {
        $source = new PDO('sqlite:'.$path, options: [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $source->exec('PRAGMA query_only = ON');
        $summary = DB::transaction(function () use ($source, $sources): array {
            $counts = [];
            foreach ($sources as $table => [$destination, $columns]) {
                $query = $source->query('SELECT '.implode(', ', $columns).' FROM '.$table);
                $read = 0;
                $imported = 0;
                while (($row = $query->fetch(PDO::FETCH_ASSOC)) !== false) {
                    if (array_key_exists('snapshot', $row) &&
                        !is_object(json_decode($row['snapshot'], flags: JSON_THROW_ON_ERROR))) {
                        throw new UnexpectedValueException('Tiến độ không hợp lệ trong '.$table.'.');
                    }
                    $read++;
                    $imported += DB::table($destination)->insertOrIgnore($row);
                }
                $counts[$table] = [$read, $imported];
            }

            return $counts;
        });
    } catch (Throwable $error) {
        $this->error('Không nhập được dữ liệu. Kiểm tra bản sao SQLite và chạy migration trước khi thử lại.');

        return 1;
    }

    foreach ($summary as $table => [$read, $imported]) {
        $this->line($table.': thêm '.$imported.'/'.$read.', trùng khóa '.($read - $imported).'.');
    }

    return 0;
})->purpose('Nhập quyền truy cập và tiến độ từ bản xuất FangSchool Site');

// ----- Email nhắc học & báo cáo tuần -----
$reportEmails = function ($command, array $log): int {
    foreach ($log as [$kind, $email]) {
        $command->line($kind.': '.$email);
    }
    $command->info(count($log).' email.');

    return 0;
};
Illuminate\Support\Facades\Artisan::command('fangschool:remind {--dry-run : Chỉ liệt kê, không gửi}', function () use ($reportEmails): int {
    return $reportEmails($this, app(App\Services\Reminders::class)->hourly(now()->getTimestampMs(), (bool) $this->option('dry-run')));
})->purpose('Nhắc học viên giữ chuỗi ngày học và nhắc bài giao sắp hết hạn');
Illuminate\Support\Facades\Artisan::command('fangschool:digest {--dry-run : Chỉ liệt kê, không gửi} {--learners : Gửi tổng kết tuần cho học viên thay vì giáo viên}', function () use ($reportEmails): int {
    $reminders = app(App\Services\Reminders::class);
    $now = now()->getTimestampMs();

    return $reportEmails($this, $this->option('learners') ? $reminders->learnerWeekly($now, (bool) $this->option('dry-run')) : $reminders->teacherDigest($now, (bool) $this->option('dry-run')));
})->purpose('Gửi báo cáo tuần cho giáo viên hoặc tổng kết tuần cho học viên');

Schedule::command('fangschool:remind')->hourlyAt(0)->timezone('Asia/Ho_Chi_Minh')->withoutOverlapping()->name('fangschool-remind');
Schedule::command('fangschool:digest')->weeklyOn(1, '07:30')->timezone('Asia/Ho_Chi_Minh')->withoutOverlapping()->name('fangschool-digest');
Schedule::command('fangschool:digest --learners')->weeklyOn(0, '08:00')->timezone('Asia/Ho_Chi_Minh')->withoutOverlapping()->name('fangschool-weekly');
