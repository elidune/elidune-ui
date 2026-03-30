import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCircle, Globe, Loader2, Play, RefreshCw, X } from 'lucide-react';
import { Card, CardHeader, Button } from '@/components/common';
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

function getMaintenanceReportKey(action: MaintenanceActionReport['action']): string {
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

function isZ3950RefreshDetails(d: MaintenanceActionReport['details']): d is CatalogZ3950RefreshResult {
  return (
    typeof d === 'object' &&
    d !== null &&
    'updated' in d &&
    'notFound' in d &&
    'failed' in d &&
    'total' in d
  );
}

export default function MaintenanceSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reindexResult, setReindexResult] = useState<ReindexSearchResponse | null>(null);
  const [actionReports, setActionReports] = useState<Record<string, MaintenanceActionReport>>({});
  const [recoveredTask, setRecoveredTask] = useState<BackgroundTask | null>(null);
  const [z3950ServerId, setZ3950ServerId] = useState<string>('');
  const [z3950RebuildAll, setZ3950RebuildAll] = useState(false);

  const { data: z3950Servers = [] } = useQuery({
    queryKey: ['z3950-servers'],
    queryFn: () => api.getZ3950Servers(),
  });

  const activeZ3950Servers = useMemo(
    () => z3950Servers.filter((s) => s.isActive),
    [z3950Servers]
  );

  const maintenanceActions = useMemo(
    () =>
      [
        'cleanupDanglingBiblioSeries',
        'cleanupDanglingBiblioCollections',
        'cleanupSeries',
        'cleanupCollections',
        'mergeDuplicateSeries',
        'mergeDuplicateCollections',
        'cleanupOrphanAuthors',
        'cleanupUsers',
      ] as MaintenanceAction[],
    []
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

  // Restore in-progress task on mount
  useEffect(() => {
    restoreTaskId(MAINTENANCE_TASK_KEY).then((task) => {
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

  const z3950NumericId =
    z3950ServerId.trim() !== '' ? Number(z3950ServerId) : Number.NaN;
  const z3950ReportKey =
    Number.isFinite(z3950NumericId) && z3950NumericId > 0
      ? `z3950Refresh:${z3950NumericId}`
      : '';
  const z3950Report = z3950ReportKey ? actionReports[z3950ReportKey] : undefined;

  return (
    <Card>
      <CardHeader
        title={t('settings.maintenance.title')}
        subtitle={t('settings.maintenance.subtitle')}
      />

      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {reindexResult && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{t('settings.maintenance.reindexSuccess', { count: reindexResult.itemsQueued })}</p>
            <p className="text-xs opacity-90">
              {reindexResult.meilisearchAvailable
                ? t('settings.maintenance.meilisearchOn')
                : t('settings.maintenance.meilisearchOff')}
            </p>
          </div>
        </div>
      )}

      {/* Recovered / active background task banner */}
      {recoveredTask && (
        <div className={`mx-4 mb-3 rounded-lg border px-3 py-2.5 flex items-start gap-3 ${
          recoveredTask.status === 'completed'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : recoveredTask.status === 'failed'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          {recoveredTask.status === 'completed' ? (
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : recoveredTask.status === 'failed' ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          ) : (
            <Loader2 className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 animate-spin" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t(`backgroundTask.status.${recoveredTask.status}`)}
            </p>
            {(recoveredTask.status === 'pending' || recoveredTask.status === 'running') && recoveredTask.progress && (
              <div className="mt-1.5">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>{t('backgroundTask.progress')}</span>
                  <span>{recoveredTask.progress.current} / {recoveredTask.progress.total}</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${recoveredTask.progress.total > 0
                        ? (recoveredTask.progress.current / recoveredTask.progress.total) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {recoveredTask.status === 'failed' && recoveredTask.error && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{recoveredTask.error}</p>
            )}
          </div>
          {(recoveredTask.status === 'completed' || recoveredTask.status === 'failed') && (
            <button
              type="button"
              onClick={() => setRecoveredTask(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="px-4 pb-4 space-y-4">
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('settings.maintenance.searchIndexingTitle')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('settings.maintenance.searchIndexingIntro')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('settings.maintenance.searchIndexingWhen')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('settings.maintenance.searchIndexingAsync')}
          </p>
          <div className="pt-1">
            <Button
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              isLoading={loading}
              onClick={() => void runReindex()}
            >
              {loading ? t('settings.maintenance.reindexing') : t('settings.maintenance.reindexButton')}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
            {t('settings.maintenance.z3950Title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {t('settings.maintenance.z3950Intro')}
          </p>
          {activeZ3950Servers.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              {t('settings.maintenance.z3950NoActiveServers')}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  id="maint-z3950-server"
                  value={z3950ServerId}
                  onChange={(e) => setZ3950ServerId(e.target.value)}
                  title={t('settings.maintenance.z3950Server')}
                  aria-label={t('settings.maintenance.z3950Server')}
                  className="min-w-[10rem] max-w-[min(100%,20rem)] flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                >
                  {activeZ3950Servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.address}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={z3950RebuildAll}
                    aria-label={t('settings.maintenance.z3950RebuildAll')}
                    title={t('settings.maintenance.z3950RebuildAllHint')}
                    onClick={() => setZ3950RebuildAll((v) => !v)}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900 ${
                      z3950RebuildAll ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                        z3950RebuildAll ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {t('settings.maintenance.z3950RebuildAll')}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  leftIcon={isTaskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                  disabled={isTaskRunning || activeZ3950Servers.length === 0}
                  onClick={() => void runZ3950Refresh()}
                >
                  {isTaskRunning ? t('settings.maintenance.runningAllActions') : t('settings.maintenance.z3950Run')}
                </Button>
              </div>
              {z3950Report && (
                <div
                  className={`rounded-md border px-2.5 py-2 text-xs ${
                    z3950Report.success
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  <p className="font-medium">
                    {z3950Report.success
                      ? t('settings.maintenance.actionSuccess')
                      : t('settings.maintenance.actionFailed')}
                  </p>
                  {(isZ3950RefreshDetails(z3950Report.details) ||
                    (typeof z3950Report.details === 'object' &&
                      z3950Report.details !== null &&
                      Object.keys(z3950Report.details).length > 0)) && (
                    <p className="mt-0.5">{formatDetails(z3950Report.details)}</p>
                  )}
                  {z3950Report.error && <p className="mt-0.5">{z3950Report.error}</p>}
                </div>
              )}
            </>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('settings.maintenance.actionsGroupTitle')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('settings.maintenance.actionsGroupIntro')}
              </p>
            </div>
            <Button
              variant="secondary"
              leftIcon={isTaskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              isLoading={false}
              disabled={isTaskRunning}
              onClick={() => void runMaintenanceActions(maintenanceActions)}
            >
              {isTaskRunning
                ? t('settings.maintenance.runningAllActions')
                : t('settings.maintenance.runAllActions')}
            </Button>
          </div>
          <div className="space-y-3">
            {maintenanceActions.map((action) => {
              const report = actionReports[action];
              return (
                <div
                  key={action}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {t(`settings.maintenance.actions.${action}.label`)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t(`settings.maintenance.actions.${action}.description`)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Play className="h-4 w-4" aria-hidden />}
                      isLoading={isTaskRunning}
                      onClick={() => void runMaintenanceActions([action])}
                      disabled={isTaskRunning}
                    >
                      {t('settings.maintenance.runAction')}
                    </Button>
                  </div>
                  {report && (
                    <div
                      className={`mt-2 rounded-md border px-2.5 py-2 text-xs ${
                        report.success
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                          : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                      }`}
                    >
                      <p className="font-medium">
                        {report.success
                          ? t('settings.maintenance.actionSuccess')
                          : t('settings.maintenance.actionFailed')}
                      </p>
                      {Object.keys(report.details).length > 0 && (
                        <p className="mt-0.5">{formatDetails(report.details)}</p>
                      )}
                      {report.error && <p className="mt-0.5">{report.error}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Card>
  );
}
