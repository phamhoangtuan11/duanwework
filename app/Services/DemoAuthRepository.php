<?php

namespace App\Services;

use RuntimeException;

class DemoAuthRepository
{
    private function directory(): string
    {
        return (string) config('bfc-auth.path');
    }

    public function read(): array
    {
        return $this->locked(LOCK_SH, fn () => $this->readUnlocked());
    }

    public function transaction(callable $callback): mixed
    {
        return $this->locked(LOCK_EX, function () use ($callback) {
            $state = $this->readUnlocked();
            $result = $callback($state);
            $this->writeUnlocked($state);

            return $result;
        });
    }

    private function locked(int $mode, callable $callback): mixed
    {
        $directory = $this->directory();
        if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            throw new RuntimeException('Không thể tạo thư mục lưu trữ tài khoản cục bộ.');
        }

        $lock = fopen($directory.DIRECTORY_SEPARATOR.'.lock', 'c+b');
        if ($lock === false) {
            throw new RuntimeException('Không thể mở khóa lưu trữ tài khoản cục bộ.');
        }

        try {
            if (! flock($lock, $mode)) {
                throw new RuntimeException('Không thể khóa lưu trữ tài khoản cục bộ.');
            }

            return $callback();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function readUnlocked(): array
    {
        $path = $this->directory().DIRECTORY_SEPARATOR.'state.json';
        if (! is_file($path)) {
            return $this->defaults();
        }

        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new RuntimeException('Không thể đọc kho dữ liệu xác thực.');
        }

        try {
            $state = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $exception) {
            throw new RuntimeException('Kho dữ liệu xác thực bị hỏng; không thể tiếp tục an toàn.', 0, $exception);
        }

        if (! is_array($state) || ($state['schema_version'] ?? null) !== 1) {
            throw new RuntimeException('Phiên bản kho dữ liệu xác thực không hợp lệ.');
        }

        return array_replace($this->defaults(), $state);
    }

    private function writeUnlocked(array $state): void
    {
        $path = $this->directory().DIRECTORY_SEPARATOR.'state.json';
        $temporary = $path.'.'.bin2hex(random_bytes(8)).'.tmp';
        $json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        if (file_put_contents($temporary, $json, LOCK_EX) === false) {
            throw new RuntimeException('Không thể ghi dữ liệu xác thực tạm thời.');
        }

        @chmod($temporary, 0600);
        if (! rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('Không thể thay thế kho dữ liệu xác thực.');
        }

        @chmod($path, 0600);
    }

    private function defaults(): array
    {
        return [
            'schema_version' => 1,
            'email_domains' => array_values((array) config('bfc-auth.email_domains', [])),
            'users' => [],
            'access_requests' => [],
            'roles' => [
                ['id' => 'SYSTEM_ADMIN', 'label' => 'Quản trị hệ thống', 'permissions' => ['accounts.manage', 'roles.manage', 'domains.manage']],
                ['id' => 'EMPLOYEE', 'label' => 'Nhân viên', 'permissions' => ['tasks.create', 'tasks.view_related', 'tasks.update_related', 'tasks.comment_related']],
                ['id' => 'DEPARTMENT_MANAGER', 'label' => 'Quản lý phòng ban', 'permissions' => ['tasks.create', 'tasks.view_related', 'tasks.update_related', 'tasks.comment_related', 'tasks.view_scoped', 'tasks.assign', 'tasks.review', 'tasks.edit_scoped']],
                ['id' => 'PROJECT_MANAGER', 'label' => 'Quản lý dự án', 'permissions' => ['tasks.create', 'tasks.view_related', 'tasks.update_related', 'tasks.comment_related', 'tasks.view_scoped', 'tasks.assign', 'tasks.review', 'tasks.edit_scoped']],
                ['id' => 'REVIEWER', 'label' => 'Người duyệt', 'permissions' => ['tasks.view_scoped', 'tasks.review']],
                ['id' => 'DEPUTY_GM', 'label' => 'Phó tổng giám đốc', 'permissions' => ['tasks.view_scoped', 'tasks.review']],
                ['id' => 'CHAIRMAN', 'label' => 'Chủ tịch', 'permissions' => ['tasks.view_scoped', 'tasks.review']],
            ],
            'user_role_scopes' => [],
            'notifications' => [],
            'audit_logs' => [],
            'tasks' => [],
        ];
    }
}
