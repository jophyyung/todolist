import { addDays, atTime, DAY, formatTime, HOUR, startOfDay, startOfWeek } from '@/lib/dates';
import type { TaskLogEntry } from '@/garden/plant';
import type { Course, Run, Settings, StudySession, Task } from '@/lib/types';
import { formatGoalAmount, runWeek, type RunGoal } from '@/running/stats';
import { courseWeek, statusFor } from '@/study/progress';

/** iOS keeps at most 64 pending local notifications per app. */
export const IOS_PENDING_LIMIT = 64;
export const PLAN_DAYS = 7;
export const TASK_CATEGORY = 'task';
export const STUDY_CATEGORY = 'study';

export type PlannedNotification = {
  key: string;
  date: number;
  title: string;
  body: string;
  taskId?: number;
  courseId?: number;
  kind: 'reminder' | 'due' | 'overdue' | 'snooze' | 'digest' | 'study' | 'plant' | 'run';
};

type PlanInput = {
  tasks: Task[];
  courses: Course[];
  sessions: StudySession[];
  settings: Pick<Settings, 'digestHour' | 'digestMinute' | 'studyHour' | 'studyMinute' | 'plantHour' | 'plantMinute'>;
  now: number;
  /** Task completions, used to skip today's plant reminder once something is done. */
  log?: TaskLogEntry[];
  /** Current plant streak, mentioned in today's plant reminder. */
  streak?: number;
  runs?: Run[];
  runGoal?: RunGoal;
};

function taskNotifications(task: Task, now: number): PlannedNotification[] {
  if (task.completedAt != null || task.dueAt == null) return [];
  const due = task.dueAt;
  const snoozed = task.snoozedUntil != null && task.snoozedUntil > now ? task.snoozedUntil : null;
  const out: PlannedNotification[] = [];
  const add = (n: Omit<PlannedNotification, 'taskId'>) => {
    if (n.date > now && (snoozed == null || n.date >= snoozed)) out.push({ ...n, taskId: task.id });
  };

  for (const minutes of new Set(task.reminders)) {
    add(
      minutes === 0
        ? { key: `t${task.id}-due`, kind: 'due', date: due, title: task.title, body: `Due now (${formatTime(due)})` }
        : {
            key: `t${task.id}-r${minutes}`,
            kind: 'reminder',
            date: due - minutes * 60_000,
            title: task.title,
            body: `Due ${formatTime(due)}. Finish it on time or your plant's streak resets.`,
          },
    );
  }
  add({ key: `t${task.id}-overdue`, kind: 'overdue', date: due + HOUR, title: `Overdue: ${task.title}`, body: `Was due ${formatTime(due)}` });
  if (snoozed != null) {
    out.push({ key: `t${task.id}-snooze`, kind: 'snooze', date: snoozed, title: task.title, body: 'Snoozed reminder', taskId: task.id });
  }
  return out;
}

/** Sessions still needed for each course in the week containing `day`, assuming nothing more is logged. */
function remainingOn(day: number, courses: Course[], sessions: StudySession[], now: number) {
  const sameWeek = startOfWeek(day) === startOfWeek(now);
  return courses.map((c) => {
    const remaining = sameWeek ? courseWeek(c, sessions, now).remaining : c.weeklyTarget;
    const daysLeft = Math.round((addDays(startOfWeek(day), 7) - day) / DAY);
    return { course: c, remaining, daysLeft };
  });
}

function names(list: string[]): string {
  return list.length <= 2 ? list.join(' & ') : `${list.slice(0, 2).join(', ')} +${list.length - 2}`;
}

function digestBody(today: number, overdue: number, studyLeft: string[], runLeft: string | null): string | null {
  const parts: string[] = [];
  if (today) parts.push(`${today} to-do${today === 1 ? '' : 's'} today`);
  if (overdue) parts.push(`${overdue} overdue`);
  if (studyLeft.length) parts.push(`study ${names(studyLeft)} this week`);
  if (runLeft) parts.push(`${runLeft} to run`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Plans every local notification for the next week, earliest first, capped at the iOS limit.
 * Future days are planned assuming nothing changes; the plan is recomputed on every data change.
 */
export function planNotifications({
  tasks,
  courses,
  sessions,
  settings,
  now,
  log = [],
  streak = 0,
  runs = [],
  runGoal = { kind: 'none', value: 0, setAt: 0 },
}: PlanInput): PlannedNotification[] {
  const open = tasks.filter((t) => t.completedAt == null);
  const daily: PlannedNotification[] = [];

  for (let i = 0; i < PLAN_DAYS; i++) {
    const day = addDays(startOfDay(now), i);
    const dayEnd = addDays(day, 1);
    const status = remainingOn(day, courses, sessions, now);
    const run = runWeek(runs, runGoal, now, day);

    const digestAt = atTime(day, settings.digestHour, settings.digestMinute);
    if (digestAt > now) {
      const todayCount = open.filter((t) => t.dueAt != null && t.dueAt >= digestAt && t.dueAt < dayEnd).length;
      const overdue = open.filter((t) => t.dueAt != null && t.dueAt < digestAt).length;
      const runLeft = run.remaining > 0 ? formatGoalAmount(run.kind, run.remaining) : null;
      const body = digestBody(todayCount, overdue, status.filter((s) => s.remaining > 0).map((s) => s.course.name), runLeft);
      if (body) daily.push({ key: `digest-${day}`, kind: 'digest', date: digestAt, title: 'Good morning', body });
    }

    const runAt = atTime(day, settings.studyHour, settings.studyMinute);
    if (runAt > now && run.status === 'behind') {
      const left = formatGoalAmount(run.kind, run.remaining);
      daily.push({
        key: `run-${day}`,
        kind: 'run',
        date: runAt,
        title: 'Time for a run 🏃',
        body:
          run.daysLeft === 1
            ? `Last day of the week: ${left} left, or your plant's streak resets.`
            : `${left} left this week and ${run.daysLeft} days to go.`,
      });
    }

    const studyAt = atTime(day, settings.studyHour, settings.studyMinute);
    if (studyAt > now) {
      for (const s of status) {
        if (statusFor(s.remaining, s.daysLeft) !== 'behind') continue;
        daily.push({
          key: `study-${s.course.id}-${day}`,
          kind: 'study',
          date: studyAt,
          courseId: s.course.id,
          title: `Time to study ${s.course.name}`,
          body:
            s.daysLeft === 1
              ? `Last day of the week: ${s.remaining} session${s.remaining === 1 ? '' : 's'} left, or your plant's streak resets.`
              : `${s.remaining} session${s.remaining === 1 ? '' : 's'} left and ${s.daysLeft} days to go.`,
        });
      }
    }
  }

  const dayStart = startOfDay(now);
  const activeToday =
    log.some((e) => e.kind === 'done' && e.doneAt != null && e.doneAt >= dayStart) ||
    sessions.some((s) => s.at >= dayStart) ||
    runs.some((r) => r.at >= dayStart);
  for (let i = 0; i < PLAN_DAYS; i++) {
    const plantAt = atTime(addDays(dayStart, i), settings.plantHour, settings.plantMinute);
    if (plantAt <= now || (i === 0 && activeToday)) continue;
    daily.push({
      key: `plant-${plantAt}`,
      kind: 'plant',
      date: plantAt,
      title: 'Your plant is thirsty 🌱',
      body:
        i === 0 && streak > 0
          ? `Finish a task, study or go for a run before midnight to keep your ${streak}-day streak.`
          : 'Finish a task, study or go for a run before midnight, or it wilts.',
    });
  }

  const taskItems = open.flatMap((t) => taskNotifications(t, now));
  // Earliest first; anything beyond the limit is picked up by a later re-plan.
  const all = [...taskItems, ...daily].sort((a, b) => a.date - b.date);
  return all.slice(0, IOS_PENDING_LIMIT);
}
