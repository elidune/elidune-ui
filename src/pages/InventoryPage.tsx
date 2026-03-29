import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  ClipboardList,
  Scan,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Upload,
  ListOrdered,
  PackageSearch,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, Button, Modal, Input, Badge, ScrollableListRegion } from '@/components/common';
import api from '@/services/api';
import type {
  InventorySession,
  CreateInventorySession,
  InventoryScan,
  InventoryScanResultCode,
} from '@/types';

const SCANS_PER_PAGE = 50;
const MISSING_PER_PAGE = 50;
const SESSIONS_PER_PAGE = 50;
const BATCH_CHUNK = 500;

type SessionStatusFilter = 'all' | 'open' | 'closed';
type SessionSubTab = 'scans' | 'missing';

function sessionStartedAt(s: InventorySession): string {
  return s.startedAt ?? s.createdAt ?? '';
}

function sessionDisplayName(s: InventorySession, t: (k: string) => string): string {
  if (s.name?.trim()) return s.name.trim();
  return `${t('inventory.sessionTitle')} #${s.id.slice(0, 8)}`;
}

function scanResultVariant(
  result: InventoryScanResultCode
): 'success' | 'warning' | 'default' {
  if (result === 'found') return 'success';
  if (result === 'found_archived') return 'warning';
  return 'warning';
}

export default function InventoryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsStatus, setSessionsStatus] = useState<SessionStatusFilter>('all');
  const [subTab, setSubTab] = useState<SessionSubTab>('scans');
  const [scansPage, setScansPage] = useState(1);
  const [missingPage, setMissingPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createLocationFilter, setCreateLocationFilter] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createScopePlace, setCreateScopePlace] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const [barcode, setBarcode] = useState('');
  const [scanFlash, setScanFlash] = useState<InventoryScan | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [batchText, setBatchText] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSummary, setBatchSummary] = useState<string | null>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const sessionsQuery = useQuery({
    queryKey: ['inventory', 'sessions', sessionsPage, SESSIONS_PER_PAGE, sessionsStatus],
    queryFn: () =>
      api.getInventorySessions({
        page: sessionsPage,
        perPage: SESSIONS_PER_PAGE,
        status: sessionsStatus === 'all' ? undefined : sessionsStatus,
      }),
    staleTime: 30_000,
  });

  const sessionQuery = useQuery({
    queryKey: ['inventory', 'session', sessionId],
    queryFn: () => api.getInventorySession(sessionId!),
    enabled: !!sessionId,
    staleTime: 15_000,
  });

  const activeSession = sessionQuery.data ?? null;

  const reportQuery = useQuery({
    queryKey: ['inventory', 'report', sessionId],
    queryFn: () => api.getInventoryReport(sessionId!),
    enabled: !!sessionId,
    staleTime: 10_000,
  });

  const scansQuery = useQuery({
    queryKey: ['inventory', 'scans', sessionId, scansPage, SCANS_PER_PAGE],
    queryFn: () =>
      api.getInventoryScans(sessionId!, { page: scansPage, perPage: SCANS_PER_PAGE }),
    enabled: !!sessionId && subTab === 'scans',
    staleTime: 10_000,
  });

  const missingQuery = useQuery({
    queryKey: ['inventory', 'missing', sessionId, missingPage, MISSING_PER_PAGE],
    queryFn: () =>
      api.getInventoryMissing(sessionId!, { page: missingPage, perPage: MISSING_PER_PAGE }),
    enabled: !!sessionId && subTab === 'missing',
    staleTime: 10_000,
  });

  const invalidateSessionData = useCallback(
    (id: string) => {
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'session', id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'report', id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'scans', id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'missing', id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'sessions'] });
    },
    [queryClient]
  );

  const enterSession = useCallback((id: string) => {
    setScansPage(1);
    setMissingPage(1);
    setSubTab('scans');
    setScanFlash(null);
    setScanError(null);
    setBarcode('');
    setBatchText('');
    setBatchError(null);
    setBatchSummary(null);
    setSessionId(id);
  }, []);

  const createMutation = useMutation({
    mutationFn: (body: CreateInventorySession) => api.createInventorySession(body),
    onSuccess: (created) => {
      setShowCreateModal(false);
      setCreateName('');
      setCreateLocationFilter('');
      setCreateNotes('');
      setCreateScopePlace('');
      setCreateError(null);
      void queryClient.invalidateQueries({ queryKey: ['inventory', 'sessions'] });
      enterSession(created.id);
    },
    onError: () => setCreateError(t('inventory.createError')),
  });

  const scanMutation = useMutation({
    mutationFn: ({ id, bc }: { id: string; bc: string }) => api.scanInventoryItem(id, bc),
    onSuccess: (row, { id }) => {
      setScanFlash(row);
      setScanError(null);
      invalidateSessionData(id);
      setBarcode('');
      setTimeout(() => barcodeRef.current?.focus(), 80);
    },
    onError: () => setScanError(t('inventory.scanError')),
  });

  const batchMutation = useMutation({
    mutationFn: async ({ id, codes }: { id: string; codes: string[] }) => {
      let total = 0;
      for (let i = 0; i < codes.length; i += BATCH_CHUNK) {
        const chunk = codes.slice(i, i + BATCH_CHUNK);
        await api.batchInventoryScans(id, chunk);
        total += chunk.length;
      }
      return total;
    },
    onSuccess: (total, { id }) => {
      setBatchError(null);
      setBatchSummary(t('inventory.batchDone', { count: total }));
      setBatchText('');
      invalidateSessionData(id);
    },
    onError: () => setBatchError(t('inventory.batchError')),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => api.closeInventorySession(id),
    onSuccess: (_, id) => {
      invalidateSessionData(id);
    },
  });

  const handleCreateSession = () => {
    const name = createName.trim();
    if (!name) {
      setCreateError(t('inventory.nameRequired'));
      return;
    }
    setCreateError(null);
    const scopeRaw = createScopePlace.trim();
    let scopePlace: number | null | undefined = null;
    if (scopeRaw !== '') {
      const n = parseInt(scopeRaw, 10);
      if (Number.isNaN(n) || n < 0) {
        setCreateError(t('inventory.scopePlaceInvalid'));
        return;
      }
      scopePlace = n;
    }
    createMutation.mutate({
      name,
      locationFilter: createLocationFilter.trim() || null,
      notes: createNotes.trim() || null,
      scopePlace: scopeRaw === '' ? null : scopePlace,
    });
  };

  const handleScan = () => {
    if (!activeSession || !barcode.trim() || activeSession.status !== 'open') return;
    scanMutation.mutate({ id: activeSession.id, bc: barcode.trim() });
  };

  const handleBatchImport = () => {
    if (!activeSession || activeSession.status !== 'open') return;
    const lines = batchText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setBatchError(t('inventory.batchEmpty'));
      return;
    }
    setBatchError(null);
    setBatchSummary(null);
    batchMutation.mutate({ id: activeSession.id, codes: lines });
  };

  const openCreateModal = () => {
    const d = new Date();
    const suggested = t('inventory.defaultSessionName', {
      date: d.toLocaleDateString(undefined, { dateStyle: 'medium' }),
    });
    setCreateName(suggested);
    setCreateLocationFilter('');
    setCreateNotes('');
    setCreateScopePlace('');
    setCreateError(null);
    setShowCreateModal(true);
  };

  // ─── Session detail view ───────────────────────────────────────
  if (sessionId) {
    if (sessionQuery.isError) {
      return (
        <div className="space-y-4">
          <Button variant="secondary" onClick={() => setSessionId(null)}>
            ← {t('common.back')}
          </Button>
          <p className="text-red-600 dark:text-red-400">{t('inventory.sessionLoadError')}</p>
        </div>
      );
    }

    if (sessionQuery.isLoading || !activeSession) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      );
    }

    const report = reportQuery.data ?? null;
    const scansData = scansQuery.data;
    const missingData = missingQuery.data;

    return (
      <div className="space-y-6">
        <div className="flex items-start gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setSessionId(null)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0"
          >
            ← {t('common.back')}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white break-words">
              {sessionDisplayName(activeSession, t)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sessionStartedAt(activeSession)
                ? new Date(sessionStartedAt(activeSession)).toLocaleString()
                : '—'}
              {activeSession.locationFilter ? ` — ${activeSession.locationFilter}` : ''}
              {activeSession.scopePlace != null
                ? ` · ${t('inventory.scopePlaceShort', { n: activeSession.scopePlace })}`
                : ` · ${t('inventory.scopeAll')}`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <Badge variant={activeSession.status === 'open' ? 'success' : 'default'}>
              {t(`inventory.statuses.${activeSession.status}`)}
            </Badge>
            {activeSession.status === 'open' && (
              <Button
                variant="danger"
                size="sm"
                isLoading={closeMutation.isPending}
                onClick={() => closeMutation.mutate(activeSession.id)}
              >
                {t('inventory.closeSession')}
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/30 px-4 py-3 text-sm text-indigo-900 dark:text-indigo-100">
          <p className="font-medium">{t('inventory.sessionHelpTitle')}</p>
          <p className="mt-1 text-indigo-800 dark:text-indigo-200">{t('inventory.sessionHelpBody')}</p>
          {activeSession.status === 'open' ? (
            <p className="mt-2 text-indigo-800 dark:text-indigo-200">{t('inventory.sessionHelpOpen')}</p>
          ) : (
            <p className="mt-2 text-indigo-800 dark:text-indigo-200">{t('inventory.sessionHelpClosed')}</p>
          )}
        </div>

        {activeSession.status === 'open' && (
          <>
            <Card>
              <CardHeader title={t('inventory.scanBarcode')} subtitle={t('inventory.scanBarcodeHint')} />
              <div className="flex gap-3 flex-wrap">
                <Input
                  ref={barcodeRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleScan();
                  }}
                  placeholder={t('inventory.barcodePlaceholder')}
                  autoFocus
                  className="flex-1 min-w-[200px]"
                />
                <Button
                  onClick={handleScan}
                  isLoading={scanMutation.isPending}
                  leftIcon={<Scan className="h-4 w-4" />}
                >
                  {t('inventory.scan')}
                </Button>
              </div>

              {scanFlash && (
                <div
                  className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-sm ${
                    scanFlash.result === 'found'
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                      : scanFlash.result === 'found_archived'
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                        : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {scanFlash.result === 'found' ? (
                    <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>
                    {scanFlash.result === 'found' &&
                      t('inventory.scanFound', { barcode: scanFlash.barcode })}
                    {scanFlash.result === 'found_archived' &&
                      t('inventory.scanArchived', { barcode: scanFlash.barcode })}
                    {scanFlash.result === 'unknown_barcode' &&
                      t('inventory.scanNotFound', { barcode: scanFlash.barcode })}
                  </span>
                </div>
              )}

              {scanError && (
                <div className="mt-3 flex items-center gap-2 p-3 rounded-lg text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  {scanError}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title={t('inventory.batchTitle')} subtitle={t('inventory.batchHint')} />
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('inventory.batchTextareaLabel')}
              </label>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 font-mono"
                placeholder={t('inventory.batchPlaceholder')}
              />
              {batchError && (
                <div className="mt-2 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {batchError}
                </div>
              )}
              {batchSummary && (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {batchSummary}
                </div>
              )}
              <div className="mt-3">
                <Button
                  variant="secondary"
                  leftIcon={<Upload className="h-4 w-4" />}
                  onClick={handleBatchImport}
                  isLoading={batchMutation.isPending}
                >
                  {t('inventory.batchSubmit')}
                </Button>
              </div>
            </Card>
          </>
        )}

        <Card>
          <CardHeader
            title={t('inventory.report')}
            subtitle={t('inventory.reportHint')}
          />
          {reportQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : report ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <StatBox label={t('inventory.expectedInScope')} value={report.expectedInScope ?? 0} />
              <StatBox label={t('inventory.totalScanned')} value={report.totalScanned ?? 0} />
              <StatBox label={t('inventory.totalFound')} value={report.totalFound ?? 0} color="green" />
              <StatBox
                label={t('inventory.totalFoundArchived')}
                value={report.totalFoundArchived ?? 0}
                color="amber"
              />
              <StatBox
                label={t('inventory.totalUnknown')}
                value={report.totalUnknown ?? 0}
                color="amber"
              />
              <StatBox
                label={t('inventory.distinctItemsScanned')}
                value={report.distinctItemsScanned ?? 0}
              />
              <StatBox
                label={t('inventory.duplicateScanCount')}
                value={report.duplicateScanCount ?? 0}
              />
              <StatBox label={t('inventory.missing')} value={report.missingCount ?? 0} color="red" />
              <StatBox
                label={t('inventory.missingScannable')}
                value={report.missingScannable ?? 0}
                color="red"
              />
              <StatBox
                label={t('inventory.missingWithoutBarcode')}
                value={report.missingWithoutBarcode ?? 0}
              />
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('inventory.noReport')}</p>
          )}
        </Card>

        <Card padding="none" className="flex flex-col min-h-0">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubTab('scans')}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  subTab === 'scans'
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <ListOrdered className="h-4 w-4" />
                {t('inventory.scansTitle')}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('missing')}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  subTab === 'missing'
                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <PackageSearch className="h-4 w-4" />
                {t('inventory.missingTab')}
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {subTab === 'scans' ? t('inventory.scansTabHint') : t('inventory.missingTabHint')}
            </p>
            {subTab === 'scans' && scansData && (
              <PaginationControls
                page={scansPage}
                pageCount={Math.max(1, scansData.pageCount)}
                total={scansData.total}
                perPage={scansData.perPage}
                onPageChange={setScansPage}
                t={t}
              />
            )}
            {subTab === 'missing' && missingData && (
              <PaginationControls
                page={missingPage}
                pageCount={Math.max(1, missingData.pageCount)}
                total={missingData.total}
                perPage={missingData.perPage}
                onPageChange={setMissingPage}
                t={t}
              />
            )}
          </div>
          <ScrollableListRegion
            aria-label={subTab === 'scans' ? t('inventory.scansTitle') : t('inventory.missingTab')}
          >
            {subTab === 'scans' && (
              <>
                {scansQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : !scansData?.items.length ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-6 px-4">
                    {t('inventory.noScans')}
                  </p>
                ) : (
                  <div className="space-y-2 p-4 sm:p-6">
                    {scansData.items.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all">
                            {scan.barcode}
                          </span>
                          {scan.scannedAt && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {new Date(scan.scannedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <Badge variant={scanResultVariant(scan.result)}>
                          {t(`inventory.scanResults.${scan.result}`)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {subTab === 'missing' && (
              <>
                {missingQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : !missingData?.items.length ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-6 px-4">
                    {t('inventory.noMissing')}
                  </p>
                ) : (
                  <div className="overflow-x-auto p-4 sm:p-6">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                          <th className="py-2 pr-3 font-medium">{t('inventory.missingColTitle')}</th>
                          <th className="py-2 pr-3 font-medium">{t('items.callNumber')}</th>
                          <th className="py-2 pr-3 font-medium">{t('inventory.missingColBarcode')}</th>
                          <th className="py-2 font-medium">{t('inventory.missingColPlace')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missingData.items.map((row) => (
                          <tr
                            key={row.itemId}
                            className="border-b border-gray-100 dark:border-gray-800"
                          >
                            <td className="py-2 pr-3 text-gray-900 dark:text-gray-100">
                              {row.biblioTitle ?? '—'}
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300">
                              {row.callNumber ?? '—'}
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300">
                              {row.barcode ?? '—'}
                            </td>
                            <td className="py-2 text-gray-600 dark:text-gray-400">
                              {row.place != null ? row.place : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </ScrollableListRegion>
        </Card>
      </div>
    );
  }

  // ─── Sessions list ─────────────────────────────────────────────
  const sess = sessionsQuery.data;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
        <p className="font-medium text-gray-900 dark:text-white">{t('inventory.listHelpTitle')}</p>
        <p className="mt-1">{t('inventory.listHelpBody')}</p>
        <ul className="mt-2 list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
          <li>{t('inventory.listHelpStep1')}</li>
          <li>{t('inventory.listHelpStep2')}</li>
          <li>{t('inventory.listHelpStep3')}</li>
          <li>{t('inventory.listHelpStep4')}</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inventory.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('inventory.subtitle')}</p>
        </div>
        <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
          {t('inventory.newSession')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'open', 'closed'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSessionsStatus(key);
              setSessionsPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              sessionsStatus === key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {key === 'all' ? t('common.all') : t(`inventory.statuses.${key}`)}
          </button>
        ))}
      </div>

      <Card>
        {sessionsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !sess?.items.length ? (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">{t('inventory.noSessions')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sess.items.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => enterSession(session.id)}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white break-words">
                    {sessionDisplayName(session, t)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {sessionStartedAt(session)
                      ? new Date(sessionStartedAt(session)).toLocaleString()
                      : '—'}
                    {session.locationFilter ? ` — ${session.locationFilter}` : ''}
                    {session.scopePlace != null
                      ? ` · ${t('inventory.scopePlaceShort', { n: session.scopePlace })}`
                      : ''}
                  </p>
                </div>
                <Badge variant={session.status === 'open' ? 'success' : 'default'}>
                  {t(`inventory.statuses.${session.status}`)}
                </Badge>
              </button>
            ))}
            <PaginationControls
              page={sessionsPage}
              pageCount={Math.max(1, sess.pageCount)}
              total={sess.total}
              perPage={sess.perPage}
              onPageChange={setSessionsPage}
              t={t}
            />
          </div>
        )}
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (createMutation.isPending) return;
          setShowCreateModal(false);
          setCreateError(null);
        }}
        title={t('inventory.newSession')}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setCreateError(null);
              }}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateSession} isLoading={createMutation.isPending}>
              {t('common.create')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('inventory.createModalHint')}</p>
          <Input
            label={t('inventory.sessionName')}
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder={t('inventory.sessionNamePlaceholder')}
          />
          <Input
            label={t('inventory.locationFilter')}
            hint={t('inventory.locationFilterExplain')}
            value={createLocationFilter}
            onChange={(e) => setCreateLocationFilter(e.target.value)}
            placeholder={t('inventory.locationFilterHint')}
          />
          <Input
            label={t('inventory.scopePlace')}
            hint={t('inventory.scopePlaceHint')}
            value={createScopePlace}
            onChange={(e) => setCreateScopePlace(e.target.value)}
            placeholder={t('inventory.scopePlacePlaceholder')}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('inventory.notes')}
            </label>
            <textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100"
              placeholder={t('inventory.notesPlaceholder')}
            />
          </div>
          {createError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {createError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function PaginationControls(props: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  onPageChange: (p: number) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { page, pageCount, total, perPage, onPageChange, t } = props;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span>
        {t('inventory.paginationRange', { from, to, total })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t('common.previous')}
        </Button>
        <span>
          {t('common.page')} {page} / {pageCount}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}

interface StatBoxProps {
  label: string;
  value: number;
  color?: 'green' | 'amber' | 'red' | 'default';
}

function StatBox({ label, value, color = 'default' }: StatBoxProps) {
  const colorClass = {
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
    default: 'text-gray-900 dark:text-white',
  }[color];

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-center">
      <p className={`text-2xl sm:text-3xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">{label}</p>
    </div>
  );
}
