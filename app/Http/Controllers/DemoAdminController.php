<?php

namespace App\Http\Controllers;

use App\Services\DemoAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DemoAdminController extends Controller
{
    public function index(DemoAuthService $auth): JsonResponse
    {
        return response()->json($auth->adminData());
    }

    public function domains(Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate(['domains' => ['present', 'array', 'max:20'], 'domains.*' => ['required', 'string', 'max:253']]);
        $auth->setEmailDomains($input['domains'], $request->attributes->get('demo_user'));

        return response()->json(['message' => 'Đã cập nhật miền email đăng ký.']);
    }

    public function decideRequest(string $id, Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'decision' => ['required', 'in:approve,reject,more_info'],
            'role_id' => ['nullable', 'string', 'max:60'],
            'scope.departments' => ['sometimes', 'array', 'max:100'],
            'scope.departments.*' => ['string', 'max:100'],
            'scope.projects' => ['sometimes', 'array', 'max:100'],
            'scope.projects.*' => ['string', 'max:100'],
            'scope.organization' => ['sometimes', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);
        $accessRequest = $auth->decideRequest($id, $input['decision'], $input['role_id'] ?? null, $input['scope'] ?? [], $input['note'] ?? null, $request->attributes->get('demo_user'));

        return response()->json(['request' => $accessRequest]);
    }

    public function updateUser(string $id, Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'department' => ['sometimes', 'nullable', 'string', 'max:100'],
            'job_title' => ['sometimes', 'nullable', 'string', 'max:100'],
            'role_id' => ['sometimes', 'string', 'max:60'],
            'status' => ['sometimes', 'in:ACTIVE,SUSPENDED,DISABLED'],
            'scope.departments' => ['sometimes', 'array', 'max:100'],
            'scope.departments.*' => ['string', 'max:100'],
            'scope.projects' => ['sometimes', 'array', 'max:100'],
            'scope.projects.*' => ['string', 'max:100'],
            'scope.organization' => ['sometimes', 'boolean'],
        ]);
        $user = $auth->updateUser($id, $input, $request->attributes->get('demo_user'));

        return response()->json(['user' => $user]);
    }

    public function updateRole(string $id, Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'label' => ['required', 'string', 'min:2', 'max:100'],
            'permissions' => ['present', 'array', 'max:30'],
            'permissions.*' => ['required', 'string', 'max:60'],
        ]);
        $role = $auth->updateRole($id, $input, $request->attributes->get('demo_user'));

        return response()->json(['role' => $role]);
    }
}
