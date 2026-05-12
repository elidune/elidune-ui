import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { useBackgroundTask, restoreTaskId } from '@/hooks/common/useBackgroundTask';
import type {
  CatalogZ3950RefreshResult,
  MaintenanceAction,
  MaintenanceActionReport,
  MaintenanceRequestAction,
  MaintenanceResponse,
  ReindexSearchResponse,
  BackgroundTask,
} from '@/types';

const MAINTENANCE_TASK_KEY = 'elidune.maintenanceTask';

/** Server accepts up to 512 MiB for POST /maintenance/database/restore. */
export const MAX_RESTORE_SQL_BYTES = 512 * 1024 * 1024;

export function formatMaintenanceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function getMaintenanceReportKey(action: MaintenanceActionReport['action']): string {
  if (typeof action === 'string') return action;
  if (action && typeof action === 'object' && 'action' in action) {
    const a = action as { action: string; z3950ServerId?: number };
    if (a.action === 'z3950Refresh' && a.z3950ServerId != null) {
      return `z3950Refresh:${a.z3950ServerId}`;
    }
    return a.action;
  }
  return String(action);
}

export function isZ3950RefreshDetails(
  d: MaintenanceActionReport['details'],
): d is CatalogZ3950RefreshResult {
  return (
    typeof d === 'object' &&
    d !== null &&
    'updated' in d &&
    'notFound' in d &&
    'failed' in d &&
    'total' in d
  );
}

const MAINTENANCE_ACTIONS: MaintenanceAction[] = [
  'cleanupDanglingBiblioSeries',
  'cleanupDanglingBiblioCollections',
  'cleanupSeries',
  'cleanupCollections',
  'mergeDuplicateSeries',
  'mergeDuplicateCollections',
  'cleanupOrphanAuthors',
  'cleanupUsers',
];

export function useEliduneMaintenance() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reindexResult, setReindexResult] = useState<ReindexSearchResponse | null>(null);
  const [actionReports, setActionReports] = useState<Record<string, MaintenanceActionReport>>({});
  const [recoveredTask, setRecoveredTask] = useState<BackgroundTask | null>(null);
  const [z3950ServerId, setZ3950ServerId] = useState('');
  const [z3950RebuildAll, setZ3950RebuildAll] = useState(false);
  const [dumpLoading, setDumpLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const { data: z3950Servers = [] } = useQuery({
    queryKey: ['z3950-servers'],
    queryFn: () => api.getZ3950Servers(),
  });

  const activeZ3950Servers = useMemo(
    () => z3950Servers.filter((s) => s.isActive),
    [z3950Servers],
  );

  const maintenanceTask = useBackgroundTask('maintenance', {
    storageKey: MAINTENANCE_TASK_KEY,
    onProgress: (task) => {
      setRecoveredTask((prev) => (prev && prev.id === task.id ? task : prev));
    },
    onSettled: (task) => {
      setRecoveredTask((prev) => (prev && prev.id === task.id ? task : prev));
      if (task.status === 'completed' && task.result) {
        const report = task.result as MaintenanceResponse;
        setActionReports((prev) => {
          const next = { ...prev };
          for (const r of report.reports) {
            next[getMaintenanceReportKey(r.action)] = r;
          }
          return next;
        });
      } else if (task.status === 'failed') {
        setError(task.error ?? t('settings.maintenance.actionRunError'));
      }
    },
  });

  useEffect(() => {
    void restoreTaskId(MAINTENANCE_TASK_KEY).then((task) => {
      if (!task) return;
      setRecoveredTask(task);
      if (task.status === 'pending' || task.status === 'running') {
        maintenanceTask.resumeTask(task.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeZ3950Servers.length === 0) return;
    setZ3950ServerId((prev) => {
      if (prev && activeZ3950Servers.some((s) => s.id === prev)) return prev;
      return activeZ3950Servers[0].id;
    });
  }, [activeZ3950Servers]);

  const runDumpDownload = async () => {
    setDatabaseError(null);
    setRestoreSuccess(false);
    setDumpLoading(true);
    try {
      const { blob, filename } = await api.getMaintenanceDatabaseDump();
      triggerBlobDownload(blob, filename);
    } catch (e: unknown) {
      setDatabaseError(getApiErrorMessage(e, t) || t('settings.maintenance.database.exportError'));
    } finally {
      setDumpLoading(false);
    }
  };

  const runRestore = async () => {
    if (!restoreFile) return;
    if (restoreFile.size > MAX_RESTORE_SQL_BYTES) {
      setDatabaseError(t('settings.maintenance.database.restoreFileTooLarge'));
      return;
    }
    const confirmed = window.confirm(t('settings.maintenance.database.restoreConfirm'));
    if (!confirmed) return;

    setDatabaseError(null);
    setRestoreSuccess(false);
    setRestoreLoading(true);
    try {
      await api.postMaintenanceDatabaseRestore(restoreFile);
      setRestoreSuccess(true);
    } catch (e: unknown) {
      setDatabaseError(getApiErrorMessage(e, t) || t('settings.maintenance.database.restoreError'));
    } finally {
      setRestoreLoading(false);
    }
  };

  const clearDatabaseFeedback = () => {
    setDatabaseError(null);
    setRestoreSuccess(false);
  };

  const runReindex = async () => {
    setError(null);
    setReindexResult(null);
    setLoading(true);
    try {
      const data = await api.postAdminReindexSearch();
      setReindexResult(data);
      setTimeout(() => setReindexResult(null), 8000);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.maintenance.reindexError'));
    } finally {
      setLoading(false);
    }
  };

  const runMaintenanceActions = async (actions: MaintenanceRequestAction[]) => {
    setError(null);
    try {
      const { taskId } = await api.postMaintenance(actions);
      maintenanceTask.startTask(taskId);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.maintenance.actionRunError'));
    }
  };

  const runZ3950Refresh = async () => {
    const sid = z3950ServerId.trim();
    const num = Number(sid);
    if (!sid || Number.isNaN(num) || num <= 0) {
      setError(t('settings.maintenance.z3950SelectServer'));
      return;
    }
    setError(null);
    const payload: MaintenanceRequestAction = {
      action: 'z3950Refresh',
      z3950ServerId: num,
      rebuildAll: z3950RebuildAll,
    };
    await runMaintenanceActions([payload]);
  };

  const isTaskRunning = maintenanceTask.isPolling;

  const formatDetails = (details: MaintenanceActionReport['details']) => {
    if (isZ3950RefreshDetails(details)) {
      return t('settings.maintenance.z3950ResultSummary', {
        total: details.total,
        updated: details.updated,
        notFound: details.notFound,
        failed: details.failed,
      });
    }
    const rec = details as Record<string, number>;
    return Object.entries(rec)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
  };

  const z3950NumericId = z3950ServerId.trim() !== '' ? Number(z3950ServerId) : Number.NaN;
  const z3950ReportKey =
    Number.isFinite(z3950NumericId) && z3950NumericId > 0
      ? `z3950Refresh:${z3950NumericId}`
      : '';
  const z3950Report = z3950ReportKey ? actionReports[z3950ReportKey] : undefined;

  return {
    loading,
    error,
    setError,
    reindexResult,
    actionReports,
    recoveredTask,
    setRecoveredTask,
    z3950ServerId,
    setZ3950ServerId,
    z3950RebuildAll,
    setZ3950RebuildAll,
    dumpLoading,
    restoreLoading,
    restoreFile,
    setRestoreFile,
    databaseError,
    setDatabaseError,
    restoreSuccess,
    activeZ3950Servers,
    maintenanceActions: MAINTENANCE_ACTIONS,
    isTaskRunning,
    formatDetails,
    z3950Report,
    runDumpDownload,
    runRestore,
    runReindex,
    runMaintenanceActions,
    runZ3950Refresh,
    clearDatabaseFeedback,
  };
}
