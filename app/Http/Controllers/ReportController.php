<?php

namespace App\Http\Controllers;

use App\Services\Access;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;

/** Học viên báo lỗi nội dung; quản trị viên xem và đánh dấu đã xử lý. */
final class ReportController
{
    public const REASONS = ['answer' => 'Sai đáp án', 'pinyin' => 'Sai pinyin', 'translation' => 'Sai bản dịch', 'text' => 'Sai chữ / chính tả', 'audio' => 'Lỗi âm thanh', 'other' => 'Lỗi khác'];

    public function __construct(private readonly Access $access) {}

    public function store(Request $request): JsonResponse
    {
        $user = $this->access->identity($request);
        abort_if(!$user, 401, 'Bạn cần xác thực email còn quyền truy cập.');
        $input = $request->validate([
            'level' => ['required', 'integer', 'regex:/^'.Access::COURSE_PATTERN.'$/'],
            'kind' => ['required', Rule::in(['question', 'dialogue', 'word', 'ai'])],
            'ref' => 'required|string|max:160',
            'reason' => ['required', Rule::in(array_keys(self::REASONS))],
            'note' => 'nullable|string|max:500',
            'context' => 'nullable|string|max:3000',
        ]);
        abort_unless($this->access->canStudy($user, (int) $input['level']), 403, 'Bạn chưa có quyền học khóa này.');
        $email = $this->access->email($user['email']);
        $key = 'content-report:'.$email;
        abort_if(RateLimiter::tooManyAttempts($key, 20), 429, 'Bạn đã gửi nhiều báo lỗi. Vui lòng thử lại sau.');
        RateLimiter::hit($key, 3600);

        // Một người báo lại cùng một mục khi báo cũ còn mở: cập nhật báo cũ thay vì tạo trùng.
        $existing = DB::table('content_reports')->where('email', $email)->where('level', $input['level'])
            ->where('ref', $input['ref'])->where('status', 'open')->value('id');
        $row = ['kind' => $input['kind'], 'reason' => $input['reason'], 'note' => trim((string) ($input['note'] ?? '')),
            'context' => (string) ($input['context'] ?? ''), 'created_at' => now()->getTimestampMs()];
        if ($existing) {
            DB::table('content_reports')->where('id', $existing)->update($row);
        } else {
            DB::table('content_reports')->insert($row + ['email' => $email, 'level' => $input['level'], 'ref' => $input['ref'], 'status' => 'open']);
        }

        return response()->json(['ok' => true])->header('Cache-Control', 'no-store');
    }

    public function index(Request $request): JsonResponse
    {
        $this->admin($request);
        $status = $request->query('status') === 'resolved' ? 'resolved' : 'open';
        $rows = DB::table('content_reports')->where('status', $status)->orderByDesc('created_at')->limit(200)->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id, 'email' => $row->email, 'level' => (int) $row->level, 'kind' => $row->kind, 'ref' => $row->ref,
                'reason' => self::REASONS[$row->reason] ?? $row->reason, 'note' => $row->note, 'context' => $row->context,
                'status' => $row->status, 'createdAt' => (int) $row->created_at,
            ]);

        return response()->json([
            'reports' => $rows,
            'open' => DB::table('content_reports')->where('status', 'open')->count(),
        ])->header('Cache-Control', 'no-store');
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->admin($request);
        $status = $request->validate(['status' => ['required', Rule::in(['open', 'resolved'])]])['status'];
        $updated = DB::table('content_reports')->where('id', $id)
            ->update(['status' => $status, 'resolved_at' => $status === 'resolved' ? now()->getTimestampMs() : null]);
        abort_unless($updated || DB::table('content_reports')->where('id', $id)->exists(), 404, 'Không tìm thấy báo lỗi.');

        return response()->json(['ok' => true])->header('Cache-Control', 'no-store');
    }

    private function admin(Request $request): void
    {
        $user = $this->access->identity($request);
        abort_unless($user && $user['admin'], $user ? 403 : 401, 'Bạn chưa có quyền cho mục này.');
    }
}
