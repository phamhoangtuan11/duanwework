<?php

namespace App\Http\Controllers;

use App\Services\DemoAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DemoAuthController extends Controller
{
    public function login(Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
        ]);
        $user = $auth->login($input['email'], $input['password']);
        $request->session()->regenerate();
        $request->session()->put('demo_user_id', $user['id']);

        return response()->json(['user' => $user]);
    }

    public function register(Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'department' => ['required', 'string', 'min:2', 'max:120'],
            'job_title' => ['nullable', 'string', 'max:120'],
            'password' => ['required', 'string', 'min:8', 'max:200', 'confirmed'],
        ]);
        $accessRequest = $auth->register($input);

        return response()->json([
            'request' => $accessRequest,
            'message' => 'Đã gửi yêu cầu. Tài khoản chưa hoạt động; hãy chờ Quản trị hệ thống xác minh và cấp quyền.',
        ], 201);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->session()->forget('demo_user_id');
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function csrf(Request $request): JsonResponse
    {
        return response()->json(['token' => csrf_token()]);
    }
}
