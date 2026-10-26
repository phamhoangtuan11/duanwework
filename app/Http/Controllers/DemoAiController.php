<?php

namespace App\Http\Controllers;

use App\Services\DemoAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DemoAiController extends Controller
{
    /**
     * GET /demo-work/ai/briefing
     * Lấy dữ liệu tóm tắt công việc gấp và câu chào cá nhân hóa cho Mascot AI.
     */
    public function briefing(Request $request, DemoAiService $service): JsonResponse
    {
        $user = $request->attributes->get('demo_user');
        $briefing = $service->getBriefing($user);

        return response()->json([
            'success' => true,
            'data' => $briefing,
        ]);
    }

    /**
     * POST /demo-work/ai/chat
     * Xử lý tương tác thông minh, bóc tách nháp công việc và phân tích dữ liệu.
     */
    public function chat(Request $request, DemoAiService $service): JsonResponse
    {
        $input = $request->validate([
            'prompt' => ['required', 'string', 'max:1500'],
        ]);

        $user = $request->attributes->get('demo_user');
        $result = $service->chat($user, $input['prompt']);

        return response()->json([
            'success' => true,
            'data' => [
                'message' => $result['reply'],
                'draft' => $result['draft'],
            ],
        ]);
    }
}
