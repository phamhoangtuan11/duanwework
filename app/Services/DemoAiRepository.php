<?php

namespace App\Services;

use RuntimeException;

class DemoAiRepository
{
    private function directory(): string
    {
        return (string) config('bfc-auth.path', storage_path('app/private/demo-auth'));
    }

    private function filePath(): string
    {
        return $this->directory() . DIRECTORY_SEPARATOR . 'ai-store.json';
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

    public function getUserProfile(string $userId): array
    {
        $state = $this->read();
        return $state['users'][$userId] ?? [
            'last_active_at' => null,
            'summary_memory' => '',
            'recent_messages' => [],
        ];
    }

    public function recordInteraction(string $userId, array $userMsg, array $assistantMsg, ?string $summary = null): void
    {
        $this->transaction(function (array &$state) use ($userId, $userMsg, $assistantMsg, $summary) {
            $state['users'] ??= [];
            $userStore = $state['users'][$userId] ?? [
                'last_active_at' => null,
                'summary_memory' => '',
                'recent_messages' => [],
            ];

            $userStore['last_active_at'] = now()->toIso8601String();
            if ($summary !== null) {
                $userStore['summary_memory'] = $summary;
            }

            // Append messages
            $userStore['recent_messages'][] = $userMsg;
            $userStore['recent_messages'][] = $assistantMsg;

            // Sliding window: keep up to 8 recent messages (4 pairs) to avoid token explosion
            if (count($userStore['recent_messages']) > 8) {
                $userStore['recent_messages'] = array_slice($userStore['recent_messages'], -8);
            }

            $state['users'][$userId] = $userStore;
        });
    }

    public function updateLastActive(string $userId): void
    {
        $this->transaction(function (array &$state) use ($userId) {
            $state['users'] ??= [];
            if (! isset($state['users'][$userId])) {
                $state['users'][$userId] = [
                    'last_active_at' => now()->toIso8601String(),
                    'summary_memory' => '',
                    'recent_messages' => [],
                ];
            } else {
                $state['users'][$userId]['last_active_at'] = now()->toIso8601String();
            }
        });
    }

    private function locked(int $mode, callable $callback): mixed
    {
        $directory = $this->directory();
        if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            throw new RuntimeException('Không thể tạo thư mục lưu trữ AI cục bộ.');
        }

        $lock = fopen($directory . DIRECTORY_SEPARATOR . '.ai-lock', 'c+b');
        if ($lock === false) {
            throw new RuntimeException('Không thể mở khóa lưu trữ AI cục bộ.');
        }

        try {
            if (! flock($lock, $mode)) {
                throw new RuntimeException('Không thể khóa lưu trữ AI cục bộ.');
            }

            return $callback();
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    private function readUnlocked(): array
    {
        $path = $this->filePath();
        if (! is_file($path)) {
            return $this->defaults();
        }

        $content = file_get_contents($path);
        if ($content === false || trim($content) === '') {
            return $this->defaults();
        }

        try {
            $data = json_decode($content, true, 512, JSON_THROW_ON_ERROR);
            return is_array($data) ? $data : $this->defaults();
        } catch (\Throwable) {
            return $this->defaults();
        }
    }

    private function writeUnlocked(array $state): void
    {
        $path = $this->filePath();
        $tmp = $path . '.' . uniqid('ai_', true) . '.tmp';
        $json = json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if (file_put_contents($tmp, $json) === false) {
            throw new RuntimeException('Không thể ghi dữ liệu AI tạm thời.');
        }

        if (! rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('Không thể hoàn tất cập nhật tệp AI.');
        }
    }

    private function defaults(): array
    {
        return [
            'users' => [],
            'version' => 1,
        ];
    }
}
