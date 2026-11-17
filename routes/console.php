<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Schedule::call(function (): void {
    $now = now()->getTimestampMs();
    DB::table('access_sessions')->where('expires_at', '<=', $now)->delete();
    DB::table('otp_challenges')->where('expires_at', '<=', $now)->delete();
})->daily()->name('prune-fangschool-expired-auth');
