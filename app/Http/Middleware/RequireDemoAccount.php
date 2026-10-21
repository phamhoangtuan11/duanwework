<?php

namespace App\Http\Middleware;

use App\Services\DemoAccessService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireDemoAccount
{
    public function __construct(private DemoAccessService $access)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $this->access->currentUser($request->session()->get('demo_user_id'));
        if (! $user) {
            $request->session()->forget('demo_user_id');

            return response()->json(['message' => 'Phiên đăng nhập hết hạn hoặc tài khoản không còn ACTIVE.'], 401);
        }

        $request->attributes->set('demo_user', $user);

        return $next($request);
    }
}
