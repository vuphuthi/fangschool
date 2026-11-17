<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

final class LearnerReports
{
    public function learners(): array
    {
        $learners = [];

        foreach (DB::table('grants')->get() as $row) {
            $learners[$row->email] = [
                'email' => $row->email, 'max_level' => (int) $row->max_level,
                'expires_at' => (int) $row->expires_at, 'revoked' => (bool) $row->revoked,
                'workplace' => [],
            ];
        }

        foreach (DB::table('workplace_grants')->get() as $row) {
            $learners[$row->email] ??= [
                'email' => $row->email, 'max_level' => 0, 'expires_at' => 0, 'revoked' => true,
                'workplace' => [],
            ];
            $learners[$row->email]['workplace'][$row->track] = [
                'expires_at' => (int) $row->expires_at, 'revoked' => (bool) $row->revoked,
            ];
        }
        ksort($learners);

        return $learners;
    }

    public function overview(): array
    {
        $learners = $this->learners();
        $progress = [];
        foreach (DB::table('learner_progress')->orderBy('email')->orderBy('level')->cursor() as $row) {
            if (!isset($learners[$row->email])) {
                continue;
            }
            $state = json_decode($row->snapshot, true, flags: JSON_THROW_ON_ERROR);
            $progress[] = ['email' => $row->email, 'level' => (int) $row->level] + $this->summarize($state);
        }

        return ['learners' => array_values($learners), 'progress' => $progress];
    }

    private function summarize(array $state): array
    {
        $totals = ['attempts' => 0, 'correct' => 0, 'incorrect' => 0, 'exams' => 0,
            'last_at' => 0, 'questions_viewed' => 0, 'exams_viewed' => 0, 'studied' => false];

        foreach ($state['attempts'] ?? [] as $attempt) {
            if (!is_array($attempt)) {
                continue;
            }
            $totals['studied'] = true;
            $totals['last_at'] = max($totals['last_at'], $this->timestamp($attempt['at'] ?? null));
            if (($attempt['skipped'] ?? false) === true) {
                continue;
            }
            $totals['attempts']++;
            $totals['correct'] += (int) (($attempt['grade'] ?? null) === true);
            $totals['incorrect'] += (int) (($attempt['grade'] ?? null) === false);
        }
        foreach ($state['history'] ?? [] as $record) {
            if (!is_array($record)) {
                continue;
            }
            $totals['studied'] = true;
            $totals['exams'] += (int) (is_string($record['examCode'] ?? null) || is_string($record['practicePaper'] ?? null));
            $totals['last_at'] = max($totals['last_at'], $this->timestamp($record['at'] ?? null));
        }

        $examKeys = [];
        foreach (($state['views']['questions'] ?? []) as $stamp) {
            if ($this->timestamp($stamp)) {
                $totals['questions_viewed']++;
                $totals['last_at'] = max($totals['last_at'], $stamp);
            }
        }
        foreach (($state['views']['examPages'] ?? []) as $key => $stamp) {
            if ($this->timestamp($stamp) && preg_match('/^([a-z0-9-]+):[0-9]{1,3}$/D', (string) $key, $match)) {
                $examKeys[$match[1]] = true;
                $totals['last_at'] = max($totals['last_at'], $stamp);
            }
        }
        $totals['exams_viewed'] = count($examKeys);
        $totals['studied'] = $totals['studied'] || $totals['last_at'] > 0
            || in_array('known', $state['words'] ?? [], true) || in_array('unknown', $state['words'] ?? [], true);

        return $totals;
    }

    private function timestamp(mixed $value): int
    {
        return is_int($value) && $value > 0 && $value <= 8_640_000_000_000_000 ? $value : 0;
    }
}
