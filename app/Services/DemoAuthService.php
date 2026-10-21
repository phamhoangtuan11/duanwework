<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;

class DemoAuthService
{
    private const PERMISSIONS = [
        'accounts.manage',
        'roles.manage',
        'domains.manage',
        'tasks.create',
        'tasks.view_related',
        'tasks.update_related',
        'tasks.comment_related',
        'tasks.view_scoped',
        'tasks.assign',
        'tasks.review',
        'tasks.edit_scoped',
    ];

    public function __construct(
        private DemoAuthRepository $repository,
        private DemoAccessService $access,
    ) {
    }

    public function register(array $input): array
    {
        return $this->repository->transaction(function (array &$state) use ($input) {
            $email = mb_strtolower(trim($input['email']));
            $domain = substr(strrchr($email, '@') ?: '', 1);
            if ($state['email_domains'] === []) {
                throw ValidationException::withMessages(['email' => 'Đăng ký đang tạm khóa. SYSTEM_ADMIN cần cấu hình miền email công ty trong Cài đặt.']);
            }
            if (! in_array($domain, $state['email_domains'], true)) {
                throw ValidationException::withMessages(['email' => 'Email không thuộc miền công ty được phép đăng ký.']);
            }

            foreach ($state['users'] as $user) {
                if ($user['email'] === $email) {
                    throw ValidationException::withMessages(['email' => 'Email này đã có tài khoản hoặc đang bị khóa. Hãy liên hệ Quản trị hệ thống.']);
                }
            }
            foreach ($state['access_requests'] as $request) {
                if ($request['email'] === $email && in_array($request['status'], ['PENDING', 'MORE_INFO'], true)) {
                    throw ValidationException::withMessages(['email' => 'Email này đã có yêu cầu cấp quyền đang chờ xử lý.']);
                }
            }

            $request = [
                'id' => (string) Str::uuid(),
                'email' => $email,
                'name' => trim($input['name']),
                'department' => trim($input['department']),
                'job_title' => trim($input['job_title'] ?? ''),
                'password_hash' => Hash::make($input['password']),
                'status' => 'PENDING',
                'admin_note' => null,
                'requested_at' => now()->toIso8601String(),
                'reviewed_at' => null,
                'reviewed_by' => null,
                'user_id' => null,
            ];
            $state['access_requests'][] = $request;
            $this->notifyAdmins($state, 'Yêu cầu cấp quyền mới', "{$request['name']} ({$email}) đang chờ xác minh.", $request['id']);

            return $this->publicRequest($request);
        });
    }

    public function login(string $email, string $password): array
    {
        $state = $this->repository->read();
        $email = mb_strtolower(trim($email));
        foreach ($state['users'] as $user) {
            if ($user['email'] !== $email) {
                continue;
            }
            if ($user['status'] !== 'ACTIVE') {
                throw ValidationException::withMessages(['email' => $this->statusMessage($user['status'])]);
            }
            if (! Hash::check($password, $user['password_hash'])) {
                throw ValidationException::withMessages(['email' => 'Email hoặc mật khẩu không chính xác.']);
            }

            return $this->access->publicUser($user, $state);
        }

        foreach (array_reverse($state['access_requests']) as $request) {
            if ($request['email'] !== $email || ! Hash::check($password, $request['password_hash'])) {
                continue;
            }
            $message = $request['status'] === 'PENDING'
                ? 'Yêu cầu của bạn đang chờ Quản trị hệ thống xác minh và cấp quyền.'
                : ($request['status'] === 'MORE_INFO'
                    ? 'Quản trị hệ thống yêu cầu bổ sung thông tin: '.($request['admin_note'] ?: 'Hãy liên hệ bộ phận quản trị.')
                    : 'Yêu cầu cấp quyền đã bị từ chối. Hãy liên hệ Quản trị hệ thống nếu cần hỗ trợ.');
            throw ValidationException::withMessages(['email' => $message]);
        }

        throw ValidationException::withMessages(['email' => 'Email hoặc mật khẩu không chính xác. Nếu chưa có tài khoản, hãy gửi yêu cầu đăng ký.']);
    }

    public function createSystemAdmin(string $email, string $name, string $password): array
    {
        return $this->repository->transaction(function (array &$state) use ($email, $name, $password) {
            foreach ($state['users'] as $user) {
                if ($user['role_id'] === 'SYSTEM_ADMIN') {
                    throw ValidationException::withMessages(['email' => 'SYSTEM_ADMIN đã được khởi tạo. Lệnh này chỉ dùng một lần.']);
                }
                if ($user['email'] === mb_strtolower($email)) {
                    throw ValidationException::withMessages(['email' => 'Email này đã được sử dụng.']);
                }
            }

            $id = (string) Str::uuid();
            $user = [
                'id' => $id,
                'name' => trim($name),
                'email' => mb_strtolower(trim($email)),
                'department' => 'Quản trị hệ thống',
                'job_title' => 'SYSTEM_ADMIN',
                'password_hash' => Hash::make($password),
                'role_id' => 'SYSTEM_ADMIN',
                'status' => 'ACTIVE',
                'created_at' => now()->toIso8601String(),
                'approved_at' => now()->toIso8601String(),
                'approved_by' => 'CLI_SETUP',
            ];
            $state['users'][] = $user;
            $state['user_role_scopes'][$id] = ['departments' => [], 'projects' => [], 'organization' => false];
            $this->audit($state, 'system_admin_bootstrapped', $id, ['email' => $user['email']], 'CLI_SETUP');

            return $this->access->publicUser($user, $state);
        });
    }

    public function adminData(): array
    {
        $state = $this->repository->read();

        return [
            'email_domains' => $state['email_domains'],
            'requests' => array_values(array_map(fn (array $item) => $this->publicRequest($item), array_reverse($state['access_requests']))),
            'users' => array_values(array_map(fn (array $item) => $this->access->publicUser($item, $state), $state['users'])),
            'roles' => $state['roles'],
            'notifications' => array_values(array_reverse($state['notifications'])),
            'audit_logs' => array_slice(array_reverse($state['audit_logs']), 0, 100),
        ];
    }

    public function setEmailDomains(array $domains, array $actor): void
    {
        $domains = array_values(array_unique(array_map(
            fn ($domain) => mb_strtolower(ltrim(trim($domain), '@')),
            $domains
        )));
        foreach ($domains as $domain) {
            if (! preg_match('/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/', $domain)) {
                throw ValidationException::withMessages(['domains' => "Miền email “{$domain}” không hợp lệ."]);
            }
        }

        $this->repository->transaction(function (array &$state) use ($domains, $actor) {
            $state['email_domains'] = $domains;
            $this->audit($state, 'email_domains_updated', 'registration', ['domains' => $domains], $actor['id']);
        });
    }

    public function decideRequest(string $requestId, string $decision, ?string $roleId, array $scope, ?string $note, array $actor): array
    {
        return $this->repository->transaction(function (array &$state) use ($requestId, $decision, $roleId, $scope, $note, $actor) {
            $index = $this->findIndex($state['access_requests'], $requestId);
            if ($index === null || ! in_array($state['access_requests'][$index]['status'], ['PENDING', 'MORE_INFO'], true)) {
                throw ValidationException::withMessages(['request' => 'Yêu cầu không còn ở trạng thái chờ xử lý.']);
            }
            $request = &$state['access_requests'][$index];
            $role = $this->findRole($state, (string) $roleId);
            if ($decision === 'approve' && (! $role || $role['id'] === 'SYSTEM_ADMIN')) {
                throw ValidationException::withMessages(['role' => 'Chọn vai trò nghiệp vụ hợp lệ. Không thể cấp SYSTEM_ADMIN qua yêu cầu đăng ký.']);
            }

            if ($decision === 'approve') {
                foreach ($state['users'] as $user) {
                    if ($user['email'] === $request['email']) {
                        throw ValidationException::withMessages(['request' => 'Email này đã có tài khoản.']);
                    }
                }
                $userId = (string) Str::uuid();
                $user = [
                    'id' => $userId,
                    'name' => $request['name'],
                    'email' => $request['email'],
                    'department' => $request['department'],
                    'job_title' => $request['job_title'],
                    'password_hash' => $request['password_hash'],
                    'role_id' => $role['id'],
                    'status' => 'ACTIVE',
                    'created_at' => $request['requested_at'],
                    'approved_at' => now()->toIso8601String(),
                    'approved_by' => $actor['id'],
                ];
                $state['users'][] = $user;
                $state['user_role_scopes'][$userId] = $this->normalizeScope($scope);
                $request['status'] = 'APPROVED';
                $request['user_id'] = $userId;
                $this->notify($state, $userId, 'Tài khoản đã được cấp quyền', 'Tài khoản đã kích hoạt với vai trò '.$role['label'].'.');
                $this->audit($state, 'access_request_approved', $userId, ['request_id' => $requestId, 'role_id' => $role['id'], 'scope' => $state['user_role_scopes'][$userId]], $actor['id']);
            } elseif ($decision === 'reject') {
                $request['status'] = 'REJECTED';
                $request['admin_note'] = $note;
                $this->notify($state, null, 'Yêu cầu cấp quyền bị từ chối', $request['email'].': '.($note ?: 'Hãy liên hệ Quản trị hệ thống.'));
                $this->audit($state, 'access_request_rejected', $requestId, ['note' => $note], $actor['id']);
            } elseif ($decision === 'more_info') {
                if (! $note) {
                    throw ValidationException::withMessages(['note' => 'Nhập nội dung cần bổ sung.']);
                }
                $request['status'] = 'MORE_INFO';
                $request['admin_note'] = $note;
                $this->notify($state, null, 'Yêu cầu bổ sung thông tin', $request['email'].': '.$note);
                $this->audit($state, 'access_request_more_info', $requestId, ['note' => $note], $actor['id']);
            } else {
                throw ValidationException::withMessages(['decision' => 'Lựa chọn xử lý không hợp lệ.']);
            }

            $request['reviewed_at'] = now()->toIso8601String();
            $request['reviewed_by'] = $actor['id'];

            return $this->publicRequest($request);
        });
    }

    public function updateUser(string $userId, array $input, array $actor): array
    {
        return $this->repository->transaction(function (array &$state) use ($userId, $input, $actor) {
            $index = $this->findIndex($state['users'], $userId);
            if ($index === null) {
                throw ValidationException::withMessages(['user' => 'Không tìm thấy tài khoản.']);
            }
            $user = &$state['users'][$index];
            $isSelf = $userId === $actor['id'];
            $isSystemAdmin = $user['role_id'] === 'SYSTEM_ADMIN';
            if (($isSelf && ! $isSystemAdmin)
                || ($isSystemAdmin && ! $isSelf)
                || ($input['role_id'] ?? null) === 'SYSTEM_ADMIN') {
                throw ValidationException::withMessages(['role_id' => 'SYSTEM_ADMIN không thể được sửa hoặc cấp từ giao diện quản lý.']);
            }
            if ($isSelf && (array_key_exists('role_id', $input) || array_key_exists('status', $input))) {
                throw ValidationException::withMessages(['user' => 'Không thể tự thay đổi vai trò hoặc trạng thái tài khoản.']);
            }

            $before = [
                'name' => $user['name'],
                'department' => $user['department'] ?? '',
                'job_title' => $user['job_title'] ?? '',
                'role_id' => $user['role_id'],
                'status' => $user['status'],
                'scope' => $state['user_role_scopes'][$userId] ?? [],
            ];
            $previousName = $user['name'];
            if (array_key_exists('name', $input)) {
                $user['name'] = trim($input['name']);
            }
            if (array_key_exists('department', $input)) {
                $user['department'] = trim((string) ($input['department'] ?? ''));
            }
            if (array_key_exists('job_title', $input)) {
                $user['job_title'] = trim((string) ($input['job_title'] ?? ''));
            }
            if ($user['name'] !== $previousName) {
                foreach ($state['tasks'] as &$task) {
                    if (($task['assignee_id'] ?? null) === $userId) {
                        $task['assignee'] = $user['name'];
                    }
                    if (($task['creator_id'] ?? null) === $userId) {
                        $task['creator'] = $user['name'];
                    }
                }
                unset($task);
            }
            if (isset($input['role_id'])) {
                if (! $this->findRole($state, $input['role_id'])) {
                    throw ValidationException::withMessages(['role_id' => 'Vai trò không hợp lệ.']);
                }
                $user['role_id'] = $input['role_id'];
            }
            if (isset($input['status'])) {
                if (! in_array($input['status'], ['ACTIVE', 'SUSPENDED', 'DISABLED'], true)) {
                    throw ValidationException::withMessages(['status' => 'Trạng thái tài khoản không hợp lệ.']);
                }
                $user['status'] = $input['status'];
            }
            if (isset($input['scope'])) {
                $state['user_role_scopes'][$userId] = $this->normalizeScope($input['scope']);
            }

            $after = [
                'name' => $user['name'],
                'department' => $user['department'] ?? '',
                'job_title' => $user['job_title'] ?? '',
                'role_id' => $user['role_id'],
                'status' => $user['status'],
                'scope' => $state['user_role_scopes'][$userId] ?? [],
            ];
            $this->audit($state, 'account_access_updated', $userId, ['before' => $before, 'after' => $after], $actor['id']);

            return $this->access->publicUser($user, $state);
        });
    }

    public function updateRole(string $roleId, array $input, array $actor): array
    {
        if ($roleId === 'SYSTEM_ADMIN' || ! in_array($roleId, ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'PROJECT_MANAGER', 'REVIEWER', 'DEPUTY_GM', 'CHAIRMAN'], true)) {
            throw ValidationException::withMessages(['role' => 'Không thể chỉnh sửa vai trò SYSTEM_ADMIN hoặc vai trò không được hỗ trợ.']);
        }

        return $this->repository->transaction(function (array &$state) use ($roleId, $input, $actor) {
            $index = $this->findIndex($state['roles'], $roleId);
            if ($index === null) {
                throw ValidationException::withMessages(['role' => 'Không tìm thấy vai trò.']);
            }
            $before = $state['roles'][$index];
            $permissions = array_values(array_unique($input['permissions']));
            if (array_diff($permissions, self::PERMISSIONS)) {
                throw ValidationException::withMessages(['permissions' => 'Danh sách quyền chứa quyền không hợp lệ.']);
            }
            $state['roles'][$index]['label'] = trim($input['label']);
            $state['roles'][$index]['permissions'] = $permissions;
            $this->audit($state, 'role_permissions_updated', $roleId, ['before' => $before, 'after' => $state['roles'][$index]], $actor['id']);

            return $state['roles'][$index];
        });
    }

    public function syncTasks(array $actor, array $incoming): array
    {
        return $this->repository->transaction(function (array &$state) use ($actor, $incoming) {
            if (count($incoming) > 2000) {
                throw ValidationException::withMessages(['tasks' => 'Mỗi lần chỉ đồng bộ tối đa 2.000 công việc.']);
            }

            $changed = false;
            foreach ($incoming as $candidate) {
                if (! is_array($candidate) || ! isset($candidate['id'], $candidate['title'])) {
                    throw ValidationException::withMessages(['tasks' => 'Dữ liệu công việc không hợp lệ.']);
                }
                $index = $this->findIndex($state['tasks'], (string) $candidate['id']);
                if ($index === null) {
                    $task = $this->newTask($state, $actor, $candidate);
                    $state['tasks'][] = $task;
                    $this->audit($state, 'task_created', $task['id'], ['title' => $task['title']], $actor['id']);
                    $changed = true;
                    continue;
                }

                $updated = $this->updateTask($state, $actor, $state['tasks'][$index], $candidate);
                if ($updated !== $state['tasks'][$index]) {
                    $state['tasks'][$index] = $updated;
                    $changed = true;
                }
            }

            if ($changed) {
                $this->audit($state, 'tasks_updated', 'work', ['count' => count($incoming)], $actor['id']);
            }

            return array_values(array_filter($state['tasks'], fn (array $task) => $this->access->canViewTask($actor, $task, $state)));
        });
    }

    public function importLegacyTasks(array $actor, array $incoming): array
    {
        $importable = [];
        foreach ($incoming as $task) {
            if (! is_array($task) || empty($task['title']) || empty($task['id'])) {
                continue;
            }
            $task['creator'] = $actor['name'];
            $task['creator_id'] = $actor['id'];
            $task['assignee'] = $actor['name'];
            $task['assignee_id'] = $actor['id'];
            $task['department_id'] = $actor['department'] ?? null;
            $task['events'] = array_slice($task['events'] ?? [], 0, 100);
            $importable[] = $task;
        }

        return $this->syncTasks($actor, $importable);
    }

    public function addTaskAttachment(string $taskId, UploadedFile $file, string $section, array $actor): array
    {
        $mime = $file->getMimeType();
        $extensions = [
            'application/pdf' => 'pdf',
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'text/plain' => 'txt',
            'text/csv' => 'csv',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
        ];
        if (! isset($extensions[$mime]) || $file->getSize() > 512 * 1024) {
            throw ValidationException::withMessages(['file' => 'Chỉ nhận PDF, ảnh, văn bản, CSV, Word hoặc Excel tối đa 500 KB.']);
        }

        $attachmentId = (string) Str::uuid();
        $extension = $extensions[$mime];
        $path = "demo-work-attachments/{$attachmentId}.{$extension}";
        if (! $file->storeAs('demo-work-attachments', "{$attachmentId}.{$extension}", 'local')) {
            throw new \RuntimeException('Không thể lưu tài liệu vào kho riêng của ứng dụng.');
        }

        try {
            return $this->repository->transaction(function (array &$state) use ($taskId, $actor, $section, $file, $mime, $attachmentId, $extension) {
                $index = $this->findIndex($state['tasks'], $taskId);
                $task = $index === null ? null : $state['tasks'][$index];
                $canAttachComment = $section === 'comment'
                    && $task
                    && $this->access->canViewTask($actor, $task, $state)
                    && $this->access->can($actor, 'tasks.comment_related', $state);
                $canEditTask = $task && $this->access->canEditTask($actor, $task, $state);
                if (! $task || (! $canAttachComment && ! $canEditTask)
                    || ($section !== 'comment' && ($task['status'] ?? null) === 'COMPLETED')) {
                    throw ValidationException::withMessages(['task' => 'Không có quyền đính kèm tài liệu cho công việc này.']);
                }
                $task = &$state['tasks'][$index];
                $task['attachments'] ??= [];
                $task['events'] ??= [];
                $attachments = $task['attachments'] ?? [];
                $totalSize = array_sum(array_column($attachments, 'size'));
                if (count($attachments) >= 5 || $totalSize + $file->getSize() > 2 * 1024 * 1024) {
                    throw ValidationException::withMessages(['file' => 'Mỗi công việc nhận tối đa 5 tài liệu và tổng dung lượng 2 MB.']);
                }
                $attachment = [
                    'id' => $attachmentId,
                    'name' => mb_substr(basename($file->getClientOriginalName()), 0, 180),
                    'type' => $mime,
                    'extension' => $extension,
                    'size' => $file->getSize(),
                    'section' => $section,
                ];
                $task['attachments'][] = $attachment;
                $task['events'][] = ['actor' => $actor['name'], 'text' => 'Đã đính kèm tài liệu: '.$attachment['name'], 'at' => now()->toIso8601String()];
                $this->audit($state, 'task_attachment_added', $taskId, ['name' => $attachment['name']], $actor['id']);

                return $attachment;
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }
    }

    public function taskAttachment(string $taskId, string $attachmentId, array $actor): ?array
    {
        $state = $this->repository->read();
        $index = $this->findIndex($state['tasks'], $taskId);
        $task = $index === null ? null : $state['tasks'][$index];
        if (! $task || ! $this->access->canViewTask($actor, $task, $state)) {
            return null;
        }

        foreach ($task['attachments'] ?? [] as $attachment) {
            if (($attachment['id'] ?? null) === $attachmentId) {
                return $attachment;
            }
        }

        return null;
    }

    private function newTask(array &$state, array $actor, array $input): array
    {
        if (! $this->access->can($actor, 'tasks.create', $state)) {
            throw ValidationException::withMessages(['task' => 'Vai trò hiện tại không được tạo công việc.']);
        }
        $assigneeId = $this->resolveAssignee($state, $input, $actor);
        $assignee = $this->userById($state, $assigneeId);
        $task = $this->cleanTask($input);
        $task['review'] = (bool) ($task['review'] ?? false);
        $task['creator_id'] = $actor['id'];
        $task['creator'] = $actor['name'];
        $task['assignee_id'] = $assigneeId;
        $task['assignee'] = $assignee['name'];
        $task['department_id'] = $assignee['department'] ?? null;
        if ($task['review']) {
            if (! $task['reviewer_id']) {
                throw ValidationException::withMessages(['reviewer_id' => 'Cần chỉ định người nghiệm thu khi công việc yêu cầu nghiệm thu.']);
            }
            $reviewer = $this->userById($state, $task['reviewer_id']);
            if (! $reviewer || $reviewer['status'] !== 'ACTIVE') {
                throw ValidationException::withMessages(['reviewer_id' => 'Người nghiệm thu phải có tài khoản ACTIVE.']);
            }
            if (! $this->access->canReviewTask($reviewer, $task, $state)) {
                throw ValidationException::withMessages(['reviewer_id' => 'Người được chọn không có quyền nghiệm thu công việc này trong phạm vi hiện tại.']);
            }
        } else {
            $task['reviewer_id'] = null;
        }
        $task['follower_ids'] = [];
        $task['created_at'] = now()->toIso8601String();
        $task['status'] = 'TODO';
        $task['progress'] = 0;
        $task['checkins'] = [];
        $task['events'] = [['actor' => $actor['name'], 'text' => 'Tạo công việc mới', 'at' => now()->toIso8601String()]];
        $task['comments'] = [];
        $task['subtasks'] = [];
        $task['checklists'] = [];
        $task['links'] = [];
        $task['attachments'] = [];

        if ($assigneeId !== $actor['id'] && ! $this->access->canAssignTo($actor, $task, $state)) {
            throw ValidationException::withMessages(['assignee' => 'Không có quyền giao việc cho người này trong phạm vi được cấp.']);
        }

        return $task;
    }

    private function updateTask(array &$state, array $actor, array $current, array $input): array
    {
        if (! $this->access->canViewTask($actor, $current, $state)) {
            throw ValidationException::withMessages(['task' => 'Không có quyền truy cập công việc này.']);
        }
        $updated = $current;
        $candidate = $this->cleanTask($input);

        if (array_key_exists('review', $input)
            && (bool) $candidate['review'] !== (bool) ($current['review'] ?? false)) {
            throw ValidationException::withMessages(['review' => 'Không thể thay đổi yêu cầu nghiệm thu sau khi đã giao công việc.']);
        }
        if (array_key_exists('reviewer_id', $input)
            && $candidate['reviewer_id'] !== ($current['reviewer_id'] ?? null)) {
            throw ValidationException::withMessages(['reviewer_id' => 'Không thể thay đổi người nghiệm thu sau khi đã giao công việc.']);
        }

        foreach (['title', 'project', 'start_date', 'due', 'due_time', 'priority', 'review', 'description', 'result'] as $field) {
            if ($field === 'review' && ! array_key_exists('review', $input)) {
                continue;
            }
            if (array_key_exists($field, $candidate) && $candidate[$field] !== ($current[$field] ?? null)) {
                if (! $this->access->canEditTask($actor, $current, $state)) {
                    throw ValidationException::withMessages(['task' => 'Không có quyền sửa thông tin công việc này.']);
                }
                $updated[$field] = $candidate[$field];
            }
        }

        if (($candidate['assignee'] ?? $current['assignee']) !== $current['assignee']) {
            $assigneeId = $this->resolveAssignee($state, $candidate, $actor);
            if (! $this->access->canAssignTo($actor, array_merge($current, $candidate), $state)) {
                throw ValidationException::withMessages(['assignee' => 'Không có quyền thay đổi người nhận trong phạm vi này.']);
            }
            $assignee = $this->userById($state, $assigneeId);
            $updated['assignee_id'] = $assigneeId;
            $updated['assignee'] = $assignee['name'];
            $updated['department_id'] = $assignee['department'] ?? null;
        }

        $this->updateProgress($actor, $current, $updated, $candidate);
        $this->updateTaskChildren($state, $actor, $current, $updated, $candidate);
        $this->updateTaskResources($state, $actor, $current, $updated, $candidate);
        $this->updateTaskStatus($state, $actor, $current, $updated, (string) ($candidate['status'] ?? $current['status']));
        $this->updateTaskComments($state, $actor, $current, $updated, $candidate);
        $this->updateTaskEvents($actor, $current, $updated);

        return $updated;
    }

    private function updateTaskStatus(array $state, array $actor, array $current, array &$updated, string $next): void
    {
        if ($next === $current['status']) {
            return;
        }

        if (($current['review'] ?? false)
            && $current['status'] === 'IN_PROGRESS'
            && $next === 'COMPLETED') {
            throw ValidationException::withMessages(['status' => 'Công việc này cần được gửi nghiệm thu trước khi hoàn thành.']);
        }

        $transitions = [
            'TODO:IN_PROGRESS' => ['tasks.update_related', 'Bắt đầu thực hiện'],
            'PAUSED:IN_PROGRESS' => ['tasks.update_related', 'Tiếp tục thực hiện'],
            'IN_PROGRESS:IN_REVIEW' => ['tasks.update_related', 'Đã gửi yêu cầu nghiệm thu'],
            'IN_PROGRESS:COMPLETED' => ['tasks.update_related', 'Đã hoàn thành không cần nghiệm thu'],
            'IN_REVIEW:COMPLETED' => ['tasks.review', 'Phê duyệt kết quả công việc'],
            'IN_REVIEW:IN_PROGRESS' => ['tasks.review', 'Trả lại để bổ sung'],
        ];
        $key = $current['status'].':'.$next;
        if (! isset($transitions[$key])) {
            throw ValidationException::withMessages(['status' => 'Chuyển trạng thái không hợp lệ.']);
        }

        [$permission, $message] = $transitions[$key];
        $isAssignee = ($current['assignee_id'] ?? null) === $actor['id'];
        if ($permission === 'tasks.update_related'
            && (! $this->access->can($actor, $permission, $state) || (! $isAssignee && $actor['role_id'] !== 'SYSTEM_ADMIN'))) {
            throw ValidationException::withMessages(['status' => 'Chỉ người thực hiện có quyền mới được chuyển bước này.']);
        }
        if ($permission === 'tasks.review' && ! $this->access->canReviewTask($actor, $current, $state)) {
            throw ValidationException::withMessages(['status' => 'Không có quyền duyệt công việc này trong phạm vi được cấp.']);
        }
        if ($next === 'IN_REVIEW' && ! ($current['review'] ?? false)) {
            throw ValidationException::withMessages(['status' => 'Công việc này không yêu cầu nghiệm thu.']);
        }
        if (in_array($next, ['IN_REVIEW', 'COMPLETED'], true) && ($updated['progress'] ?? 0) < 100) {
            throw ValidationException::withMessages(['status' => 'Cần đạt tiến độ 100% trước khi gửi hoặc hoàn thành.']);
        }
        if (in_array($next, ['IN_REVIEW', 'COMPLETED'], true) && count(array_filter($updated['subtasks'] ?? [], fn (array $item) => ! ($item['done'] ?? false))) > 0) {
            throw ValidationException::withMessages(['status' => 'Cần hoàn thành tất cả công việc con trước khi chuyển bước.']);
        }

        $updated['status'] = $next;
        if ($next === 'IN_REVIEW') {
            $updated['submittedAt'] = now()->toIso8601String();
        }
        if ($next === 'COMPLETED') {
            $updated['completedAt'] = now()->toIso8601String();
            if ($current['status'] === 'IN_REVIEW') {
                $updated['approvedAt'] = now()->toIso8601String();
            }
        }
        $updated['events'][] = ['actor' => $actor['name'], 'text' => $message, 'at' => now()->toIso8601String()];
    }

    private function updateProgress(array $actor, array $current, array &$updated, array $candidate): void
    {
        $nextCheckins = $candidate['checkins'] ?? $current['checkins'] ?? [];
        $currentCheckins = $current['checkins'] ?? [];
        $nextProgress = (int) ($candidate['progress'] ?? $current['progress'] ?? 0);
        if ($nextProgress === (int) ($current['progress'] ?? 0) && $nextCheckins === $currentCheckins) {
            return;
        }
        if (($current['assignee_id'] ?? null) !== $actor['id'] || count($nextCheckins) !== count($currentCheckins) + 1 || $nextProgress < 0 || $nextProgress > 100) {
            throw ValidationException::withMessages(['progress' => 'Chỉ người thực hiện được ghi check-in tiến độ hợp lệ.']);
        }

        $entry = end($nextCheckins);
        if (! is_array($entry) || mb_strlen(trim((string) ($entry['text'] ?? ''))) < 5 || (int) ($entry['pct'] ?? -1) !== $nextProgress) {
            throw ValidationException::withMessages(['progress' => 'Check-in cần có nội dung và phần trăm tiến độ khớp.']);
        }
        $updated['progress'] = $nextProgress;
        $updated['checkins'] = $currentCheckins;
        $updated['checkins'][] = ['text' => trim($entry['text']), 'pct' => $nextProgress, 'at' => now()->toIso8601String()];
        $updated['events'][] = ['actor' => $actor['name'], 'text' => "Đã check-in tiến độ {$nextProgress}%", 'at' => now()->toIso8601String()];
    }

    private function updateTaskChildren(array &$state, array $actor, array $current, array &$updated, array $candidate): void
    {
        $next = $candidate['subtasks'] ?? $current['subtasks'] ?? [];
        $previous = $current['subtasks'] ?? [];
        if ($next === $previous) {
            return;
        }
        if (! $this->access->canEditTask($actor, $current, $state) || ($current['status'] ?? null) === 'COMPLETED') {
            throw ValidationException::withMessages(['subtasks' => 'Không có quyền thay đổi công việc con hoặc công việc cha đã hoàn thành.']);
        }
        if (count($next) < count($previous)) {
            throw ValidationException::withMessages(['subtasks' => 'Không thể xóa công việc con qua thao tác đồng bộ.']);
        }
        foreach ($previous as $index => $old) {
            if (! isset($next[$index]) || ($next[$index]['title'] ?? null) !== ($old['title'] ?? null) || (! empty($old['done']) && empty($next[$index]['done']))) {
                throw ValidationException::withMessages(['subtasks' => 'Cập nhật công việc con không hợp lệ.']);
            }
        }

        $updated['subtasks'] = array_map(function (array $item) use ($actor) {
            return ['id' => $item['id'] ?? (string) Str::uuid(), 'title' => trim((string) ($item['title'] ?? '')), 'done' => (bool) ($item['done'] ?? false), 'createdBy' => $actor['name'], 'createdAt' => now()->toIso8601String()];
        }, $next);
        if (count(array_filter($updated['subtasks'], fn (array $item) => empty($item['done']))) === 0) {
            $updated['events'][] = ['actor' => $actor['name'], 'text' => 'Đã hoàn thành tất cả công việc con', 'at' => now()->toIso8601String()];
        }
    }

    private function updateTaskResources(array $state, array $actor, array $current, array &$updated, array $candidate): void
    {
        foreach (['checklists', 'links', 'attachments'] as $field) {
            $next = $candidate[$field] ?? $current[$field] ?? [];
            $previous = $current[$field] ?? [];
            if ($next === $previous) {
                continue;
            }
            if (! $this->access->canEditTask($actor, $current, $state) || ($current['status'] ?? null) === 'COMPLETED') {
                throw ValidationException::withMessages([$field => 'Không có quyền cập nhật mục này hoặc công việc đã hoàn thành.']);
            }
            if (! is_array($next) || count($next) < count($previous)
                || ($field !== 'checklists' && array_slice($next, 0, count($previous)) !== $previous)) {
                throw ValidationException::withMessages([$field => 'Không thể xóa hoặc thay thế dữ liệu đã lưu.']);
            }
            if (count(array_filter($next, fn ($entry) => ! is_array($entry))) > 0) {
                throw ValidationException::withMessages([$field => 'Cấu trúc dữ liệu không hợp lệ.']);
            }

            if ($field === 'checklists') {
                if (count($next) > 30) {
                    throw ValidationException::withMessages([$field => 'Mỗi công việc có thể có tối đa 30 checklist.']);
                }
                foreach ($previous as $index => $oldList) {
                    $newList = $next[$index];
                    if (($oldList['id'] ?? null) !== ($newList['id'] ?? null)
                        || ($oldList['title'] ?? null) !== ($newList['title'] ?? null)
                        || ! is_array($newList['items'] ?? null)
                        || count($newList['items']) < count($oldList['items'] ?? [])) {
                        throw ValidationException::withMessages([$field => 'Không thể xóa hoặc đổi tên checklist hay mục đã lưu.']);
                    }
                    foreach ($oldList['items'] ?? [] as $itemIndex => $oldItem) {
                        $newItem = $newList['items'][$itemIndex];
                        if (($oldItem['id'] ?? null) !== ($newItem['id'] ?? null)
                            || ($oldItem['text'] ?? null) !== ($newItem['text'] ?? null)
                            || ! is_bool($newItem['done'] ?? null)) {
                            throw ValidationException::withMessages([$field => 'Không thể xóa hoặc đổi tên mục checklist đã lưu.']);
                        }
                    }
                }
                $itemCount = array_sum(array_map(fn (array $list) => count($list['items'] ?? []), $next));
                if ($itemCount > 500) {
                    throw ValidationException::withMessages([$field => 'Mỗi công việc có thể có tối đa 500 mục checklist.']);
                }
                foreach ($next as $list) {
                    if (mb_strlen(trim((string) ($list['title'] ?? ''))) < 2
                        || ! is_array($list['items'] ?? null)
                        || ! is_string($list['id'] ?? null)) {
                        throw ValidationException::withMessages([$field => 'Tên checklist hoặc danh sách mục không hợp lệ.']);
                    }
                    if (count(array_filter($list['items'], fn ($item) => ! is_array($item))) > 0) {
                        throw ValidationException::withMessages([$field => 'Cấu trúc mục checklist không hợp lệ.']);
                    }
                    foreach ($list['items'] as $item) {
                        if (mb_strlen(trim((string) ($item['text'] ?? ''))) < 2
                            || ! is_string($item['id'] ?? null)
                            || ! is_bool($item['done'] ?? null)) {
                            throw ValidationException::withMessages([$field => 'Mỗi mục checklist cần ít nhất 2 ký tự.']);
                        }
                    }
                }
            } elseif ($field === 'links') {
                if (count($next) > 50) {
                    throw ValidationException::withMessages([$field => 'Mỗi công việc có thể lưu tối đa 50 liên kết.']);
                }
                foreach (array_slice($next, count($previous)) as $link) {
                    if (! isset($link['url'], $link['title']) || ! is_string($link['url']) || ! is_string($link['title'])) {
                        throw ValidationException::withMessages([$field => 'Liên kết không đúng cấu trúc.']);
                    }
                    $url = filter_var($link['url'] ?? '', FILTER_VALIDATE_URL);
                    if (! $url || ! in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)
                        || mb_strlen(trim((string) ($link['title'] ?? ''))) < 2
                        || mb_strlen($link['title']) > 100
                        || mb_strlen($link['url']) > 2048) {
                        throw ValidationException::withMessages([$field => 'Liên kết chỉ hỗ trợ URL HTTP/HTTPS hợp lệ và cần có tên.']);
                    }
                }
            } else {
                if (count($next) > 5) {
                    throw ValidationException::withMessages([$field => 'Mỗi công việc có thể đính kèm tối đa 5 tài liệu.']);
                }
                $totalSize = 0;
                $extensions = [
                    'application/pdf' => 'pdf',
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/gif' => 'gif',
                    'image/webp' => 'webp',
                    'text/plain' => 'txt',
                    'text/csv' => 'csv',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
                ];
                foreach ($next as $attachmentIndex => $attachment) {
                    if (! isset($attachment['id'], $attachment['name'], $attachment['type'], $attachment['section'], $attachment['extension'], $attachment['size'])
                        || ! is_string($attachment['id'])
                        || ! is_string($attachment['name'])
                        || ! is_string($attachment['type'])
                        || ! is_string($attachment['section'])
                        || ! is_string($attachment['extension'])
                        || ! is_numeric($attachment['size'])) {
                        throw ValidationException::withMessages([$field => 'Tệp đính kèm không đúng cấu trúc.']);
                    }
                    $size = (int) $attachment['size'];
                    $totalSize += $size;
                    $path = "demo-work-attachments/{$attachment['id']}.{$attachment['extension']}";
                    if (! preg_match('/^[0-9a-f-]{36}$/i', $attachment['id'])
                        || mb_strlen(trim($attachment['name'])) < 1
                        || mb_strlen($attachment['name']) > 180
                        || ! in_array($attachment['section'], ['description', 'result', 'comment'], true)
                        || ($extensions[$attachment['type']] ?? null) !== $attachment['extension']
                        || $size < 1
                        || $size > 500 * 1024
                        || ($attachmentIndex >= count($previous) && ! Storage::disk('local')->exists($path))) {
                        throw ValidationException::withMessages([$field => 'Tệp không hợp lệ. Chỉ nhận PDF, ảnh, văn bản, CSV, Word hoặc Excel tối đa 500 KB mỗi tệp.']);
                    }
                }
                if ($totalSize > 2 * 1024 * 1024) {
                    throw ValidationException::withMessages([$field => 'Tổng dung lượng tài liệu trên một công việc không được vượt quá 2 MB.']);
                }
            }
            $updated[$field] = $next;
        }
    }

    private function updateTaskComments(array &$state, array $actor, array $current, array &$updated, array $candidate): void
    {
        $next = $candidate['comments'] ?? $current['comments'] ?? [];
        $previous = $current['comments'] ?? [];
        if ($next === $previous) {
            return;
        }
        if (! $this->access->canViewTask($actor, $current, $state) || count($next) !== count($previous) + 1) {
            throw ValidationException::withMessages(['comments' => 'Không có quyền bình luận hoặc dữ liệu bình luận không hợp lệ.']);
        }
        $comment = end($next);
        $text = trim((string) ($comment['text'] ?? ''));
        if ($text === '' || mb_strlen($text) > 2000) {
            throw ValidationException::withMessages(['comments' => 'Bình luận phải có từ 1 đến 2.000 ký tự.']);
        }
        $updated['comments'] = $previous;
        $updated['comments'][] = ['author' => $actor['name'], 'author_id' => $actor['id'], 'text' => $text, 'at' => now()->toIso8601String()];
        $updated['events'][] = ['actor' => $actor['name'], 'text' => 'Đã thêm bình luận', 'at' => now()->toIso8601String()];
    }

    private function updateTaskEvents(array $actor, array $current, array &$updated): void
    {
        $updated['events'] ??= $current['events'] ?? [];
        if ($updated['events'] === ($current['events'] ?? [])) {
            return;
        }
        $updated['events'] = $current['events'] ?? [];
        $updated['events'][] = ['actor' => $actor['name'], 'text' => 'Cập nhật thông tin công việc', 'at' => now()->toIso8601String()];
    }

    private function cleanTask(array $input): array
    {
        $title = trim((string) ($input['title'] ?? ''));
        if (mb_strlen($title) < 4 || mb_strlen($title) > 160) {
            throw ValidationException::withMessages(['title' => 'Tên công việc phải có từ 4 đến 160 ký tự.']);
        }
        if (! in_array($input['priority'] ?? 'MEDIUM', ['HIGH', 'MEDIUM', 'LOW'], true)) {
            throw ValidationException::withMessages(['priority' => 'Mức ưu tiên không hợp lệ.']);
        }
        $startDate = $input['start_date'] ?? null;
        if ($startDate !== null && $startDate !== '') {
            validator(
                ['start_date' => $startDate, 'due' => $input['due'] ?? null],
                ['start_date' => ['required', 'date_format:Y-m-d'], 'due' => ['required', 'date_format:Y-m-d']]
            )->validate();
            if ($startDate > $input['due']) {
                throw ValidationException::withMessages(['start_date' => 'Thời gian bắt đầu không thể muộn hơn hạn hoàn thành.']);
            }
        } else {
            $startDate = null;
        }
        $dueTime = $input['due_time'] ?? null;
        if ($dueTime !== null && $dueTime !== '') {
            validator(['due_time' => $dueTime], ['due_time' => ['required', 'date_format:H:i']])->validate();
        } else {
            $dueTime = null;
        }

        return [
            'id' => (string) $input['id'],
            'title' => $title,
            'project' => trim((string) ($input['project'] ?? 'Công việc độc lập')),
            'project_id' => $input['project_id'] ?? null,
            'department_id' => $input['department_id'] ?? null,
            'assignee' => trim((string) ($input['assignee'] ?? '')),
            'assignee_id' => $input['assignee_id'] ?? null,
            'creator' => trim((string) ($input['creator'] ?? '')),
            'creator_id' => $input['creator_id'] ?? null,
            'start_date' => $startDate,
            'due' => (string) ($input['due'] ?? ''),
            'due_time' => $dueTime,
            'priority' => $input['priority'] ?? 'MEDIUM',
            'review' => array_key_exists('review', $input) ? (bool) $input['review'] : null,
            'reviewer_id' => is_string($input['reviewer_id'] ?? null) && trim($input['reviewer_id']) !== ''
                ? trim($input['reviewer_id'])
                : null,
            'description' => mb_substr(trim((string) ($input['description'] ?? '')), 0, 5000),
            'result' => mb_substr(trim((string) ($input['result'] ?? '')), 0, 5000),
            'status' => $input['status'] ?? 'TODO',
            'progress' => (int) ($input['progress'] ?? 0),
            'subtasks' => is_array($input['subtasks'] ?? null) ? $input['subtasks'] : [],
            'checklists' => is_array($input['checklists'] ?? null) ? $input['checklists'] : [],
            'links' => is_array($input['links'] ?? null) ? $input['links'] : [],
            'attachments' => is_array($input['attachments'] ?? null) ? $input['attachments'] : [],
            'comments' => is_array($input['comments'] ?? null) ? $input['comments'] : [],
            'checkins' => is_array($input['checkins'] ?? null) ? $input['checkins'] : [],
            'events' => is_array($input['events'] ?? null) ? $input['events'] : [],
            'follower_ids' => is_array($input['follower_ids'] ?? null) ? $input['follower_ids'] : [],
            'watchers' => is_array($input['watchers'] ?? null) ? $input['watchers'] : [],
            'createdAt' => $input['createdAt'] ?? null,
            'completedAt' => $input['completedAt'] ?? null,
            'submittedAt' => $input['submittedAt'] ?? null,
            'approvedAt' => $input['approvedAt'] ?? null,
        ];
    }

    private function resolveAssignee(array $state, array $task, array $actor): string
    {
        $assigneeId = $task['assignee_id'] ?? null;
        if ($assigneeId) {
            $assignee = $this->userById($state, $assigneeId);
            if ($assignee && $assignee['status'] === 'ACTIVE') {
                return $assigneeId;
            }
        }
        foreach ($state['users'] as $user) {
            if ($user['status'] === 'ACTIVE' && $user['name'] === ($task['assignee'] ?? '')) {
                return $user['id'];
            }
        }
        if (($task['assignee'] ?? '') === $actor['name'] || ($task['assignee'] ?? '') === '') {
            return $actor['id'];
        }

        throw ValidationException::withMessages(['assignee' => 'Người nhận chưa có tài khoản ACTIVE trong hệ thống.']);
    }

    private function normalizeScope(array $scope): array
    {
        return [
            'departments' => array_values(array_unique(array_map('strval', $scope['departments'] ?? []))),
            'projects' => array_values(array_unique(array_map('strval', $scope['projects'] ?? []))),
            'organization' => (bool) ($scope['organization'] ?? false),
        ];
    }

    private function statusMessage(string $status): string
    {
        return match ($status) {
            'PENDING' => 'Tài khoản đang chờ Quản trị hệ thống cấp quyền.',
            'SUSPENDED' => 'Tài khoản đang bị tạm khóa. Hãy liên hệ Quản trị hệ thống.',
            'DISABLED' => 'Tài khoản đã bị vô hiệu hóa. Hãy liên hệ Quản trị hệ thống.',
            default => 'Tài khoản không được phép đăng nhập.',
        };
    }

    private function publicRequest(array $request): array
    {
        unset($request['password_hash']);

        return $request;
    }

    private function notifyAdmins(array &$state, string $title, string $message, ?string $requestId): void
    {
        foreach ($state['users'] as $user) {
            if ($user['role_id'] === 'SYSTEM_ADMIN' && $user['status'] === 'ACTIVE') {
                $this->notify($state, $user['id'], $title, $message, $requestId);
            }
        }
    }

    private function notify(array &$state, ?string $userId, string $title, string $message, ?string $requestId = null): void
    {
        $state['notifications'][] = [
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'request_id' => $requestId,
            'title' => $title,
            'message' => $message,
            'created_at' => now()->toIso8601String(),
            'read_at' => null,
        ];
    }

    private function audit(array &$state, string $action, string $subject, array $metadata, string $actorId): void
    {
        $state['audit_logs'][] = ['id' => (string) Str::uuid(), 'action' => $action, 'subject' => $subject, 'actor_id' => $actorId, 'metadata' => $metadata, 'created_at' => now()->toIso8601String()];
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

    private function findRole(array $state, string $roleId): ?array
    {
        foreach ($state['roles'] as $role) {
            if ($role['id'] === $roleId) {
                return $role;
            }
        }

        return null;
    }

    private function userById(array $state, string $id): ?array
    {
        foreach ($state['users'] as $user) {
            if ($user['id'] === $id) {
                return $user;
            }
        }

        return null;
    }
}
