import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Button, Card } from '@/components/common';
import api from '@/services/api';

/**
 * Shown when GET /health reports a degraded state (e.g. database unavailable).
 */
export default function MaintenancePage() {
  const { t } = useTranslation();
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    staleTime: 30_000,
    retry: 1,
  });

  const version = data?.version;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
      <Card className="max-w-md w-full shadow-lg border border-amber-200/80 dark:border-amber-900/50">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('maintenance.title')}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {t('maintenance.body')}
            </p>
            {version != null && version !== '' && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                {t('maintenance.version', { version })}
              </p>
            )}
          </div>
          <Button type="button" onClick={() => void refetch()} disabled={isFetching} className="w-full sm:w-auto">
            {isFetching ? t('common.loading') : t('maintenance.retry')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
