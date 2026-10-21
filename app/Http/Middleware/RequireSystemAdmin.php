<?php

namespace App\Http\Middleware;

use App\Services\DemoAuthRepository;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireSystemAdmin
{
    public function __construct(private DemoAuthRepository $repository)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->attributes->get('demo_user');
        $state = $this->repository->read();
        $permissions = [];
        foreach ($state['roles'] as $role) {
            if ($role['id'] === ($user['role_id'] ?? null)) {
                $permissions = $role['permissions'] ?? [];
                break;
            }
        }
        if (! in_array('accounts.manage', $permissions, true) || ($user['role_id'] ?? null) !== 'SYSTEM_ADMIN') {
            return response()->json(['message' => 'Chỉ SYSTEM_ADMIN được truy cập khu vực quản trị tài khoản.'], 403);
        }

        return $next($request);
    }
}
