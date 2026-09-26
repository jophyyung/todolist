import { addDays, DAY, startOfDay, startOfWeek } from '@/lib/dates';
import type { Course, StudySession } from '@/lib/types';

export type CourseStatus = 'done' | 'on-track' | 'behind';

export type CourseWeek = {
  course: Course;
  done: number;
  minutes: number;
  remaining: number;
  /** Days left in the week including today. */
  daysLeft: number;
  status: CourseStatus;
  /** Minutes studied on each day Mon…Sun. */
  perDay: number[];
};

/**
 * A course is "behind" once the sessions still needed fill every remaining day
 * (e.g. 2 left with 2 days to go), so the warning comes while it's still fixable.
 */
export function statusFor(remaining: number, daysLeft: number): CourseStatus {
  if (remaining <= 0) return 'done';
  return remaining >= daysLeft ? 'behind' : 'on-track';
}

export function courseWeek(course: Course, sessions: StudySession[], now: number): CourseWeek {
  const week = startOfWeek(now);
  const weekEnd = addDays(week, 7);
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  let done = 0;
  let minutes = 0;
  for (const s of sessions) {
    if (s.courseId !== course.id || s.at < week || s.at >= weekEnd) continue;
    done += 1;
    minutes += s.minutes;
    perDay[Math.round((startOfDay(s.at) - week) / DAY)] += s.minutes;
  }
  const daysLeft = Math.round((weekEnd - startOfDay(now)) / DAY);
  const remaining = Math.max(0, course.weeklyTarget - done);
  return { course, done, minutes, remaining, daysLeft, status: statusFor(remaining, daysLeft), perDay };
}

export function statusLabel(w: CourseWeek): string {
  if (w.status === 'done') return 'Goal met this week';
  const left = `${w.remaining} session${w.remaining === 1 ? '' : 's'} left`;
  if (w.status === 'behind') return `Behind · ${left}, ${w.daysLeft} day${w.daysLeft === 1 ? '' : 's'} to go`;
  return `${left} this week`;
}

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}
