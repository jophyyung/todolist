import type { Repeat, Task } from './types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Adds calendar days in local time (DST-safe, unlike `t + n * DAY`). */
export function addDays(t: number, n: number): number {
  const d = new Date(t);
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Monday 00:00 of the week containing `t`. */
export function startOfWeek(t: number): number {
  const day = startOfDay(t);
  const weekday = (new Date(day).getDay() + 6) % 7; // Mon = 0 … Sun = 6
  return addDays(day, -weekday);
}

export function atTime(day: number, hour: number, minute = 0): number {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function stepOnce(t: number, repeat: Repeat): number {
  switch (repeat) {
    case 'daily':
      return addDays(t, 1);
    case 'weekly':
      return addDays(t, 7);
    case 'weekdays': {
      let next = addDays(t, 1);
      while ([0, 6].includes(new Date(next).getDay())) next = addDays(next, 1);
      return next;
    }
    case 'none':
      return t;
  }
}

/** Next occurrence of a repeating task strictly after `now` (at least one step forward). */
export function nextOccurrence(dueAt: number, repeat: Repeat, now: number): number {
  if (repeat === 'none') return dueAt;
  let next = stepOnce(dueAt, repeat);
  while (next <= now) next = stepOnce(next, repeat);
  return next;
}

export type SectionKey = 'overdue' | 'today' | 'upcoming' | 'someday' | 'completed';

export const SECTION_TITLES: Record<SectionKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  someday: 'Someday',
  completed: 'Completed',
};

export function sectionOf(task: Task, now: number): SectionKey {
  if (task.completedAt != null) return 'completed';
  if (task.dueAt == null) return 'someday';
  if (task.dueAt < now) return 'overdue';
  if (task.dueAt < addDays(startOfDay(now), 1)) return 'today';
  return 'upcoming';
}

export function groupTasks(tasks: Task[], now: number) {
  const groups: Record<SectionKey, Task[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    someday: [],
    completed: [],
  };
  for (const t of tasks) groups[sectionOf(t, now)].push(t);
  const byDue = (a: Task, b: Task) => (a.dueAt ?? 0) - (b.dueAt ?? 0) || b.priority - a.priority;
  groups.overdue.sort(byDue);
  groups.today.sort(byDue);
  groups.upcoming.sort(byDue);
  groups.someday.sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  groups.completed.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  groups.completed = groups.completed.slice(0, 20);
  return (Object.keys(groups) as SectionKey[])
    .filter((k) => groups[k].length > 0)
    .map((k) => ({ key: k, title: SECTION_TITLES[k], data: groups[k] }));
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(t: number): string {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDue(t: number, now: number): string {
  const today = startOfDay(now);
  const day = startOfDay(t);
  const diff = Math.round((day - today) / DAY);
  const time = formatTime(t);
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff === -1) return `Yesterday ${time}`;
  const d = new Date(t);
  const label = d.toLocaleDateString(undefined, {
    weekday: Math.abs(diff) < 7 ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
  });
  return `${label} ${time}`;
}

export function formatReminder(minutes: number): string {
  if (minutes === 0) return 'At time';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes < 1440) return `${minutes / 60} h before`;
  return `${minutes / 1440} d before`;
}
