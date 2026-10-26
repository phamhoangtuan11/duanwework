<?php

namespace Tests\Feature;

use App\Services\DemoAuthRepository;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class DemoAiTest extends TestCase
{
    private string $authPath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->authPath = storage_path('framework/testing/demo-auth-'.Str::uuid());
        config(['bfc-auth.path' => $this->authPath]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->authPath);
        parent::tearDown();
    }

    private function setupTestEnvironment(): array
    {
        $repo = app(DemoAuthRepository::class);

        return $repo->transaction(function (&$state) {
            $chairmanId = (string) Str::uuid();
            $employee1Id = (string) Str::uuid();
            $employee2Id = (string) Str::uuid();
            $pmAId = (string) Str::uuid();
            $pmBId = (string) Str::uuid();

            $state['roles'][] = [
                'id' => 'STAFF',
                'label' => 'Nhân viên',
                'permissions' => ['tasks.create', 'tasks.view_related', 'tasks.update_related', 'tasks.comment_related'],
            ];

            $state['users'] = [
                [
                    'id' => $chairmanId,
                    'name' => 'Quản lý BFC',
                    'email' => 'manager@bfc.test',
                    'password_hash' => password_hash('Pass12345!', PASSWORD_DEFAULT),
                    'role_id' => 'DEPARTMENT_MANAGER',
                    'department' => 'Ban Điều hành',
                    'job_title' => 'Trưởng ban',
                    'status' => 'ACTIVE',
                    'scope' => ['organization' => true],
                    'created_at' => now()->toIso8601String(),
                ],
                [
                    'id' => $employee1Id,
                    'name' => 'Nhân viên Tuấn',
                    'email' => 'tuan@bfc.test',
                    'password_hash' => password_hash('Pass12345!', PASSWORD_DEFAULT),
                    'role_id' => 'STAFF',
                    'department' => 'Phòng CNTT',
                    'job_title' => 'Kỹ sư phần mềm',
                    'status' => 'ACTIVE',
                    'scope' => ['departments' => ['Phòng CNTT']],
                    'created_at' => now()->toIso8601String(),
                ],
                [
                    'id' => $employee2Id,
                    'name' => 'Nhân viên Lan',
                    'email' => 'lan@bfc.test',
                    'password_hash' => password_hash('Pass12345!', PASSWORD_DEFAULT),
                    'role_id' => 'STAFF',
                    'department' => 'Phòng Nhân sự',
                    'job_title' => 'Chuyên viên Tuyển dụng',
                    'status' => 'ACTIVE',
                    'scope' => ['departments' => ['Phòng Nhân sự']],
                    'created_at' => now()->toIso8601String(),
                ],
                [
                    'id' => $pmAId,
                    'name' => 'Quản lý An',
                    'email' => 'pma@bfc.test',
                    'password_hash' => password_hash('Pass12345!', PASSWORD_DEFAULT),
                    'role_id' => 'PROJECT_MANAGER',
                    'department' => 'Khối Công nghệ',
                    'job_title' => 'Quản lý dự án Smart Work',
                    'status' => 'ACTIVE',
                    'created_at' => now()->toIso8601String(),
                ],
                [
                    'id' => $pmBId,
                    'name' => 'Quản lý Bình',
                    'email' => 'pmb@bfc.test',
                    'password_hash' => password_hash('Pass12345!', PASSWORD_DEFAULT),
                    'role_id' => 'PROJECT_MANAGER',
                    'department' => 'Khối Marketing',
                    'job_title' => 'Quản lý dự án Marketing',
                    'status' => 'ACTIVE',
                    'created_at' => now()->toIso8601String(),
                ],
            ];

            $state['projects'] = [
                [
                    'id' => 'PRJ-1',
                    'name' => 'Dự án Smart Work',
                    'manager_id' => $pmAId,
                    'manager' => 'Quản lý An',
                    'status' => 'IN_PROGRESS',
                    'department' => 'Khối Công nghệ',
                ],
                [
                    'id' => 'PRJ-2',
                    'name' => 'Dự án Marketing 2026',
                    'manager_id' => $pmBId,
                    'manager' => 'Quản lý Bình',
                    'status' => 'IN_PROGRESS',
                    'department' => 'Khối Marketing',
                ],
            ];

            $state['user_role_scopes'] = [
                $pmAId => ['projects' => ['PRJ-1'], 'departments' => [], 'organization' => false],
                $pmBId => ['projects' => ['PRJ-2'], 'departments' => [], 'organization' => false],
                $employee1Id => ['departments' => ['Phòng CNTT'], 'projects' => [], 'organization' => false],
                $employee2Id => ['departments' => ['Phòng Nhân sự'], 'projects' => [], 'organization' => false],
            ];

            $now = now();
            $tasks = [
                [
                    'id' => 'CV-1001',
                    'title' => 'Tối ưu hóa cơ sở dữ liệu BFC',
                    'project' => 'Dự án Smart Work',
                    'project_id' => 'PRJ-1',
                    'assignee' => 'Nhân viên Tuấn',
                    'assignee_id' => $employee1Id,
                    'creator' => 'Quản lý An',
                    'creator_id' => $pmAId,
                    'due' => $now->copy()->subDays(2)->toDateString(), // Quá hạn
                    'due_time' => '17:00',
                    'priority' => 'HIGH',
                    'status' => 'IN_PROGRESS',
                    'progress' => 40,
                    'review' => true,
                    'reviewer_id' => $pmAId,
                ],
                [
                    'id' => 'CV-1002',
                    'title' => 'Kế hoạch tuyển dụng nhân sự Quý 4',
                    'project' => 'Nhân sự 2026',
                    'assignee' => 'Nhân viên Lan',
                    'assignee_id' => $employee2Id,
                    'creator' => 'Quản lý BFC',
                    'creator_id' => $chairmanId,
                    'due' => $now->copy()->addDays(5)->toDateString(),
                    'priority' => 'MEDIUM',
                    'status' => 'TODO',
                    'progress' => 0,
                    'review' => false,
                ],
                [
                    'id' => 'CV-1003',
                    'title' => 'Chiến dịch truyền thông sản phẩm mới',
                    'project' => 'Dự án Marketing 2026',
                    'project_id' => 'PRJ-2',
                    'assignee' => 'Nhân viên Lan',
                    'assignee_id' => $employee2Id,
                    'creator' => 'Quản lý Bình',
                    'creator_id' => $pmBId,
                    'due' => $now->copy()->addDays(4)->toDateString(),
                    'priority' => 'HIGH',
                    'status' => 'IN_PROGRESS',
                    'progress' => 15,
                    'review' => false,
                ],
            ];
            $state['tasks'] = $tasks;

            return [
                'chairman' => $state['users'][0],
                'tuan' => $state['users'][1],
                'lan' => $state['users'][2],
                'pmA' => $state['users'][3],
                'pmB' => $state['users'][4],
            ];
        });
    }

    public function test_zero_trust_employee_only_sees_their_own_briefing(): void
    {
        $users = $this->setupTestEnvironment();

        // Đăng nhập bằng tài khoản Nhân viên Tuấn
        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        $response = $this->getJson('/demo-work/ai/briefing');
        $response->assertOk();
        $data = $response->json('data');

        // Tuấn chỉ có 1 task CV-1001 (quá hạn)
        $this->assertEquals(1, $data['attention_count']);
        $this->assertEquals(1, $data['overdue_count']);
        $this->assertCount(1, $data['critical_tasks']);
        $this->assertEquals('CV-1001', $data['critical_tasks'][0]['id']);

        // Tuyệt đối không thấy task CV-1002 và CV-1003 của Lan
        foreach ($data['critical_tasks'] as $task) {
            $this->assertNotEquals('CV-1002', $task['id']);
            $this->assertNotEquals('CV-1003', $task['id']);
        }
    }

    public function test_employee_forbidden_from_asking_salaries_or_bonuses(): void
    {
        $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        $response = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Lương tháng này của tôi và bảng lương thưởng nhân sự thế nào?',
        ]);

        $response->assertOk();
        $msg = $response->json('data.message');
        $this->assertStringContainsString('không được phép truy cập hoặc trao đổi về thông tin lương, thưởng, thu nhập cá nhân', $msg);
        $this->assertNull($response->json('data.draft'));
    }

    public function test_employee_forbidden_from_asking_about_other_employees_or_departments(): void
    {
        $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        // Hỏi người khác quá hạn
        $res1 = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Có ai quá hạn công việc trong toàn bộ công ty không?',
        ]);
        $res1->assertOk();
        $this->assertStringContainsString('bạn chỉ có quyền tra cứu dữ liệu công việc được giao hoặc do chính bạn tạo', $res1->json('data.message'));

        // Hỏi tiến độ công việc của đồng nghiệp
        $res2 = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Công việc của nhân viên Lan đang làm đến đâu rồi?',
        ]);
        $res2->assertOk();
        $this->assertStringContainsString('Tôi không thể cung cấp dữ liệu nhân sự, công việc của người khác', $res2->json('data.message'));
    }

    public function test_employee_cannot_assign_task_to_another_employee(): void
    {
        $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        $response = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Giao cho nhân viên Lan việc lập báo cáo tài chính hạn ngày mai',
        ]);

        $response->assertOk();
        $msg = $response->json('data.message');
        $this->assertStringContainsString('nhân viên chỉ có quyền tạo công việc cho chính mình', $msg);
        $this->assertNull($response->json('data.draft'));
    }

    public function test_employee_cannot_create_task_in_unauthorized_project(): void
    {
        $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        // Tuấn không tham gia và không có quyền trong Dự án Marketing 2026
        $response = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Tạo việc thiết kế poster trong Dự án Marketing 2026 hạn tuần sau',
        ]);

        $response->assertOk();
        $msg = $response->json('data.message');
        $this->assertStringContainsString('không thuộc phạm vi quản lý hoặc tham gia của bạn', $msg);
        $this->assertNull($response->json('data.draft'));
    }

    public function test_project_manager_scope_isolation(): void
    {
        $this->setupTestEnvironment();

        // Đăng nhập tài khoản Quản lý An (quản lý PRJ-1 Dự án Smart Work)
        $this->postJson('/demo-auth/login', [
            'email' => 'pma@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        // Briefing: PM An chỉ thấy dự án Smart Work và task CV-1001 thuộc dự án mình quản lý
        $resBriefing = $this->getJson('/demo-work/ai/briefing');
        $resBriefing->assertOk();
        $briefingData = $resBriefing->json('data');

        $this->assertEquals(1, $briefingData['attention_count']);
        $this->assertEquals('CV-1001', $briefingData['critical_tasks'][0]['id']);

        $projectIds = array_column($briefingData['projects'], 'id');
        $this->assertContains('PRJ-1', $projectIds);
        $this->assertNotContains('PRJ-2', $projectIds);

        // PM An hỏi về dự án ngoài phạm vi -> Bị từ chối
        $resChat = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Cho tôi xem dự án của người khác hoặc toàn bộ dự án công ty',
        ]);
        $resChat->assertOk();
        $this->assertStringContainsString('Quản lý dự án chỉ có quyền theo dõi công việc của nhân sự trong các dự án mình được giao phụ trách', $resChat->json('data.message'));

        // PM An hỏi lương -> Cũng bị từ chối
        $resSalary = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Lương và thưởng của nhân viên Tuấn là bao nhiêu?',
        ]);
        $resSalary->assertOk();
        $this->assertStringContainsString('không được phép truy cập hoặc trao đổi về thông tin lương, thưởng', $resSalary->json('data.message'));
    }

    public function test_ai_chat_creates_draft_with_subtasks_and_fuzzy_project(): void
    {
        $users = $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'pma@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        $prompt = "Giao cho nhân viên Tuấn việc Thiết kế API báo cáo KPI dự án Smart Work hạn ngày mai lúc 16h ưu tiên cao:\n- Bước 1: thiết kế db\n- Bước 2: viết unit test";

        $response = $this->postJson('/demo-work/ai/chat', [
            'prompt' => $prompt,
        ]);

        $response->assertOk();
        $data = $response->json('data');
        $this->assertNotEmpty($data['message']);
        $this->assertNotNull($data['draft']);

        $draft = $data['draft'];
        $this->assertStringContainsString('Thiết kế API báo cáo KPI', $draft['title']);
        $this->assertEquals($users['tuan']['id'], $draft['assignee_id']);
        $this->assertEquals('HIGH', $draft['priority']);
        $this->assertStringContainsString('thiết kế db', mb_strtolower($draft['subtasks'][0]['title']));
    }

    public function test_ai_memory_remembers_user_and_saves_isolated_json(): void
    {
        $users = $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        // Lần chat thứ nhất
        $res1 = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Chào bạn, hôm nay tôi có việc gì gấp không?',
        ]);
        $res1->assertOk();

        // File ai-store.json phải tồn tại trong private test storage
        $aiStorePath = $this->authPath . '/ai-store.json';
        $this->assertFileExists($aiStorePath);

        $jsonContent = json_decode(file_get_contents($aiStorePath), true);
        $this->assertArrayHasKey('users', $jsonContent);
        $this->assertArrayHasKey($users['tuan']['id'], $jsonContent['users']);

        $userMemory = $jsonContent['users'][$users['tuan']['id']];
        $this->assertNotEmpty($userMemory['recent_messages']);
        $this->assertNotNull($userMemory['last_active_at']);
    }

    public function test_department_kpi_scoping_and_zero_trust_isolation(): void
    {
        $users = $this->setupTestEnvironment();
        $accessService = app(\App\Services\DemoAccessService::class);

        // 1. Nhân viên CNTT chỉ nhận KPI của CNTT + CHUNG, không nhận Kinh Doanh hay Nhân sự
        $tuanUser = $users['tuan'];
        $tuanKpis = $accessService->departmentKpisForUser($tuanUser);
        $kpiIds = array_column($tuanKpis, 'id');

        $this->assertContains('CNTT-01', $kpiIds);
        $this->assertContains('CNTT-02', $kpiIds);
        $this->assertContains('GEN-01', $kpiIds);
        $this->assertNotContains('KD-01', $kpiIds);
        $this->assertNotContains('NS-01', $kpiIds);

        // 2. Đảm bảo cấu trúc Zero-Trust: không rò rỉ trọng số thưởng hay chỉ tiêu nhạy cảm
        foreach ($tuanKpis as $kpi) {
            $this->assertArrayNotHasKey('reference_target', $kpi);
            $this->assertArrayNotHasKey('salary_weight', $kpi);
            $this->assertArrayNotHasKey('bonus_rate', $kpi);
            $this->assertArrayHasKey('name', $kpi);
            $this->assertArrayHasKey('description', $kpi);
        }
    }

    public function test_ai_task_draft_auto_suggests_department_kpi(): void
    {
        $users = $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        // Gửi prompt lập trình / tối ưu hệ thống
        $res = $this->postJson('/demo-work/ai/chat', [
            'prompt' => 'Tạo công việc tối ưu database Smart Work hạn ngày 28/10',
        ]);
        $res->assertOk();

        $data = $res->json('data');
        $this->assertNotNull($data['draft']);
        $draft = $data['draft'];

        // Kiểm tra AI tự động gán KPI thuộc CNTT (CNTT-01 hoặc CNTT-02)
        $this->assertNotEmpty($draft['kpi_id']);
        $this->assertStringStartsWith('CNTT-', $draft['kpi_id']);
        $this->assertNotEmpty($draft['kpi_name']);
        $this->assertEquals(0, $draft['extensions_count']);
        $this->assertNotEmpty($draft['original_due']);
    }

    public function test_task_dual_mode_deadline_and_formal_extension_tracking(): void
    {
        $users = $this->setupTestEnvironment();

        $this->postJson('/demo-auth/login', [
            'email' => 'tuan@bfc.test',
            'password' => 'Pass12345!',
        ])->assertOk();

        // 1. Tạo task với KPI phòng ban
        $initialTask = [
            'id' => 'CV-9999',
            'title' => 'Nâng cấp bảo mật hệ thống Smart Work',
            'project' => 'Công việc độc lập',
            'assignee' => 'Nhân viên Tuấn',
            'assignee_id' => $users['tuan']['id'],
            'due' => '2026-10-25',
            'due_time' => '17:00',
            'priority' => 'HIGH',
            'review' => false,
            'kpi_id' => 'CNTT-02',
            'kpi_name' => 'Đảm bảo hạ tầng, an toàn thông tin & Uptime hệ thống >= 99.5%',
            'original_due' => '2026-10-25',
            'extensions_count' => 0,
        ];

        $syncRes = $this->postJson('/demo-work/tasks/sync', [
            'tasks' => [$initialTask],
        ]);
        $syncRes->assertOk();

        $savedTasks = $syncRes->json('tasks');
        $created = collect($savedTasks)->firstWhere('id', 'CV-9999');
        $this->assertNotNull($created);
        $this->assertEquals('CNTT-02', $created['kpi_id']);
        $this->assertEquals('2026-10-25', $created['original_due']);
        $this->assertEquals(0, $created['extensions_count']);

        // 2. Thực hiện quy trình gia hạn có lý do (Formal Extension)
        $extendedTask = $created;
        $extendedTask['due'] = '2026-10-30';
        $extendedTask['due_time'] = '18:00';
        $extendedTask['extensions_count'] = 1;
        $extendedTask['events'][] = [
            'actor' => 'Nhân viên Tuấn',
            'text' => 'Gia hạn lần 1 đến 30/10/2026 18:00: [Phát sinh yêu cầu kỹ thuật phức tạp] Cần thêm thời gian kiểm thử tải DB.',
            'at' => now()->toIso8601String(),
        ];

        $extendRes = $this->postJson('/demo-work/tasks/sync', [
            'tasks' => [$extendedTask],
        ]);
        $extendRes->assertOk();

        $afterExtendTasks = $extendRes->json('tasks');
        $afterExtend = collect($afterExtendTasks)->firstWhere('id', 'CV-9999');
        $this->assertNotNull($afterExtend);
        $this->assertEquals('2026-10-30', $afterExtend['due']);
        $this->assertEquals('2026-10-25', $afterExtend['original_due'], 'Original due date must be preserved');
        $this->assertEquals(1, $afterExtend['extensions_count']);

        // Kiểm tra audit log trong events
        $eventTexts = array_column($afterExtend['events'], 'text');
        $foundAudit = false;
        foreach ($eventTexts as $text) {
            if (str_contains($text, 'Gia hạn lần 1') && str_contains($text, 'Phát sinh yêu cầu kỹ thuật phức tạp')) {
                $foundAudit = true;
                break;
            }
        }
        $this->assertTrue($foundAudit, 'Extension audit log must be recorded in events');
    }
}
