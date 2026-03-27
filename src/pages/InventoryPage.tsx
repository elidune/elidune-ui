import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList, Scan, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, Button, Modal, Input, Badge, ScrollableListRegion } from '@/components/common';
import api from '@/services/api';
import type { InventorySession, CreateInventorySession, InventoryScanResult, InventoryReport } from '@/types';

type ViewState = 'list' | 'session';

export default function InventoryPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewState>('list');
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [scans, setScans] = useState<InventoryScanResult[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState('');
  const [barcode, setBarcode] = useState('');
  const [isScan, setIsScan] = useState(false);
  const [scanResult, setScanResult] = useState<InventoryScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const barcodeRef = useRef<HTMLInputElement>(null);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await api.getInventorySessions();
      setSessions(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessionData = async (session: InventorySession) => {
    setActiveSession(session);
    setView('session');
    setReport(null);
    setScans([]);
    setScanResult(null);
    setScanError(null);

    const [scansData] = await Promise.all([
      api.getInventoryScans(session.id).catch(() => []),
    ]);
    setScans(scansData);

    if (session.status === 'closed') {
      setIsLoadingReport(true);
      api.getInventoryReport(session.id)
        .then(setReport)
        .catch(() => {})
        .finally(() => setIsLoadingReport(false));
    }
  };

  const handleCreateSession = async () => {
    setIsCreating(true);
    setCreateError(null);
    try {
      const payload: CreateInventorySession = {
        locationFilter: locationFilter.trim() || null,
      };
      const created = await api.createInventorySession(payload);
      await loadSessions();
      setShowCreateModal(false);
      setLocationFilter('');
      loadSessionData(created);
    } catch {
      setCreateError(t('inventory.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleScan = async () => {
    if (!activeSession || !barcode.trim()) return;
    setIsScan(true);
    setScanResult(null);
    setScanError(null);
    try {
      const result = await api.scanInventoryItem(activeSession.id, barcode.trim());
      setScanResult(result);
      setScans((prev) => [result, ...prev]);
      setBarcode('');
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } catch {
      setScanError(t('inventory.scanError'));
    } finally {
      setIsScan(false);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    setIsClosing(true);
    try {
      const closed = await api.closeInventorySession(activeSession.id);
      setActiveSession(closed);
      setIsLoadingReport(true);
      const rep = await api.getInventoryReport(activeSession.id).catch(() => null);
      setReport(rep);
      await loadSessions();
    } catch {
      // ignore
    } finally {
      setIsClosing(false);
      setIsLoadingReport(false);
    }
  };

  if (view === 'session' && activeSession) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView('list')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
          >
            ← {t('common.back')}
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {t('inventory.sessionTitle')} #{activeSession.id.slice(0, 8)}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {new Date(activeSession.createdAt ?? activeSession.createdAt ?? '').toLocaleDateString()}
              {(activeSession.locationFilter ?? activeSession.locationFilter) &&
                ` — ${activeSession.locationFilter ?? activeSession.locationFilter}`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Badge variant={activeSession.status === 'open' ? 'success' : 'default'}>
              {t(`inventory.statuses.${activeSession.status}`)}
            </Badge>
            {activeSession.status === 'open' && (
              <Button variant="danger" size="sm" isLoading={isClosing} onClick={handleCloseSession}>
                {t('inventory.closeSession')}
              </Button>
            )}
          </div>
        </div>

        {/* Scan input (only for open sessions) */}
        {activeSession.status === 'open' && (
          <Card>
            <CardHeader title={t('inventory.scanBarcode')} />
            <div className="flex gap-3">
              <Input
                ref={barcodeRef}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleScan(); }}
                placeholder={t('inventory.barcodePlaceholder')}
                autoFocus
                className="flex-1"
              />
              <Button onClick={handleScan} isLoading={isScan} leftIcon={<Scan className="h-4 w-4" />}>
                {t('inventory.scan')}
              </Button>
            </div>

            {scanResult && (
              <div className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-sm ${
                scanResult.found
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
              }`}>
                {scanResult.found
                  ? <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                <span>
                  {scanResult.found
                    ? t('inventory.scanFound', { barcode: scanResult.barcode })
                    : t('inventory.scanNotFound', { barcode: scanResult.barcode })}
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
        )}

        {/* Report (for closed sessions) */}
        {activeSession.status === 'closed' && (
          <Card>
            <CardHeader title={`${t('inventory.report')} — ${t('inventory.totalScanned')}`} />
            {isLoadingReport ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : report ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatBox
                  label={t('inventory.totalScanned')}
                  value={report.totalScanned ?? report.totalScanned ?? 0}
                />
                <StatBox
                  label={t('inventory.totalFound')}
                  value={report.totalFound ?? report.totalFound ?? 0}
                  color="green"
                />
                <StatBox
                  label={t('inventory.totalUnknown')}
                  value={report.totalUnknown ?? report.totalUnknown ?? 0}
                  color="amber"
                />
                <StatBox
                  label={t('inventory.missing')}
                  value={report.missingCount ?? report.missingCount ?? 0}
                  color="red"
                />
              </div>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('inventory.noReport')}</p>
            )}
          </Card>
        )}

        {/* Scans list */}
        <Card padding="none" className="flex flex-col min-h-0">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <CardHeader
              title={t('inventory.scansTitle')}
              subtitle={t('inventory.scansCount', { count: scans.length })}
            />
          </div>
          <ScrollableListRegion aria-label={t('inventory.scansTitle')}>
            {scans.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-6">{t('inventory.noScans')}</p>
            ) : (
              <div className="space-y-2 p-4 sm:p-6">
                {scans.map((scan, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{scan.barcode}</span>
                    <Badge variant={scan.found ? 'success' : 'warning'}>
                      {scan.found ? t('inventory.found') : t('inventory.unknown')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </ScrollableListRegion>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('inventory.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('inventory.subtitle')}</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          {t('inventory.newSession')}
        </Button>
      </div>

      <Card>
        {isLoadingSessions ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">{t('inventory.noSessions')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => loadSessionData(session)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {t('inventory.sessionTitle')} #{session.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(session.createdAt ?? session.createdAt ?? '').toLocaleDateString()}
                    {(session.locationFilter ?? session.locationFilter) &&
                      ` — ${session.locationFilter ?? session.locationFilter}`}
                  </p>
                </div>
                <Badge variant={session.status === 'open' ? 'success' : 'default'}>
                  {t(`inventory.statuses.${session.status}`)}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Create session modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          if (isCreating) return;
          setShowCreateModal(false);
          setCreateError(null);
          setLocationFilter('');
        }}
        title={t('inventory.newSession')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                setCreateError(null);
                setLocationFilter('');
              }}
              disabled={isCreating}
            >
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateSession} isLoading={isCreating}>
              {t('common.create')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('inventory.locationFilter')}
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder={t('inventory.locationFilterHint')}
          />
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
      <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </div>
  );
}
