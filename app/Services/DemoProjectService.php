<?php

namespace App\Services;

use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * DemoProjectService — Nghiệp vụ quản lý Dự án.
 *
 * Quy tắc nghiệp vụ:
 *  - Tên dự án phải duy nhất (không phân biệt hoa thường).
 *  - Mã dự án (code) tự sinh theo dạng PRJ-XXXX, dựa trên số thứ tự.
 *  - Ai có tasks.create đều có thể tạo dự án.
 *  - Sửa / đổi trạng thái: tasks.edit_scoped HOẶC tasks.assign.
 *  - Chỉ xóa được khi không còn công việc nào liên kết (project_id).
 *  - Khi đổi tên dự án, tên hiển thị (project) trong task cũng được cập nhật ngay.
 */
class DemoProjectService
{
    public function __construct(
        private readonly DemoAuthRepository $repository,
        private readonly DemoAccessService  $access,
    ) {}

    // ─── Queries ─────────────────────────────────────────────────────────────

    /**
     * Trả về toàn bộ danh sách dự án, kèm thống kê công việc tổng hợp.
     * Người dùng nào đang đăng nhập (ACTIVE) đều thấy danh sách dự án.
     */
    public function listProjects(array $actor): array
    {
        $state = $this->repository->read();
        if (empty($state['projects'])) {
            $this->seedProjectsFromTasks();
            $state = $this->repository->read();
        }

        $projects = $state['projects'] ?? [];
        usort($projects, fn ($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));

        return array_values(array_map(
            fn (array $project) => $this->publicProject($project, $state),
            $projects,
        ));
    }

    public function seedProjectsFromTasks(): void
    {
        $this->repository->transaction(function (array &$state) {
            $state['projects'] ??= [];
            $state['tasks'] ??= [];
            if (! empty($state['projects'])) {
                return;
            }

            $uniqueNames = [];
            foreach ($state['tasks'] as $task) {
                $name = trim((string) ($task['project'] ?? ''));
                if ($name !== '' && ! in_array($name, $uniqueNames, true)) {
                    $uniqueNames[] = $name;
                }
            }

            if (empty($uniqueNames)) {
                return;
            }

            $counter = 1;
            $now = now()->toIso8601String();
            $adminId = $state['users'][0]['id'] ?? 'SYSTEM';

            foreach ($uniqueNames as $name) {
                $projectId = (string) Str::uuid();
                $code = sprintf('PRJ-%04d', $counter++);

                $project = [
                    'id' => $projectId,
                    'code' => $code,
                    'name' => $name,
                    'description' => "Dự án {$name}",
                    'department' => 'Toàn công ty',
                    'status' => 'ACTIVE',
                    'priority' => 'MEDIUM',
                    'start_date' => now()->format('Y-m-01'),
                    'end_date' => now()->addMonths(3)->format('Y-m-t'),
                    'created_by' => $adminId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                $state['projects'][] = $project;

                foreach ($state['tasks'] as &$task) {
                    if (trim((string) ($task['project'] ?? '')) === $name) {
                        $task['project_id'] = $projectId;
                    }
                }
                unset($task);
            }
        });
    }

    // ─── Commands ─────────────────────────────────────────────────────────────

    public function createProject(array $input, array $actor): array
    {
        if (! $this->access->can($actor, 'tasks.create')) {
            throw ValidationException::withMessages(['project' => 'Vai trò hiện tại không có quyền tạo dự án.']);
        }

        return $this->repository->transaction(function (array &$state) use ($input, $actor) {
            $state['projects'] ??= [];
            $state['tasks'] ??= [];
            $name = $this->validatedName($input['name'] ?? '', $state['projects']);

            $code    = $this->nextCode($state['projects']);
            $now     = now()->toIso8601String();

            $project = [
                'id'          => (string) Str::uuid(),
                'code'        => $code,
                'name'        => $name,
                'description' => mb_substr(trim((string) ($input['description'] ?? '')), 0, 500),
                'department'  => mb_substr(trim((string) ($input['department']  ?? '')), 0, 100),
                'status'      => 'ACTIVE',
                'priority'    => in_array($input['priority'] ?? 'MEDIUM', ['HIGH', 'MEDIUM', 'LOW'], true)
                    ? $input['priority']
                    : 'MEDIUM',
                'start_date'  => $this->sanitizeDate($input['start_date'] ?? null),
                'end_date'    => $this->sanitizeDate($input['end_date']   ?? null),
                'created_by'  => $actor['id'],
                'created_at'  => $now,
                'updated_at'  => $now,
            ];

            // Validate date range
            if ($project['start_date'] && $project['end_date']
                && $project['start_date'] > $project['end_date']) {
                throw ValidationException::withMessages(['end_date' => 'Ngày kết thúc phải sau ngày bắt đầu.']);
            }

            array_unshift($state['projects'], $project);
            $this->audit($state, 'project_created', $project['id'], ['name' => $name, 'code' => $code], $actor['id']);

            return $this->publicProject($project, $state);
        });
    }

    public function updateProject(string $projectId, array $input, array $actor): array
    {
        if (! $this->canManageProject($actor)) {
            throw ValidationException::withMessages(['project' => 'Vai trò hiện tại không có quyền chỉnh sửa dự án.']);
        }

        return $this->repository->transaction(function (array &$state) use ($projectId, $input, $actor) {
            $state['projects'] ??= [];
            $state['tasks'] ??= [];
            $index = $this->findIndex($state['projects'], $projectId);
            if ($index === null) {
                throw ValidationException::withMessages(['project' => 'Không tìm thấy dự án.']);
            }

            $project   = &$state['projects'][$index];
            $oldName   = $project['name'];
            $nameChanged = false;

            if (array_key_exists('name', $input)) {
                $newName = $this->validatedName($input['name'], $state['projects'], $projectId);
                if ($newName !== $oldName) {
                    $project['name'] = $newName;
                    $nameChanged = true;
                }
            }

            if (array_key_exists('description', $input)) {
                $project['description'] = mb_substr(trim((string) ($input['description'] ?? '')), 0, 500);
            }
            if (array_key_exists('department', $input)) {
                $project['department'] = mb_substr(trim((string) ($input['department'] ?? '')), 0, 100);
            }
            if (array_key_exists('priority', $input)
                && in_array($input['priority'], ['HIGH', 'MEDIUM', 'LOW'], true)) {
                $project['priority'] = $input['priority'];
            }
            if (array_key_exists('status', $input)
                && in_array($input['status'], ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'], true)) {
                $project['status'] = $input['status'];
            }
            if (array_key_exists('start_date', $input)) {
                $project['start_date'] = $this->sanitizeDate($input['start_date']);
            }
            if (array_key_exists('end_date', $input)) {
                $project['end_date'] = $this->sanitizeDate($input['end_date']);
            }

            if ($project['start_date'] && $project['end_date']
                && $project['start_date'] > $project['end_date']) {
                throw ValidationException::withMessages(['end_date' => 'Ngày kết thúc phải sau ngày bắt đầu.']);
            }

            $project['updated_at'] = now()->toIso8601String();

            // Khi đổi tên dự án → cập nhật tên hiển thị trong tất cả task liên kết
            if ($nameChanged) {
                foreach ($state['tasks'] as &$task) {
                    if (($task['project_id'] ?? null) === $projectId) {
                        $task['project'] = $project['name'];
                    }
                }
                unset($task);
            }

            $this->audit($state, 'project_updated', $projectId, [
                'name'   => $project['name'],
                'status' => $project['status'],
            ], $actor['id']);

            return $this->publicProject($project, $state);
        });
    }

    public function deleteProject(string $projectId, array $actor): void
    {
        if (! $this->canManageProject($actor)) {
            throw ValidationException::withMessages(['project' => 'Vai trò hiện tại không có quyền xóa dự án.']);
        }

        $this->repository->transaction(function (array &$state) use ($projectId, $actor) {
            $state['projects'] ??= [];
            $state['tasks'] ??= [];
            $index = $this->findIndex($state['projects'], $projectId);
            if ($index === null) {
                throw ValidationException::withMessages(['project' => 'Không tìm thấy dự án.']);
            }

            $project = $state['projects'][$index];

            // Kiểm tra toàn vẹn: không cho xóa khi còn task liên kết
            $linkedCount = count(array_filter(
                $state['tasks'],
                fn (array $task) => ($task['project_id'] ?? null) === $projectId,
            ));
            if ($linkedCount > 0) {
                throw ValidationException::withMessages([
                    'project' => "Dự án \"{$project['name']}\" đang có {$linkedCount} công việc liên kết. "
                        . 'Hãy chuyển hoặc hoàn thành toàn bộ công việc trước khi xóa dự án.',
                ]);
            }

            array_splice($state['projects'], $index, 1);
            $this->audit($state, 'project_deleted', $projectId, ['name' => $project['name']], $actor['id']);
        });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Dữ liệu công khai của dự án, bao gồm thống kê task tổng hợp.
     */
    public function publicProject(array $project, array $state): array
    {
        $tasks     = array_filter($state['tasks'], fn ($t) => ($t['project_id'] ?? null) === $project['id']);
        $total     = count($tasks);
        $done      = count(array_filter($tasks, fn ($t) => ($t['status'] ?? '') === 'COMPLETED'));
        $overdue   = count(array_filter($tasks, fn ($t) => $this->isOverdue($t)));
        $inReview  = count(array_filter($tasks, fn ($t) => ($t['status'] ?? '') === 'IN_REVIEW'));
        $progress  = $total > 0
            ? (int) round(array_sum(array_column(array_values($tasks), 'progress')) / $total)
            : 0;

        // Người tham gia dự án (assignee + creator duy nhất)
        $memberIds = array_values(array_unique(array_merge(
            array_filter(array_column(array_values($tasks), 'creator_id')),
            array_filter(array_column(array_values($tasks), 'assignee_id')),
        )));

        return [
            'id'          => $project['id'],
            'code'        => $project['code']        ?? '',
            'name'        => $project['name']         ?? '',
            'description' => $project['description']  ?? '',
            'department'  => $project['department']   ?? '',
            'status'      => $project['status']       ?? 'ACTIVE',
            'priority'    => $project['priority']     ?? 'MEDIUM',
            'start_date'  => $project['start_date']   ?? null,
            'end_date'    => $project['end_date']     ?? null,
            'created_by'  => $project['created_by']   ?? null,
            'created_at'  => $project['created_at']   ?? null,
            'updated_at'  => $project['updated_at']   ?? null,
            // computed stats
            'task_count'  => $total,
            'done_count'  => $done,
            'overdue_count' => $overdue,
            'in_review_count' => $inReview,
            'progress'    => $progress,
            'member_ids'  => $memberIds,
        ];
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private function canManageProject(array $actor): bool
    {
        return $this->access->can($actor, 'tasks.edit_scoped')
            || $this->access->can($actor, 'tasks.assign');
    }

    /**
     * Sinh mã dự án dạng PRJ-XXXX (4 chữ số, tự tăng).
     */
    private function nextCode(array $projects): string
    {
        $max = 0;
        foreach ($projects as $p) {
            if (preg_match('/^PRJ-(\d+)$/', $p['code'] ?? '', $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return sprintf('PRJ-%04d', $max + 1);
    }

    /**
     * Validate và chuẩn hoá tên dự án, kiểm tra trùng tên.
     *
     * @param  array  $existingProjects  Mảng projects trong $state
     * @param  string|null  $excludeId   ID dự án đang chỉnh sửa (để bỏ qua khi check trùng)
     */
    private function validatedName(mixed $raw, array $existingProjects, ?string $excludeId = null): string
    {
        $name = mb_substr(trim((string) $raw), 0, 120);
        if (mb_strlen($name) < 2) {
            throw ValidationException::withMessages(['name' => 'Tên dự án cần ít nhất 2 ký tự.']);
        }

        foreach ($existingProjects as $p) {
            if (($excludeId !== null && $p['id'] === $excludeId)) {
                continue;
            }
            if (mb_strtolower($p['name']) === mb_strtolower($name)) {
                throw ValidationException::withMessages(['name' => "Tên dự án \"{$name}\" đã tồn tại. Hãy chọn tên khác."]);
            }
        }

        return $name;
    }

    private function sanitizeDate(mixed $value): ?string
    {
        if (! $value || ! is_string($value)) {
            return null;
        }
        $cleaned = trim($value);

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $cleaned) ? $cleaned : null;
    }

    private function isOverdue(array $task): bool
    {
        if (in_array($task['status'] ?? '', ['COMPLETED', 'IN_REVIEW'], true)) {
            return false;
        }

        return ! empty($task['due']) && $task['due'] < date('Y-m-d');
    }

    private function findIndex(array $items, string $id): ?int
    {
        foreach ($items as $index => $item) {
            if (($item['id'] ?? null) === $id) {
                return $index;
            }
        }

        return null;
    }

    private function audit(array &$state, string $action, string $subject, array $metadata, string $actorId): void
    {
        $state['audit_logs'][] = [
            'id'         => (string) Str::uuid(),
            'action'     => $action,
            'subject'    => $subject,
            'actor_id'   => $actorId,
            'metadata'   => $metadata,
            'created_at' => now()->toIso8601String(),
        ];
    }
}
