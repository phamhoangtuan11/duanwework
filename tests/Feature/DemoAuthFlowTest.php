<?php

namespace Tests\Feature;

use App\Services\DemoAuthService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class DemoAuthFlowTest extends TestCase
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

    public function test_registration_requires_a_configured_company_email_domain(): void
    {
        $this->postJson('/demo-auth/register', $this->registrationData())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_registration_requires_matching_password_confirmation(): void
    {
        $admin = $this->createAdmin();
        app(DemoAuthService::class)->setEmailDomains(['bfc.test'], $admin);
        $registration = $this->registrationData();
        $registration['password_confirmation'] = 'Different-Password';

        $this->postJson('/demo-auth/register', $registration)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $registration['password_confirmation'] = $registration['password'];
        $this->postJson('/demo-auth/register', $registration)->assertCreated();
    }

    public function test_registration_is_pending_until_admin_approval_and_login_uses_server_session(): void
    {
        $admin = $this->createAdmin();
        $service = app(DemoAuthService::class);
        $service->setEmailDomains(['bfc.test'], $admin);

        $this->postJson('/demo-auth/register', $this->registrationData())
            ->assertCreated()
            ->assertJsonPath('request.status', 'PENDING');

        $this->postJson('/demo-auth/register', $this->registrationData())
            ->assertUnprocessable();

        $this->postJson('/demo-auth/login', [
            'email' => 'staff@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertUnprocessable();

        $this->postJson('/demo-auth/login', [
            'email' => 'admin@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();
        $this->get('/')->assertOk()->assertSee('"role_id":"SYSTEM_ADMIN"', false);

        $adminData = $this->getJson('/demo-auth/admin/')->assertOk()->json();
        $request = $adminData['requests'][0];
        $this->postJson('/demo-auth/admin/requests/'.$request['id'].'/decision', [
            'decision' => 'approve',
            'role_id' => 'EMPLOYEE',
            'scope' => ['departments' => [], 'projects' => [], 'organization' => false],
        ])->assertOk()->assertJsonPath('request.status', 'APPROVED');
        $this->assertContains('access_request_approved', array_column(
            app(DemoAuthService::class)->adminData()['audit_logs'],
            'action'
        ));

        $this->postJson('/demo-auth/login', [
            'email' => 'staff@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk()->assertJsonPath('user.role_id', 'EMPLOYEE');

        $this->get('/')->assertOk()->assertSee('Staff Member')->assertSee('notifications', false);
        $this->getJson('/demo-auth/admin/')->assertForbidden();
    }

    public function test_admin_can_update_own_scope_and_has_full_organization_task_access(): void
    {
        $this->getJson('/demo-auth/admin/')->assertUnauthorized();

        $admin = $this->createAdmin();
        $this->postJson('/demo-auth/login', [
            'email' => $admin['email'],
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();

        $this->putJson('/demo-auth/admin/users/'.$admin['id'], [
            'role_id' => 'CHAIRMAN',
            'status' => 'ACTIVE',
        ])->assertUnprocessable();

        $service = app(DemoAuthService::class);
        $service->syncTasks($admin, [[
            'id' => 'CV-1999',
            'title' => 'Cập nhật hồ sơ quản trị',
            'assignee' => $admin['name'],
            'assignee_id' => $admin['id'],
            'creator' => $admin['name'],
            'creator_id' => $admin['id'],
            'due' => '2026-10-25',
        ]]);
        $this->putJson('/demo-auth/admin/users/'.$admin['id'], [
            'name' => 'System Admin Updated',
            'department' => 'CNTT',
            'job_title' => 'Nhân viên CNTT',
            'scope' => ['departments' => [], 'projects' => [], 'organization' => true],
        ])->assertOk()
            ->assertJsonPath('user.name', 'System Admin Updated')
            ->assertJsonPath('user.department', 'CNTT')
            ->assertJsonPath('user.job_title', 'Nhân viên CNTT')
            ->assertJsonPath('user.scope.organization', true);

        $updatedAdmin = app(\App\Services\DemoAccessService::class)->currentUser($admin['id']);
        $updatedTasks = $service->syncTasks($updatedAdmin, []);
        $this->assertSame('System Admin Updated', $updatedTasks[0]['assignee']);
        $this->assertSame('System Admin Updated', $updatedTasks[0]['creator']);

        $task = ['id' => 'CV-2001', 'creator_id' => 'another-user', 'assignee_id' => 'another-user', 'reviewer_id' => $admin['id'], 'follower_ids' => [], 'project' => 'Dự án A', 'department_id' => 'Sản xuất'];
        $access = app(\App\Services\DemoAccessService::class);
        $this->assertTrue($access->canViewTask($admin, $task));
        $this->assertTrue($access->canEditTask($admin, $task));
        $this->assertTrue($access->canReviewTask($admin, $task));
        $this->assertTrue($access->canAssignTo($admin, $task));

        $taskDraft = [
            'id' => 'CV-2001',
            'title' => 'Cập nhật tiến độ dự án',
            'assignee' => $admin['name'],
            'assignee_id' => $admin['id'],
            'due' => '2026-10-25',
            'status' => 'TODO',
            'review' => false,
        ];
        $service->syncTasks($admin, [$taskDraft]);
        $taskDraft['status'] = 'IN_PROGRESS';
        $updatedTasks = $service->syncTasks($admin, [$taskDraft]);
        $this->assertSame('IN_PROGRESS', collect($updatedTasks)->firstWhere('id', 'CV-2001')['status']);

        $this->putJson('/demo-auth/admin/roles/EMPLOYEE', [
            'label' => 'Nhân viên',
            'permissions' => ['tasks.create', 'tasks.view_related'],
        ])->assertOk();
        $this->assertContains('role_permissions_updated', array_column(
            app(DemoAuthService::class)->adminData()['audit_logs'],
            'action'
        ));

        $this->putJson('/demo-auth/admin/roles/SYSTEM_ADMIN', [
            'label' => 'Admin nâng quyền',
            'permissions' => ['accounts.manage'],
        ])->assertUnprocessable();
    }

    public function test_logout_invalidates_the_authenticated_session(): void
    {
        $this->createAdmin();

        $this->postJson('/demo-auth/login', [
            'email' => 'admin@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();

        $this->postJson('/demo-auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Đã đăng xuất.');

        $this->get('/')->assertOk()->assertDontSee('"role_id":"SYSTEM_ADMIN"', false);
        $this->getJson('/demo-auth/admin/')->assertUnauthorized();
    }

    public function test_approved_employee_can_create_a_task_through_the_authorized_endpoint(): void
    {
        $admin = $this->createAdmin();
        $service = app(DemoAuthService::class);
        $service->setEmailDomains(['bfc.test'], $admin);
        $registered = $service->register($this->registrationData());
        $service->decideRequest($registered['id'], 'approve', 'EMPLOYEE', [], null, $admin);
        $reviewer = $this->createReviewer($service, $admin, 'reviewer@bfc.test', 'Scoped Reviewer');
        $outsider = $this->createReviewer($service, $admin, 'outsider@bfc.test', 'Other Reviewer');
        $wrongScopeReviewer = $this->createReviewer($service, $admin, 'wrong-scope@bfc.test', 'Out of Scope Reviewer', ['Finance']);
        $inactiveReviewer = $this->createReviewer($service, $admin, 'inactive@bfc.test', 'Inactive Reviewer');
        $service->updateUser($inactiveReviewer['id'], ['status' => 'SUSPENDED'], $admin);

        $this->postJson('/demo-auth/login', [
            'email' => 'staff@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();

        $taskInput = [
            'id' => 'TEST-1',
            'title' => 'Prepare a verified handover',
            'assignee' => 'Staff Member',
            'start_date' => '2027-12-31',
            'due' => '2027-12-31',
            'due_time' => '16:30',
            'priority' => 'MEDIUM',
            'review' => true,
            'reviewer_id' => $reviewer['id'],
        ];
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [array_merge($taskInput, ['due' => '2027-12-30'])]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('start_date');

        $this->postJson('/demo-work/tasks/sync', ['tasks' => [array_merge($taskInput, ['due_time' => '25:30'])]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('due_time');

        $withoutReviewer = $taskInput;
        unset($withoutReviewer['reviewer_id']);
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$withoutReviewer]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviewer_id');

        $this->postJson('/demo-work/tasks/sync', ['tasks' => [array_merge($taskInput, ['reviewer_id' => $inactiveReviewer['id']])]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviewer_id');

        $this->postJson('/demo-work/tasks/sync', ['tasks' => [array_merge($taskInput, ['reviewer_id' => $wrongScopeReviewer['id']])]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviewer_id');

        $created = $this->postJson('/demo-work/tasks/sync', ['tasks' => [array_merge($taskInput, ['start_date' => '2027-12-20'])]])
            ->assertOk()
            ->assertJsonPath('tasks.0.status', 'TODO')
            ->assertJsonPath('tasks.0.start_date', '2027-12-20')
            ->assertJsonPath('tasks.0.due_time', '16:30')
            ->assertJsonPath('tasks.0.reviewer_id', $reviewer['id']);

        $task = $created->json('tasks.0');
        $task['reviewer_id'] = $outsider['id'];
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reviewer_id');
        $task['reviewer_id'] = $reviewer['id'];

        $task['review'] = false;
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('review');
        $task['review'] = true;

        $task['status'] = 'IN_PROGRESS';
        $task['subtasks'] = [['title' => 'Collect evidence', 'done' => false]];
        $task['comments'] = [['text' => 'Started the handover work']];
        $task['checklists'] = [[
            'id' => 'check-1',
            'title' => 'Handover review',
            'items' => [['id' => 'item-1', 'text' => 'Confirm owner', 'done' => false]],
        ]];
        $task['links'] = [['title' => 'Handover guide', 'url' => 'https://example.test/guide']];
        $updated = $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertOk()
            ->assertJsonPath('tasks.0.status', 'IN_PROGRESS')
            ->assertJsonPath('tasks.0.title', 'Prepare a verified handover')
            ->assertJsonPath('tasks.0.subtasks.0.title', 'Collect evidence')
            ->assertJsonPath('tasks.0.comments.0.text', 'Started the handover work')
            ->assertJsonPath('tasks.0.checklists.0.items.0.text', 'Confirm owner')
            ->assertJsonPath('tasks.0.links.0.url', 'https://example.test/guide');

        $task = $updated->json('tasks.0');
        Storage::fake('local');
        $attachment = $this->post('/demo-work/tasks/TEST-1/attachments', [
            'file' => UploadedFile::fake()->createWithContent('handover.txt', 'Handover evidence'),
            'section' => 'description',
        ])->assertCreated()->json('attachment');
        $this->assertSame('handover.txt', $attachment['name']);
        Storage::disk('local')->assertExists("demo-work-attachments/{$attachment['id']}.txt");
        $this->get("/demo-work/tasks/TEST-1/attachments/{$attachment['id']}")
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $task['attachments'][] = $attachment;
        $task['links'][] = ['title' => 'Unsafe link', 'url' => 'javascript:alert(1)'];
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('links');
        $task = $updated->json('tasks.0');
        $task['attachments'][] = $attachment;
        $task['checklists'][0]['items'][0]['done'] = true;
        $task = $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertOk()
            ->assertJsonPath('tasks.0.checklists.0.items.0.done', true)
            ->json('tasks.0');
        $task['progress'] = 100;
        $task['checkins'][] = ['text' => 'All handover details are ready', 'pct' => 100, 'at' => now()->toIso8601String()];
        $task['status'] = 'IN_REVIEW';
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $task['subtasks'][0]['done'] = true;
        $task['status'] = 'COMPLETED';
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $task['status'] = 'IN_REVIEW';
        $reviewPending = $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertOk()
            ->assertJsonPath('tasks.0.status', 'IN_REVIEW');

        $task = $reviewPending->json('tasks.0');
        $task['status'] = 'COMPLETED';
        $this->postJson('/demo-auth/login', [
            'email' => 'outsider@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->postJson('/demo-auth/login', [
            'email' => 'reviewer@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();

        $repository = app(\App\Services\DemoAuthRepository::class);
        $repository->transaction(function (array &$state): void {
            foreach ($state['tasks'] as &$storedTask) {
                if (($storedTask['id'] ?? null) === 'TEST-1') {
                    unset($storedTask['reviewer_id']);
                }
            }
        });
        unset($task['reviewer_id']);
        $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
        $repository->transaction(function (array &$state) use ($reviewer): void {
            foreach ($state['tasks'] as &$storedTask) {
                if (($storedTask['id'] ?? null) === 'TEST-1') {
                    $storedTask['reviewer_id'] = $reviewer['id'];
                }
            }
        });

        $completed = $this->postJson('/demo-work/tasks/sync', ['tasks' => [$task]])
            ->assertOk()
            ->assertJsonPath('tasks.0.status', 'COMPLETED')
            ->assertJsonPath('tasks.0.progress', 100);
        $this->assertNotEmpty($completed->json('tasks.0.approvedAt'));

        $this->get('/')->assertOk()->assertSee('Prepare a verified handover');
    }

    public function test_non_review_task_keeps_the_existing_direct_completion_flow(): void
    {
        $admin = $this->createAdmin();
        $service = app(DemoAuthService::class);
        $task = $service->syncTasks($admin, [[
            'id' => 'NO-REVIEW-1',
            'title' => 'Complete without review',
            'assignee_id' => $admin['id'],
            'review' => false,
            'due' => '2027-12-31',
        ]])[0];

        $task['status'] = 'IN_PROGRESS';
        $task = $service->syncTasks($admin, [$task])[0];
        $task['progress'] = 100;
        $task['checkins'][] = ['text' => 'All work is complete', 'pct' => 100];
        $task['status'] = 'COMPLETED';

        $completed = $service->syncTasks($admin, [$task])[0];

        $this->assertSame('COMPLETED', $completed['status']);
        $this->assertSame(false, $completed['review']);
    }

    public function test_demo_kpi_bank_is_loaded_for_authenticated_users_with_its_source_year_preserved(): void
    {
        $this->get('/')->assertOk()->assertDontSee('BFC-DEMO-KPI-001');
        $this->createAdmin();

        $this->postJson('/demo-auth/login', [
            'email' => 'admin@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();

        $this->get('/')
            ->assertOk()
            ->assertSee('BFC-DEMO-KPI-001')
            ->assertSee('"demo_cycle_year":2026', false)
            ->assertSee('"historical_source_year":2024', false);
    }

    public function test_suspended_account_cannot_log_in(): void
    {
        $admin = $this->createAdmin();
        $service = app(DemoAuthService::class);
        $service->setEmailDomains(['bfc.test'], $admin);
        $request = $service->register($this->registrationData());
        $approved = $service->decideRequest($request['id'], 'approve', 'EMPLOYEE', [], null, $admin);
        $service->updateUser($approved['user_id'], ['status' => 'SUSPENDED'], $admin);

        $this->postJson('/demo-auth/login', [
            'email' => 'staff@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    private function createAdmin(): array
    {
        return app(DemoAuthService::class)->createSystemAdmin(
            'admin@bfc.test',
            'System Admin',
            'Correct-Horse-Battery'
        );
    }

    private function createReviewer(DemoAuthService $service, array $admin, string $email, string $name, array $departments = ['Operations']): array
    {
        $registration = $this->registrationData();
        $registration['email'] = $email;
        $registration['name'] = $name;
        $registration['job_title'] = 'Reviewer';
        $request = $service->register($registration);
        $approved = $service->decideRequest($request['id'], 'approve', 'REVIEWER', [
            'departments' => $departments,
            'projects' => [],
            'organization' => false,
        ], null, $admin);

        return app(\App\Services\DemoAccessService::class)->currentUser($approved['user_id']);
    }

    private function registrationData(): array
    {
        return [
            'email' => 'staff@bfc.test',
            'name' => 'Staff Member',
            'department' => 'Operations',
            'job_title' => '',
            'password' => 'Correct-Horse-Battery',
            'password_confirmation' => 'Correct-Horse-Battery',
        ];
    }
}
