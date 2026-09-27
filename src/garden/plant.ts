import { addDays, startOfDay, startOfWeek } from '@/lib/dates';
import type { Course, Run, StudySession, Task } from '@/lib/types';
import { runGoalMiss, type RunGoal } from '@/running/stats';

/** One record per completion (repeating tasks included) or per overdue task deleted. */
export type TaskLogEntry = {
  id: number;
  taskId: number;
  title: string;
  dueAt: number | null;
  doneAt: number | null;
  kind: 'done' | 'deleted';
};

export type DayState = 'kept' | 'failed' | 'pending';

export type Stage = { minStreak: number; emoji: string; name: string };

export const STAGES: Stage[] = [
  { minStreak: 0, emoji: '🌰', name: 'Seed' },
  { minStreak: 1, emoji: '🌱', name: 'Seedling' },
  { minStreak: 3, emoji: '🌿', name: 'Sprout' },
  { minStreak: 7, emoji: '🪴', name: 'Young plant' },
  { minStreak: 14, emoji: '🌳', name: 'Tree' },
  { minStreak: 30, emoji: '🌸', name: 'Blossom' },
  { minStreak: 60, emoji: '🍎', name: 'Fruit tree' },
];
export const WILTED = '🥀';

export function stageFor(streak: number): { stage: Stage; next: Stage | null } {
  let i = 0;
  while (i + 1 < STAGES.length && streak >= STAGES[i + 1].minStreak) i++;
  return { stage: STAGES[i], next: STAGES[i + 1] ?? null };
}

type Input = {
  log: TaskLogEntry[];
  tasks: Task[];
  sessions: StudySession[];
  courses: Course[];
  runs?: Run[];
  runGoal?: RunGoal;
  /** When the plant was planted; earlier days aren't judged. */
  startedAt: number;
  now: number;
};

export type Garden = {
  streak: number;
  best: number;
  today: 'kept' | 'pending' | 'broken';
  /** Why today (if broken) or else yesterday failed; empty if neither did. */
  reasons: string[];
  wilted: boolean;
  /** Oldest first, ending with today. */
  history: { day: number; state: DayState | 'before' }[];
  stage: Stage;
  next: Stage | null;
};

const HISTORY_DAYS = 14;

/**
 * Strict rules: a day is kept only if something was done (a task completed, study or a run
 * logged) and every task due that day was completed on time. On Sundays every course and the
 * running goal must also have been met. Deleting an overdue task counts as missing it.
 */
export function evaluateGarden({ log, tasks, sessions, courses, runs = [], runGoal, startedAt, now }: Input): Garden {
  const today = startOfDay(now);
  const start = startOfDay(startedAt);
  const inDay = (t: number | null, day: number) => t != null && t >= day && t < addDays(day, 1);
  // Only deadlines after planting count, so tasks already overdue at install don't wilt it.
  const judged = (dueAt: number | null, day: number, until: number) => inDay(dueAt, day) && dueAt! < until && dueAt! >= startedAt;

  function misses(day: number, until: number): string[] {
    const out: string[] = [];
    for (const e of log) {
      if (!judged(e.dueAt, day, until)) continue;
      if (e.kind === 'deleted') out.push(`“${e.title}” was deleted while overdue`);
      else if (e.doneAt! > e.dueAt!) out.push(`“${e.title}” was done late`);
    }
    for (const t of tasks) {
      if (t.completedAt == null && judged(t.dueAt, day, until)) out.push(`“${t.title}” was missed`);
    }
    return out;
  }

  function weeklyMisses(day: number): string[] {
    if (new Date(day).getDay() !== 0) return [];
    const week = startOfWeek(day);
    if (week < start) return [];
    const weekEnd = addDays(week, 7);
    const courseMisses = courses
      .filter((c) => c.createdAt < week)
      .flatMap((c) => {
        const done = sessions.filter((s) => s.courseId === c.id && s.at >= week && s.at < weekEnd).length;
        return done < c.weeklyTarget ? [`${c.name} weekly goal missed (${done}/${c.weeklyTarget})`] : [];
      });
    const runMiss = runGoal ? runGoalMiss(runs, runGoal, day) : null;
    return runMiss ? [...courseMisses, runMiss] : courseMisses;
  }

  const active = (day: number) =>
    log.some((e) => e.kind === 'done' && inDay(e.doneAt, day)) ||
    sessions.some((s) => inDay(s.at, day)) ||
    runs.some((r) => inDay(r.at, day));

  function judgePast(day: number): { state: DayState; reasons: string[] } {
    const reasons = [...misses(day, Infinity), ...weeklyMisses(day)];
    if (!reasons.length && !active(day)) reasons.push('Nothing was done that day');
    return { state: reasons.length ? 'failed' : 'kept', reasons };
  }

  let run = 0;
  let best = 0;
  let yesterday: { state: DayState; reasons: string[] } | null = null;
  const states = new Map<number, DayState>();
  for (let day = start; day < today; day = addDays(day, 1)) {
    const j = judgePast(day);
    states.set(day, j.state);
    run = j.state === 'kept' ? run + 1 : 0;
    best = Math.max(best, run);
    yesterday = j;
  }

  const todayMisses = misses(today, now);
  const todayState = todayMisses.length ? 'broken' : active(today) ? 'kept' : 'pending';
  const streak = todayState === 'broken' ? 0 : todayState === 'kept' ? run + 1 : run;
  best = Math.max(best, streak);
  states.set(today, todayState === 'broken' ? 'failed' : todayState);

  const wilted = todayState === 'broken' || (streak === 0 && yesterday?.state === 'failed');
  const reasons = todayState === 'broken' ? todayMisses : yesterday?.state === 'failed' && streak === 0 ? yesterday.reasons : [];

  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const day = addDays(today, i - HISTORY_DAYS + 1);
    return { day, state: states.get(day) ?? ('before' as const) };
  });

  return { streak, best, today: todayState, reasons, wilted, history, ...stageFor(streak) };
}
