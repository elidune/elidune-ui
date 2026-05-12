import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Database,
  Download,
  Globe,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/common';
import type {
  BackgroundTask,
  MaintenanceAction,
  MaintenanceActionReport,
  ReindexSearchResponse,
} from '@/types';
import {
  formatMaintenanceFileSize,
  isZ3950RefreshDetails,
} from '@/hooks/settings/useEliduneMaintenance';

type MaintenancePanelsProps = {
  error: string | null;
  databaseError: string | null;
  restoreSuccess: boolean;
  reindexResult: ReindexSearchResponse | null;
  recoveredTask: BackgroundTask | null;
  onDismissRecoveredTask: () => void;
};

export function EliduneMaintenanceBanners({
  error,
  databaseError,
  restoreSuccess,
  reindexResult,
  recoveredTask,
  onDismissRecoveredTask,
}: MaintenancePanelsProps) {
  const { t } = useTranslation();

  return (
    <>
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/80 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {databaseError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/80 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {databaseError}
        </div>
      )}

      {restoreSuccess && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/80 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium">{t('settings.maintenance.database.restoreSuccess')}</p>
            <p>{t('settings.maintenance.database.restoreSuccessFollowUp')}</p>
            <p className="text-xs opacity-90">{t('settings.maintenance.database.restoreMeilisearchNote')}</p>
          </div>
        </div>
      )}

      {reindexResult && (
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/80 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
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

      {recoveredTask && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2.5 flex items-start gap-3 ${
            recoveredTask.status === 'completed'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/80 dark:border-emerald-800/80'
              : recoveredTask.status === 'failed'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200/80 dark:border-red-800/80'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/80 dark:border-amber-800/80'
          }`}
        >
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
            {(recoveredTask.status === 'pending' || recoveredTask.status === 'running') &&
              recoveredTask.progress && (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                    <span>{t('backgroundTask.progress')}</span>
                    <span>
                      {recoveredTask.progress.current} / {recoveredTask.progress.total}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          recoveredTask.progress.total > 0
                            ? (recoveredTask.progress.current / recoveredTask.progress.total) * 100
                            : 0
                        }%`,
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
              onClick={onDismissRecoveredTask}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </>
  );
}

const panelShell =
  'rounded-2xl border border-gray-200/90 dark:border-gray-700/90 bg-white/90 dark:bg-gray-900/40 p-4 sm:p-5 space-y-3 shadow-sm';

type CatalogProps = {
  loading: boolean;
  activeZ3950Servers: { id: string; name: string; address: string }[];
  z3950ServerId: string;
  setZ3950ServerId: (v: string) => void;
  z3950RebuildAll: boolean;
  setZ3950RebuildAll: (v: boolean | ((p: boolean) => boolean)) => void;
  isTaskRunning: boolean;
  z3950Report: MaintenanceActionReport | undefined;
  formatDetails: (d: MaintenanceActionReport['details']) => string;
  onReindex: () => void;
  onZ3950Run: () => void;
};

export function EliduneCatalogMaintenancePanel({
  loading,
  activeZ3950Servers,
  z3950ServerId,
  setZ3950ServerId,
  z3950RebuildAll,
  setZ3950RebuildAll,
  isTaskRunning,
  z3950Report,
  formatDetails,
  onReindex,
  onZ3950Run,
}: CatalogProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className={panelShell}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t('settings.maintenance.searchIndexingTitle')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
          {t('settings.maintenance.searchIndexingIntro')}
        </p>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc pl-4">
          <li>{t('settings.maintenance.searchIndexingWhen')}</li>
          <li>{t('settings.maintenance.searchIndexingAsync')}</li>
        </ul>
        <Button
          variant="secondary"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          isLoading={loading}
          onClick={() => void onReindex()}
        >
          {loading ? t('settings.maintenance.reindexing') : t('settings.maintenance.reindexButton')}
        </Button>
      </div>

      <div className={panelShell}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Globe className="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" aria-hidden />
          {t('settings.maintenance.z3950Title')}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
          {t('settings.maintenance.z3950Intro')}
        </p>
        {activeZ3950Servers.length === 0 ? (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/25 border border-amber-200/80 dark:border-amber-800/80 rounded-xl px-3 py-2">
            {t('settings.maintenance.z3950NoActiveServers')}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <select
                id="maint-z3950-server"
                value={z3950ServerId}
                onChange={(e) => setZ3950ServerId(e.target.value)}
                title={t('settings.maintenance.z3950Server')}
                aria-label={t('settings.maintenance.z3950Server')}
                className="min-w-[12rem] max-w-full flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
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
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900 ${
                    z3950RebuildAll ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
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
                leftIcon={
                  isTaskRunning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )
                }
                disabled={isTaskRunning || activeZ3950Servers.length === 0}
                onClick={() => void onZ3950Run()}
              >
                {isTaskRunning ? t('settings.maintenance.runningAllActions') : t('settings.maintenance.z3950Run')}
              </Button>
            </div>
            {z3950Report && (
              <div
                className={`rounded-xl border px-3 py-2 text-xs ${
                  z3950Report.success
                    ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                    : 'border-red-200/80 bg-red-50/80 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
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
      </div>
    </div>
  );
}

type DatabaseProps = {
  dumpLoading: boolean;
  restoreLoading: boolean;
  restoreFile: File | null;
  setRestoreFile: (f: File | null) => void;
  onRestoreFileChange: () => void;
  onDump: () => void;
  onRestore: () => void;
  maintenanceActions: MaintenanceAction[];
  actionReports: Record<string, MaintenanceActionReport>;
  isTaskRunning: boolean;
  formatDetails: (d: MaintenanceActionReport['details']) => string;
  onRunAllActions: () => void;
  onRunAction: (a: MaintenanceAction) => void;
};

export function EliduneDatabaseMaintenancePanel({
  dumpLoading,
  restoreLoading,
  restoreFile,
  setRestoreFile,
  onRestoreFileChange,
  onDump,
  onRestore,
  maintenanceActions,
  actionReports,
  isTaskRunning,
  formatDetails,
  onRunAllActions,
  onRunAction,
}: DatabaseProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className={panelShell}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('settings.maintenance.actionsGroupTitle')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug max-w-prose">
              {t('settings.maintenance.actionsGroupIntro')}
            </p>
          </div>
          <Button
            variant="secondary"
            className="shrink-0"
            leftIcon={
              isTaskRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />
            }
            disabled={isTaskRunning}
            onClick={() => void onRunAllActions()}
          >
            {isTaskRunning ? t('settings.maintenance.runningAllActions') : t('settings.maintenance.runAllActions')}
          </Button>
        </div>
        <div className="space-y-2">
          {maintenanceActions.map((action) => {
            const report = actionReports[action];
            return (
              <div
                key={action}
                className="rounded-xl border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/50 dark:bg-gray-800/30 p-3 sm:p-3.5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t(`settings.maintenance.actions.${action}.label`)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t(`settings.maintenance.actions.${action}.description`)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    leftIcon={<Play className="h-4 w-4" aria-hidden />}
                    isLoading={isTaskRunning}
                    onClick={() => void onRunAction(action)}
                    disabled={isTaskRunning}
                  >
                    {t('settings.maintenance.runAction')}
                  </Button>
                </div>
                {report && (
                  <div
                    className={`mt-2 rounded-lg border px-2.5 py-2 text-xs ${
                      report.success
                        ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
                        : 'border-red-200/80 bg-red-50/80 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
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
      </div>
      <div className="rounded-2xl border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/35 dark:bg-amber-950/20 p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Database className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t('settings.maintenance.database.sectionTitle')}
          </h3>
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200 border border-indigo-200/80 dark:border-indigo-700">
            {t('settings.maintenance.database.adminBadge')}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${panelShell} !shadow-none border-gray-200/80 dark:border-gray-700/80`}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('settings.maintenance.database.exportTitle')}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
              {t('settings.maintenance.database.exportBody')}
            </p>
            <Button
              variant="secondary"
              leftIcon={
                dumpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />
              }
              isLoading={dumpLoading}
              disabled={dumpLoading || restoreLoading}
              onClick={() => void onDump()}
            >
              {dumpLoading ? t('settings.maintenance.database.exportRunning') : t('settings.maintenance.database.exportButton')}
            </Button>
          </div>

          <div
            className={`${panelShell} !shadow-none border-red-200/60 dark:border-red-900/45 bg-red-50/30 dark:bg-red-950/15`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden />
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                {t('settings.maintenance.database.restoreTitle')}
              </h4>
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-200/80 dark:border-red-800">
                {t('settings.maintenance.database.dangerBadge')}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">
              {t('settings.maintenance.database.restoreBody')}
            </p>
            <div className="rounded-xl border border-red-200/70 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/25 px-3 py-2 space-y-1 text-xs text-red-900 dark:text-red-200">
              <p className="font-semibold">{t('settings.maintenance.database.restoreWarningTitle')}</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>{t('settings.maintenance.database.restoreWarningDestructive')}</li>
                <li>{t('settings.maintenance.database.restoreWarningConcurrency')}</li>
                <li>{t('settings.maintenance.database.restoreWarningAfter')}</li>
              </ul>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.maintenance.database.formatHint')}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <label
                className={`inline-flex rounded-xl ${
                  restoreLoading || dumpLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                }`}
              >
                <input
                  type="file"
                  accept=".sql,text/plain,application/sql,.txt"
                  className="sr-only"
                  disabled={restoreLoading || dumpLoading}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setRestoreFile(f);
                    onRestoreFileChange();
                    e.target.value = '';
                  }}
                />
                <span className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700">
                  {t('settings.maintenance.database.restorePickFile')}
                </span>
              </label>
              <span className="text-sm text-gray-600 dark:text-gray-400 min-h-[2.25rem] flex items-center">
                {restoreFile
                  ? t('settings.maintenance.database.restoreSelected', {
                      name: restoreFile.name,
                      size: formatMaintenanceFileSize(restoreFile.size),
                    })
                  : t('settings.maintenance.database.restoreNoFile')}
              </span>
            </div>
            <Button
              variant="danger"
              leftIcon={
                restoreLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />
              }
              isLoading={restoreLoading}
              disabled={!restoreFile || restoreLoading || dumpLoading}
              onClick={() => void onRestore()}
            >
              {restoreLoading ? t('settings.maintenance.database.restoreRunning') : t('settings.maintenance.database.restoreButton')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
