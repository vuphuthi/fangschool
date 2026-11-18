<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\TutorController;
use App\Http\Controllers\StudyController;
use App\Http\Controllers\TeachingController;
use App\Services\Access;
use Illuminate\Support\Facades\Route;

Route::get('/', [StudyController::class, 'home']);
Route::get('/admin', [StudyController::class, 'admin']);
Route::get('/admin/progress', [StudyController::class, 'dashboard']);
Route::get('/admin/sources', [StudyController::class, 'sourcesPage']);
if (config('fangschool.assignments')) {
    Route::get('/admin/assignments', [StudyController::class, 'assignmentsPage']);
}
Route::get('/learning/{level}.json', [StudyController::class, 'learning'])->where('level', Access::COURSE_PATTERN);
Route::get('/audio/{filename}', [StudyController::class, 'audio'])->where('filename', '[a-z0-9-]+\.mp3');
Route::get('/exams/{filename}', [StudyController::class, 'exam'])->where('filename', '[A-Za-z0-9-]+\.(pdf|webp)');

Route::prefix('api')->group(function () {
    Route::get('/ai/history', [TutorController::class, 'history']);
    Route::post('/ai/chat', [TutorController::class, 'chat']);
    Route::post('/ai/grade', [TutorController::class, 'grade']);
    Route::post('/ai/speech', [TutorController::class, 'speech']);
    Route::post('/ai/transcribe', [TutorController::class, 'transcribe']);
    Route::post('/code', [AuthController::class, 'requestCode']);
    Route::post('/verify', [AuthController::class, 'verify']);
    Route::get('/session', [AuthController::class, 'session']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::match(['GET', 'PUT', 'DELETE'], '/grants', [StudyController::class, 'grants']);
    Route::get('/admin/progress/overview', [StudyController::class, 'overview']);
    Route::get('/admin/progress', [StudyController::class, 'learnerDetail']);
    Route::get('/admin/sources', [StudyController::class, 'sources']);
    Route::match(['GET', 'PUT'], '/progress/{level}', [StudyController::class, 'progress'])->where('level', Access::COURSE_PATTERN);

    // Câu hỏi giáo viên trên máy chủ
    Route::get('/teacher-questions/{level}', [TeachingController::class, 'teacherQuestions'])->where('level', Access::COURSE_PATTERN);
    Route::put('/teacher-questions/{level}', [TeachingController::class, 'saveTeacherQuestion'])->where('level', Access::COURSE_PATTERN);
    Route::get('/questions/{level}', [TeachingController::class, 'liveQuestions'])->where('level', Access::COURSE_PATTERN);

    // Bài giao (tạm tắt: FANGSCHOOL_ASSIGNMENTS=true để bật lại)
    if (config('fangschool.assignments')) {
        Route::get('/assignments', [TeachingController::class, 'myAssignments']);
        Route::get('/admin/assignments', [TeachingController::class, 'adminAssignments']);
        Route::post('/admin/assignments', [TeachingController::class, 'createAssignment']);
        Route::get('/admin/assignments/{id}', [TeachingController::class, 'adminAssignment'])->whereNumber('id');
        Route::patch('/admin/assignments/{id}', [TeachingController::class, 'updateAssignment'])->whereNumber('id');
        Route::post('/admin/assignments/{id}/nudge', [TeachingController::class, 'nudgeAssignment'])->whereNumber('id');
        Route::get('/admin/learners/{level}', [TeachingController::class, 'courseLearners'])->where('level', Access::COURSE_PATTERN);
    }

    // Báo lỗi nội dung
    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/admin/reports', [ReportController::class, 'index']);
    Route::patch('/admin/reports/{id}', [ReportController::class, 'update'])->whereNumber('id');

    // Email nhắc học
    Route::match(['GET', 'PUT'], '/email-prefs', [TeachingController::class, 'emailPrefs']);
});
