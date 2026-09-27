import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { runGoalFrom, runWeek } from '@/running/stats';
import { courseWeek } from '@/study/progress';

export default function AppTabs() {
  const { tasks, courses, sessions, runs, settings } = useData();
  const now = useNow();
  const runBehind = runWeek(runs, runGoalFrom(settings), now).status === 'behind';
  const overdue = tasks.filter((t) => t.completedAt == null && t.dueAt != null && t.dueAt < now).length;
  const behind = courses.filter((c) => courseWeek(c, sessions, now).status === 'behind').length;

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist', selected: 'checklist.checked' }} />
        {overdue > 0 && <NativeTabs.Trigger.Badge>{String(overdue)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="study">
        <NativeTabs.Trigger.Label>Study</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'graduationcap', selected: 'graduationcap.fill' }} />
        {behind > 0 && <NativeTabs.Trigger.Badge>{String(behind)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="run">
        <NativeTabs.Trigger.Label>Run</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.run" />
        {runBehind && <NativeTabs.Trigger.Badge>!</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
