import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  X,
} from 'lucide-react';
import { Card, CardHeader, Button, Input } from '@/components/common';
import { Pagination } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { AuditLogEntry } from '@/types';

type OutcomeFilter = '' | 'success' | 'failure';

type AppliedAuditFilters = {
  eventType: string;
  entityType: string;
  entityId: string;
  userId: string;
  fromDate: string;
  toDate: string;
  outcome: OutcomeFilter;
  errorCode: string;
};

const EMPTY_FILTERS: AppliedAuditFilters = {
  eventType: '',
  entityType: '',
  entityId: '',
  userId: '',
  fromDate: '',
  toDate: '',
  outcome: '',
  errorCode: '',
};

/** Typical server event strings (`domain.action`); extend as backend grows */
const AUDIT_EVENT_PRESETS: { domainKey: string; types: string[] }[] = [
  {
    domainKey: 'settings.audit.presetDomainAuth',
    types: [
      'auth.login',
      'auth.login_failed',
      'auth.logout',
      'auth.password_changed',
      'auth.password_reset',
    ],
  },
  {
    domainKey: 'settings.audit.presetDomainLoans',
    types: [
      'loan.created',
      'loan.returned',
      'loan.extended',
      'loan.renewed',
      'loan.closed',
    ],
  },
  {
    domainKey: 'settings.audit.presetDomainCatalog',
    types: [
      'biblio.created',
      'biblio.updated',
      'biblio.deleted',
      'import.marc_batch',
      'specimen.created',
      'specimen.updated',
    ],
  },
  {
    domainKey: 'settings.audit.presetDomainMaintenance',
    types: ['maintenance.run', 'system.reminders_batch_completed'],
  },
];

function cloneFilters(f: AppliedAuditFilters): AppliedAuditFilters {
  return { ...f };
}

function auditRowOutcome(row: AuditLogEntry): 'success' | 'failure' {
  return row.outcome === 'failure' ? 'failure' : 'success';
}

function toIsoEndOfDay(localDatetime: string): string {
  const d = new Date(localDatetime);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function optionalPositiveInt(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return undefined;
  return n;
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

  const applyQuick = useCallback((patch: Partial<AppliedAuditFilters>) => {
    setApplied((a) => ({ ...a, ...patch }));
    setDraft((d) => ({ ...d, ...patch }));
    setPage(1);
  }, []);

  const listParamsBase = useMemo(() => {
    const params: Parameters<typeof api.getAuditLog>[0] = {};
    if (applied.eventType.trim()) params.eventType = applied.eventType.trim();
    if (applied.entityType.trim()) params.entityType = applied.entityType.trim();
    const eid = optionalPositiveInt(applied.entityId);
    if (eid !== undefined) params.entityId = eid;
    const uid = optionalPositiveInt(applied.userId);
    if (uid !== undefined) params.userId = uid;
    if (applied.fromDate) params.fromDate = new Date(applied.fromDate).toISOString();
    if (applied.toDate) params.toDate = toIsoEndOfDay(applied.toDate);
    if (applied.outcome === 'success' || applied.outcome === 'failure') {
      params.outcome = applied.outcome;
    }
    if (applied.errorCode.trim()) params.errorCode = applied.errorCode.trim();
    return params;
  }, [applied]);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLog({
        ...listParamsBase,
        page,
        perPage,
      });
      setEntries(data.entries);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.audit.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, page, perPage, listParamsBase]);

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
        ...listParamsBase,
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

  const setDateRangeLastHoursApplied = useCallback(
    (hours: number) => {
      const to = new Date();
      const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
      const toLocal = (d: Date) => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      applyQuick({
        fromDate: toLocal(from),
        toDate: toLocal(to),
      });
    },
    [applyQuick],
  );

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const failuresChipActive = applied.outcome === 'failure';

  return (
    <Card className="rounded-2xl border-gray-200/80 dark:border-gray-800/80 shadow-sm overflow-hidden">
      <CardHeader title={t('settings.audit.title')} subtitle={t('settings.audit.subtitle')} />
      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/80 dark:border-red-800/80 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button type="button" onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/80 dark:border-green-800/80 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      <div className="px-4 pb-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t('settings.audit.quickFilters')}
          </span>
          <button
            type="button"
            onClick={() => applyQuick({ outcome: failuresChipActive ? '' : 'failure' })}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              failuresChipActive
                ? 'bg-red-100 dark:bg-red-950/50 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300'
                : 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t('settings.audit.quickFailuresOnly')}
          </button>
          <button
            type="button"
            onClick={() => setDateRangeLastHoursApplied(24)}
            className="rounded-full px-3 py-1 text-xs font-medium border border-transparent bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {t('settings.audit.quickLast24h')}
          </button>
          <button
            type="button"
            onClick={() => setDateRangeLastHoursApplied(24 * 7)}
            className="rounded-full px-3 py-1 text-xs font-medium border border-transparent bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            {t('settings.audit.quickLast7d')}
          </button>
          <button
            type="button"
            onClick={() => applyQuick({ outcome: applied.outcome === 'success' ? '' : 'success' })}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              applied.outcome === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {t('settings.audit.quickSuccessOnly')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('settings.audit.eventType')}
            </label>
            <input
              list="audit-event-presets"
              value={draft.eventType}
              onChange={(e) => setDraft((d) => ({ ...d, eventType: e.target.value }))}
              placeholder="user.created"
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <datalist id="audit-event-presets">
              {AUDIT_EVENT_PRESETS.flatMap((g) => g.types.map((type) => <option key={type} value={type} />))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1 xl:col-span-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('settings.audit.commonEvents')}
            </label>
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (v) setDraft((d) => ({ ...d, eventType: v }));
                e.target.value = '';
              }}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">{t('settings.audit.commonEventsPlaceholder')}</option>
              {AUDIT_EVENT_PRESETS.map((g) => (
                <optgroup key={g.domainKey} label={t(g.domainKey)}>
                  {g.types.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
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
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {t('settings.audit.outcome')}
            </label>
            <select
              value={draft.outcome}
              onChange={(e) =>
                setDraft((d) => ({ ...d, outcome: e.target.value as OutcomeFilter }))
              }
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="">{t('settings.audit.outcomeAny')}</option>
              <option value="success">{t('settings.audit.outcomeSuccess')}</option>
              <option value="failure">{t('settings.audit.outcomeFailure')}</option>
            </select>
          </div>
          <Input
            label={t('settings.audit.errorCode')}
            value={draft.errorCode}
            onChange={(e) => setDraft((d) => ({ ...d, errorCode: e.target.value }))}
            placeholder="validation_error"
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(cloneFilters(EMPTY_FILTERS));
              setApplied(cloneFilters(EMPTY_FILTERS));
              setPage(1);
            }}
          >
            {t('common.reset')}
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => void exportAudit('json')}
          >
            {t('settings.audit.exportJson')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Download className="h-4 w-4" />}
            onClick={() => void exportAudit('csv')}
          >
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
              {[25, 50, 100, 200, 500].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-700/80">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">ID</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.outcome')}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.eventType')}
                </th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300">
                  {t('settings.audit.errorSummary')}
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
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500">
                    {t('common.noResults')}
                  </td>
                </tr>
              ) : (
                entries.map((row) => {
                  const isOpen = expandedId === row.id;
                  const oc = auditRowOutcome(row);
                  const isFailure = oc === 'failure';
                  return (
                    <Fragment key={row.id}>
                      <tr
                        onClick={() => setExpandedId(isOpen ? null : row.id)}
                        title={t('settings.audit.clickForDetails')}
                        className={`cursor-pointer align-top border-b border-gray-100 dark:border-gray-800 transition-colors ${
                          isOpen
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/30'
                            : isFailure
                              ? 'bg-red-50/50 dark:bg-red-950/15'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              isFailure
                                ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'
                                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                            }`}
                          >
                            {isFailure ? t('settings.audit.outcomeFailure') : t('settings.audit.outcomeSuccess')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs break-all">{row.eventType}</td>
                        <td className="px-3 py-2 font-mono text-xs break-all">
                          {isFailure ? (
                            <span className="text-red-800 dark:text-red-300">
                              {row.errorCode ?? t('settings.audit.errorUnknown')}
                              {row.httpStatus != null ? ` · HTTP ${row.httpStatus}` : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
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
                          <td colSpan={10} className="px-3 py-3 space-y-3">
                            {isFailure && (
                              <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/90 dark:bg-red-950/25 px-3 py-2.5">
                                <p className="text-xs font-semibold text-red-800 dark:text-red-300 mb-1">
                                  {t('settings.audit.errorDetail')}
                                </p>
                                <p className="text-sm text-red-900 dark:text-red-200">
                                  {row.errorMessage ?? '—'}
                                </p>
                                <p className="text-xs font-mono text-red-800/90 dark:text-red-400 mt-1">
                                  {(row.errorCode ?? '—') +
                                    (row.httpStatus != null ? ` · HTTP ${row.httpStatus}` : '')}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                {t('settings.audit.payload')}
                              </p>
                              <pre className="text-xs overflow-auto max-h-72 whitespace-pre-wrap break-all rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 p-3 text-gray-700 dark:text-gray-300">
                                {JSON.stringify(row.payload ?? {}, null, 2)}
                              </pre>
                            </div>
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
          <span>{t('settings.audit.totalEntries', { total })}</span>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      </div>
    </Card>
  );
}
