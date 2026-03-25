import { useEffect } from 'react';
import { useLibrary } from '@/contexts/LibraryContext';
import type { ScheduleSlot } from '@/types';

interface UseLibraryScheduleResult {
  scheduleSlots: ScheduleSlot[];
}

/**
 * Returns the schedule slots for the currently active period.
 * Data is fetched once in LibraryContext on app mount — no extra HTTP calls
 * unless the context was initialised before the user authenticated.
 */
export function useLibrarySchedule(): UseLibraryScheduleResult {
  const { scheduleSlots, refreshSchedule } = useLibrary();

  useEffect(() => {
    if (scheduleSlots.length === 0) {
      refreshSchedule();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { scheduleSlots };
}
