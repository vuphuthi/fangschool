<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>FangSchool</title>
    <link rel="stylesheet" href="/style.css?v=19"><link rel="stylesheet" href="/design.css?v=13">
    <link rel="stylesheet" href="/access.css?v=4">
    @vite('resources/js/main.js')
</head>
<body class="access-page">
    <div id="access-app" data-mode="{{ $mode }}"></div>
    <noscript>Vui lòng bật JavaScript để dùng FangSchool.</noscript>
</body>
</html>
