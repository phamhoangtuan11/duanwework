<?php

namespace App\Http\Controllers;

use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;
use App\Services\DemoAccessService;
use App\Services\DemoProjectService;

class DemoController extends Controller
{
    public function index(Request $request, DemoAccessService $access, DemoProjectService $projectService): View
    {
        $user = $access->currentUser($request->session()->get('demo_user_id'));
        if (! $user && $request->session()->has('demo_user_id')) {
            $request->session()->forget('demo_user_id');
        }

        $permissions = [];
        if ($user) {
            $stateUser = $user;
            $permissions = $access->permissions($stateUser);
        }

        $kpiBank = null;
        if ($user) {
            $kpiBankPath = resource_path('data/kpi-bank-demo-2026.json');
            if (! is_file($kpiBankPath)) {
                throw new \RuntimeException('Không tìm thấy dữ liệu ngân hàng KPI demo.');
            }
            $kpiBankContents = file_get_contents($kpiBankPath);
            if ($kpiBankContents === false) {
                throw new \RuntimeException('Không thể đọc dữ liệu ngân hàng KPI demo.');
            }
            $kpiBank = json_decode($kpiBankContents, true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($kpiBank) || ! is_array($kpiBank['kpis'] ?? null)) {
                throw new \UnexpectedValueException('Dữ liệu ngân hàng KPI demo không đúng cấu trúc.');
            }
            $kpiBank['demo_cycle_year'] = 2026;
        }

        return view('bfc-demo', [
            'bootData' => [
                'tasks' => $user ? $access->visibleTasks($user) : [],
                'authUser' => $user,
                'assignableUsers' => $user ? $access->assignableUsers($user) : [],
                'reviewerUsers' => $user ? $access->reviewerUsers($user) : [],
                'permissions' => $permissions,
                'emailDomains' => $access->emailDomains(),
                'notifications' => $user ? $access->notifications($user) : [],
                'kpiBank'       => $kpiBank,
                'departmentKpis' => $user ? $access->departmentKpisForUser($user) : [],
                'projects'      => $user ? $projectService->listProjects($user) : [],
                'authMode'      => 'local-json-demo',
            ],
        ]);
    }
}
