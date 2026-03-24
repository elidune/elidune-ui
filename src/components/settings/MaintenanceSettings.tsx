import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { Card, CardHeader, Button } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { MaintenanceAction, MaintenanceActionReport, ReindexSearchResponse } from '@/types';

export default function MaintenanceSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [runningAction, setRunningAction] = useState<MaintenanceAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReindexSearchResponse | null>(null);
  const [actionReports, setActionReports] = useState<Record<string, MaintenanceActionReport>>({});

  const maintenanceActions = useMemo(
    () =>
      [
        'cleanup_dangling_biblio_series',
        'cleanup_dangling_biblio_collections',
        'cleanup_series',
        'cleanup_collections',
        'merge_duplicate_series',
        'merge_duplicate_collections',
        'cleanup_orphan_authors',
      ] as MaintenanceAction[],
    []
  );

  const runReindex = async () => {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await api.postAdminReindexSearch();
      setResult(data);
      setTimeout(() => setResult(null), 8000);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.maintenance.reindexError'));
    } finally {
      setLoading(false);
    }
  };

  const runMaintenanceActions = async (actions: MaintenanceAction[]) => {
    setError(null);
    try {
      const data = await api.postMaintenance(actions);
      setActionReports((prev) => {
        const next = { ...prev };
        for (const report of data.reports) {
          next[report.action] = report;
        }
        return next;
      });
    } catch (e: unknown) {
      const message = getApiErrorMessage(e, t) || t('settings.maintenance.actionRunError');
      setError(message);
    }
  };

  const runSingleAction = async (action: MaintenanceAction) => {
    setRunningAction(action);
    await runMaintenanceActions([action]);
    setRunningAction(null);
  };

  const runAllActions = async () => {
    setMaintenanceLoading(true);
    await runMaintenanceActions(maintenanceActions);
    setMaintenanceLoading(false);
  };

  const formatDetails = (details: Record<string, number>) =>
    Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');

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
      {result && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-300">
          <Check className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{t('settings.maintenance.reindexSuccess', { count: result.items_queued })}</p>
            <p className="text-xs opacity-90">
              {result.meilisearch_available
                ? t('settings.maintenance.meilisearchOn')
                : t('settings.maintenance.meilisearchOff')}
            </p>
          </div>
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
              leftIcon={<RefreshCw className="h-4 w-4" />}
              isLoading={maintenanceLoading}
              onClick={() => void runAllActions()}
            >
              {maintenanceLoading
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
                      variant="ghost"
                      isLoading={runningAction === action}
                      onClick={() => void runSingleAction(action)}
                      disabled={maintenanceLoading}
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
