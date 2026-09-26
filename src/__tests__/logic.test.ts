/// <reference types="jest" />
import { addDays, atTime, groupTasks, HOUR, nextOccurrence, startOfWeek } from '@/lib/dates';
import { parseQuickAdd } from '@/lib/quickAdd';
import type { Course, StudySession, Task } from '@/lib/types';
import { IOS_PENDING_LIMIT, planNotifications } from '@/notifications/planner';
import { courseWeek, statusFor, statusLabel } from '@/study/progress';
import { evaluateGarden, stageFor, type TaskLogEntry } from '@/garden/plant';

// Wednesday 2026-09-23 10:00 local time.
const NOW = new Date(2026, 8, 23, 10, 0).getTime();
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime();

let nextId = 1;
function task(over: Partial<Task> = {}): Task {
  return {
    id: nextId++,
    title: 'Task',
    notes: '',
    dueAt: null,
    priority: 0,
    repeat: 'none',
    reminders: [0],
    completedAt: null,
    snoozedUntil: null,
    createdAt: NOW - 1000,
    ...over,
  };
}

const course = (over: Partial<Course> = {}): Course => ({
  id: nextId++,
  name: 'Biology',
  color: '#208AEF',
  weeklyTarget: 2,
  createdAt: NOW,
  ...over,
});

const session = (courseId: number, t: number, minutes = 30): StudySession => ({ id: nextId++, courseId, minutes, at: t });

describe('parseQuickAdd', () => {
  const p = (s: string) => parseQuickAdd(s, NOW);

  it('leaves plain text alone', () => {
    expect(p('buy 2 apples')).toEqual({ title: 'buy 2 apples', dueAt: null, repeat: 'none', priority: 0, matched: false });
  });

  it('understands day words with and without times', () => {
    expect(p('gym tomorrow 6pm')).toMatchObject({ title: 'gym', dueAt: at(9, 24, 18) });
    expect(p('call mum tonight')).toMatchObject({ title: 'call mum', dueAt: at(9, 23, 20) });
    expect(p('dentist Tomorrow')).toMatchObject({ title: 'dentist', dueAt: at(9, 24, 9) });
    expect(p('report next week')).toMatchObject({ title: 'report', dueAt: at(9, 28, 9) });
  });

  it('handles weekdays, including today and "next"', () => {
    expect(p('pay rent fri')).toMatchObject({ title: 'pay rent', dueAt: at(9, 25, 9) });
    expect(p('meeting on Wednesday at 3pm')).toMatchObject({ title: 'meeting', dueAt: at(9, 23, 15) });
    expect(p('meeting next wed 3pm')).toMatchObject({ dueAt: at(9, 30, 15) });
    expect(p('thursday lab 14:00')).toMatchObject({ title: 'lab', dueAt: at(9, 24, 14) });
  });

  it('reads times alone, rolling to tomorrow if already past', () => {
    expect(p('lunch at noon')).toMatchObject({ title: 'lunch', dueAt: at(9, 23, 12) });
    expect(p('run 7am')).toMatchObject({ title: 'run', dueAt: at(9, 24, 7) });
    expect(p('call at 5')).toMatchObject({ title: 'call', dueAt: at(9, 23, 17) });
    expect(p('standup 9:30')).toMatchObject({ title: 'standup', dueAt: at(9, 24, 9, 30) });
    expect(p('email 5:30pm')).toMatchObject({ dueAt: at(9, 23, 17, 30) });
  });

  it('reads day-first dates and relative times', () => {
    expect(p('exam 12/10')).toMatchObject({ title: 'exam', dueAt: at(10, 12, 9) });
    expect(p('renew passport 1/3 at 10am')).toMatchObject({ title: 'renew passport', dueAt: new Date(2027, 2, 1, 10).getTime() });
    expect(p('tea in 20 min')).toMatchObject({ title: 'tea', dueAt: NOW + 20 * 60_000 });
    expect(p('check oven in 2h')).toMatchObject({ dueAt: NOW + 2 * HOUR });
  });

  it('reads repeats and priority', () => {
    expect(p('vitamins every day 8pm')).toMatchObject({ title: 'vitamins', repeat: 'daily', dueAt: at(9, 23, 20) });
    expect(p('standup every weekday')).toMatchObject({ repeat: 'weekdays', dueAt: at(9, 24, 9) });
    expect(p('bins every monday 7pm')).toMatchObject({ title: 'bins', repeat: 'weekly', dueAt: at(9, 28, 19) });
    expect(p('fix bug !')).toMatchObject({ title: 'fix bug', priority: 1, dueAt: null, matched: true });
    expect(p('taxes !! tomorrow')).toMatchObject({ title: 'taxes', priority: 2 });
  });

  it('keeps the original text if everything was a date', () => {
    expect(p('tomorrow').title).toBe('tomorrow');
  });
});

describe('study progress', () => {
  it('counts only this week (Mon–Sun) and spreads minutes per day', () => {
    const c = course({ weeklyTarget: 3 });
    const w = courseWeek(c, [session(c.id, at(9, 21, 19), 45), session(c.id, at(9, 23, 8), 30), session(c.id, at(9, 20, 12)), session(999, NOW)], NOW);
    expect(startOfWeek(NOW)).toBe(at(9, 21, 0));
    expect(w).toMatchObject({ done: 2, minutes: 75, remaining: 1, daysLeft: 5, status: 'on-track' });
    expect(w.perDay).toEqual([45, 0, 30, 0, 0, 0, 0]);
    expect(statusLabel(w)).toBe('1 session left this week');
  });

  it('flags behind when the sessions needed fill the remaining days', () => {
    expect(statusFor(0, 3)).toBe('done');
    expect(statusFor(1, 3)).toBe('on-track');
    expect(statusFor(3, 3)).toBe('behind');
    const c = course({ weeklyTarget: 2 });
    const sunday = at(9, 27, 10);
    expect(statusLabel(courseWeek(c, [], sunday))).toBe('Behind · 2 sessions left, 1 day to go');
  });
});

describe('dates', () => {
  it('rolls repeating tasks forward past now', () => {
    const due = atTime(addDays(NOW, -3), 9);
    expect(nextOccurrence(due, 'daily', NOW)).toBe(atTime(addDays(NOW, 1), 9));
    expect(nextOccurrence(due, 'weekly', NOW)).toBe(atTime(addDays(NOW, 4), 9));
    // Friday 2026-09-25 → next weekday is Monday 28th.
    const friday = at(9, 25, 9);
    expect(new Date(nextOccurrence(friday, 'weekdays', friday)).getDate()).toBe(28);
  });

  it('groups tasks into sections in order', () => {
    const sections = groupTasks(
      [
        task({ title: 'later', dueAt: addDays(NOW, 2) }),
        task({ title: 'late', dueAt: NOW - 1000 }),
        task({ title: 'soon', dueAt: NOW + 1000 }),
        task({ title: 'anytime' }),
        task({ title: 'done', completedAt: NOW }),
      ],
      NOW,
    );
    expect(sections.map((s) => [s.key, s.data.map((t) => t.title)])).toEqual([
      ['overdue', ['late']],
      ['today', ['soon']],
      ['upcoming', ['later']],
      ['someday', ['anytime']],
      ['completed', ['done']],
    ]);
  });
});

describe('planNotifications', () => {
  const settings = { digestHour: 8, digestMinute: 0, studyHour: 19, studyMinute: 0, plantHour: 21, plantMinute: 0 };
  const plan = (over: Partial<Parameters<typeof planNotifications>[0]>) =>
    planNotifications({ tasks: [], courses: [], sessions: [], settings, now: NOW, ...over });

  it('plans reminders, due and overdue nags, skipping the past', () => {
    const t = task({ title: 'Gym', dueAt: NOW + 30 * 60_000, reminders: [0, 15, 60] });
    const kinds = plan({ tasks: [t] }).filter((p) => p.taskId === t.id).map((p) => p.kind);
    expect(kinds).toEqual(['reminder', 'due', 'overdue']);
  });

  it('suppresses reminders before a snooze and adds the snooze alert', () => {
    const t = task({ dueAt: NOW + 10 * 60_000, reminders: [0, 5], snoozedUntil: NOW + 30 * 60_000 });
    expect(plan({ tasks: [t] }).filter((p) => p.taskId != null).map((p) => p.kind)).toEqual(['snooze', 'overdue']);
  });

  it('ignores completed and undated tasks', () => {
    const result = plan({ tasks: [task({ dueAt: NOW + 60_000, completedAt: NOW }), task()] });
    expect(result.filter((p) => p.kind !== 'plant')).toEqual([]);
  });

  it('reminds the plant needs water each evening, skipping today once something is done', () => {
    const idle = plan({ streak: 4 }).filter((p) => p.kind === 'plant');
    expect(idle).toHaveLength(7);
    expect(idle[0].date).toBe(at(9, 23, 21));
    expect(idle[0].body).toContain('4-day streak');
    const active = plan({ sessions: [session(1, at(9, 23, 9))] }).filter((p) => p.kind === 'plant');
    expect(active[0].date).toBe(at(9, 24, 21));
  });

  it('writes digests with task counts and unfinished courses', () => {
    const bio = course({ name: 'Biology', weeklyTarget: 1 });
    const maths = course({ name: 'Maths', weeklyTarget: 1 });
    const digests = plan({
      tasks: [task({ dueAt: at(9, 24, 12) }), task({ dueAt: NOW - HOUR })],
      courses: [bio, maths],
      sessions: [session(maths.id, at(9, 22, 20))],
    }).filter((p) => p.kind === 'digest');
    expect(digests[0].date).toBe(at(9, 24, 8));
    expect(digests[0].body).toBe('1 to-do today · 1 overdue · study Biology this week');
    // Next Monday is a new week, so both courses are open again.
    expect(digests.find((d) => d.date === at(9, 28, 8))!.body).toBe('2 overdue · study Biology & Maths this week');
  });

  it('nudges in the evening only once a course is behind', () => {
    const c = course({ name: 'Maths', weeklyTarget: 2 });
    const nudges = plan({ courses: [c] }).filter((p) => p.kind === 'study');
    // 2 sessions needed: behind from Saturday (2 days left). Next week restarts with 7 days.
    expect(nudges.map((n) => new Date(n.date).getDate())).toEqual([26, 27]);
    expect(nudges[1].body).toBe("Last day of the week: 2 sessions left, or your plant's streak resets.");
    expect(nudges[0].courseId).toBe(c.id);

    const done = plan({ courses: [c], sessions: [session(c.id, at(9, 21, 9)), session(c.id, at(9, 22, 9))] });
    expect(done.filter((p) => p.kind === 'study')).toEqual([]);
  });

  it('never exceeds the iOS pending limit and keeps the earliest', () => {
    const tasks = Array.from({ length: 50 }, (_, i) => task({ dueAt: NOW + (i + 1) * HOUR, reminders: [0, 15] }));
    const result = plan({ tasks });
    expect(result).toHaveLength(IOS_PENDING_LIMIT);
    expect(result).toEqual([...result].sort((a, b) => a.date - b.date));
    expect(result[0].taskId).toBe(tasks[0].id);
  });
});

describe('evaluateGarden', () => {
  // Plant started Monday 21st; NOW is Wednesday 23rd 10:00.
  const startedAt = at(9, 21, 8);
  let logId = 1;
  const done = (title: string, dueAt: number | null, doneAt: number): TaskLogEntry => ({
    id: logId++,
    taskId: logId,
    title,
    dueAt,
    doneAt,
    kind: 'done',
  });
  const garden = (over: Partial<Parameters<typeof evaluateGarden>[0]>) =>
    evaluateGarden({ log: [], tasks: [], sessions: [], courses: [], startedAt, now: NOW, ...over });

  it('grows the streak for days with on-time activity', () => {
    const g = garden({
      log: [done('a', at(9, 21, 12), at(9, 21, 11)), done('b', null, at(9, 22, 9))],
      sessions: [session(1, at(9, 23, 9))],
    });
    expect(g).toMatchObject({ streak: 3, best: 3, today: 'kept', wilted: false, reasons: [] });
    expect(g.stage.name).toBe('Sprout');
    expect(g.history.slice(-4).map((h) => h.state)).toEqual(['before', 'kept', 'kept', 'kept']);
  });

  it('keeps yesterday\'s streak while today is still pending', () => {
    const g = garden({ log: [done('a', null, at(9, 21, 9)), done('b', null, at(9, 22, 9))] });
    expect(g).toMatchObject({ streak: 2, today: 'pending' });
  });

  it('resets on a late task, a missed task or an idle day', () => {
    const late = garden({ log: [done('Essay', at(9, 21, 12), at(9, 21, 13)), done('b', null, at(9, 22, 9))] });
    expect(late).toMatchObject({ streak: 1, best: 1 });

    const missed = garden({ log: [done('a', null, at(9, 21, 9))], tasks: [task({ title: 'Rent', dueAt: at(9, 22, 18) })] });
    expect(missed).toMatchObject({ streak: 0, best: 1, wilted: true, reasons: ['“Rent” was missed'] });

    const idle = garden({ log: [done('a', null, at(9, 21, 9))] });
    expect(idle).toMatchObject({ streak: 0, wilted: true, reasons: ['Nothing was done that day'] });
  });

  it('breaks immediately when a task goes overdue today, and counts deleting it', () => {
    const g = garden({ log: [done('a', null, at(9, 22, 9))], tasks: [task({ title: 'Call', dueAt: at(9, 23, 9) })] });
    expect(g).toMatchObject({ today: 'broken', streak: 0, wilted: true, reasons: ['“Call” was missed'] });
    const notYet = garden({ tasks: [task({ dueAt: at(9, 23, 18) })], log: [done('a', null, at(9, 22, 9))] });
    expect(notYet.today).toBe('pending');
    const deleted = garden({ log: [{ ...done('Gym', at(9, 22, 7), at(9, 22, 9)), kind: 'deleted', doneAt: null }] });
    expect(deleted.reasons).toEqual(['“Gym” was deleted while overdue']);
  });

  it('fails Sunday if a course missed its weekly goal', () => {
    const monday = at(9, 28, 10);
    const bio = course({ name: 'Bio', weeklyTarget: 2, createdAt: at(9, 14, 9) });
    const daily = [21, 22, 23, 24, 25, 26, 27].map((d) => done('x', null, at(9, d, 9)));
    const g = garden({ now: monday, startedAt: at(9, 14, 8), courses: [bio], log: daily, sessions: [session(bio.id, at(9, 22, 9))] });
    expect(g).toMatchObject({ streak: 0, reasons: ['Bio weekly goal missed (1/2)'] });
  });

  it('maps streaks to plant stages', () => {
    expect(stageFor(0).stage.name).toBe('Seed');
    expect(stageFor(6)).toMatchObject({ stage: { name: 'Sprout' }, next: { name: 'Young plant', minStreak: 7 } });
    expect(stageFor(100).next).toBeNull();
  });
});

describe('evaluateGarden at install', () => {
  it('ignores deadlines that passed before the plant was planted', () => {
    const g = evaluateGarden({
      log: [],
      tasks: [task({ title: 'Old', dueAt: at(9, 23, 8) })],
      sessions: [],
      courses: [],
      startedAt: at(9, 23, 9),
      now: NOW,
    });
    expect(g).toMatchObject({ today: 'pending', wilted: false, streak: 0 });
  });
});
