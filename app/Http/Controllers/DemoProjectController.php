<?php

namespace App\Http\Controllers;

use App\Services\DemoProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DemoProjectController extends Controller
{
    // GET /demo-projects
    public function index(Request $request, DemoProjectService $service): JsonResponse
    {
        $projects = $service->listProjects($request->attributes->get('demo_user'));

        return response()->json(['projects' => $projects]);
    }

    // POST /demo-projects
    public function store(Request $request, DemoProjectService $service): JsonResponse
    {
        $input = $request->validate([
            'name'        => ['required', 'string', 'min:2', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'department'  => ['nullable', 'string', 'max:100'],
            'priority'    => ['nullable', 'in:HIGH,MEDIUM,LOW'],
            'start_date'  => ['nullable', 'date_format:Y-m-d'],
            'end_date'    => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        $project = $service->createProject($input, $request->attributes->get('demo_user'));

        return response()->json(['project' => $project], 201);
    }

    // PUT /demo-projects/{id}
    public function update(string $id, Request $request, DemoProjectService $service): JsonResponse
    {
        $input = $request->validate([
            'name'        => ['sometimes', 'required', 'string', 'min:2', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'department'  => ['sometimes', 'nullable', 'string', 'max:100'],
            'priority'    => ['sometimes', 'in:HIGH,MEDIUM,LOW'],
            'status'      => ['sometimes', 'in:ACTIVE,ON_HOLD,COMPLETED,ARCHIVED'],
            'start_date'  => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'end_date'    => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ]);

        $project = $service->updateProject($id, $input, $request->attributes->get('demo_user'));

        return response()->json(['project' => $project]);
    }

    // DELETE /demo-projects/{id}
    public function destroy(string $id, Request $request, DemoProjectService $service): JsonResponse
    {
        $service->deleteProject($id, $request->attributes->get('demo_user'));

        return response()->json(['message' => 'Đã xóa dự án.']);
    }
}
