<?php

namespace App\Services;

use App\Http\Controllers\TeachingController;
use Illuminate\Support\Facades\DB;

/** Email tự động: nhắc học hằng ngày, nhắc bài giao sắp hết hạn, báo cáo tuần cho giáo viên và học viên. */
final class Reminders
{
    public function __construct(
        private readonly Access $access,
        private readonly Learning $learning,
        private readonly Assignments $assignments,
        private readonly Mailer $mailer,
        private readonly TeachingController $teaching,
        private readonly WebPush $push,
    ) {}

    private function vnNow(int $now): \DateTimeImmutable
    {
        return (new \DateTimeImmutable('@'.intdiv($now, 1000)))->setTimezone(new \DateTimeZone(Learning::TZ));
    }

    /** Học viên còn quyền học (không gồm quản trị viên). */
    private function learners(int $now): array
    {
        $hsk = DB::table('grants')->where('revoked', false)->where('expires_at', '>', $now)->pluck('email')->all();
        $work = DB::table('workplace_grants')->where('revoked', false)->where('expires_at', '>', $now)->pluck('email')->all();

        return array_values(array_diff(array_unique([...$hsk, ...$work]), $this->access->admins()));
    }

    private function url(string $suffix = ''): string
    {
        return rtrim((string) config('app.url'), '/').'/'.$suffix;
    }

    /** Chạy mỗi giờ. Trả về danh sách [loại, email] đã gửi (hoặc sẽ gửi nếu $dryRun). */
    public function hourly(int $now, bool $dryRun = false): array
    {
        $log = [];
        $hour = (int) $this->vnNow($now)->format('G');
        $today = $this->vnNow($now)->format('Y-m-d');
        $prefs = DB::table('email_prefs')->get()->keyBy('email');
        // Thiết bị đã bật nhắc học là lựa chọn riêng: vẫn nhận thông báo đẩy khi đã tắt email nhắc học.
        $pushUsers = array_flip(DB::table('push_subscriptions')->distinct()->pluck('email')->all());

        foreach ($this->learners($now) as $email) {
            $pref = $prefs[$email] ?? null;
            $wantsEmail = !$pref || $pref->streak;
            if ((!$wantsEmail && !isset($pushUsers[$email])) || ($pref->hour ?? 20) !== $hour) {
                continue;
            }
            if ($pref && $pref->last_reminder_at && Learning::dayKey((int) $pref->last_reminder_at) === $today) {
                continue;
            }
            $states = $this->learning->states($email);
            $days = $this->learning->activity($states);
            if (isset($days[$today])) {
                continue; // hôm nay đã học
            }
            $streak = $this->learning->streakBefore($days, $now);
            $recent = array_filter(array_keys($days), fn ($day) => $day >= $this->vnNow($now)->modify('-14 days')->format('Y-m-d'));
            if (!$recent) {
                continue; // chỉ nhắc học viên đang học gần đây
            }
            $due = $this->learning->dueCards($states, $now);
            $pending = config('fangschool.assignments')
                ? array_filter($this->assignments->forLearner($email, $now), fn ($a) => !$a['closed'] && in_array($a['status'], ['none', 'doing'], true))
                : [];
            $items = [];
            if ($due) {
                $items[] = ['Thẻ từ vựng cần ôn', $due.' thẻ'];
            }
            foreach (array_slice($pending, 0, 3) as $a) {
                $items[] = ['Bài được giao · hạn '.$this->teaching->vnTime($a['dueAt']), $a['title']];
            }
            if (!$streak && !$items) {
                continue;
            }
            $log[] = ['streak', $email];
            if ($dryRun) {
                continue;
            }
            $subject = $streak > 0 ? 'Đừng để mất chuỗi '.$streak.' ngày nhé!' : 'Hôm nay học 10 phút với FangSchool nhé';
            $html = view('emails.reminder', ['subjectLine' => $subject, 'streak' => $streak, 'items' => $items, 'url' => $this->url(), 'prefsUrl' => $this->url('#progress')])->render();
            $text = $subject."\n\n".implode("\n", array_map(fn ($i) => $i[0].': '.$i[1], $items))."\n\nHọc ngay: ".$this->url()."\nĐổi giờ nhắc hoặc tắt email: ".$this->url('#progress');
            // Thông báo đẩy tới các thiết bị đã bật nhắc học, cùng giờ với email.
            $pushed = !isset($pushUsers[$email]) ? 0 : $this->push->sendTo($email, [
                'title' => $subject,
                'body' => $items ? implode(' · ', array_map(fn ($i) => $i[0].': '.$i[1], $items)) : 'Mở FangSchool học 10 phút để giữ nhịp nhé.',
                'url' => '/#today', 'tag' => 'fangschool-daily',
            ]);
            if ($pushed) {
                $log[] = ['push', $email];
            }
            $mailed = $wantsEmail && $this->mailer->send($email, $subject, $html, $text);
            if ($mailed || $pushed) {
                DB::table('email_prefs')->upsert([['email' => $email, 'streak' => true, 'weekly' => (bool) ($pref->weekly ?? false), 'hour' => $pref->hour ?? 20, 'last_reminder_at' => $now]], ['email'], ['last_reminder_at']);
            }
        }

        if (!config('fangschool.assignments')) {
            return $log;
        }

        // Bài giao sắp hết hạn trong 24 giờ: nhắc một lần cho ai chưa nộp.
        foreach (DB::table('assignments')->where('closed', false)->where('remind', true)->where('due_at', '>', $now)->where('due_at', '<=', $now + Access::DAY)->get() as $row) {
            foreach (DB::table('assignment_targets')->where('assignment_id', $row->id)->whereNull('reminded_at')->pluck('email') as $email) {
                $status = $this->assignments->status($row, $this->learning->state($email, (int) $row->level), $now);
                if (in_array($status['status'], ['done', 'late_done'], true)) {
                    continue;
                }
                $log[] = ['assignment', $email];
                if (!$dryRun && $this->teaching->sendAssignmentEmail($row, $email, $status)) {
                    DB::table('assignment_targets')->where('assignment_id', $row->id)->where('email', $email)->update(['reminded_at' => $now]);
                }
            }
        }

        return $log;
    }

    /** Báo cáo tuần cho giáo viên (sáng thứ Hai). */
    public function teacherDigest(int $now, bool $dryRun = false): array
    {
        $end = $this->vnNow($now)->setTime(0, 0);
        $start = $end->modify('-7 days');
        $inWeek = fn (string $day) => $day >= $start->format('Y-m-d') && $day < $end->format('Y-m-d');
        $learners = $this->learners($now);
        $active = 0;
        $answers = 0;
        $correct = 0;
        $graded = 0;
        $attention = [];
        foreach ($learners as $email) {
            $days = $this->learning->activity($this->learning->states($email));
            $week = array_filter($days, $inWeek, ARRAY_FILTER_USE_KEY);
            if ($week) {
                $active++;
            }
            foreach ($week as $day) {
                $answers += $day['answers'] ?? 0;
                $correct += $day['correct'] ?? 0;
                $graded += $day['graded'] ?? 0;
            }
            $last = $days ? max(array_keys($days)) : null;
            if ($last && $last < $this->vnNow($now)->modify('-7 days')->format('Y-m-d')) {
                $gap = (int) ((strtotime($end->format('Y-m-d')) - strtotime($last)) / 86400);
                $attention[] = [$email.' · '.$gap.' ngày không học', 'Nghỉ lâu', '#a43a30'];
            }
        }
        $soon = DB::table('grants')->where('revoked', false)->where('expires_at', '>', $now)->where('expires_at', '<=', $now + 7 * Access::DAY)->count()
            + DB::table('workplace_grants')->where('revoked', false)->where('expires_at', '>', $now)->where('expires_at', '<=', $now + 7 * Access::DAY)->count();
        if ($soon) {
            $attention[] = [$soon.' quyền học hết hạn trong 7 ngày tới', 'Gia hạn', '#7a500d'];
        }
        $assignments = [];
        $open = config('fangschool.assignments')
            ? DB::table('assignments')->where('closed', false)->where('due_at', '>', $start->getTimestamp() * 1000)->orderBy('due_at')->limit(8)->get()
            : [];
        foreach ($open as $row) {
            $item = $this->assignments->present($row, true, $now);
            $late = count(array_filter($item['people'], fn ($p) => $p['status'] === 'late'));
            if ($late) {
                $attention[] = [$late.' học viên quá hạn “'.$row->title.'”', 'Quá hạn', '#a43a30'];
            }
            $assignments[] = $item;
        }
        $range = $start->format('d/m').'–'.$end->modify('-1 day')->format('d/m/Y');
        $subject = 'Báo cáo tuần FangSchool · '.$range;
        $data = ['subjectLine' => $subject, 'range' => $range, 'heading' => 'Báo cáo tuần '.$range, 'active' => $active, 'total' => count($learners),
            'stats' => [[$active.'/'.count($learners), 'Học viên có học'], [number_format($answers, 0, ',', '.'), 'Câu đã trả lời'], [$graded ? round(100 * $correct / $graded).'%' : '—', 'Tỷ lệ đúng']],
            'attention' => array_slice($attention, 0, 10), 'assignments' => $assignments, 'url' => $this->url('admin/progress'), 'cta' => 'Mở trang Tiến độ học viên →',
            'footer' => 'Gửi tự động mỗi sáng thứ Hai tới email quản trị FangSchool.'];
        $sent = [];
        foreach ($this->access->admins() as $admin) {
            $sent[] = ['digest', $admin];
            if (!$dryRun) {
                $this->mailer->send($admin, $subject, view('emails.digest', $data)->render(),
                    $subject."\nHọc viên có học: {$active}/".count($learners)."\nCâu đã trả lời: {$answers}\n\n".$this->url('admin/progress'));
            }
        }

        return $sent;
    }

    /** Tổng kết tuần cho học viên đã bật (sáng Chủ nhật). */
    public function learnerWeekly(int $now, bool $dryRun = false): array
    {
        $end = $this->vnNow($now)->setTime(0, 0);
        $start = $end->modify('-7 days');
        $sent = [];
        foreach (DB::table('email_prefs')->where('weekly', true)->get() as $pref) {
            if (!in_array($pref->email, $this->learners($now), true)) {
                continue;
            }
            $days = array_filter($this->learning->activity($this->learning->states($pref->email)), fn ($d) => $d >= $start->format('Y-m-d') && $d < $end->format('Y-m-d'), ARRAY_FILTER_USE_KEY);
            $minutes = array_sum(array_column($days, 'minutes'));
            $answers = array_sum(array_column($days, 'answers'));
            $graded = array_sum(array_column($days, 'graded'));
            $correct = array_sum(array_column($days, 'correct'));
            $range = $start->format('d/m').'–'.$end->modify('-1 day')->format('d/m');
            $subject = 'Tuần học của bạn · '.$range;
            $sent[] = ['weekly', $pref->email];
            if ($dryRun) {
                continue;
            }
            $data = ['subjectLine' => $subject, 'range' => $range, 'heading' => count($days) ? 'Bạn đã học '.count($days).'/7 ngày tuần qua' : 'Tuần qua bạn chưa học buổi nào',
                'active' => count($days), 'total' => 7,
                'stats' => [[$minutes.' phút', 'Thời gian học'], [$answers.' câu', 'Đã trả lời'], [$graded ? round(100 * $correct / $graded).'%' : '—', 'Tỷ lệ đúng']],
                'attention' => [], 'assignments' => [], 'url' => $this->url(), 'cta' => 'Tiếp tục học →',
                'footer' => 'Bạn nhận email này vì đã bật “Tổng kết tuần”. Tắt trong trang Tiến độ: '.$this->url('#progress')];
            $this->mailer->send($pref->email, $subject, view('emails.digest', $data)->render(), $subject."\n{$minutes} phút · {$answers} câu\n\n".$this->url());
        }

        return $sent;
    }
}
