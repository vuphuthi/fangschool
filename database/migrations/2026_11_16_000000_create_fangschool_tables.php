<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('grants', function (Blueprint $table) {
            $table->string('email', 254)->primary();
            $table->unsignedTinyInteger('max_level');
            $table->unsignedBigInteger('expires_at');
            $table->boolean('revoked')->default(false);
        });

        Schema::create('otp_challenges', function (Blueprint $table) {
            $table->string('email', 254)->primary();
            $table->char('id', 64);
            $table->char('signature', 64);
            $table->unsignedBigInteger('created_at');
            $table->unsignedBigInteger('expires_at')->index();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->boolean('used')->default(false);
        });

        Schema::create('access_sessions', function (Blueprint $table) {
            $table->char('digest', 64)->primary();
            $table->string('email', 254)->index();
            $table->boolean('admin');
            $table->unsignedBigInteger('expires_at')->index();
        });

        Schema::create('learner_progress', function (Blueprint $table) {
            $table->string('email', 254);
            $table->unsignedTinyInteger('level');
            $table->longText('snapshot');
            $table->unsignedBigInteger('revision');
            $table->primary(['email', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('learner_progress');
        Schema::dropIfExists('access_sessions');
        Schema::dropIfExists('otp_challenges');
        Schema::dropIfExists('grants');
    }
};
