<?php

namespace Tests\Feature;

use App\Services\DemoAuthService;
use App\Services\DemoProjectService;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class DemoProjectTest extends TestCase
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

    public function test_can_list_create_update_and_delete_project(): void
    {
        $admin = $this->createAdmin();
        $this->postJson('/demo-auth/login', [
            'email' => 'admin@bfc.test',
            'password' => 'Correct-Horse-Battery',
        ])->assertOk();

        // 1. List projects initially empty
        $response = $this->getJson('/demo-work/projects');
        $response->assertOk();
        $response->assertJson(['projects' => []]);

        // 2. Create a project
        $createRes = $this->postJson('/demo-work/projects', [
            'name' => 'Dự án Nâng cấp ERP',
            'description' => 'Hiện đại hóa hệ thống quản trị',
            'department' => 'CNTT',
            'priority' => 'HIGH',
            'start_date' => '2026-10-01',
            'end_date' => '2026-12-31',
        ]);
        $createRes->assertCreated();
        $projectId = $createRes->json('project.id');
        $this->assertNotEmpty($projectId);
        $this->assertEquals('PRJ-0001', $createRes->json('project.code'));
        $this->assertEquals('Dự án Nâng cấp ERP', $createRes->json('project.name'));

        // 3. Prevent duplicate project name
        $this->postJson('/demo-work/projects', [
            'name' => 'dự án nâng cấp erp',
        ])->assertUnprocessable()->assertJsonValidationErrors('name');

        // 4. Update the project
        $updateRes = $this->putJson("/demo-work/projects/{$projectId}", [
            'name' => 'Dự án Nâng cấp ERP v2',
            'status' => 'ACTIVE',
            'priority' => 'MEDIUM',
        ]);
        $updateRes->assertOk();
        $this->assertEquals('Dự án Nâng cấp ERP v2', $updateRes->json('project.name'));

        // 5. Delete the project
        $deleteRes = $this->deleteJson("/demo-work/projects/{$projectId}");
        $deleteRes->assertOk();

        // 6. List projects again - should be empty
        $this->getJson('/demo-work/projects')
            ->assertOk()
            ->assertJson(['projects' => []]);
    }

    private function createAdmin(): array
    {
        return app(DemoAuthService::class)->createSystemAdmin(
            'admin@bfc.test',
            'System Admin',
            'Correct-Horse-Battery'
        );
    }
}
