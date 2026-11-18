<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('owner', 254);
            $table->string('title', 72);
            $table->unsignedBigInteger('updated_at');
            $table->index(['owner', 'updated_at', 'id']);
        });

        Schema::create('ai_chat_turns', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('conversation_id')->constrained('ai_conversations')->cascadeOnDelete();
            $table->text('question');
            $table->text('answer');
            $table->index(['conversation_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_chat_turns');
        Schema::dropIfExists('ai_conversations');
    }
};
