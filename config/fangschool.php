<?php

return [
    'admin_emails' => env('FANGSCHOOL_ADMIN_EMAILS', ''),
    'mail_from' => env('FANGSCHOOL_MAIL_FROM', ''),
    'ai_account_id' => env('CF_AI_ACCOUNT_ID', ''),
    'ai_api_token' => env('CF_AI_API_TOKEN', ''),
    'resend_key' => env('RESEND_API_KEY', ''),
    // Giao bài cho học viên: tạm tắt vì giáo viên ít dùng. Dữ liệu bài giao vẫn được giữ; đặt true để bật lại.
    'assignments' => (bool) env('FANGSCHOOL_ASSIGNMENTS', false),
];
