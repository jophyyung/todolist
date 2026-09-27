import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, LayoutAnimation } from 'react-native';

import * as db from '@/db/database';
import { evaluateGarden, type TaskLogEntry } from '@/garden/plant';
import { HOUR, nextOccurrence } from '@/lib/dates';
import {
  DEFAULT_SETTINGS,
  type Course,
  type CourseInput,
  type Settings,
  type StudySession,
  type Task,
  type TaskInput,
} from '@/lib/types';
import { ACTION_DONE, ACTION_LOG_30, ACTION_SNOOZE, applyPlan, configureNotifications, ensurePermission } from '@/notifications/scheduler';
import { buildSnapshot } from '@/widget/snapshot';
import { syncWidget } from '@/widget/sync';

type DataContextValue = {
  tasks: Task[];
  courses: Course[];
  /** All study sessions, newest first (the plant streak needs the full history). */
  sessions: StudySession[];
  taskLog: TaskLogEntry[];
  settings: Settings;
  notificationsAllowed: boolean;
  addTask(input: TaskInput): Promise<void>;
  editTask(id: number, input: TaskInput): Promise<void>;
  toggleComplete(task: Task): Promise<void>;
  snooze(task: Task, minutes: number): Promise<void>;
  removeTask(id: number): Promise<void>;
  addCourse(input: CourseInput): Promise<void>;
  editCourse(id: number, input: CourseInput): Promise<void>;
  removeCourse(id: number): Promise<void>;
  logSession(courseId: number, minutes: number): Promise<void>;
  removeSession(id: number): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  requestNotifications(): Promise<boolean>;
};

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

const animateNext = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

export function DataProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [taskLog, setTaskLog] = useState<TaskLogEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);

  const reload = useCallback(async () => {
    let st = await db.getSettings(sqlite);
    if (!st.plantStartedAt) {
      // Plant the seed on first launch; days before this aren't judged.
      await db.saveSettings(sqlite, { plantStartedAt: Date.now() });
      st = await db.getSettings(sqlite);
    }
    const [t, c, s, log] = await Promise.all([
      db.getTasks(sqlite),
      db.getCourses(sqlite),
      db.getSessions(sqlite, 0),
      db.getTaskLog(sqlite),
    ]);
    setTasks(t);
    setCourses(c);
    setSessions(s);
    setTaskLog(log);
    setSettings(st);
  }, [sqlite]);

  const completeOrRoll = useCallback(
    async (task: Task) => {
      await db.insertTaskLog(sqlite, { taskId: task.id, title: task.title, dueAt: task.dueAt, doneAt: Date.now(), kind: 'done' });
      if (task.repeat !== 'none' && task.dueAt != null) {
        await db.setTaskFields(sqlite, task.id, { dueAt: nextOccurrence(task.dueAt, task.repeat, Date.now()), snoozedUntil: null });
      } else {
        await db.setTaskFields(sqlite, task.id, { completedAt: Date.now(), snoozedUntil: null });
      }
    },
    [sqlite],
  );

  // Handles buttons pressed on a notification ("Done", "Snooze 1h", "Studied 30 min") and plain taps.
  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      await Notifications.clearLastNotificationResponseAsync();
      const data = response.notification.request.content.data ?? {};
      const action = response.actionIdentifier;
      const tapped = action === Notifications.DEFAULT_ACTION_IDENTIFIER;

      if (typeof data.courseId === 'number') {
        if (action === ACTION_LOG_30) await db.insertSession(sqlite, data.courseId, 30, Date.now());
        else if (tapped) router.push({ pathname: '/log/[courseId]', params: { courseId: String(data.courseId) } });
      } else if (typeof data.taskId === 'number') {
        const task = (await db.getTasks(sqlite)).find((t) => t.id === data.taskId);
        if (!task) return;
        if (action === ACTION_DONE && task.completedAt == null) await completeOrRoll(task);
        else if (action === ACTION_SNOOZE) await db.setTaskFields(sqlite, task.id, { snoozedUntil: Date.now() + HOUR });
        else if (tapped) router.push({ pathname: '/task/[id]', params: { id: String(task.id) } });
      }
      await reload();
    },
    [sqlite, completeOrRoll, reload],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await configureNotifications().catch((e) => console.warn('Notification setup failed', e));
      await reload();
      await handleResponse(await Notifications.getLastNotificationResponseAsync());
      const perm = await Notifications.getPermissionsAsync();
      if (!cancelled) {
        setNotificationsAllowed(perm.granted);
        setReady(true);
      }
    })();
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => {
      cancelled = true;
      sub.remove();
      appState.remove();
    };
  }, [reload, handleResponse]);

  // Keep the lock-screen widget in step with the data (no-op in Expo Go).
  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    const garden = evaluateGarden({ log: taskLog, tasks, sessions, courses, startedAt: settings.plantStartedAt, now });
    syncWidget(buildSnapshot(tasks, courses, sessions, garden, now));
  }, [ready, tasks, courses, sessions, taskLog, settings.plantStartedAt]);

  // Recompute every pending notification whenever the data changes (debounced).
  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready || !notificationsAllowed) return;
    if (planTimer.current) clearTimeout(planTimer.current);
    planTimer.current = setTimeout(() => {
      const now = Date.now();
      const { streak } = evaluateGarden({ log: taskLog, tasks, sessions, courses, startedAt: settings.plantStartedAt, now });
      applyPlan({ tasks, courses, sessions, settings, now, log: taskLog, streak }).catch((e) =>
        console.warn('Failed to schedule notifications', e),
      );
    }, 300);
  }, [ready, notificationsAllowed, tasks, courses, sessions, taskLog, settings]);

  const value = useMemo<DataContextValue>(() => {
    const mutate = async (fn: () => Promise<unknown>, animate = true) => {
      await fn();
      if (animate) animateNext();
      await reload();
    };
    return {
      tasks,
      courses,
      sessions,
      taskLog,
      settings,
      notificationsAllowed,
      addTask: (input) => mutate(() => db.insertTask(sqlite, input)),
      editTask: (id, input) => mutate(() => db.updateTask(sqlite, id, input)),
      toggleComplete: (task) =>
        mutate(async () => {
          if (task.completedAt != null) {
            await db.setTaskFields(sqlite, task.id, { completedAt: null });
            await db.deleteLatestCompletion(sqlite, task.id);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await completeOrRoll(task);
          }
        }),
      snooze: (task, minutes) => mutate(() => db.setTaskFields(sqlite, task.id, { snoozedUntil: Date.now() + minutes * 60_000 })),
      removeTask: (id) =>
        mutate(async () => {
          const task = tasks.find((t) => t.id === id);
          // Deleting an overdue task still counts as missing it.
          if (task && task.completedAt == null && task.dueAt != null && task.dueAt < Date.now()) {
            await db.insertTaskLog(sqlite, { taskId: id, title: task.title, dueAt: task.dueAt, doneAt: null, kind: 'deleted' });
          }
          await db.deleteTask(sqlite, id);
        }),
      addCourse: (input) => mutate(() => db.insertCourse(sqlite, input)),
      editCourse: (id, input) => mutate(() => db.updateCourse(sqlite, id, input)),
      removeCourse: (id) => mutate(() => db.deleteCourse(sqlite, id)),
      logSession: (courseId, minutes) =>
        mutate(async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await db.insertSession(sqlite, courseId, minutes, Date.now());
        }),
      removeSession: (id) => mutate(() => db.deleteSession(sqlite, id)),
      updateSettings: (patch) => mutate(() => db.saveSettings(sqlite, patch), false),
      async requestNotifications() {
        const granted = await ensurePermission();
        setNotificationsAllowed(granted);
        return granted;
      },
    };
  }, [tasks, courses, sessions, taskLog, settings, notificationsAllowed, sqlite, reload, completeOrRoll]);

  // Screens seed local form state from settings, so wait for the first load (the splash covers it).
  return <DataContext.Provider value={value}>{ready ? children : null}</DataContext.Provider>;
}
