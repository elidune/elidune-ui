import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { healthNeedsFirstSetup, healthIsDegraded } from '@/types';
import { Button } from '@/components/common';

/**
 * Health-based routing: degraded → /maintenance, need_first_setup → /first-setup.
 * Must wrap routes inside BrowserRouter.
 */
export function FirstSetupGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || data == null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950 p-6">
        <p className="text-center text-gray-700 dark:text-gray-300 max-w-md">
          {t('firstSetup.healthError')}
        </p>
        <Button type="button" onClick={() => void refetch()} disabled={isFetching}>
          {t('firstSetup.retryHealth')}
        </Button>
      </div>
    );
  }

  if (healthIsDegraded(data)) {
    if (location.pathname !== '/maintenance') {
      return <Navigate to="/maintenance" replace />;
    }
    return <>{children}</>;
  }

  if (location.pathname === '/maintenance') {
    return <Navigate to="/login" replace />;
  }

  const need = healthNeedsFirstSetup(data);

  if (need) {
    if (location.pathname !== '/first-setup') {
      return <Navigate to="/first-setup" replace />;
    }
    return <>{children}</>;
  }

  if (location.pathname === '/first-setup') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
