<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\StudyController;
use App\Services\Access;
use Illuminate\Support\Facades\Route;

Route::get('/', [StudyController::class, 'home']);
Route::get('/admin', [StudyController::class, 'admin']);
Route::get('/admin/progress', [StudyController::class, 'dashboard']);
Route::get('/learning/{level}.json', [StudyController::class, 'learning'])->where('level', Access::COURSE_PATTERN);
Route::get('/audio/{filename}', [StudyController::class, 'audio'])->where('filename', '[a-z0-9-]+\.mp3');
Route::get('/exams/{filename}', [StudyController::class, 'exam'])->where('filename', '[A-Za-z0-9-]+\.(pdf|webp)');

Route::prefix('api')->group(function () {
    Route::post('/code', [AuthController::class, 'requestCode']);
    Route::post('/verify', [AuthController::class, 'verify']);
    Route::get('/session', [AuthController::class, 'session']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::match(['GET', 'PUT', 'DELETE'], '/grants', [StudyController::class, 'grants']);
    Route::get('/admin/progress/overview', [StudyController::class, 'overview']);
    Route::get('/admin/progress', [StudyController::class, 'learnerDetail']);
    Route::match(['GET', 'PUT'], '/progress/{level}', [StudyController::class, 'progress'])->where('level', Access::COURSE_PATTERN);
});
