import { addDays, DAY, startOfDay, startOfWeek } from '@/lib/dates';
import type { Run, RunGoalKind, Settings } from '@/lib/types';
import type { CourseStatus } from '@/study/progress';

export type RunGoal = {
  kind: RunGoalKind;
  value: number;
  setAt: number;
  /** The goal before the last change, which still judges the week it was changed in. */
  previous?: { kind: RunGoalKind; value: number; setAt: number };
};

type GoalSettings = Pick<
  Settings,
  'runGoalKind' | 'runGoalValue' | 'runGoalSetAt' | 'runGoalPrevKind' | 'runGoalPrevValue' | 'runGoalPrevSetAt'
>;

export function runGoalFrom(s: GoalSettings): RunGoal {
  return {
    kind: s.runGoalKind,
    value: s.runGoalValue,
    setAt: s.runGoalSetAt,
    previous: { kind: s.runGoalPrevKind, value: s.runGoalPrevValue, setAt: s.runGoalPrevSetAt },
  };
}

/** Settings patch for changing the goal; unchanged goals keep their start date. */
export function runGoalChange(s: GoalSettings, kind: RunGoalKind, value: number, now: number): Partial<Settings> {
  if (kind === s.runGoalKind && (kind === 'none' || value === s.runGoalValue)) return {};
  return {
    runGoalKind: kind,
    runGoalValue: value,
    runGoalSetAt: now,
    runGoalPrevKind: s.runGoalKind,
    runGoalPrevValue: s.runGoalValue,
    runGoalPrevSetAt: s.runGoalSetAt,
  };
}

// ---------- formatting & parsing ----------

export function formatKm(m: number): string {
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(2).replace(/0$/, '') : km.toFixed(1)} km`;
}

export function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Seconds per km, or null for runs too short to have a meaningful pace. */
export function paceOf(run: Pick<Run, 'distanceM' | 'durationS'>): number | null {
  return run.distanceM >= 100 && run.durationS > 0 ? run.durationS / (run.distanceM / 1000) : null;
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return '–';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return s === 60 ? `${m + 1}:00 /km` : `${m}:${String(s).padStart(2, '0')} /km`;
}

/** "25:30" → 1530, "1:02:03" → 3723, "45" → 2700 (plain number = minutes). */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t) * 60) || null;
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((n) => n >= 60)) return null;
  const s = nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
  return s > 0 ? s : null;
}

/** "5.2", "5,2", "5.2km" → 5200 metres. */
export function parseKm(text: string): number | null {
  const n = Number(text.trim().replace(',', '.').replace(/\s*km$/i, ''));
  return Number.isFinite(n) && n > 0 && n < 1000 ? Math.round(n * 1000) : null;
}

// ---------- weekly goal ----------

export type RunWeek = {
  kind: RunGoalKind;
  goal: number;
  distanceM: number;
  runs: number;
  /** In goal units: km or runs. */
  done: number;
  remaining: number;
  daysLeft: number;
  status: CourseStatus;
};

/**
 * "Behind" for a runs goal: the runs still needed fill every remaining day.
 * For a km goal: what's left would need more than a third of the weekly goal on each remaining day.
 */
export function runStatus(kind: RunGoalKind, goal: number, remaining: number, daysLeft: number): CourseStatus {
  if (kind === 'none' || remaining <= 0) return 'done';
  if (kind === 'runs') return remaining >= daysLeft ? 'behind' : 'on-track';
  return remaining / daysLeft > goal / 3 ? 'behind' : 'on-track';
}

function weekOf(runs: Run[], weekStart: number) {
  const end = addDays(weekStart, 7);
  const inWeek = runs.filter((r) => r.at >= weekStart && r.at < end);
  return { distanceM: inWeek.reduce((s, r) => s + r.distanceM, 0), runs: inWeek.length };
}

export function runWeek(runs: Run[], goal: RunGoal, now: number, day = now): RunWeek {
  const week = startOfWeek(day);
  // Future weeks haven't started, so nothing is logged in them yet.
  const { distanceM, runs: count } = startOfWeek(now) === week ? weekOf(runs, week) : { distanceM: 0, runs: 0 };
  const done = goal.kind === 'km' ? distanceM / 1000 : count;
  const remaining = goal.kind === 'none' ? 0 : Math.max(0, Math.round((goal.value - done) * 100) / 100);
  const daysLeft = Math.round((addDays(week, 7) - startOfDay(day)) / DAY);
  return {
    kind: goal.kind,
    goal: goal.value,
    distanceM,
    runs: count,
    done,
    remaining,
    daysLeft,
    status: runStatus(goal.kind, goal.value, remaining, daysLeft),
  };
}

export function formatGoalAmount(kind: RunGoalKind, amount: number): string {
  if (kind === 'runs') return `${amount} run${amount === 1 ? '' : 's'}`;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(1)} km`;
}

export function runStatusLabel(w: RunWeek): string {
  if (w.kind === 'none') return 'No weekly goal set';
  if (w.status === 'done') return 'Goal met this week';
  const left = `${formatGoalAmount(w.kind, w.remaining)} left`;
  if (w.status === 'behind') return `Behind · ${left}, ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'} to go`;
  return `${left} this week`;
}

/**
 * Sunday check for the plant: null if fine, otherwise the reason it failed.
 * A goal changed mid-week only applies from next week; that week is judged by the previous goal,
 * so switching the goal off or lowering it on Sunday doesn't dodge the check.
 */
export function runGoalMiss(runs: Run[], current: RunGoal, sunday: number): string | null {
  const week = startOfWeek(sunday);
  const goal = current.setAt < week ? current : current.previous;
  if (!goal || goal.kind === 'none' || goal.setAt >= week) return null;
  const { distanceM, runs: count } = weekOf(runs, week);
  const done = goal.kind === 'km' ? distanceM / 1000 : count;
  if (done >= goal.value) return null;
  return goal.kind === 'km'
    ? `Running goal missed (${(distanceM / 1000).toFixed(1)}/${goal.value} km)`
    : `Running goal missed (${count}/${goal.value} runs)`;
}

// ---------- statistics ----------

export type WeekTotal = { weekStart: number; distanceM: number; runs: number };

/** The last `weeks` weeks ending with the current one, oldest first. */
export function weeklyTotals(runs: Run[], now: number, weeks = 8): WeekTotal[] {
  const current = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDays(current, -7 * (weeks - 1 - i));
    return { weekStart, ...weekOf(runs, weekStart) };
  });
}

export type RunRecords = {
  totalDistanceM: number;
  totalRuns: number;
  monthDistanceM: number;
  longest: Run | null;
  fastest: { run: Run; pace: number } | null;
  /** Best 5 km time, estimated from the average pace of runs of at least 5 km. */
  best5kS: number | null;
  averagePace: number | null;
};

export function records(runs: Run[], now: number): RunRecords {
  const month = new Date(now);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  let longest: Run | null = null;
  let fastest: RunRecords['fastest'] = null;
  let best5kS: number | null = null;
  let totalDistanceM = 0;
  let totalDurationS = 0;
  for (const r of runs) {
    totalDistanceM += r.distanceM;
    totalDurationS += r.durationS;
    if (!longest || r.distanceM > longest.distanceM) longest = r;
    const pace = paceOf(r);
    if (pace != null && r.distanceM >= 1000 && (!fastest || pace < fastest.pace)) fastest = { run: r, pace };
    if (pace != null && r.distanceM >= 5000) best5kS = Math.min(best5kS ?? Infinity, pace * 5);
  }
  return {
    totalDistanceM,
    totalRuns: runs.length,
    monthDistanceM: runs.filter((r) => r.at >= monthStart).reduce((s, r) => s + r.distanceM, 0),
    longest,
    fastest,
    best5kS,
    averagePace: totalDistanceM >= 100 ? totalDurationS / (totalDistanceM / 1000) : null,
  };
}

/** Pace of the most recent runs (≥ 1 km), oldest first, for the trend chart. */
export function paceTrend(runs: Run[], count = 10): { run: Run; pace: number }[] {
  return [...runs]
    .filter((r) => r.distanceM >= 1000 && paceOf(r) != null)
    .sort((a, b) => a.at - b.at)
    .slice(-count)
    .map((run) => ({ run, pace: paceOf(run)! }));
}
