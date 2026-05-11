import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Bookmark, AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  Button,
  Badge,
  Table,
  Pagination,
  ConfirmDialog,
  ScrollableListRegion,
  ResponsiveRecordList,
  ListSkeleton,
} from '@/components/common';
import HoldMobileCard from '@/components/holds/HoldMobileCard';
import HoldDocumentCell from '@/components/holds/HoldDocumentCell';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { Hold } from '@/types';
import { canPatronSelfServiceHolds } from '@/types';

const PAGE_SIZE_DEFAULT = 20;

function statusBadge(t: (k: string) => string, status: Hold['status']) {
  return (
    <Badge variant={status === 'ready' ? 'success' : 'default'}>{t(`holds.statuses.${status}`)}</Badge>
  );
}

export default function MyHoldsPage() {
  const { t, i18n } = useTranslation();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(PAGE_SIZE_DEFAULT);
  const [activeOnly, setActiveOnly] = useState(true);
  const [cancelHoldId, setCancelHoldId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [activeOnly, perPage]);

  const listQuery = useQuery({
    queryKey: ['my-holds', page, perPage, activeOnly],
    queryFn: () =>
      api.getHolds({
        page,
        perPage: Math.min(200, Math.max(1, perPage)),
        activeOnly,
      }),
    enabled: canPatronSelfServiceHolds(user, api.getToken()),
    staleTime: 30 * 1000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelHold(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-holds'] });
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!canPatronSelfServiceHolds(user, api.getToken())) {
    return <Navigate to="/" replace />;
  }

  const expiresCell = (r: Hold) => {
    const line = r.expiresAt ? new Date(r.expiresAt).toLocaleString(i18n.language) : '—';
    const ready = r.status === 'ready' && r.expiresAt;
    return (
      <div
        className={
          ready
            ? 'rounded-md px-2 py-1.5 -mx-1 bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800'
            : ''
        }
      >
        <span className={ready ? 'font-semibold text-amber-900 dark:text-amber-100' : ''}>{line}</span>
        {ready && (
          <p className="text-xs mt-1 text-amber-800 dark:text-amber-200/90 leading-snug">
            {t('holds.pickupDeadlineHint')}
          </p>
        )}
      </div>
    );
  };

  const cancelCell = (r: Hold) =>
    r.status === 'pending' || r.status === 'ready' ? (
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Ban className="h-4 w-4" />}
        isLoading={cancelMutation.isPending && cancelMutation.variables === r.id}
        onClick={() => setCancelHoldId(r.id)}
      >
        {t('holds.cancelHold')}
      </Button>
    ) : null;

  const columns = [
    {
      key: 'item',
      header: t('holds.columnDocument'),
      render: (r: Hold) => <HoldDocumentCell hold={r} />,
    },
    {
      key: 'status',
      header: t('holds.status'),
      render: (r: Hold) => statusBadge(t, r.status),
    },
    {
      key: 'position',
      header: t('holds.position'),
      render: (r: Hold) => r.position,
    },
    {
      key: 'created',
      header: t('holds.createdAt'),
      render: (r: Hold) => new Date(r.createdAt).toLocaleString(i18n.language),
    },
    {
      key: 'expires',
      header: t('holds.expiresAt'),
      render: expiresCell,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right' as const,
      render: cancelCell,
    },
  ];

  const listData = listQuery.data;
  const totalPages = Math.max(1, listData?.pageCount ?? 1);
  const emptyMessage = activeOnly ? t('holds.noActiveHolds') : t('holds.noHolds');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bookmark className="h-7 w-7 text-amber-600" />
          {t('holds.patronTitle')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('holds.patronSubtitle')}</p>
      </div>

      <Card padding="none" className="flex flex-col min-h-0">
        {listQuery.isError && (
          <div className="m-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0 text-sm text-red-800 dark:text-red-200">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
              <span>{getApiErrorMessage(listQuery.error, t)}</span>
            </div>
            <Button type="button" size="sm" variant="secondary" onClick={() => void listQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 flex-shrink-0">
          <CardHeader
            title={activeOnly ? t('holds.activeHoldsTitle') : t('holds.patronAllSectionTitle')}
            subtitle={listData != null ? t('holds.patronCount', { total: listData.total }) : undefined}
          />
          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">{t('holds.patronFilterLegend')}</legend>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="holds-filter"
                  className="text-indigo-600"
                  checked={activeOnly}
                  onChange={() => setActiveOnly(true)}
                />
                {t('holds.filterOngoing')}
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="radio"
                  name="holds-filter"
                  className="text-indigo-600"
                  checked={!activeOnly}
                  onChange={() => setActiveOnly(false)}
                />
                {t('holds.filterAll')}
              </label>
            </fieldset>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="my-holds-per-page">
                {t('common.perPage')}
              </label>
              <select
                id="my-holds-per-page"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm min-w-[5rem]"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <ScrollableListRegion aria-label={t('holds.patronTitle')}>
          {listQuery.isLoading && !(listData?.items?.length) ? (
            <ListSkeleton rows={8} />
          ) : (
            <ResponsiveRecordList
              desktop={
                <Table
                  columns={columns}
                  data={listData?.items ?? []}
                  keyExtractor={(r) => r.id}
                  isLoading={false}
                  emptyMessage={emptyMessage}
                />
              }
              mobile={
                (listData?.items ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                    {emptyMessage}
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2">
                    {(listData?.items ?? []).map((r) => (
                      <HoldMobileCard
                        key={r.id}
                        hold={r}
                        showUser={false}
                        emphasizePickup
                        statusBadge={(s) => statusBadge(t, s)}
                        onCancel={() => setCancelHoldId(r.id)}
                        cancelPending={cancelMutation.isPending && cancelMutation.variables === r.id}
                      />
                    ))}
                  </div>
                )
              }
            />
          )}
        </ScrollableListRegion>

        {listData != null && listData.total > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={cancelHoldId !== null}
        onClose={() => setCancelHoldId(null)}
        onConfirm={() => {
          const id = cancelHoldId;
          setCancelHoldId(null);
          if (id) void cancelMutation.mutateAsync(id);
        }}
        message={t('holds.cancelConfirm')}
        confirmVariant="danger"
      />
    </div>
  );
}
