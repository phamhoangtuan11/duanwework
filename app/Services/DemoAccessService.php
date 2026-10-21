<?php

namespace App\Services;

class DemoAccessService
{
    public function __construct(private DemoAuthRepository $repository)
    {
    }

    public function currentUser(?string $id): ?array
    {
        if (! $id) {
            return null;
        }

        $state = $this->repository->read();
        foreach ($state['users'] as $user) {
            if (($user['id'] ?? null) === $id && ($user['status'] ?? null) === 'ACTIVE') {
                return $this->publicUser($user, $state);
            }
        }

        return null;
    }

    public function publicUser(array $user, ?array $state = null): array
    {
        $state ??= $this->repository->read();
        $role = collect($state['roles'])->firstWhere('id', $user['role_id'] ?? '');

        return [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'department' => $user['department'] ?? '',
            'job_title' => $user['job_title'] ?? '',
            'role_id' => $user['role_id'],
            'role_label' => $role['label'] ?? 'Chưa cấp vai trò',
            'status' => $user['status'],
            'scope' => $state['user_role_scopes'][$user['id']] ?? ['departments' => [], 'projects' => [], 'organization' => false],
        ];
    }

    public function permissions(array $user, ?array $state = null): array
    {
        $state ??= $this->repository->read();
        foreach ($state['roles'] as $role) {
            if ($role['id'] === ($user['role_id'] ?? null)) {
                $permissions = $role['permissions'] ?? [];
                if ($user['role_id'] === 'SYSTEM_ADMIN') {
                    $permissions = array_merge($permissions, [
                        'tasks.create',
                        'tasks.view_related',
                        'tasks.update_related',
                        'tasks.comment_related',
                        'tasks.view_scoped',
                        'tasks.assign',
                        'tasks.review',
                        'tasks.edit_scoped',
                    ]);
                }

                return array_values(array_unique($permissions));
            }
        }

        return [];
    }

    public function can(array $user, string $permission, ?array $state = null): bool
    {
        return in_array($permission, $this->permissions($user, $state), true);
    }

    public function canViewTask(array $user, array $task, ?array $state = null): bool
    {
        if ($this->can($user, 'tasks.view_related', $state) && $this->related($user, $task)) {
            return true;
        }

        return $this->inTaskScope($user, $task, 'tasks.view_scoped', $state);
    }

    public function canEditTask(array $user, array $task, ?array $state = null): bool
    {
        if ($this->can($user, 'tasks.update_related', $state) && $this->related($user, $task)) {
            return true;
        }

        return $this->inTaskScope($user, $task, 'tasks.edit_scoped', $state);
    }

    public function canReviewTask(array $user, array $task, ?array $state = null): bool
    {
        return ($task['reviewer_id'] ?? null) === ($user['id'] ?? null)
            && $this->can($user, 'tasks.review', $state)
            && ($this->related($user, $task) || $this->inTaskScope($user, $task, 'tasks.view_scoped', $state));
    }

    public function reviewerUsers(array $user): array
    {
        $state = $this->repository->read();

        return array_values(array_map(
            fn (array $candidate) => $this->publicUser($candidate, $state),
            array_filter($state['users'], fn (array $candidate) => $candidate['status'] === 'ACTIVE'
                && $this->can($candidate, 'tasks.review', $state))
        ));
    }

    public function canAssignTo(array $user, array $task, ?array $state = null): bool
    {
        return $this->inTaskScope($user, $task, 'tasks.assign', $state);
    }

    public function visibleTasks(array $user): array
    {
        $state = $this->repository->read();

        return array_values(array_filter($state['tasks'], fn (array $task) => $this->canViewTask($user, $task, $state)));
    }

    public function emailDomains(): array
    {
        return $this->repository->read()['email_domains'];
    }

    public function notifications(array $user): array
    {
        $state = $this->repository->read();

        return array_values(array_filter(
            array_reverse($state['notifications']),
            fn (array $notification) => ($notification['user_id'] ?? null) === $user['id']
        ));
    }

    public function assignableUsers(array $user): array
    {
        $state = $this->repository->read();
        $scope = $state['user_role_scopes'][$user['id']] ?? [];
        $canAssign = $this->can($user, 'tasks.assign', $state);
        $isSystemAdmin = $user['role_id'] === 'SYSTEM_ADMIN';

        return array_values(array_map(
            fn (array $item) => $this->publicUser($item, $state),
            array_filter($state['users'], function (array $candidate) use ($user, $scope, $canAssign, $isSystemAdmin) {
                if ($candidate['status'] !== 'ACTIVE') {
                    return false;
                }
                if ($candidate['id'] === $user['id']) {
                    return true;
                }

                return $isSystemAdmin || ($canAssign && (
                    ($scope['organization'] ?? false)
                    || in_array($candidate['department'] ?? '', $scope['departments'] ?? [], true)
                ));
            })
        ));
    }

    private function related(array $user, array $task): bool
    {
        return ($task['creator_id'] ?? null) === $user['id']
            || ($task['assignee_id'] ?? null) === $user['id']
            || in_array($user['id'], $task['follower_ids'] ?? [], true);
    }

    private function inTaskScope(array $user, array $task, string $permission, ?array $state): bool
    {
        if (! $this->can($user, $permission, $state)) {
            return false;
        }

        $state ??= $this->repository->read();
        if (($user['role_id'] ?? null) === 'SYSTEM_ADMIN') {
            return true;
        }
        $scope = $state['user_role_scopes'][$user['id']] ?? [];
        if (($scope['organization'] ?? false) === true) {
            return true;
        }

        $departments = $scope['departments'] ?? [];
        $projects = $scope['projects'] ?? [];

        return (isset($task['department_id']) && in_array($task['department_id'], $departments, true))
            || (isset($task['project_id']) && in_array($task['project_id'], $projects, true))
            || (isset($task['project']) && in_array($task['project'], $projects, true));
    }
}
