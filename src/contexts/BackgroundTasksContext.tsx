import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import i18n from '@/locales';
import { isLibrarian } from '@/types';
import type { BackgroundTask, TaskStatus } from '@/types';
import {
  formatTaskResultSummary,
  isTaskActive,
  taskKindLabel,
} from '@/utils/backgroundTaskDisplay';

const BASE_MS = 500;
const MAX_MS = 5_000;

export interface TrackTaskOptions {
  /** Skip the "task started" toast (e.g. when resuming after login). */
  silent?: boolean;
}

interface BackgroundTasksContextValue {
  tasks: BackgroundTask[];
  activeTasks: BackgroundTask[];
  activeCount: number;
  unreadCount: number;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  getTask: (taskId: string) => BackgroundTask | undefined;
  trackTask: (taskId: string, options?: TrackTaskOptions) => void;
  refreshTasks: () => Promise<void>;
}

const BackgroundTasksContext = createContext<BackgroundTasksContextValue | null>(null);

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function BackgroundTasksNotifier({
  tasksById,
  onUnread,
}: {
  tasksById: Record<string, BackgroundTask>;
  onUnread: () => void;
}) {
  const { showToast } = useToast();
  const prevStatusRef = useRef<Map<string, TaskStatus>>(new Map());
  const toastedTerminalRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = i18n.t.bind(i18n);

    for (const task of Object.values(tasksById)) {
      const prev = prevStatusRef.current.get(task.id);
      const status = task.status;

      if (prev === undefined) {
        prevStatusRef.current.set(task.id, status);
        continue;
      }

      if (prev === status) continue;
      prevStatusRef.current.set(task.id, status);

      const wasActive = prev === 'pending' || prev === 'running';
      const isTerminal = status === 'completed' || status === 'failed';

      if (isTerminal && wasActive && !toastedTerminalRef.current.has(task.id)) {
        toastedTerminalRef.current.add(task.id);
        onUnread();

        const label = taskKindLabel(task.kind, t);
        if (status === 'completed') {
          const summary = formatTaskResultSummary(task, t);
          showToast({
            variant: 'success',
            message: summary
              ? t('backgroundTask.toast.completedWithSummary', { label, summary })
              : t('backgroundTask.toast.completed', { label }),
          });
        } else {
          showToast({
            variant: 'error',
            message: t('backgroundTask.toast.failed', {
              label,
              error: task.error?.trim() || t('backgroundTask.status.failed'),
            }),
          });
        }
      }
    }
  }, [tasksById, onUnread, showToast]);

  return null;
}

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const enabled = isAuthenticated && isLibrarian(user?.accountType);

  const [tasksById, setTasksById] = useState<Record<string, BackgroundTask>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const pollingRef = useRef<Map<string, AbortController>>(new Map());
  const startToastedRef = useRef<Set<string>>(new Set());

  const mergeTask = useCallback((task: BackgroundTask) => {
    setTasksById((prev) => ({ ...prev, [task.id]: task }));
  }, []);

  const stopPolling = useCallback((taskId: string) => {
    pollingRef.current.get(taskId)?.abort();
    pollingRef.current.delete(taskId);
  }, []);

  const stopAllPolling = useCallback(() => {
    for (const controller of pollingRef.current.values()) {
      controller.abort();
    }
    pollingRef.current.clear();
  }, []);

  const pollTask = useCallback(
    async (taskId: string, signal: AbortSignal) => {
      let delay = BASE_MS;
      while (!signal.aborted) {
        try {
          const task = await api.getTask(taskId);
          if (signal.aborted) return;
          mergeTask(task);
          if (task.status === 'completed' || task.status === 'failed') {
            stopPolling(taskId);
            return;
          }
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            stopPolling(taskId);
            return;
          }
        }
        await sleep(delay);
        delay = Math.min(delay * 1.5, MAX_MS);
      }
    },
    [mergeTask, stopPolling]
  );

  const maybeToastStarted = useCallback(
    (task: BackgroundTask, silent: boolean) => {
      if (silent || startToastedRef.current.has(task.id)) return;
      if (!isTaskActive(task)) return;
      startToastedRef.current.add(task.id);
      const t = i18n.t.bind(i18n);
      showToast({
        variant: 'info',
        message: t('backgroundTask.toast.started', { label: taskKindLabel(task.kind, t) }),
      });
    },
    [showToast]
  );

  const trackTask = useCallback(
    (taskId: string, options?: TrackTaskOptions) => {
      if (!enabled || !taskId) return;
      const silent = options?.silent ?? false;

      void (async () => {
        try {
          const task = await api.getTask(taskId);
          mergeTask(task);
          maybeToastStarted(task, silent);
        } catch {
          /* poll loop will fetch */
        }
      })();

      if (pollingRef.current.has(taskId)) return;

      const controller = new AbortController();
      pollingRef.current.set(taskId, controller);
      void pollTask(taskId, controller.signal);
    },
    [enabled, mergeTask, maybeToastStarted, pollTask]
  );

  const refreshTasks = useCallback(async () => {
    if (!enabled) return;
    try {
      const listed = await api.listTasks();
      let resumed = 0;
      setTasksById((prev) => {
        const next = { ...prev };
        for (const task of listed) {
          next[task.id] = task;
        }
        return next;
      });
      for (const task of listed) {
        if (isTaskActive(task)) {
          resumed += 1;
          trackTask(task.id, { silent: true });
        }
      }
      if (resumed > 0) {
        const t = i18n.t.bind(i18n);
        showToast({
          variant: 'info',
          message: t('backgroundTask.toast.resumed', { count: resumed }),
          duration: 5_000,
        });
      }
    } catch {
      /* ignore */
    }
  }, [enabled, trackTask, showToast]);

  useEffect(() => {
    if (!enabled) {
      stopAllPolling();
      setTasksById({});
      setDrawerOpen(false);
      setUnreadCount(0);
      startToastedRef.current.clear();
      return;
    }
    void refreshTasks();
    return () => {
      stopAllPolling();
    };
  }, [enabled, refreshTasks, stopAllPolling]);

  const markUnread = useCallback(() => {
    setUnreadCount((c) => c + 1);
  }, []);

  const setDrawerOpenAndMarkRead = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (open) setUnreadCount(0);
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => {
      const next = !prev;
      if (next) setUnreadCount(0);
      return next;
    });
  }, []);

  const tasks = useMemo(
    () =>
      Object.values(tasksById).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tasksById]
  );

  const activeTasks = useMemo(() => tasks.filter(isTaskActive), [tasks]);
  const activeCount = activeTasks.length;

  const getTask = useCallback((taskId: string) => tasksById[taskId], [tasksById]);

  const value = useMemo(
    (): BackgroundTasksContextValue => ({
      tasks,
      activeTasks,
      activeCount,
      unreadCount,
      drawerOpen,
      setDrawerOpen: setDrawerOpenAndMarkRead,
      toggleDrawer,
      getTask,
      trackTask,
      refreshTasks,
    }),
    [
      tasks,
      activeTasks,
      activeCount,
      unreadCount,
      drawerOpen,
      setDrawerOpenAndMarkRead,
      toggleDrawer,
      getTask,
      trackTask,
      refreshTasks,
    ]
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <BackgroundTasksContext.Provider value={value}>
      <BackgroundTasksNotifier tasksById={tasksById} onUnread={markUnread} />
      {children}
    </BackgroundTasksContext.Provider>
  );
}

export function useBackgroundTasks(): BackgroundTasksContextValue {
  const ctx = useContext(BackgroundTasksContext);
  if (!ctx) {
    return {
      tasks: [],
      activeTasks: [],
      activeCount: 0,
      unreadCount: 0,
      drawerOpen: false,
      setDrawerOpen: () => {},
      toggleDrawer: () => {},
      getTask: () => undefined,
      trackTask: () => {},
      refreshTasks: async () => {},
    };
  }
  return ctx;
}
