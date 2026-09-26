import * as Notifications from 'expo-notifications';

import { planNotifications, STUDY_CATEGORY, TASK_CATEGORY, type PlannedNotification } from './planner';

export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_LOG_30 = 'log30';

export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  return Promise.all([
    Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
      { identifier: ACTION_DONE, buttonTitle: 'Done', options: { opensAppToForeground: false } },
      { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
    ]),
    Notifications.setNotificationCategoryAsync(STUDY_CATEGORY, [
      { identifier: ACTION_LOG_30, buttonTitle: 'Studied 30 min', options: { opensAppToForeground: false } },
    ]),
  ]);
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return result.granted;
}

/** Replaces all pending notifications with a freshly computed plan. */
export async function applyPlan(input: Parameters<typeof planNotifications>[0]) {
  const plan = planNotifications(input);
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Promise.all(plan.map(schedule));
  return plan.length;
}

function schedule(n: PlannedNotification) {
  const category = n.taskId != null ? TASK_CATEGORY : n.courseId != null ? STUDY_CATEGORY : undefined;
  return Notifications.scheduleNotificationAsync({
    identifier: n.key,
    content: {
      title: n.title,
      body: n.body,
      sound: 'default',
      data: n.taskId != null ? { taskId: n.taskId } : n.courseId != null ? { courseId: n.courseId } : {},
      categoryIdentifier: category,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.date },
  });
}
