import type { SQLiteDatabase } from 'expo-sqlite';

import type { TaskLogEntry } from '@/garden/plant';
import {
  DEFAULT_SETTINGS,
  type Course,
  type CourseInput,
  type Run,
  type RunInput,
  type Settings,
  type StudySession,
  type Task,
  type TaskInput,
} from '@/lib/types';

export const DATABASE_NAME = 'todolist.db';
const DATABASE_VERSION = 4;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = result?.user_version ?? 0;
  if (version >= DATABASE_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        due_at INTEGER,
        priority INTEGER NOT NULL DEFAULT 0,
        repeat TEXT NOT NULL DEFAULT 'none',
        reminders TEXT NOT NULL DEFAULT '[0]',
        completed_at INTEGER,
        snoozed_until INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
    version = 1;
  }
  if (version === 1) {
    // v1 had Obsidian note review; v2 replaces it with weekly course goals.
    await db.execAsync(`
      DROP TABLE IF EXISTS revision_items;
      DROP TABLE IF EXISTS review_log;
      DELETE FROM settings WHERE key IN ('revisionTag', 'vaultName');
      CREATE TABLE courses (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        weekly_target INTEGER NOT NULL DEFAULT 2,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE study_sessions (
        id INTEGER PRIMARY KEY NOT NULL,
        course_id INTEGER NOT NULL,
        minutes INTEGER NOT NULL,
        at INTEGER NOT NULL
      );
      CREATE INDEX study_sessions_at ON study_sessions (at);
    `);
    version = 2;
  }
  if (version === 2) {
    // Every completion (repeats included) and every overdue task deleted, for the plant streak.
    await db.execAsync(`
      CREATE TABLE task_log (
        id INTEGER PRIMARY KEY NOT NULL,
        task_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        due_at INTEGER,
        done_at INTEGER,
        kind TEXT NOT NULL
      );
      CREATE INDEX task_log_due ON task_log (due_at);
    `);
    version = 3;
  }
  if (version === 3) {
    await db.execAsync(`
      CREATE TABLE runs (
        id INTEGER PRIMARY KEY NOT NULL,
        distance_m INTEGER NOT NULL,
        duration_s INTEGER NOT NULL,
        at INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      );
      CREATE INDEX runs_at ON runs (at);
    `);
    version = 4;
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

type TaskRow = {
  id: number;
  title: string;
  notes: string;
  due_at: number | null;
  priority: number;
  repeat: string;
  reminders: string;
  completed_at: number | null;
  snoozed_until: number | null;
  created_at: number;
};

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  notes: r.notes,
  dueAt: r.due_at,
  priority: r.priority as Task['priority'],
  repeat: r.repeat as Task['repeat'],
  reminders: JSON.parse(r.reminders),
  completedAt: r.completed_at,
  snoozedUntil: r.snoozed_until,
  createdAt: r.created_at,
});

export async function getTasks(db: SQLiteDatabase): Promise<Task[]> {
  const rows = await db.getAllAsync<TaskRow>('SELECT * FROM tasks');
  return rows.map(toTask);
}

export async function insertTask(db: SQLiteDatabase, t: TaskInput): Promise<number> {
  const r = await db.runAsync(
    'INSERT INTO tasks (title, notes, due_at, priority, repeat, reminders, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    t.title, t.notes, t.dueAt, t.priority, t.repeat, JSON.stringify(t.reminders), Date.now(),
  );
  return r.lastInsertRowId;
}

export async function updateTask(db: SQLiteDatabase, id: number, t: TaskInput) {
  await db.runAsync(
    'UPDATE tasks SET title = ?, notes = ?, due_at = ?, priority = ?, repeat = ?, reminders = ?, snoozed_until = NULL WHERE id = ?',
    t.title, t.notes, t.dueAt, t.priority, t.repeat, JSON.stringify(t.reminders), id,
  );
}

export async function setTaskFields(
  db: SQLiteDatabase,
  id: number,
  f: { dueAt?: number | null; completedAt?: number | null; snoozedUntil?: number | null },
) {
  const columns = { dueAt: 'due_at', completedAt: 'completed_at', snoozedUntil: 'snoozed_until' } as const;
  const entries = (Object.keys(columns) as (keyof typeof columns)[]).filter((k) => f[k] !== undefined);
  if (!entries.length) return;
  await db.runAsync(
    `UPDATE tasks SET ${entries.map((k) => `${columns[k]} = ?`).join(', ')} WHERE id = ?`,
    ...entries.map((k) => f[k] as number | null),
    id,
  );
}

export async function deleteTask(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

type CourseRow = { id: number; name: string; color: string; weekly_target: number; created_at: number };

export async function getCourses(db: SQLiteDatabase): Promise<Course[]> {
  const rows = await db.getAllAsync<CourseRow>('SELECT * FROM courses ORDER BY created_at');
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, weeklyTarget: r.weekly_target, createdAt: r.created_at }));
}

export async function insertCourse(db: SQLiteDatabase, c: CourseInput) {
  await db.runAsync(
    'INSERT INTO courses (name, color, weekly_target, created_at) VALUES (?, ?, ?, ?)',
    c.name, c.color, c.weeklyTarget, Date.now(),
  );
}

export async function updateCourse(db: SQLiteDatabase, id: number, c: CourseInput) {
  await db.runAsync('UPDATE courses SET name = ?, color = ?, weekly_target = ? WHERE id = ?', c.name, c.color, c.weeklyTarget, id);
}

export async function deleteCourse(db: SQLiteDatabase, id: number) {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM study_sessions WHERE course_id = ?', id);
    await db.runAsync('DELETE FROM courses WHERE id = ?', id);
  });
}

type SessionRow = { id: number; course_id: number; minutes: number; at: number };

export async function getSessions(db: SQLiteDatabase, since: number): Promise<StudySession[]> {
  const rows = await db.getAllAsync<SessionRow>('SELECT * FROM study_sessions WHERE at >= ? ORDER BY at DESC', since);
  return rows.map((r) => ({ id: r.id, courseId: r.course_id, minutes: r.minutes, at: r.at }));
}

export async function insertSession(db: SQLiteDatabase, courseId: number, minutes: number, at: number) {
  await db.runAsync('INSERT INTO study_sessions (course_id, minutes, at) VALUES (?, ?, ?)', courseId, minutes, at);
}

export async function deleteSession(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM study_sessions WHERE id = ?', id);
}

type RunRow = { id: number; distance_m: number; duration_s: number; at: number; note: string };

export async function getRuns(db: SQLiteDatabase): Promise<Run[]> {
  const rows = await db.getAllAsync<RunRow>('SELECT * FROM runs ORDER BY at DESC');
  return rows.map((r) => ({ id: r.id, distanceM: r.distance_m, durationS: r.duration_s, at: r.at, note: r.note }));
}

export async function insertRun(db: SQLiteDatabase, r: RunInput) {
  await db.runAsync('INSERT INTO runs (distance_m, duration_s, at, note) VALUES (?, ?, ?, ?)', r.distanceM, r.durationS, r.at, r.note);
}

export async function updateRun(db: SQLiteDatabase, id: number, r: RunInput) {
  await db.runAsync(
    'UPDATE runs SET distance_m = ?, duration_s = ?, at = ?, note = ? WHERE id = ?',
    r.distanceM, r.durationS, r.at, r.note, id,
  );
}

export async function deleteRun(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM runs WHERE id = ?', id);
}

type LogRow = { id: number; task_id: number; title: string; due_at: number | null; done_at: number | null; kind: string };

export async function getTaskLog(db: SQLiteDatabase): Promise<TaskLogEntry[]> {
  const rows = await db.getAllAsync<LogRow>('SELECT * FROM task_log');
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    title: r.title,
    dueAt: r.due_at,
    doneAt: r.done_at,
    kind: r.kind as TaskLogEntry['kind'],
  }));
}

export async function insertTaskLog(db: SQLiteDatabase, e: Omit<TaskLogEntry, 'id'>) {
  await db.runAsync(
    'INSERT INTO task_log (task_id, title, due_at, done_at, kind) VALUES (?, ?, ?, ?, ?)',
    e.taskId, e.title, e.dueAt, e.doneAt, e.kind,
  );
}

/** Undo the latest completion of a task (when it's un-ticked). */
export async function deleteLatestCompletion(db: SQLiteDatabase, taskId: number) {
  await db.runAsync(
    "DELETE FROM task_log WHERE id = (SELECT MAX(id) FROM task_log WHERE task_id = ? AND kind = 'done')",
    taskId,
  );
}

export async function getSettings(db: SQLiteDatabase): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored = Object.fromEntries(rows.filter((r) => r.key in DEFAULT_SETTINGS).map((r) => [r.key, JSON.parse(r.value)]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(db: SQLiteDatabase, patch: Partial<Settings>) {
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(patch)) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
    }
  });
}
