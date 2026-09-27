import { useMemo } from 'react';

import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';
import { runGoalFrom } from '@/running/stats';

import { evaluateGarden } from './plant';

export function useGarden() {
  const { taskLog, tasks, sessions, courses, runs, settings } = useData();
  const now = useNow();
  return useMemo(
    () =>
      evaluateGarden({
        log: taskLog,
        tasks,
        sessions,
        courses,
        runs,
        runGoal: runGoalFrom(settings),
        startedAt: settings.plantStartedAt,
        now,
      }),
    [taskLog, tasks, sessions, courses, runs, settings, now],
  );
}
