<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Học viên báo lỗi nội dung (đáp án, pinyin, bản dịch...) thay cho bước giáo viên duyệt trước.
        Schema::create('content_reports', function (Blueprint $table) {
            $table->id();
            $table->string('email', 254);
            $table->unsignedSmallInteger('level');
            $table->string('kind', 16);
            $table->string('ref', 160);
            $table->string('reason', 24);
            $table->text('note');
            $table->text('context');
            $table->string('status', 12)->default('open');
            $table->unsignedBigInteger('created_at');
            $table->unsignedBigInteger('resolved_at')->nullable();
            $table->index(['status', 'created_at']);
            $table->index(['level', 'ref']);
        });

        // Bản dịch tiếng Việt cho câu hội thoại còn thiếu, do AI dịch (gắn nhãn "dịch tự động" khi hiển thị).
        Schema::create('content_translations', function (Blueprint $table) {
            $table->char('key', 40)->primary();
            $table->text('zh');
            $table->text('vi');
            $table->string('source', 40);
            $table->unsignedBigInteger('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_translations');
        Schema::dropIfExists('content_reports');
    }
};
