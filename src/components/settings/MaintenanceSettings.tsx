import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { Card, CardHeader, Button } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { ReindexSearchResponse } from '@/types';

export default function MaintenanceSettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReindexSearchResponse | null>(null);

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
      </div>
    </Card>
  );
}
