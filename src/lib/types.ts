export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly';
export type Priority = 0 | 1 | 2;

export type Task = {
  id: number;
  title: string;
  notes: string;
  dueAt: number | null;
  priority: Priority;
  repeat: Repeat;
  /** Minutes before `dueAt` to remind (0 = at due time). */
  reminders: number[];
  completedAt: number | null;
  snoozedUntil: number | null;
  createdAt: number;
};

export type TaskInput = Pick<Task, 'title' | 'notes' | 'dueAt' | 'priority' | 'repeat' | 'reminders'>;

export type Course = {
  id: number;
  name: string;
  color: string;
  /** Study sessions wanted per week (Mon–Sun), any day. */
  weeklyTarget: number;
  createdAt: number;
};

export type CourseInput = Pick<Course, 'name' | 'color' | 'weeklyTarget'>;

export type StudySession = {
  id: number;
  courseId: number;
  minutes: number;
  at: number;
};

export type Run = {
  id: number;
  distanceM: number;
  durationS: number;
  /** When the run happened. */
  at: number;
  note: string;
};

export type RunInput = Omit<Run, 'id'>;

/** Weekly running goal: kilometres or number of runs, Mon–Sun. */
export type RunGoalKind = 'none' | 'km' | 'runs';

export type Settings = {
  digestHour: number;
  digestMinute: number;
  /** Evening time for "you're behind on a course" nudges. */
  studyHour: number;
  studyMinute: number;
  /** Evening "your plant needs water" reminder if nothing was done today. */
  plantHour: number;
  plantMinute: number;
  /** When the plant was planted (first launch with the garden); 0 = not yet. */
  plantStartedAt: number;
  runGoalKind: RunGoalKind;
  runGoalValue: number;
  /** When the running goal was last changed; weeks that began earlier aren't judged. */
  runGoalSetAt: number;
  /** The goal before the last change; it still judges the week the change was made in. */
  runGoalPrevKind: RunGoalKind;
  runGoalPrevValue: number;
  runGoalPrevSetAt: number;
  defaultReminders: number[];
};

export const DEFAULT_SETTINGS: Settings = {
  digestHour: 8,
  digestMinute: 0,
  studyHour: 19,
  studyMinute: 0,
  plantHour: 21,
  plantMinute: 0,
  plantStartedAt: 0,
  runGoalKind: 'none',
  runGoalValue: 10,
  runGoalSetAt: 0,
  runGoalPrevKind: 'none',
  runGoalPrevValue: 0,
  runGoalPrevSetAt: 0,
  defaultReminders: [0, 15],
};

export const COURSE_COLORS = ['#208AEF', '#30A46C', '#F76B15', '#8E4EC6', '#D6409F', '#12A594', '#E5484D', '#A18072'];
