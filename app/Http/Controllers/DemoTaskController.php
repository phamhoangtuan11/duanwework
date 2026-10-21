<?php

namespace App\Http\Controllers;

use App\Services\DemoAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DemoTaskController extends Controller
{
    public function sync(Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate(['tasks' => ['required', 'array', 'max:2000']]);
        $tasks = $auth->syncTasks($request->attributes->get('demo_user'), $input['tasks']);

        return response()->json(['tasks' => $tasks]);
    }

    public function importLegacy(Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate(['tasks' => ['required', 'array', 'max:2000']]);
        $tasks = $auth->importLegacyTasks($request->attributes->get('demo_user'), $input['tasks']);

        return response()->json(['tasks' => $tasks]);
    }

    public function addAttachment(string $id, Request $request, DemoAuthService $auth): JsonResponse
    {
        $input = $request->validate([
            'file' => ['required', 'file', 'max:512', 'mimes:pdf,png,jpg,jpeg,gif,webp,txt,csv,docx,xlsx'],
            'section' => ['required', 'in:description,result,comment'],
        ]);
        $attachment = $auth->addTaskAttachment($id, $input['file'], $input['section'], $request->attributes->get('demo_user'));

        return response()->json(['attachment' => $attachment], 201);
    }

    public function downloadAttachment(string $id, string $attachmentId, Request $request, DemoAuthService $auth)
    {
        $attachment = $auth->taskAttachment($id, $attachmentId, $request->attributes->get('demo_user'));
        if (! $attachment) {
            abort(404);
        }
        $path = "demo-work-attachments/{$attachment['id']}.{$attachment['extension']}";
        abort_unless(Storage::disk('local')->exists($path), 404);

        return Storage::disk('local')->download($path, $attachment['name'], [
            'Content-Type' => $attachment['type'],
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
