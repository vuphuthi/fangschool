<?php

return [
    'admin_emails' => env('FANGSCHOOL_ADMIN_EMAILS', ''),
    'mail_from' => env('FANGSCHOOL_MAIL_FROM', ''),
    'ai_account_id' => env('CF_AI_ACCOUNT_ID', ''),
    'ai_api_token' => env('CF_AI_API_TOKEN', ''),
    'resend_key' => env('RESEND_API_KEY', ''),
    // Giao bài cho học viên: tạm tắt vì giáo viên ít dùng. Dữ liệu bài giao vẫn được giữ; đặt true để bật lại.
    'assignments' => (bool) env('FANGSCHOOL_ASSIGNMENTS', false),
    // Thông báo đẩy nhắc học (Web Push). Để trống thì khoá VAPID được tạo một lần và lưu ở vapid_file.
    'vapid_public' => env('FANGSCHOOL_VAPID_PUBLIC', ''),
    'vapid_private' => env('FANGSCHOOL_VAPID_PRIVATE', ''),
    'vapid_file' => env('FANGSCHOOL_VAPID_FILE', storage_path('app/vapid.json')),
];
