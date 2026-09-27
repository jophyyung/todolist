import type { Garden } from '@/garden/plant';
import type { Course, StudySession, Task } from '@/lib/types';
import { courseWeek } from '@/study/progress';

/** Shape shared with the WidgetKit extension through the App Group (keep in sync with targets/widget/TodoWidget.swift). */
export type WidgetSnapshot = {
  updatedAt: number;
  /**
   * Open tasks: dated ones soonest first, then a few undated. The widget works out
   * "overdue" and "due today" itself at each timeline entry, so counts never go stale.
   */
  items: { title: string; dueAt: number | null }[];
  /** Courses still short of their weekly goal, most urgent first. */
  study: { name: string; remaining: number; behind: boolean }[];
  plant: { streak: number; wilted: boolean; keptToday: boolean };
};

const MAX_DATED = 30;
const MAX_UNDATED = 5;

export function buildSnapshot(tasks: Task[], courses: Course[], sessions: StudySession[], garden: Garden, now: number): WidgetSnapshot {
  const open = tasks.filter((t) => t.completedAt == null);
  const dated = open.filter((t) => t.dueAt != null).sort((a, b) => a.dueAt! - b.dueAt!);
  const undated = open.filter((t) => t.dueAt == null).sort((a, b) => b.priority - a.priority || b.createdAt - a.createdAt);
  return {
    updatedAt: now,
    items: [...dated.slice(0, MAX_DATED), ...undated.slice(0, MAX_UNDATED)].map((t) => ({ title: t.title, dueAt: t.dueAt })),
    study: courses
      .map((c) => courseWeek(c, sessions, now))
      .filter((w) => w.remaining > 0)
      .sort((a, b) => Number(b.status === 'behind') - Number(a.status === 'behind') || b.remaining - a.remaining)
      .map((w) => ({ name: w.course.name, remaining: w.remaining, behind: w.status === 'behind' })),
    plant: { streak: garden.streak, wilted: garden.wilted, keptToday: garden.today === 'kept' },
  };
}
