import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/services/api';
import type { BackgroundTask, TaskKind } from '@/types';

const BASE_MS = 500;
const MAX_MS = 5_000;

export interface UseBackgroundTaskOptions {
  /** localStorage key to persist/restore the taskId across page reloads */
  storageKey?: string;
  /** Called after each poll while the task is still running */
  onProgress?: (task: BackgroundTask) => void;
  /** Called once when the task reaches completed or failed */
  onSettled?: (task: BackgroundTask) => void;
}

export interface UseBackgroundTaskResult {
  task: BackgroundTask | null;
  isPolling: boolean;
  /** Start polling a newly created task */
  startTask: (taskId: string) => void;
  /** Resume polling a task whose id was recovered from localStorage */
  resumeTask: (taskId: string) => void;
  /** Clear current task state (and remove from localStorage) */
  clearTask: () => void;
}

export function useBackgroundTask(
  kind: TaskKind,
  options: UseBackgroundTaskOptions = {}
): UseBackgroundTaskResult {
  const { storageKey, onProgress, onSettled } = options;

  const [task, setTask] = useState<BackgroundTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsPolling(false);
  }, []);

  const clearTask = useCallback(() => {
    stopPolling();
    setTask(null);
    if (storageKey) localStorage.removeItem(storageKey);
  }, [stopPolling, storageKey]);

  const poll = useCallback(
    async (taskId: string, controller: AbortController) => {
      let delay = BASE_MS;

      while (!controller.signal.aborted) {
        let fetched: BackgroundTask;
        try {
          fetched = await api.getTask(taskId);
        } catch (err: unknown) {
          // 404 means the task was evicted (server restart or >5 min after completion)
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) {
            stopPolling();
            return;
          }
          // Transient error — keep polling
          await sleep(delay);
          delay = Math.min(delay * 1.5, MAX_MS);
          continue;
        }

        if (controller.signal.aborted) break;

        setTask(fetched);

        if (fetched.status === 'completed' || fetched.status === 'failed') {
          stopPolling();
          if (storageKey) localStorage.removeItem(storageKey);
          onSettled?.(fetched);
          return;
        }

        onProgress?.(fetched);

        await sleep(delay);
        delay = Math.min(delay * 1.5, MAX_MS);
      }
    },
    [onProgress, onSettled, stopPolling, storageKey]
  );

  const startPolling = useCallback(
    (taskId: string, initialTask?: BackgroundTask) => {
      stopPolling();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsPolling(true);
      if (initialTask) setTask(initialTask);
      if (storageKey) localStorage.setItem(storageKey, taskId);
      void poll(taskId, controller);
    },
    [poll, stopPolling, storageKey]
  );

  const startTask = useCallback(
    (taskId: string) => {
      const placeholder: BackgroundTask = {
        id: taskId,
        kind,
        status: 'pending',
        createdAt: new Date().toISOString(),
        userId: '',
      };
      startPolling(taskId, placeholder);
    },
    [startPolling, kind]
  );

  const resumeTask = useCallback(
    (taskId: string) => {
      startPolling(taskId);
    },
    [startPolling]
  );

  // On unmount stop polling (but don't clear localStorage — task may still run)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { task, isPolling, startTask, resumeTask, clearTask };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Restore a persisted taskId for a given storage key.
 * Returns the stored taskId or null if none / already completed.
 */
export async function restoreTaskId(storageKey: string): Promise<BackgroundTask | null> {
  const taskId = localStorage.getItem(storageKey);
  if (!taskId) return null;
  try {
    const task = await api.getTask(taskId);
    if (task.status === 'completed' || task.status === 'failed') {
      localStorage.removeItem(storageKey);
      return task;
    }
    return task;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}
