<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DemoAiService
{
    public function __construct(
        private DemoAuthRepository $authRepo,
        private DemoAiRepository   $aiRepo,
        private DemoAccessService  $access,
        private DemoProjectService $projectService,
    ) {}

    /**
     * Lấy tóm tắt nhanh công việc (Daily Briefing & Badges) cho người dùng hiện tại.
     * Áp dụng triệt để Zero-Trust RBAC: chỉ tính toán dữ liệu mà tài khoản có quyền xem.
     */
    public function getBriefing(array $user): array
    {
        $state = $this->authRepo->read();
        $tasks = $this->getScopedTasksForUser($user, $state);
        $projects = $this->getScopedProjectsForUser($user, $state);
        $todayStr = now()->format('Y-m-d');

        $overdue = [];
        $urgent = [];
        $dueToday = [];

        foreach ($tasks as $task) {
            $isCompleted = in_array($task['status'] ?? '', ['COMPLETED', 'CANCELLED'], true);
            if ($isCompleted) {
                continue;
            }

            $due = substr((string) ($task['due'] ?? ''), 0, 10);
            $priority = strtoupper((string) ($task['priority'] ?? 'MEDIUM'));

            $isOverdue = $due !== '' && $due < $todayStr;
            $isUrgent = in_array($priority, ['HIGH', 'URGENT'], true);
            $isToday = $due === $todayStr;

            if ($isOverdue) {
                $overdue[] = $task;
            }
            if ($isUrgent) {
                $urgent[] = $task;
            }
            if ($isToday) {
                $dueToday[] = $task;
            }
        }

        // Đếm tổng số việc cần lưu ý (không trùng lặp ID)
        $attentionMap = [];
        foreach (array_merge($overdue, $urgent, $dueToday) as $t) {
            $attentionMap[$t['id']] = $t;
        }
        $attentionCount = count($attentionMap);

        // Lấy bộ nhớ tương tác phiên trước của người dùng
        $profile = $this->aiRepo->getUserProfile($user['id']);
        $lastActiveAt = $profile['last_active_at'] ?? null;
        $memoryGreeting = $this->createGreetingWithMemory($user, $lastActiveAt, $attentionCount);

        return [
            'attention_count'    => $attentionCount,
            'overdue_count'      => count($overdue),
            'urgent_count'       => count($urgent),
            'due_today_count'    => count($dueToday),
            'greeting'           => $memoryGreeting['greeting'],
            'memory_note'        => $memoryGreeting['memory_note'],
            'last_active_at'     => $lastActiveAt,
            'critical_tasks'     => array_values(array_slice($attentionMap, 0, 8)),
            'overdue_tasks'      => array_values($overdue),
            'urgent_tasks'       => array_values($urgent),
            'due_today_tasks'    => array_values($dueToday),
            'all_critical_tasks' => array_values($attentionMap),
            'projects'           => $projects,
        ];
    }

    /**
     * Xử lý trao đổi với AI (Chat & Phân tích & Tạo nháp).
     */
    public function chat(array $user, string $prompt, array $clientContext = []): array
    {
        $state = $this->authRepo->read();
        $scopedTasks = $this->getScopedTasksForUser($user, $state);
        $scopedProjects = $this->getScopedProjectsForUser($user, $state);
        $profile = $this->aiRepo->getUserProfile($user['id']);

        $cleanPrompt = trim($prompt);
        $normalized = $this->removeAccents($cleanPrompt);

        // 1. Kiểm tra rò rỉ dữ liệu / Hỏi vượt quyền / Hỏi lương thưởng
        $forbiddenRefusal = $this->isForbiddenQuery($user, $normalized);
        if ($forbiddenRefusal !== null) {
            $this->aiRepo->recordInteraction(
                $user['id'],
                ['role' => 'user', 'content' => $cleanPrompt, 'at' => now()->toIso8601String()],
                ['role' => 'assistant', 'content' => $forbiddenRefusal, 'at' => now()->toIso8601String()]
            );
            return [
                'reply' => $forbiddenRefusal,
                'draft' => null,
            ];
        }

        // 2. Kiểm tra ý định tạo / lập / giao / bóc tách việc
        if (preg_match('/\b(tao|giao|lap|phan cong|boc tach|len ke hoach|them cong viec)\b/i', $normalized)) {
            $draftResult = $this->buildTaskDraft($user, $cleanPrompt, $state);
            if (isset($draftResult['error'])) {
                $refusal = $draftResult['error'];
                $this->aiRepo->recordInteraction(
                    $user['id'],
                    ['role' => 'user', 'content' => $cleanPrompt, 'at' => now()->toIso8601String()],
                    ['role' => 'assistant', 'content' => $refusal, 'at' => now()->toIso8601String()]
                );
                return [
                    'reply' => $refusal,
                    'draft' => null,
                ];
            }
            if ($draftResult !== null) {
                $isSelf = ($draftResult['assignee_id'] ?? '') === $user['id'];
                $replyText = $isSelf
                    ? "Tôi đã chuẩn bị thẻ nháp công việc cho bạn. Vui lòng kiểm tra lại thời hạn và dự án bên dưới trước khi bấm xác nhận tạo việc."
                    : "Tôi đã chuẩn bị thẻ nháp công việc cho {$draftResult['assignee']}. Vui lòng kiểm tra lại thời hạn và dự án bên dưới trước khi bấm xác nhận giao việc.";

                $this->aiRepo->recordInteraction(
                    $user['id'],
                    ['role' => 'user', 'content' => $cleanPrompt, 'at' => now()->toIso8601String()],
                    ['role' => 'assistant', 'content' => $replyText, 'at' => now()->toIso8601String()],
                    "Đã tạo nháp công việc: {$draftResult['title']}"
                );

                return [
                    'reply' => $replyText,
                    'draft' => $draftResult,
                ];
            }
        }

        // 3. Gọi Google Gemini AI (hoặc OpenAI nếu có) với Scoped Context đã lọc sạch
        $aiReply = $this->callGemini($user, $cleanPrompt, $scopedTasks, $scopedProjects, $profile, $state);
        if ($aiReply === null && ! empty(env('OPENAI_API_KEY'))) {
            $aiReply = $this->callOpenAI($user, $cleanPrompt, $scopedTasks, $profile, $state);
        }

        if ($aiReply !== null) {
            $this->aiRepo->recordInteraction(
                $user['id'],
                ['role' => 'user', 'content' => $cleanPrompt, 'at' => now()->toIso8601String()],
                ['role' => 'assistant', 'content' => $aiReply, 'at' => now()->toIso8601String()]
            );
            return [
                'reply' => $aiReply,
                'draft' => null,
            ];
        }

        // 4. Fallback: Local Context-Aware Engine khi mất mạng hoặc không có API Key
        $localReply = $this->localEngineReply($user, $cleanPrompt, $normalized, $scopedTasks, $state);
        $this->aiRepo->recordInteraction(
            $user['id'],
            ['role' => 'user', 'content' => $cleanPrompt, 'at' => now()->toIso8601String()],
            ['role' => 'assistant', 'content' => $localReply, 'at' => now()->toIso8601String()]
        );

        return [
            'reply' => $localReply,
            'draft' => null,
        ];
    }

    /**
     * Kiểm tra xem người dùng có đang truy vấn thông tin vượt quyền hoặc dữ liệu nhạy cảm không.
     */
    private function isForbiddenQuery(array $user, string $normalized): ?string
    {
        $roleId = $user['role_id'] ?? '';
        $isSystemAdmin = $roleId === 'SYSTEM_ADMIN';
        if ($isSystemAdmin) {
            return null;
        }

        // 1. Chặn câu hỏi về lương, thưởng, thu nhập cá nhân (Cấm tuyệt đối mọi vai trò)
        if (preg_match('/\b(luong|thuong|tien thuong|hoa hong|thu nhap|dai ngo|hop dong lao dong|bang luong|he so luong|luong bong)\b/i', $normalized)) {
            return 'Theo quy định bảo mật của BFC Smart Work, trợ lý AI không được phép truy cập hoặc trao đổi về thông tin lương, thưởng, thu nhập cá nhân hay các chế độ đãi ngộ.';
        }

        // 2. Chặn câu hỏi của Nhân viên (EMPLOYEE / STAFF)
        if ($roleId === 'EMPLOYEE' || $roleId === 'STAFF') {
            $employeeForbidden = [
                '/\b(ai qua han|ai tre han|nguoi nao tre han|ai cham tien do|ai lam xong|danh sach nhan vien|tat ca nhan vien|toan bo cong ty)\b/i',
                '/\b(cong viec cua (?:anh|chi|ban|nhan vien|dong nghiep|ong|ba))\b/i',
                '/\b(kpi cua|tien do cua (?:anh|chi|ban|nhan vien))\b/i',
                '/\b(phong ban khac|du an khac|danh sach phong ban)\b/i',
            ];
            foreach ($employeeForbidden as $pattern) {
                if (preg_match($pattern, $normalized)) {
                    return 'Theo chính sách bảo mật phân quyền của BFC Smart Work, bạn chỉ có quyền tra cứu dữ liệu công việc được giao hoặc do chính bạn tạo. Tôi không thể cung cấp dữ liệu nhân sự, công việc của người khác hoặc thông tin phòng ban khác.';
                }
            }
        }

        // 3. Chặn câu hỏi của Quản lý dự án (PROJECT_MANAGER)
        if ($roleId === 'PROJECT_MANAGER') {
            $pmForbidden = [
                '/\b(du an cua nguoi khac|du an khong thuoc|toan bo du an cong ty|cac du an khac)\b/i',
                '/\b(phong ban khac|nhan su phong ban khac)\b/i',
            ];
            foreach ($pmForbidden as $pattern) {
                if (preg_match($pattern, $normalized)) {
                    return 'Theo chính sách phân quyền của BFC Smart Work, Quản lý dự án chỉ có quyền theo dõi công việc của nhân sự trong các dự án mình được giao phụ trách, không thể tra cứu các dự án khác ngoài phạm vi.';
                }
            }
        }

        return null;
    }

    /**
     * Bóc tách và xây dựng Task Draft thông minh kết hợp Gemini AI với kiểm soát chặt chẽ quyền hạn:
     * - Nhân viên CHỈ ĐƯỢC tạo việc cho chính mình.
     * - Quản lý dự án CHỈ ĐƯỢC giao việc trong dự án mình quản lý.
     */
    private function buildTaskDraft(array $user, string $prompt, array $state): ?array
    {
        $normalized = $this->removeAccents($prompt);
        $users = $state['users'] ?? [];
        $canAssignOthers = $this->access->can($user, 'tasks.assign');
        $scopedProjects = $this->getScopedProjectsForUser($user, $state);

        // 1. Thử bóc tách thông minh qua Gemini AI nếu có key
        $aiDraft = $this->extractTaskDraftWithGemini($prompt, $user, $scopedProjects, $state);

        $recipientKeyword = null;
        $title = null;
        $due = null;
        $dueTime = null;
        $dueNote = null;
        $priority = 'MEDIUM';
        $requiresReview = false;
        $subtasks = [];
        $candidateProjectName = null;

        if ($aiDraft !== null) {
            $title = $aiDraft['title'] ?? null;
            $recipientKeyword = $aiDraft['recipient'] ?? null;
            $candidateProjectName = $aiDraft['project'] ?? null;
            $due = $aiDraft['due'] ?? null;
            $dueTime = $aiDraft['due_time'] ?? null;
            $dueNote = $aiDraft['due_note'] ?? 'theo phân tích của AI';
            $priority = strtoupper($aiDraft['priority'] ?? 'MEDIUM');
            $requiresReview = (bool) ($aiDraft['review'] ?? false);

            if (! empty($aiDraft['subtasks']) && is_array($aiDraft['subtasks'])) {
                foreach ($aiDraft['subtasks'] as $subItem) {
                    $cleanSub = trim(is_string($subItem) ? $subItem : ($subItem['title'] ?? ''));
                    if (mb_strlen($cleanSub) >= 2) {
                        $subtasks[] = ['title' => $cleanSub, 'done' => false];
                    }
                }
            }
        }

        // 2. Fallback bóc tách bằng quy tắc Regex nếu AI không trích xuất được
        if (empty($title)) {
            if (preg_match('/(?:giao cho|cho)\s+(?:(?:nhan vien|nhan su)\s+)?([^\s,;.]+)/i', $normalized, $matches)) {
                $recipientKeyword = trim($matches[1]);
            }

            $deadlineInfo = $this->parsePromptDeadline($prompt, $normalized);
            $due = $deadlineInfo['due'];
            $dueTime = $deadlineInfo['due_time'];
            $dueNote = $deadlineInfo['dueNote'];

            $title = $prompt;
            $title = preg_replace('/^\s*(?:hãy|vui lòng)?\s*(?:tạo|giao|lập|phân công)\s*(?:cho tôi)?\s*(?:công việc|nhiệm vụ|việc)?\s*/iu', '', $title);
            if (! empty($recipientKeyword)) {
                $title = preg_replace('/(?:giao\s+)?cho\s+(?:nhân\s+viên\s+)?'.preg_quote($recipientKeyword, '/').'/iu', '', $title);
            }
            $title = preg_replace('/\b(hạn|deadline|trước ngày|vào lúc|lúc)\b.*$/iu', '', $title);
            $title = trim($title, " \t\n\r\0\x0B-:;,.");

            if (preg_match('/\b(gap|khan cap|cao|urgent|high)\b/i', $normalized)) {
                $priority = 'HIGH';
            } elseif (preg_match('/\b(thap|low)\b/i', $normalized)) {
                $priority = 'LOW';
            }

            if (preg_match('/\b(nghiem thu|duyet|phe duyet|kiem tra)\b/i', $normalized)) {
                $requiresReview = true;
            }

            if (preg_match_all('/(?:^|\n|;)\s*(?:[-*•]|\d+[.)])\s*([^\n;]+)/u', $prompt, $subtaskMatches)) {
                foreach ($subtaskMatches[1] as $subText) {
                    $cleanSub = trim($subText);
                    if (mb_strlen($cleanSub) >= 2) {
                        $subtasks[] = ['title' => $cleanSub, 'done' => false];
                    }
                }
            }
        }

        if (empty($title) || mb_strlen($title) < 3) {
            $title = 'Công việc mới theo yêu cầu';
        }

        // 3. ZERO-TRUST RBAC: Xác thực người nhận (Assignee)
        $recipient = null;
        if (! empty($recipientKeyword)) {
            $cleanKey = $this->removeAccents(trim($recipientKeyword));
            foreach ($users as $u) {
                if ($u['status'] === 'ACTIVE' && str_contains($this->removeAccents($u['name']), $cleanKey)) {
                    $recipient = $u;
                    break;
                }
            }
        }

        // Nhân viên cố ý giao việc cho người khác -> CHẶN NGAY LẬP TỨC
        if ($recipient && $recipient['id'] !== $user['id'] && ! $canAssignOthers) {
            return [
                'error' => 'Theo chính sách bảo mật phân quyền BFC Smart Work, nhân viên chỉ có quyền tạo công việc cho chính mình. Quyền phân công việc cho nhân sự khác thuộc thẩm quyền của Quản lý.',
            ];
        }

        // Nếu là nhân viên hoặc không chỉ định người nhận: mặc định giao cho chính mình
        if (! $recipient || ! $canAssignOthers) {
            $recipient = $user;
        }

        // 4. ZERO-TRUST RBAC: Xác thực Dự án (Project Scope)
        $matchedProject = null;
        $matchedProjectId = null;

        // Thử tìm trong Scoped Projects trước
        if (! empty($candidateProjectName)) {
            $candNorm = $this->removeAccents($candidateProjectName);
            foreach ($scopedProjects as $prj) {
                if (str_contains($this->removeAccents($prj['name']), $candNorm)) {
                    $matchedProject = $prj['name'];
                    $matchedProjectId = $prj['id'];
                    break;
                }
            }
        }

        if (! $matchedProject) {
            foreach ($scopedProjects as $prj) {
                $prjNameNorm = $this->removeAccents($prj['name']);
                if (str_contains($normalized, $prjNameNorm) || (isset($prj['code']) && str_contains($normalized, strtolower($prj['code'])))) {
                    $matchedProject = $prj['name'];
                    $matchedProjectId = $prj['id'];
                    break;
                }
            }
        }

        // Kiểm tra xem người dùng có yêu cầu vào dự án NGOÀI phạm vi được phân quyền không
        if (! $matchedProject) {
            $allProjects = $state['projects'] ?? [];
            foreach ($allProjects as $otherPrj) {
                $otherPrjNorm = $this->removeAccents($otherPrj['name']);
                $candNorm = ! empty($candidateProjectName) ? $this->removeAccents($candidateProjectName) : '';
                if (($candNorm !== '' && str_contains($otherPrjNorm, $candNorm)) || str_contains($normalized, $otherPrjNorm)) {
                    return [
                        'error' => "Dự án “{$otherPrj['name']}” không thuộc phạm vi quản lý hoặc tham gia của bạn. Bạn không thể giao hoặc tạo việc vào dự án này.",
                    ];
                }
            }

            // Mặc định dự án đầu tiên trong scope hoặc Công việc độc lập
            $matchedProject = ! empty($scopedProjects) ? $scopedProjects[0]['name'] : 'Công việc độc lập';
            $matchedProjectId = ! empty($scopedProjects) ? $scopedProjects[0]['id'] : null;
        }

        // 5. Xác thực Người nghiệm thu
        $reviewerId = null;
        $reviewerName = null;
        if ($requiresReview) {
            $reviewers = $this->access->reviewerUsers($user);
            if (! empty($reviewers)) {
                $reviewerId = $reviewers[0]['id'];
                $reviewerName = $reviewers[0]['name'];
            }
        }

        // 6. ZERO-TRUST: Xác thực Chỉ tiêu KPI phòng ban
        $matchedKpiId = null;
        $matchedKpiName = null;
        $scopedKpis = $this->access->departmentKpisForUser($user);

        if (! empty($aiDraft['kpi_id'])) {
            $candKpiId = trim((string) $aiDraft['kpi_id']);
            foreach ($scopedKpis as $kpi) {
                if ($kpi['id'] === $candKpiId) {
                    $matchedKpiId = $kpi['id'];
                    $matchedKpiName = $kpi['name'];
                    break;
                }
            }
        }

        // Fuzzy match KPI nếu AI không trích xuất được hoặc fallback qua regex
        if (! $matchedKpiId) {
            foreach ($scopedKpis as $kpi) {
                $kpiNameNorm = $this->removeAccents($kpi['name']);
                $kpiIdNorm = mb_strtolower($kpi['id']);
                if (str_contains($normalized, $kpiIdNorm) || str_contains($normalized, $kpiNameNorm)) {
                    $matchedKpiId = $kpi['id'];
                    $matchedKpiName = $kpi['name'];
                    break;
                }
            }
        }

        return [
            'title'            => mb_substr($title, 0, 160),
            'assignee'         => $recipient['name'] ?? '',
            'assigneeId'       => $recipient['id'] ?? '',
            'assignee_id'      => $recipient['id'] ?? '',
            'project'          => $matchedProject,
            'project_id'       => $matchedProjectId,
            'kpi_id'           => $matchedKpiId,
            'kpi_name'         => $matchedKpiName,
            'start_date'       => now()->format('Y-m-d'),
            'due'              => $due ?? now()->copy()->addDays(7)->format('Y-m-d'),
            'original_due'     => $due ?? now()->copy()->addDays(7)->format('Y-m-d'),
            'extensions_count' => 0,
            'due_time'         => $dueTime,
            'dueNote'          => $dueNote ?? 'hạn đề xuất sau 7 ngày',
            'priority'         => in_array($priority, ['LOW', 'MEDIUM', 'HIGH'], true) ? $priority : 'MEDIUM',
            'review'           => $requiresReview,
            'reviewer_id'      => $reviewerId,
            'reviewer'         => $reviewerName,
            'subtasks'         => $subtasks,
        ];
    }

    /**
     * Dùng Gemini AI để bóc tách thông minh các trường dữ liệu của công việc (tiêu đề, hạn, ưu tiên, checklist, KPI).
     * Sau khi AI trích xuất, backend BFC Smart Work áp dụng kiểm soát phân quyền chặt chẽ.
     */
    private function extractTaskDraftWithGemini(string $prompt, array $user, array $scopedProjects, array $state): ?array
    {
        $apiKey = config('services.gemini.key') ?? env('GEMINI_API_KEY');
        if (empty($apiKey)) {
            return null;
        }

        $candidates = array_unique(array_filter([
            config('services.gemini.model'),
            env('GEMINI_MODEL'),
            'gemini-flash-lite-latest',
            'gemini-3.5-flash-lite',
        ]));

        $todayStr = now()->format('Y-m-d');
        $projectNames = array_column($scopedProjects, 'name');
        $scopedKpis = $this->access->departmentKpisForUser($user);
        $kpiSummaries = array_map(fn ($k) => "- [{$k['id']}] {$k['name']} (Ý nghĩa: {$k['description']})", $scopedKpis);
        $kpiListText = ! empty($kpiSummaries) ? implode("\n", $kpiSummaries) : "Không có danh mục KPI khả dụng";

        $systemInstruction = "Bạn là trợ lý bóc tách thông tin công việc của BFC Smart Work. "
            . "Hôm nay là: {$todayStr}. "
            . "DANH MỤC KPI PHÒNG BAN ĐƯỢC PHÉP ÁP DỤNG CHO NGƯỜI DÙNG NÀY:\n{$kpiListText}\n\n"
            . "Hãy phân tích yêu cầu tạo/giao việc của người dùng và trả về DUY NHẤT một chuỗi JSON hợp lệ theo schema:\n"
            . "{\n"
            . "  \"title\": \"Tên công việc súc tích, đã bỏ các từ như tạo việc/hãy giao việc\",\n"
            . "  \"recipient\": \"Tên người nhận công việc nếu có được nhắc đến, hoặc rỗng\",\n"
            . "  \"project\": \"Tên dự án được nhắc đến trong danh mục: " . implode(', ', $projectNames) . " hoặc rỗng\",\n"
            . "  \"kpi_id\": \"Mã KPI phù hợp nhất trong danh mục được cung cấp ở trên (ví dụ CNTT-01, CNTT-02...) hoặc null nếu không khớp hoặc là việc vụ việc phát sinh\",\n"
            . "  \"due\": \"Hạn hoàn thành dạng YYYY-MM-DD tính từ hôm nay ({$todayStr})\",\n"
            . "  \"due_time\": \"Giờ dạng HH:MM nếu có, ví dụ 17:00, hoặc null\",\n"
            . "  \"due_note\": \"Ghi chú hạn như: hôm nay, ngày mai, ngày 25/10 lúc 15:00\",\n"
            . "  \"priority\": \"LOW | MEDIUM | HIGH\",\n"
            . "  \"review\": true | false (true nếu có từ nghiệm thu, duyệt, phê duyệt),\n"
            . "  \"subtasks\": [\"đầu việc con 1\", \"đầu việc con 2\"]\n"
            . "}";

        foreach ($candidates as $model) {
            try {
                $response = Http::timeout(8)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                        'system_instruction' => [
                            'parts' => [['text' => $systemInstruction]],
                        ],
                        'contents' => [
                            ['role' => 'user', 'parts' => [['text' => $prompt]]],
                        ],
                        'generationConfig' => [
                            'temperature' => 0.1,
                            'maxOutputTokens' => 600,
                            'responseMimeType' => 'application/json',
                        ],
                    ]);

                if ($response->successful()) {
                    $rawText = $response->json('candidates.0.content.parts.0.text');
                    if (! empty($rawText)) {
                        $json = json_decode(trim($rawText), true);
                        if (is_array($json) && ! empty($json['title'])) {
                            return $json;
                        }
                    }
                }
            } catch (\Throwable $e) {
                Log::info("Gemini draft extraction on model {$model} skipped: " . $e->getMessage());
            }
        }

        return null;
    }


    /**
     * Bóc tách ngày giờ hạn từ câu nói tự nhiên.
     */
    private function parsePromptDeadline(string $raw, string $normalized): array
    {
        $today = now();
        $due = $today->copy()->addDays(7)->format('Y-m-d');
        $dueTime = null;
        $dueNote = 'hạn đề xuất sau 7 ngày';

        if (preg_match('/\b(ngay mai|mai)\b/i', $normalized)) {
            $due = $today->copy()->addDays(1)->format('Y-m-d');
            $dueNote = 'hạn ngày mai';
        } elseif (preg_match('/\b(hom nay)\b/i', $normalized)) {
            $due = $today->format('Y-m-d');
            $dueNote = 'hạn hôm nay';
        } elseif (preg_match('/\bcuoi tuan\b/i', $normalized)) {
            $due = $today->copy()->endOfWeek()->format('Y-m-d');
            $dueNote = 'cuối tuần này';
        } elseif (preg_match('/trong\s+(\d+)\s+ngay/i', $normalized, $m)) {
            $days = max(1, (int) $m[1]);
            $due = $today->copy()->addDays($days)->format('Y-m-d');
            $dueNote = "trong vòng {$days} ngày";
        } elseif (preg_match('/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?\b/', $raw, $m)) {
            $day = (int) $m[1];
            $month = (int) $m[2];
            $year = isset($m[3]) ? (int) $m[3] : (int) $today->year;
            $due = sprintf('%04d-%02d-%02d', $year, $month, $day);
            $dueNote = "ngày {$day}/{$month}";
        }

        // Bóc tách giờ
        if (preg_match('/\b(\d{1,2})(?:h|:)(\d{2})?\s*(chieu|toi|sang)?\b/i', $raw, $tm)) {
            $hour = (int) $tm[1];
            $min = isset($tm[2]) ? (int) $tm[2] : 0;
            $period = strtolower($tm[3] ?? '');

            if ($period === 'chieu' || $period === 'toi') {
                if ($hour < 12) {
                    $hour += 12;
                }
            } elseif ($period === 'sang') {
                if ($hour === 12) {
                    $hour = 0;
                }
            }

            if ($hour >= 0 && $hour <= 23 && $min >= 0 && $min <= 59) {
                $dueTime = sprintf('%02d:%02d', $hour, $min);
                $dueNote .= " lúc {$dueTime}";
            }
        }

        return [
            'due'      => $due,
            'due_time' => $dueTime,
            'dueNote'  => $dueNote,
        ];
    }

    /**
     * Tạo câu chào cá nhân hóa dựa trên lịch sử tương tác trước đó.
     */
    private function createGreetingWithMemory(array $user, ?string $lastActiveAt, int $attentionCount): array
    {
        $name = $user['name'] ?? 'bạn';
        $timeOfDay = (int) now()->format('H');
        $timeGreet = 'Chào bạn';
        if ($timeOfDay >= 5 && $timeOfDay < 12) {
            $timeGreet = "Chào buổi sáng {$name}";
        } elseif ($timeOfDay >= 12 && $timeOfDay < 18) {
            $timeGreet = "Chào buổi chiều {$name}";
        } else {
            $timeGreet = "Chào buổi tối {$name}";
        }

        $memoryNote = null;
        if (! empty($lastActiveAt)) {
            try {
                $diffText = Carbon::parse($lastActiveAt)->diffForHumans();
                $memoryNote = "Phiên làm việc gần nhất của bạn là {$diffText}.";
            } catch (\Throwable) {
                $memoryNote = "Chào mừng bạn quay lại phiên làm việc hôm nay!";
            }
        } else {
            $memoryNote = "Chào mừng bạn lần đầu tham gia không gian BFC Smart Work!";
        }

        $taskSummary = $attentionCount > 0
            ? "Hôm nay bạn có {$attentionCount} công việc cần chú ý. Chúc bạn làm việc hiệu quả và tràn đầy năng lượng!"
            : "Hiện tại các công việc của bạn đều ổn định. Cùng tiếp tục phát huy nhé!";

        return [
            'greeting'    => "{$timeGreet}! {$taskSummary}",
            'memory_note' => $memoryNote,
        ];
    }

    /**
     * Gọi Google Gemini API với Scoped Context & Zero-Trust Guardrails.
     */
    private function callGemini(array $user, string $prompt, array $tasks, array $projects, array $profile, array $state): ?string
    {
        $apiKey = config('services.gemini.key') ?? env('GEMINI_API_KEY');
        if (empty($apiKey)) {
            return null;
        }

        $candidates = array_unique(array_filter([
            config('services.gemini.model'),
            env('GEMINI_MODEL'),
            'gemini-flash-lite-latest',
            'gemini-3.5-flash-lite',
        ]));

        // Làm sạch và tóm tắt Scoped Tasks (tối đa 25 task)
        $condensedTasks = array_map(fn ($t) => [
            'id'       => $t['id'] ?? '',
            'title'    => $t['title'] ?? '',
            'project'  => $t['project'] ?? 'Công việc độc lập',
            'assignee' => $t['assignee'] ?? '',
            'due'      => $t['due'] ?? '',
            'due_time' => $t['due_time'] ?? '',
            'status'   => $t['status'] ?? 'TODO',
            'priority' => $t['priority'] ?? 'MEDIUM',
            'progress' => $t['progress'] ?? 0,
        ], array_slice($tasks, 0, 25));

        // Làm sạch và tóm tắt Scoped Projects
        $condensedProjects = array_map(fn ($p) => [
            'id'     => $p['id'] ?? '',
            'name'   => $p['name'] ?? '',
            'status' => $p['status'] ?? 'IN_PROGRESS',
        ], array_slice($projects, 0, 15));

        $todayStr = now()->format('d/m/Y (l)');

        $systemInstruction = "Bạn là Trợ lý AI BFC Smart Work (Chuyên nghiệp, thông minh, ngắn gọn, lịch sự, bảo mật tuyệt đối).\n"
            . "HÔM NAY LÀ: {$todayStr}.\n"
            . "NGƯỜI DÙNG HIỆN TẠI:\n"
            . "- Tên: {$user['name']}\n"
            . "- Vai trò: {$user['role_label']} ({$user['role_id']})\n"
            . "- Phòng ban: {$user['department']}\n\n"
            . "QUY TẮC BẢO MẬT & PHÂN QUYỀN ZERO-TRUST TUYỆT ĐỐI:\n"
            . "1. Bạn CHỈ ĐƯỢC PHÉP trả lời và cung cấp thông tin dựa trên danh sách DỰ ÁN và CÔNG VIỆC hợp lệ được cung cấp dưới đây.\n"
            . "2. Nếu người dùng là Nhân viên (EMPLOYEE / STAFF): Họ CHỈ được xem thông tin công việc và tiến độ của chính mình. Nếu họ hỏi về người khác, phòng ban khác hoặc toàn công ty, hãy từ chối lịch sự: 'Theo chính sách bảo mật phân quyền BFC Smart Work, bạn chỉ có thể tra cứu thông tin công việc của chính mình.'\n"
            . "3. Nếu người dùng là Quản lý dự án (PROJECT MANAGER): Họ được xem công việc của các nhân sự trong dự án họ quản lý, nhưng KHÔNG ĐƯỢC xem các dự án khác ngoài danh sách được cung cấp.\n"
            . "4. TUYỆT ĐỐI KHÔNG trả lời, suy đoán hoặc cung cấp thông tin về lương, thưởng, thu nhập cá nhân hay thông tin đời tư.\n"
            . "5. Trả lời súc tích bằng tiếng Việt, định dạng markdown đẹp mắt (dùng gạch đầu dòng, in đậm tên công việc, hạn chót).\n\n"
            . "DỮ LIỆU DỰ ÁN HỢP LỆ TRONG PHẠM VI:\n" . json_encode($condensedProjects, JSON_UNESCAPED_UNICODE) . "\n\n"
            . "DỮ LIỆU CÔNG VIỆC HỢP LỆ TRONG PHẠM VI:\n" . json_encode($condensedTasks, JSON_UNESCAPED_UNICODE);

        $contents = [];
        $recent = $profile['recent_messages'] ?? [];
        foreach (array_slice($recent, -4) as $msg) {
            $role = ($msg['role'] ?? 'user') === 'assistant' ? 'model' : 'user';
            $contents[] = [
                'role'  => $role,
                'parts' => [['text' => (string) ($msg['content'] ?? '')]],
            ];
        }
        $contents[] = [
            'role'  => 'user',
            'parts' => [['text' => $prompt]],
        ];

        foreach ($candidates as $model) {
            try {
                $response = Http::timeout(10)
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}", [
                        'system_instruction' => [
                            'parts' => [['text' => $systemInstruction]],
                        ],
                        'contents' => $contents,
                        'generationConfig' => [
                            'temperature' => 0.4,
                            'maxOutputTokens' => 1024,
                        ],
                    ]);

                if ($response->successful()) {
                    $json = $response->json();
                    $reply = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
                    if (! empty($reply)) {
                        return trim($reply);
                    }
                }
            } catch (\Throwable $e) {
                Log::warning("Gemini API call on model {$model} failed: " . $e->getMessage());
            }
        }

        return null;
    }

    /**
     * Fallback Engine khi không có Gemini/OpenAI API Key hoặc lỗi mạng.
     */
    private function localEngineReply(array $user, string $prompt, string $normalized, array $tasks, array $state): string
    {
        $todayStr = now()->format('Y-m-d');

        // Hỏi việc hôm nay / tuần này
        if (preg_match('/\b(hom nay|tuan nay|can lam gi|viec cua toi)\b/i', $normalized)) {
            $myTasks = array_filter($tasks, fn ($t) => ! in_array($t['status'] ?? '', ['COMPLETED', 'CANCELLED'], true));
            if (empty($myTasks)) {
                return "Bạn không có công việc nào đang chờ xử lý hôm nay. Thật tuyệt vời!";
            }
            $lines = ["Công việc bạn cần lưu ý:"];
            $idx = 1;
            foreach (array_slice($myTasks, 0, 6) as $t) {
                $lines[] = $this->formatTaskItemLine($t, $idx++);
            }
            return implode("\n", $lines);
        }

        // Hỏi việc quá hạn
        if (preg_match('/\b(qua han|tre han|late|overdue)\b/i', $normalized)) {
            $lateTasks = array_filter($tasks, fn ($t) => ($t['status'] ?? '') !== 'COMPLETED' && ($t['due'] ?? '') < $todayStr && ! empty($t['due']));
            if (empty($lateTasks)) {
                return "Tuyệt vời! Không có công việc nào bị quá hạn trong phạm vi của bạn.";
            }
            $lines = ["Có " . count($lateTasks) . " công việc bị quá hạn:"];
            $idx = 1;
            foreach ($lateTasks as $t) {
                $lines[] = $this->formatTaskItemLine($t, $idx++);
            }
            return implode("\n", $lines);
        }

        // Hỏi việc ưu tiên cao
        if (preg_match('/\b(uu tien cao|khan cap|viec gap)\b/i', $normalized)) {
            $urgentTasks = array_filter($tasks, fn ($t) => ($t['status'] ?? '') !== 'COMPLETED' && in_array(strtoupper($t['priority'] ?? ''), ['HIGH', 'URGENT'], true));
            if (empty($urgentTasks)) {
                return "Hiện không có công việc ưu tiên cao nào chưa hoàn thành.";
            }
            $lines = ["Có " . count($urgentTasks) . " công việc ưu tiên cao:"];
            $idx = 1;
            foreach ($urgentTasks as $t) {
                $lines[] = $this->formatTaskItemLine($t, $idx++);
            }
            return implode("\n", $lines);
        }

        // Hỏi tiến độ dự án
        if (preg_match('/\b(du an|tien do du an)\b/i', $normalized)) {
            $scopedProjects = $this->getScopedProjectsForUser($user, $state);
            if (empty($scopedProjects)) {
                return "Bạn hiện chưa tham gia dự án nào trong hệ thống.";
            }
            $lines = ["Thống kê các dự án trong phạm vi của bạn:"];
            foreach (array_slice($scopedProjects, 0, 4) as $p) {
                $lines[] = "• {$p['name']}: Trạng thái {$p['status']}";
            }
            return implode("\n", $lines);
        }

        return "Tôi có thể hỗ trợ bạn:\n• Tạo nhanh công việc: ví dụ \"Tạo việc thiết kế slide thuyết trình hạn thứ sáu 17h, ưu tiên cao\"\n• Tra cứu: \"Hôm nay tôi cần làm gì?\", \"Việc ưu tiên cao nào chưa xong?\"\n• Xem công việc quá hạn hoặc tiến độ dự án.";
    }

    /**
     * Lấy danh sách Dự án được lọc nghiêm ngặt theo vai trò người dùng.
     */
    public function getScopedProjectsForUser(array $user, array $state): array
    {
        $allProjects = $state['projects'] ?? [];
        $isSystemAdmin = ($user['role_id'] ?? '') === 'SYSTEM_ADMIN';
        if ($isSystemAdmin) {
            return $allProjects;
        }

        $roleId = $user['role_id'] ?? '';
        $userScope = $state['user_role_scopes'][$user['id']] ?? [];
        $scopedProjectIdsOrNames = $userScope['projects'] ?? [];

        // 1. Quản lý phòng ban: thấy dự án thuộc phòng ban mình hoặc được cấp quyền
        if ($roleId === 'DEPARTMENT_MANAGER') {
            $userDept = $user['department'] ?? '';
            $scopedDepts = $userScope['departments'] ?? [];
            return array_values(array_filter($allProjects, function ($prj) use ($user, $userDept, $scopedDepts, $scopedProjectIdsOrNames) {
                $prjDept = $prj['department'] ?? '';
                $isSameDept = ! empty($userDept) && $prjDept === $userDept;
                $isInScopeDepts = in_array($prjDept, $scopedDepts, true);
                $isInScopePrj = in_array($prj['id'] ?? '', $scopedProjectIdsOrNames, true) || in_array($prj['name'] ?? '', $scopedProjectIdsOrNames, true);
                $isCreator = ($prj['created_by_id'] ?? null) === $user['id'] || ($prj['created_by'] ?? null) === $user['name'];

                return $isSameDept || $isInScopeDepts || $isInScopePrj || $isCreator;
            }));
        }

        // 2. Quản lý dự án: CHỈ THẤY dự án do chính mình quản lý hoặc được cấp
        if ($roleId === 'PROJECT_MANAGER') {
            return array_values(array_filter($allProjects, function ($prj) use ($user, $scopedProjectIdsOrNames) {
                $isCreator = ($prj['created_by_id'] ?? null) === $user['id'] || ($prj['created_by'] ?? null) === $user['name'];
                $isManager = ($prj['manager_id'] ?? null) === $user['id'] || ($prj['manager'] ?? null) === $user['name'];
                $isInScope = in_array($prj['id'] ?? '', $scopedProjectIdsOrNames, true) || in_array($prj['name'] ?? '', $scopedProjectIdsOrNames, true);

                return $isCreator || $isManager || $isInScope;
            }));
        }

        // 3. Nhân viên thường (EMPLOYEE / STAFF): CHỈ THẤY dự án mà mình có ít nhất 1 task tham gia
        $userTasks = $this->getScopedTasksForUser($user, $state);
        $userProjectNames = array_unique(array_filter(array_column($userTasks, 'project')));
        $userProjectIds = array_unique(array_filter(array_column($userTasks, 'project_id')));

        return array_values(array_filter($allProjects, function ($prj) use ($userProjectNames, $userProjectIds) {
            return in_array($prj['name'] ?? '', $userProjectNames, true)
                || in_array($prj['id'] ?? '', $userProjectIds, true);
        }));
    }

    /**
     * Lấy danh sách Task đã được lọc nghiêm ngặt theo quyền xem của người dùng.
     */
    public function getScopedTasksForUser(array $user, array $state): array
    {
        $allTasks = $state['tasks'] ?? [];
        $isSystemAdmin = ($user['role_id'] ?? '') === 'SYSTEM_ADMIN';
        if ($isSystemAdmin) {
            return $allTasks;
        }

        $roleId = $user['role_id'] ?? '';

        // 1. Nhân viên thường: CHỈ THẤY việc của chính mình (được giao, tạo ra, hoặc theo dõi)
        if ($roleId === 'EMPLOYEE' || $roleId === 'STAFF') {
            return array_values(array_filter($allTasks, function ($task) use ($user) {
                $isAssigned = ($task['assignee_id'] ?? null) === $user['id'] || trim($task['assignee'] ?? '') === trim($user['name'] ?? '');
                $isCreator = ($task['creator_id'] ?? null) === $user['id'] || trim($task['creator'] ?? '') === trim($user['name'] ?? '');
                $isReviewer = ($task['reviewer_id'] ?? null) === $user['id'];
                $isFollower = in_array($user['id'], $task['follower_ids'] ?? [], true);

                return $isAssigned || $isCreator || $isReviewer || $isFollower;
            }));
        }

        // 2. Quản lý dự án: CHỈ THẤY công việc thuộc về các dự án mà mình quản lý
        if ($roleId === 'PROJECT_MANAGER') {
            $managedProjects = $this->getScopedProjectsForUser($user, $state);
            $managedPrjNames = array_column($managedProjects, 'name');
            $managedPrjIds = array_column($managedProjects, 'id');

            return array_values(array_filter($allTasks, function ($task) use ($user, $managedPrjNames, $managedPrjIds) {
                $inManagedPrj = (isset($task['project_id']) && in_array($task['project_id'], $managedPrjIds, true))
                    || (isset($task['project']) && in_array($task['project'], $managedPrjNames, true));
                $isRelated = ($task['assignee_id'] ?? null) === $user['id']
                    || ($task['creator_id'] ?? null) === $user['id']
                    || ($task['reviewer_id'] ?? null) === $user['id'];

                return $inManagedPrj || $isRelated;
            }));
        }

        // 3. Quản lý phòng ban / Ban giám đốc: Dùng canViewTask từ DemoAccessService
        return array_values(array_filter($allTasks, fn ($task) => $this->access->canViewTask($user, $task, $state)));
    }

    private function formatTaskItemLine(array $task, int $index): string
    {
        $id = (string) ($task['id'] ?? '');
        $isLongUuid = strlen($id) > 12;
        $codeTag = (! $isLongUuid && ! empty($id)) ? "[{$id}] " : "{$index}. ";
        $due = ! empty($task['due']) ? Carbon::parse($task['due'])->format('d/m/Y') : 'Chưa đặt hạn';
        if (! empty($task['due_time'])) {
            $due .= " {$task['due_time']}";
        }
        $prioMap = [
            'HIGH'   => 'Cao',
            'URGENT' => 'Khẩn cấp',
            'MEDIUM' => 'Trung bình',
            'LOW'    => 'Thấp',
        ];
        $prioLabel = $prioMap[strtoupper((string) ($task['priority'] ?? 'MEDIUM'))] ?? 'Trung bình';

        return "• {$codeTag}{$task['title']} — Hạn: {$due} (Ưu tiên: {$prioLabel})";
    }

    private function removeAccents(string $str): string
    {
        $str = mb_strtolower($str, 'UTF-8');
        $accents = [
            'a' => ['à','á','ạ','ả','ã','â','ầ','ấ','ậ','ẩ','ẫ','ă','ằ','ắ','ặ','ẳ','ẵ'],
            'e' => ['è','é','ẹ','ẻ','ẽ','ê','ề','ế','ệ','ể','ễ'],
            'i' => ['ì','í','ị','ỉ','ĩ'],
            'o' => ['ò','ó','ọ','ỏ','õ','ô','ồ','ố','ộ','ổ','ỗ','ơ','ờ','ớ','ợ','ở','ỡ'],
            'u' => ['ù','ú','ụ','ủ','ũ','ư','ừ','ứ','ự','ử','ữ'],
            'y' => ['ỳ','ý','ỵ','ỷ','ỹ'],
            'd' => ['đ'],
        ];
        foreach ($accents as $non => $group) {
            $str = str_replace($group, $non, $str);
        }
        return $str;
    }
}
