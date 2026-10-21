<!doctype html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#7C2A76">
    <meta name="description" content="BFC Smart Work – quản lý công việc và KPI lưu cục bộ trên máy chủ Laravel">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link rel="icon" href="{{ asset('images/bfc/favicon.svg') }}" type="image/svg+xml">
    @vite(['resources/css/bfc-demo.css', 'resources/js/bfc-demo.js'])
    <title>BFC Smart Work – Quản lý công việc</title>
</head>
<body>
    <div id="app"></div>
    <noscript>Bạn cần bật JavaScript để sử dụng BFC Smart Work.</noscript>
    <script>
        window.BFC_DEMO = @json($bootData);
    </script>
</body>
</html>
