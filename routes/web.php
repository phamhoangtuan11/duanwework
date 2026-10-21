<?php

use App\Http\Controllers\DemoController;
use App\Http\Controllers\DemoAuthController;
use App\Http\Controllers\DemoAdminController;
use App\Http\Controllers\DemoTaskController;
use App\Http\Middleware\RequireDemoAccount;
use App\Http\Middleware\RequireSystemAdmin;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', [DemoController::class, 'index'])->name('demo');
Route::get('/demo-auth/csrf', [DemoAuthController::class, 'csrf'])->middleware('throttle:30,1');
Route::post('/demo-auth/login', [DemoAuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/demo-auth/register', [DemoAuthController::class, 'register'])->middleware('throttle:3,1');
Route::post('/demo-auth/logout', [DemoAuthController::class, 'logout'])->middleware(RequireDemoAccount::class);

Route::prefix('/demo-auth/admin')->middleware([RequireDemoAccount::class, RequireSystemAdmin::class])->group(function () {
    Route::get('/', [DemoAdminController::class, 'index']);
    Route::put('/domains', [DemoAdminController::class, 'domains']);
    Route::post('/requests/{id}/decision', [DemoAdminController::class, 'decideRequest']);
    Route::put('/users/{id}', [DemoAdminController::class, 'updateUser']);
    Route::put('/roles/{id}', [DemoAdminController::class, 'updateRole']);
});

Route::prefix('/demo-work')->middleware(RequireDemoAccount::class)->group(function () {
    Route::post('/tasks/sync', [DemoTaskController::class, 'sync']);
    Route::post('/tasks/import-legacy', [DemoTaskController::class, 'importLegacy']);
    Route::post('/tasks/{id}/attachments', [DemoTaskController::class, 'addAttachment']);
    Route::get('/tasks/{id}/attachments/{attachmentId}', [DemoTaskController::class, 'downloadAttachment']);
});
