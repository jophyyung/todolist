import { addDays, startOfDay } from '@/lib/dates';
import type { Course, StudySession, Task } from '@/lib/types';
import { courseWeek } from '@/study/progress';

/** Shape shared with the WidgetKit extension through the App Group (keep in sync with Swift). */
export type WidgetSnapshot = {
  updatedAt: number;
  items: { title: string; dueAt: number | null }[];
  todayCount: number;
  overdueCount: number;
  /** Courses still short of their weekly goal, most urgent first. */
  study: { name: string; remaining: number; behind: boolean }[];
};

export function buildSnapshot(tasks: Task[], courses: Course[], sessions: StudySession[], now: number): WidgetSnapshot {
  const open = tasks.filter((t) => t.completedAt == null);
  const tomorrow = addDays(startOfDay(now), 1);
  const dated = open.filter((t) => t.dueAt != null).sort((a, b) => a.dueAt! - b.dueAt!);
  const undated = open.filter((t) => t.dueAt == null).sort((a, b) => b.priority - a.priority);
  return {
    updatedAt: now,
    // The widget decides "overdue" itself at render time, so due dates are passed through.
    items: [...dated, ...undated].slice(0, 6).map((t) => ({ title: t.title, dueAt: t.dueAt })),
    todayCount: dated.filter((t) => t.dueAt! >= now && t.dueAt! < tomorrow).length,
    overdueCount: dated.filter((t) => t.dueAt! < now).length,
    study: courses
      .map((c) => courseWeek(c, sessions, now))
      .filter((w) => w.remaining > 0)
      .sort((a, b) => Number(b.status === 'behind') - Number(a.status === 'behind') || b.remaining - a.remaining)
      .map((w) => ({ name: w.course.name, remaining: w.remaining, behind: w.status === 'behind' })),
  };
}
