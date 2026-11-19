<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Thiết bị nhận thông báo nhắc học (Web Push). Một email có thể bật trên nhiều thiết bị.
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->string('email', 254)->index();
            $table->char('endpoint_hash', 64)->unique();
            $table->text('endpoint');
            $table->string('p256dh', 120);
            $table->string('auth', 40);
            $table->unsignedBigInteger('created_at');
            $table->unsignedBigInteger('last_sent_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
