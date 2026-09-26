import { useEffect, useState } from 'react';

import { MINUTE } from '@/lib/dates';

/** Current time that re-renders every `interval` ms, so "overdue"/"due" labels flip on their own. */
export function useNow(interval = MINUTE) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}
