import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '@/services/api';
import type { LibraryInfo, ScheduleSlot } from '@/types';

const STORAGE_KEY = 'elidune_library_name';

interface LibraryContextValue {
  libraryName: string | null;
  libraryInfo: LibraryInfo | null;
  scheduleSlots: ScheduleSlot[];
  refreshSchedule: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue>({
  libraryName: null,
  libraryInfo: null,
  scheduleSlots: [],
  refreshSchedule: async () => {},
});

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [libraryName, setLibraryName] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY)
  );
  const [libraryInfo, setLibraryInfo] = useState<LibraryInfo | null>(null);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);

  // GET /library-info is public — fetch on mount regardless of auth state
  useEffect(() => {
    api.getLibraryInfo()
      .then((info) => {
        setLibraryInfo(info);
        const name = info.name ?? null;
        setLibraryName(name);
        if (name) localStorage.setItem(STORAGE_KEY, name);
        else localStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {});
  }, []);

  const refreshSchedule = useCallback(async () => {
    try {
      const periods = await api.getSchedulePeriods();
      const today = new Date().toISOString().split('T')[0];
      const activePeriod = periods.find(
        (p) => p.startDate <= today && p.endDate >= today
      );
      if (activePeriod) {
        const slots = await api.getScheduleSlots(activePeriod.id);
        setScheduleSlots(slots);
      } else {
        setScheduleSlots([]);
      }
    } catch {
      // silent fail — schedule is non-critical
    }
  }, []);

  // Fetch schedule on mount if already authenticated (returning user)
  useEffect(() => {
    refreshSchedule();
  }, [refreshSchedule]);

  return (
    <LibraryContext.Provider value={{ libraryName, libraryInfo, scheduleSlots, refreshSchedule }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  return useContext(LibraryContext);
}
