<?php

namespace App\Console\Commands;

use App\Services\DemoAuthService;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

class SetupSystemAdmin extends Command
{
    protected $signature = 'bfc:setup-system-admin {--email= : Email công ty của quản trị hệ thống} {--name= : Họ tên quản trị viên}';

    protected $description = 'Khởi tạo SYSTEM_ADMIN cục bộ một lần bằng mật khẩu nhập an toàn.';

    public function handle(DemoAuthService $auth): int
    {
        $email = (string) ($this->option('email') ?: $this->ask('Email SYSTEM_ADMIN'));
        $name = (string) ($this->option('name') ?: $this->ask('Họ tên quản trị viên'));
        $password = $this->secret('Mật khẩu (tối thiểu 12 ký tự)');
        $confirmation = $this->secret('Nhập lại mật khẩu');
        if ($password === null || $password !== $confirmation || strlen($password) < 12) {
            $this->error('Mật khẩu nhập lại không khớp hoặc ngắn hơn 12 ký tự.');

            return self::FAILURE;
        }

        try {
            $user = $auth->createSystemAdmin($email, $name, $password);
        } catch (ValidationException $exception) {
            $this->error(collect($exception->errors())->flatten()->implode(' '));

            return self::FAILURE;
        }

        $this->info("Đã tạo SYSTEM_ADMIN {$user['email']}. Mật khẩu đã hash và không ghi ra màn hình.");

        return self::SUCCESS;
    }
}
