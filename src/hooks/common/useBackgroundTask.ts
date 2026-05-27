import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/services/api';
import { useBackgroundTasks } from '@/contexts/BackgroundTasksContext';
import type { BackgroundTask, TaskKind } from '@/types';

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
  _kind: TaskKind,
  options: UseBackgroundTaskOptions = {}
): UseBackgroundTaskResult {
  const { storageKey, onProgress, onSettled } = options;
  const { trackTask, getTask } = useBackgroundTasks();

  const [taskId, setTaskId] = useState<string | null>(null);
  const settledRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onProgressRef.current = onProgress;
    onSettledRef.current = onSettled;
  }, [onProgress, onSettled]);

  const task = taskId ? getTask(taskId) ?? null : null;
  const isPolling = !!task && (task.status === 'pending' || task.status === 'running');

  const clearTask = useCallback(() => {
    settledRef.current = false;
    setTaskId(null);
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  const startTask = useCallback(
    (id: string) => {
      settledRef.current = false;
      setTaskId(id);
      trackTask(id);
      if (storageKey) localStorage.setItem(storageKey, id);
    },
    [trackTask, storageKey]
  );

  const resumeTask = useCallback(
    (id: string) => {
      startTask(id);
    },
    [startTask]
  );

  useEffect(() => {
    if (!taskId) return;
    trackTask(taskId);
  }, [taskId, trackTask]);

  useEffect(() => {
    if (!task) return;

    if (task.status === 'pending' || task.status === 'running') {
      onProgressRef.current?.(task);
      return;
    }

    if ((task.status === 'completed' || task.status === 'failed') && !settledRef.current) {
      settledRef.current = true;
      if (storageKey) localStorage.removeItem(storageKey);
      onSettledRef.current?.(task);
    }
  }, [task, storageKey]);

  return { task, isPolling, startTask, resumeTask, clearTask };
}

/**
 * Restore a persisted taskId for a given storage key.
 * Returns the stored task or null if none / already completed.
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
