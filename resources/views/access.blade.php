<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>FangSchool</title>
    <link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="FangSchool"><meta name="apple-mobile-web-app-status-bar-style" content="default">
    <link rel="stylesheet" href="/style.css?v=19"><link rel="stylesheet" href="/design.css?v=13">
    <link rel="stylesheet" href="/access.css?v=4">
    @vite('resources/js/main.js')
</head>
<body class="access-page">
    <div id="access-app" data-mode="{{ $mode }}"></div>
    <noscript>Vui lòng bật JavaScript để dùng FangSchool.</noscript>
</body>
</html>
