<?php

namespace App\Services;

/**
 * Kiểm kê học liệu: mỗi bài giảng và mỗi đề là một nguồn; kiểm tra tệp PDF, ảnh trang và audio có trên đĩa.
 */
class SourceInventory
{
    private const COURSES = [1 => 'HSK 1', 2 => 'HSK 2', 3 => 'HSK 3', 4 => 'HSK 4', 31 => 'HSK 1 bản 3.0', 32 => 'HSK 2 bản 3.0', 41 => 'Công xưởng', 42 => 'Văn phòng'];

    /** Học liệu đã biết là còn thiếu trong bản gốc. */
    private const KNOWN_GAPS = [
        ['course' => 31, 'name' => 'Bài 12 · HSK 1 bản 3.0', 'need' => 'Chưa có tệp PowerPoint riêng cho Bài 12 của HSK 1 bản 3.0.'],
    ];

    private string $root;

    public function __construct()
    {
        $this->root = storage_path('app/private/fangschool');
    }

    public function inventory(): array
    {
        $rows = [];
        $sum = ['total' => 0, 'ok' => 0, 'fromSource' => 0, 'added' => 0, 'missingFiles' => 0];

        foreach (self::COURSES as $id => $course) {
            $path = $this->root.'/learning/'.$id.'.json';
            if (!is_file($path)) {
                $rows[] = $this->row('course-'.$id, 'Dữ liệu '.$course, 'learning/'.$id.'.json', $course, 'Dữ liệu khóa', [
                    ['file' => 'learning/'.$id.'.json', 'map' => 'Toàn bộ bài, câu hỏi và từ vựng của khóa', 'ok' => false],
                ], 'Thiếu tệp dữ liệu của khóa.');
                continue;
            }
            $catalog = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
            $audio = $catalog['audioFiles'] ?? [];

            foreach ($catalog['lessons'] ?? [] as $lesson) {
                $questions = $lesson['questions'] ?? [];
                $origins = array_count_values(array_map(fn ($q) => $q['origin'] ?? 'other', $questions));
                $sourceCount = ($origins['original'] ?? 0) + ($origins['practice'] ?? 0);
                $addedCount = ($origins['guided'] ?? 0) + ($origins['curriculum'] ?? 0) + ($origins['extra'] ?? 0);
                $sum['fromSource'] += $sourceCount;
                $sum['added'] += $addedCount;
                $n = (int) ($lesson['n'] ?? 0);
                $label = $n >= 100 ? 'Ngữ âm '.($n - 100) : 'Bài '.$n;
                $recordings = array_values(array_filter(array_map(fn ($d) => $d['recording'] ?? null, $lesson['dialogues'] ?? [])));
                $files = [[
                    'file' => $lesson['file'] ?? ($label.'.pptx'),
                    'map' => count($lesson['slides'] ?? []).' slide → '.count($lesson['vocab'] ?? []).' từ · '.$sourceCount.' câu gốc · '.$addedCount.' câu bổ sung',
                    'ok' => !empty($lesson['slides']) || !empty($questions),
                ]];
                foreach ($recordings as $file) {
                    $files[] = ['file' => $file, 'map' => 'Bản thu gốc bài khóa', 'ok' => $this->exists('audio', $file)];
                }
                $rows[] = $this->row($id.'-'.$n, $label.' · '.($lesson['zh'] ?? ''), $lesson['vi'] ?? '', $course, $n >= 100 ? 'Ngữ âm' : 'Slide bài giảng', $files);
            }

            if ($audio) {
                $missing = array_values(array_filter($audio, fn ($file) => !$this->exists('audio', $file)));
                $rows[] = $this->row($id.'-audio', 'Audio đọc từ & câu · '.$course, count($audio).' tệp được tham chiếu', $course, 'Audio', [
                    ['file' => count($audio) - count($missing).'/'.count($audio).' tệp', 'map' => 'Giọng đọc cho flashcard, ví dụ và câu nghe', 'ok' => !$missing],
                    ...array_map(fn ($file) => ['file' => $file, 'map' => 'Không tìm thấy trên máy chủ', 'ok' => false], array_slice($missing, 0, 8)),
                ], $missing ? count($missing).' tệp audio chưa có trên máy chủ.' : null);
            }

            foreach ($catalog['examCatalog']['papers'] ?? [] as $paper) {
                $files = [];
                if (!empty($paper['pdf'])) {
                    $files[] = ['file' => basename($paper['pdf']), 'map' => 'PDF đề gốc', 'ok' => $this->exists('exams', basename($paper['pdf']))];
                }
                $pages = array_values(array_unique(array_map(fn ($page) => $page[0], $paper['pages'] ?? [])));
                if ($pages && empty($paper['prompts'])) {
                    $present = count(array_filter($pages, fn ($page) => $this->exists('exams', $paper['id'].'-p'.$page.'.webp')));
                    $files[] = ['file' => $present.'/'.count($pages).' ảnh trang', 'map' => 'Ảnh trang đề hiển thị khi làm bài', 'ok' => $present === count($pages)];
                }
                if (!empty($paper['audio'])) {
                    $files[] = ['file' => basename($paper['audio']), 'map' => 'Bản nghe gốc của đề', 'ok' => $this->exists('audio', basename($paper['audio']))];
                }
                $clips = array_values($paper['recordings'] ?? []);
                if ($clips) {
                    $present = count(array_filter($clips, fn ($clip) => $this->exists('audio', basename($clip))));
                    $files[] = ['file' => $present.'/'.count($clips).' audio từng câu', 'map' => 'Bản nghe theo câu', 'ok' => $present === count($clips)];
                }
                $sum['fromSource']++;
                $rows[] = $this->row($id.'-'.$paper['id'], $paper['title'] ?? $paper['id'], ($paper['originalCode'] ?? $paper['id']).' · '.count($paper['answerKey'] ?? []).' câu', $course, 'Đề thi', $files);
            }
        }

        foreach (self::KNOWN_GAPS as $gap) {
            $rows[] = $this->row('gap-'.$gap['course'], $gap['name'], 'Không có trong bản gốc', self::COURSES[$gap['course']], 'Slide bài giảng', [
                ['file' => '—', 'map' => 'Chưa có tệp nguồn', 'ok' => false],
            ], $gap['need'], 'missing');
        }

        foreach ($rows as $row) {
            $sum['total']++;
            if ($row['status'] === 'ok') {
                $sum['ok']++;
            }
            $sum['missingFiles'] += count(array_filter($row['files'], fn ($file) => !$file['ok']));
        }

        return ['summary' => $sum, 'sources' => $rows];
    }

    private function row(string $id, string $name, string $where, string $course, string $type, array $files, ?string $need = null, ?string $status = null): array
    {
        $bad = count(array_filter($files, fn ($file) => !$file['ok']));
        $status ??= $bad === 0 ? 'ok' : ($bad === count($files) ? 'missing' : 'partial');
        if ($need === null && $bad) {
            $need = 'Thiếu '.$bad.' mục: '.implode(', ', array_map(fn ($file) => $file['file'], array_filter($files, fn ($file) => !$file['ok']))).'.';
        }

        return compact('id', 'name', 'where', 'course', 'type', 'files', 'need', 'status');
    }

    private function exists(string $kind, string $file): bool
    {
        return $file !== '' && !str_contains($file, '..') && is_file($this->root.'/'.$kind.'/'.$file);
    }
}
