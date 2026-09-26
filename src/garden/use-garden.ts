import { useMemo } from 'react';

import { useData } from '@/data/DataProvider';
import { useNow } from '@/hooks/use-now';

import { evaluateGarden } from './plant';

export function useGarden() {
  const { taskLog, tasks, sessions, courses, settings } = useData();
  const now = useNow();
  return useMemo(
    () => evaluateGarden({ log: taskLog, tasks, sessions, courses, startedAt: settings.plantStartedAt, now }),
    [taskLog, tasks, sessions, courses, settings.plantStartedAt, now],
  );
}
