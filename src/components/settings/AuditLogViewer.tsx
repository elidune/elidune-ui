import { Fragment, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react';
import { Card, CardHeader, Button, Input } from '@/components/common';
import { Pagination } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { AuditLogEntry } from '@/types';

type AppliedAuditFilters = {
  eventType: string;
  entityType: string;
  entityId: string;
  userId: string;
  fromDate: string;
  toDate: string;
};

const EMPTY_FILTERS: AppliedAuditFilters = {
  eventType: '',
  entityType: '',
  entityId: '',
  userId: '',
  fromDate: '',
  toDate: '',
};

function cloneFilters(f: AppliedAuditFilters): AppliedAuditFilters {
  return { ...f };
}

export default function AuditLogViewer() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [draft, setDraft] = useState<AppliedAuditFilters>(() => cloneFilters(EMPTY_FILTERS));
  const [applied, setApplied] = useState<AppliedAuditFilters>(() => cloneFilters(EMPTY_FILTERS));
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    setExpandedId(null);
  }, [page, perPage, applied]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Parameters<typeof api.getAuditLog>[0] = {
        page,
        perPage,
      };
      if (applied.eventType.trim()) params.eventType = applied.eventType.trim();
      if (applied.entityType.trim()) params.entityType = applied.entityType.trim();
      if (applied.entityId.trim()) params.entityId = applied.entityId.trim();
      if (applied.userId.trim()) params.userId = applied.userId.trim();
      if (applied.fromDate) params.fromDate = new Date(applied.fromDate).toISOString();
      if (applied.toDate) {
        const d = new Date(applied.toDate);
        d.setHours(23, 59, 59, 999);
        params.toDate = d.toISOString();
      }
      const data = await api.getAuditLog(params);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.audit.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, page, perPage, applied]);

  useEffect(() => {
    void fetchEntries();
  }, [fetchEntries]);

  const applyFilters = () => {
    setApplied(cloneFilters(draft));
    setPage(1);
  };

  const exportAudit = async (format: 'json' | 'csv') => {
    setSuccess(null);
    setError(null);
    try {
      const blob = await api.exportAuditLog({
        format,
        ...(applied.eventType.trim() && { eventType: applied.eventType.trim() }),
        ...(applied.fromDate && { fromDate: new Date(applied.fromDate).toISOString() }),
        ...(applied.toDate && {
          toDate: (() => {
            const d = new Date(applied.toDate);
            d.setHours(23, 59, 59, 999);
            return d.toISOString();
          })(),
        }),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? 'audit_log.csv' : 'audit_log.json';
      a.click();
      URL.revokeObjectURL(url);
      setSuccess(t('settings.audit.exportDone'));
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.audit.exportError'));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <Card>
      <CardHeader title={t('settings.audit.title')} subtitle={t('settings.audit.subtitle')} />
      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      <div className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <Input
            label={t('settings.audit.eventType')}
            value={draft.eventType}
            onChange={(e) => setDraft((d) => ({ ...d, eventType: e.target.value }))}
            placeholder="loan.created"
          />
          <Input
            label={t('settings.audit.entityType')}
            value={draft.entityType}
            onChange={(e) => setDraft((d) => ({ ...d, entityType: e.target.value }))}
            placeholder="loan"
          />
          <Input
            label={t('settings.audit.entityId')}
            value={draft.entityId}
            onChange={(e) => setDraft((d) => ({ ...d, entityId: e.target.value }))}
            placeholder="42"
          />
          <Input
            label={t('settings.audit.actorUserId')}
            value={draft.userId}
            onChange={(e) => setDraft((d) => ({ ...d, userId: e.target.value }))}
            placeholder="3"
          />
          <Input
            label={t('settings.audit.fromDate')}
            type="datetime-local"
            value={draft.fromDate}
            onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value }))}
          />
          <Input
            label={t('settings.audit.toDate')}
            type="datetime-local"
            value={draft.toDate}
            onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" leftIcon={<Search className="h-4 w-4" />} onClick={applyFilters}>
            {t('common.search')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => {
            setDraft(cloneFilters(EMPTY_FILTERS));
            setApplied(cloneFilters(EMPTY_FILTERS));
            setPage(1);
          }}>
            {t('common.reset')}
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => void exportAudit('json')}>
            {t('settings.audit.exportJson')}
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={() => void exportAudit('csv')}>
            {t('settings.audit.exportCsv')}
          </Button>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>{t('common.perPage')}</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">ID</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.eventType')}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.entityType')}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.entityId')}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.actorUserId')}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">IP</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('common.date')}
                </th>
                <th className="w-10 px-2 py-2 text-right" aria-hidden />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    {t('common.noResults')}
                  </td>
                </tr>
              ) : (
                entries.map((row) => {
                  const isOpen = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : row.id)}
                        title={t('settings.audit.clickForDetails')}
                        className={`cursor-pointer align-top border-b border-gray-100 dark:border-gray-800 transition-colors ${
                          isOpen
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{row.eventType}</td>
                        <td className="px-3 py-2">{row.entityType ?? '—'}</td>
                        <td className="px-3 py-2">{row.entityId ?? '—'}</td>
                        <td className="px-3 py-2">{row.userId ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.ipAddress ?? '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-400">
                          <div className="flex justify-end">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
                          <td colSpan={8} className="px-3 py-3">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              {t('settings.audit.payload')}
                            </p>
                            <pre className="text-xs overflow-auto max-h-72 whitespace-pre-wrap break-all rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 text-gray-700 dark:text-gray-300">
                              {JSON.stringify(row.payload ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
          <span>
            {t('settings.audit.totalEntries', { total })}
          </span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </Card>
  );
}
