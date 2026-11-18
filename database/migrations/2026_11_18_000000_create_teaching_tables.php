<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Câu hỏi giáo viên lưu trên máy chủ (thay cho bản lưu trên trình duyệt).
        Schema::create('teacher_questions', function (Blueprint $table): void {
            $table->string('id', 100)->primary();
            $table->unsignedTinyInteger('level')->index();
            $table->unsignedSmallInteger('lesson');
            $table->longText('data');
            $table->string('status', 16)->default('draft');
            $table->string('updated_by', 254);
            $table->unsignedBigInteger('created_at');
            $table->unsignedBigInteger('updated_at');
        });
        Schema::create('teacher_question_history', function (Blueprint $table): void {
            $table->id();
            $table->string('question_id', 100)->index();
            $table->string('action', 32);
            $table->string('status', 16);
            $table->longText('data');
            $table->string('actor', 254);
            $table->unsignedBigInteger('at');
        });

        // Bài giao có hạn nộp.
        Schema::create('assignments', function (Blueprint $table): void {
            $table->id();
            $table->string('title', 160);
            $table->unsignedTinyInteger('level')->index();
            $table->string('kind', 16);
            $table->text('payload');
            $table->text('note')->nullable();
            $table->unsignedBigInteger('due_at');
            $table->boolean('remind')->default(true);
            $table->boolean('closed')->default(false);
            $table->string('created_by', 254);
            $table->unsignedBigInteger('created_at');
        });
        Schema::create('assignment_targets', function (Blueprint $table): void {
            $table->unsignedBigInteger('assignment_id');
            $table->string('email', 254)->index();
            $table->unsignedBigInteger('reminded_at')->nullable();
            $table->primary(['assignment_id', 'email']);
        });

        // Tùy chọn email nhắc học của từng học viên.
        Schema::create('email_prefs', function (Blueprint $table): void {
            $table->string('email', 254)->primary();
            $table->boolean('streak')->default(true);
            $table->boolean('weekly')->default(false);
            $table->unsignedTinyInteger('hour')->default(20);
            $table->unsignedBigInteger('last_reminder_at')->nullable();
            $table->unsignedBigInteger('last_weekly_at')->nullable();
        });
    }

    public function down(): void
    {
        foreach (['email_prefs', 'assignment_targets', 'assignments', 'teacher_question_history', 'teacher_questions'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
