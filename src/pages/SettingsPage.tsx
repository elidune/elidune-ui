import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Save, Plus, Trash2, Server, Archive, Pencil, Merge, Package, Check, X, AlertTriangle, Users, ChevronDown, BookOpen, Cog, ScrollText, Wrench, Shield, Mail, Library } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LibrarySettingsPanel } from '@/pages/LibraryPage';
import AdminServerSettings from '@/components/settings/AdminServerSettings';
import AccountTypesSettings from '@/components/settings/AccountTypesSettings';
import EmailTemplatesSettings from '@/components/settings/EmailTemplatesSettings';
import AuditLogViewer from '@/components/settings/AuditLogViewer';
import MaintenanceSettings from '@/components/settings/MaintenanceSettings';
import { Card, CardHeader, Button, Input, Badge, ConfirmDialog } from '@/components/common';
import api from '@/services/api';
import { getApiErrorCode, getApiErrorMessage } from '@/utils/apiError';
import { isAdmin } from '@/types';
import type {
  Settings,
  LoanSettings,
  LoanSettingsRenewAt,
  PublicTypeLoanSettingInput,
  Z3950Server,
  MediaType,
  Source,
  PublicType,
  PublicTypeLoanSettings,
  CreatePublicType,
  UpdatePublicType,
} from '@/types';

const MEDIA_TYPE_VALUES: MediaType[] = [
  'unknown',
  'printedText',
  'multimedia',
  'comics',
  'periodic',
  'video',
  'videoTape',
  'videoDvd',
  'audio',
  'audioMusic',
  'audioMusicTape',
  'audioMusicCd',
  'audioNonMusic',
  'audioNonMusicTape',
  'audioNonMusicCd',
  'cdRom',
  'images',
];

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType | string | null | undefined): string {
  if (!mediaType) return 'unknown';
  const legacyMap: Record<string, string> = {
    u: 'unknown',
    b: 'printedText',
    bc: 'comics',
    p: 'periodic',
    v: 'video',
    vt: 'videoTape',
    vd: 'videoDvd',
    a: 'audio',
    am: 'audioMusic',
    amt: 'audioMusicTape',
    amc: 'audioMusicCd',
    an: 'audioNonMusic',
    ant: 'audioNonMusicTape',
    anc: 'audioNonMusicCd',
    c: 'cdRom',
    i: 'images',
    m: 'multimedia',
  };
  return legacyMap[String(mediaType)] ?? String(mediaType);
}

function globalRenewInheritLabel(
  globalLoanSettings: LoanSettings[],
  mediaType: MediaType | null,
  translate: (key: string) => string,
): string {
  const globalRow = globalLoanSettings.find((s) => s.mediaType === mediaType);
  if (globalRow != null) {
    return globalRow.renewAt === 'at_due_date'
      ? translate('settings.renewAtDueDate')
      : translate('settings.renewAtNow');
  }
  return translate('settings.publicTypes.renewAtGlobalFallback');
}

// ─── Source Editor Component ───────────────────────────────────────────────────
function SourceEditor() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<Source[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Merge state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [archiveConfirmSource, setArchiveConfirmSource] = useState<Source | null>(null);

  const clearMessages = () => { setError(null); setSuccessMsg(null); };
  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000); };

  const fetchSources = useCallback(async () => {
    try {
      const data = await api.getSources(showArchived);
      setSources(data);
      setError(null);
    } catch {
      setError(t('settings.sources.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [showArchived, t]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleRenameStart = (source: Source) => {
    clearMessages();
    setRenamingId(source.id);
    setRenameValue(source.name || '');
  };

  const handleRenameConfirm = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await api.renameSource(id, renameValue.trim());
      setRenamingId(null);
      showSuccess(t('settings.sources.renameSuccess'));
      fetchSources();
    } catch {
      setError(t('settings.sources.errorRename'));
    }
  };

  const handleToggleDefault = async (source: Source) => {
    clearMessages();
    const newDefaultValue = !source.default;
    try {
      // If setting as default, first unset all other sources as default
      if (newDefaultValue) {
        const otherDefaultSources = sources.filter(s => s.default && s.id !== source.id);
        for (const otherSource of otherDefaultSources) {
          await api.updateSource(otherSource.id, { default: false });
        }
      }
      await api.updateSource(source.id, { default: newDefaultValue });
      showSuccess(t('settings.sources.defaultUpdated'));
      fetchSources();
    } catch {
      setError(t('settings.sources.errorUpdateDefault'));
    }
  };

  const handleRenameCancel = () => { setRenamingId(null); setRenameValue(''); };

  const performArchiveSource = async (source: Source) => {
    clearMessages();
    try {
      await api.archiveSource(source.id);
      showSuccess(t('settings.sources.archiveSuccess'));
      fetchSources();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
      if (axiosErr.response?.status === 422) {
        setError(getApiErrorMessage(axiosErr, t) || t('settings.sources.errorArchive'));
      } else {
        setError(t('settings.sources.errorArchive'));
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleMergeOpen = () => {
    clearMessages();
    if (selectedIds.size < 2) { setError(t('settings.sources.mergeMinTwo')); return; }
    setMergeName('');
    setShowMergeDialog(true);
  };

  const handleMergeConfirm = async () => {
    if (!mergeName.trim() || selectedIds.size < 2) return;
    setIsMerging(true);
    try {
      await api.mergeSources(Array.from(selectedIds), mergeName.trim());
      showSuccess(t('settings.sources.mergeSuccess'));
      setSelectedIds(new Set());
      setMergeMode(false);
      setShowMergeDialog(false);
      fetchSources();
    } catch {
      setError(t('settings.sources.errorMerge'));
    } finally {
      setIsMerging(false);
    }
  };

  const activeSources = sources.filter(s => !s.isArchive);
  const archivedSources = sources.filter(s => !!s.isArchive);

  const renderSourceRow = (source: Source) => {
    const isArchived = !!source.isArchive;
    const isRenaming = renamingId === source.id;
    const isSelected = selectedIds.has(source.id);

    const rowClickableMerge = mergeMode && !isArchived && !isRenaming;

    return (
      <div
        key={source.id}
        onClick={
          rowClickableMerge
            ? () => {
                toggleSelect(source.id);
              }
            : undefined
        }
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
          isSelected
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
        } ${isArchived ? 'opacity-60' : ''} ${rowClickableMerge ? 'cursor-pointer' : ''}`}
      >
        {/* Checkbox for merge mode */}
        {mergeMode && !isArchived && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(source.id)}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500"
          />
        )}

        {/* Source info */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameConfirm(source.id);
                  if (e.key === 'Escape') handleRenameCancel();
                }}
                autoFocus
                className="flex-1 px-2 py-1 rounded border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleRenameConfirm(source.id)}
                className="p-1 text-green-600 hover:text-green-700"
                title={t('common.confirm')}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={handleRenameCancel}
                className="p-1 text-gray-400 hover:text-gray-600"
                title={t('common.cancel')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="font-medium text-gray-900 dark:text-white truncate">
                {source.name || '—'}
              </span>
              {source.key && (
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  {source.key}
                </span>
              )}
              {isArchived ? (
                <Badge variant="default">{t('settings.sources.archived')}</Badge>
              ) : (
                <Badge variant="success">{t('settings.sources.active')}</Badge>
              )}
              {!isArchived && source.default && (
                <Badge variant="default">{t('settings.sources.default')}</Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!mergeMode && !isRenaming && !isArchived && (
          <div className="flex items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={source.default || false}
                onChange={() => handleToggleDefault(source)}
                className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500"
                title={t('settings.sources.setDefault')}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('settings.sources.default')}
              </span>
            </label>
            <button
              onClick={() => handleRenameStart(source)}
              className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={t('settings.sources.rename')}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => setArchiveConfirmSource(source)}
              className="p-1.5 rounded-md text-gray-400 hover:text-amber-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={t('settings.sources.archive')}
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader title={t('settings.sources.title')} />
        <div className="flex items-center justify-center h-24">
          <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('settings.sources.title')}
        action={
          <div className="flex items-center gap-2">
            {mergeMode ? (
              <>
                {selectedIds.size > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.sources.selected', { count: selectedIds.size })}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Merge className="h-4 w-4" />}
                  onClick={handleMergeOpen}
                  disabled={selectedIds.size < 2}
                >
                  {t('settings.sources.mergeSelected')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setMergeMode(false); setSelectedIds(new Set()); }}
                >
                  {t('common.cancel')}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Merge className="h-4 w-4" />}
                onClick={() => { clearMessages(); setMergeMode(true); setSelectedIds(new Set()); }}
              >
                {t('settings.sources.merge')}
              </Button>
            )}
          </div>
        }
      />

      {/* Messages */}
      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Toggle archived */}
      <div className="px-4 mb-3">
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500"
          />
          {t('settings.sources.showArchived')}
        </label>
      </div>

      {/* Source list */}
      <div className="px-4 pb-4 space-y-2">
        {activeSources.length === 0 && archivedSources.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('settings.sources.noSources')}</p>
        )}
        {activeSources.map(renderSourceRow)}
        {showArchived && archivedSources.length > 0 && (
          <>
            {activeSources.length > 0 && <div className="border-t border-gray-200 dark:border-gray-700 my-2" />}
            {archivedSources.map(renderSourceRow)}
          </>
        )}
      </div>

      {/* Merge dialog */}
      {showMergeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('settings.sources.mergeTitle')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('settings.sources.mergeHint')}
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.sources.mergeName')}
              </label>
              <input
                type="text"
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                placeholder={t('settings.sources.mergeNamePlaceholder')}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && mergeName.trim()) handleMergeConfirm(); }}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <Package className="h-3.5 w-3.5" />
              {t('settings.sources.selected', { count: selectedIds.size })}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowMergeDialog(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Merge className="h-4 w-4" />}
                isLoading={isMerging}
                onClick={handleMergeConfirm}
                disabled={!mergeName.trim()}
              >
                {t('settings.sources.merge')}
              </Button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={archiveConfirmSource !== null}
        onClose={() => setArchiveConfirmSource(null)}
        onConfirm={() => {
          const src = archiveConfirmSource;
          setArchiveConfirmSource(null);
          if (src) void performArchiveSource(src);
        }}
        message={
          archiveConfirmSource
            ? t('settings.sources.archiveConfirm', { name: archiveConfirmSource.name })
            : ''
        }
        confirmVariant="danger"
      />
    </Card>
  );
}

// ─── Public Types Editor ───────────────────────────────────────────────────────
function PublicTypesEditor() {
  const { t } = useTranslation();
  const [publicTypes, setPublicTypes] = useState<PublicType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<'general' | 'overrides'>('general');
  const [loanOverrides, setLoanOverrides] = useState<Record<string, PublicTypeLoanSettings[]>>({});
  const [publicTypeToDelete, setPublicTypeToDelete] = useState<PublicType | null>(null);
  const [globalLoanSettings, setGlobalLoanSettings] = useState<LoanSettings[]>([]);

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
  };
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const fetchPublicTypes = useCallback(async () => {
    try {
      const data = await api.getPublicTypes();
      setPublicTypes(data);
      setError(null);
    } catch {
      setError(t('settings.publicTypes.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchPublicTypes();
  }, [fetchPublicTypes]);

  useEffect(() => {
    let cancelled = false;
    void api.getLoanSettings().then((r) => {
      if (!cancelled) setGlobalLoanSettings(r.loanSettings ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchOverrides = useCallback(async (id: string) => {
    try {
      const [, overrides] = await api.getPublicType(id);
      setLoanOverrides((prev) => ({ ...prev, [id]: overrides }));
    } catch {
      setLoanOverrides((prev) => ({ ...prev, [id]: [] }));
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      if (next && next !== prev) setDetailsTab('general');
      return next;
    });
    if (!loanOverrides[id]) fetchOverrides(id);
  };

  const handleCreate = async (data: CreatePublicType) => {
    try {
      await api.createPublicType(data);
      showSuccess(t('settings.publicTypes.createSuccess'));
      setShowCreateModal(false);
      fetchPublicTypes();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t));
    }
  };

  const handleUpdate = async (id: string, data: UpdatePublicType) => {
    try {
      await api.updatePublicType(id, data);
      showSuccess(t('settings.publicTypes.updateSuccess'));
      fetchPublicTypes();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t));
    }
  };

  const performDeletePublicType = async (pt: PublicType) => {
    clearMessages();
    try {
      await api.deletePublicType(pt.id);
      showSuccess(t('settings.publicTypes.deleteSuccess'));
      setExpandedId((prev) => (prev === pt.id ? null : prev));
      fetchPublicTypes();
    } catch (err: unknown) {
      if (getApiErrorCode(err) === 'business_rule_violation') {
        setError(t('settings.publicTypes.deleteError'));
      } else {
        setError(getApiErrorMessage(err, t));
      }
    }
  };

  const handleSaveLoanOverrides = async (
    publicTypeId: string,
    settings: PublicTypeLoanSettingInput[],
  ) => {
    clearMessages();
    try {
      const list = await api.replacePublicTypeLoanSettings(publicTypeId, { settings });
      setLoanOverrides((prev) => ({ ...prev, [publicTypeId]: list }));
      showSuccess(t('settings.publicTypes.overrideSuccess'));
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t));
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader title={t('settings.publicTypes.title')} />
        <div className="flex items-center justify-center h-24">
          <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t('settings.publicTypes.title')}
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              clearMessages();
              setShowCreateModal(true);
            }}
          >
            {t('settings.publicTypes.add')}
          </Button>
        }
      />
      {error && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <Check className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}
      <div className="px-4 pb-4 space-y-2">
        {publicTypes.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('settings.publicTypes.noTypes')}</p>
        ) : (
          publicTypes.map((pt) => (
            <div
              key={pt.id}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden"
            >
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                onClick={() => toggleExpand(pt.id)}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{pt.label}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">({pt.name})</span>
                  <span className="text-xs text-gray-400">
                    {pt.ageMin != null && pt.ageMax != null
                      ? t('settings.publicTypes.ageRange', { min: pt.ageMin, max: pt.ageMax })
                      : pt.subscriptionPrice != null
                        ? `${(pt.subscriptionPrice / 100).toFixed(2)}€`
                        : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={() => setPublicTypeToDelete(pt)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === pt.id ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              {expandedId === pt.id && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                  <div className="border-b border-gray-200 dark:border-gray-800 mb-4">
                    <nav className="-mb-px flex gap-4">
                      <button
                        type="button"
                        onClick={() => setDetailsTab('general')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          detailsTab === 'general'
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        {t('settings.publicTypes.general')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailsTab('overrides')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                          detailsTab === 'overrides'
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        {t('settings.publicTypes.loanOverrides')}
                      </button>
                    </nav>
                  </div>

                  {detailsTab === 'general' ? (
                    <PublicTypeEditForm pt={pt} onSave={(data) => handleUpdate(pt.id, data)} />
                  ) : (
                    <LoanOverridesForm
                      publicTypeId={pt.id}
                      overrides={loanOverrides[pt.id] || []}
                      globalLoanSettings={globalLoanSettings}
                      onSaveAll={handleSaveLoanOverrides}
                      getMediaTypeKey={getMediaTypeTranslationKey}
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      {showCreateModal && (
        <PublicTypeCreateModal
          onSave={handleCreate}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
      <ConfirmDialog
        isOpen={publicTypeToDelete !== null}
        onClose={() => setPublicTypeToDelete(null)}
        onConfirm={() => {
          const pt = publicTypeToDelete;
          setPublicTypeToDelete(null);
          if (pt) void performDeletePublicType(pt);
        }}
        message={
          publicTypeToDelete
            ? t('settings.publicTypes.deleteConfirm', { label: publicTypeToDelete.label })
            : ''
        }
        confirmVariant="danger"
      />
    </Card>
  );
}

function PublicTypeEditForm({
  pt,
  onSave,
}: {
  pt: PublicType;
  onSave: (data: UpdatePublicType) => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: pt.name,
    label: pt.label,
    subscriptionDurationDays: pt.subscriptionDurationDays ?? '',
    ageMin: pt.ageMin ?? '',
    ageMax: pt.ageMax ?? '',
    subscriptionPrice: pt.subscriptionPrice != null ? (pt.subscriptionPrice / 100).toString() : '',
    maxLoans: pt.maxLoans ?? '',
    loanDurationDays: pt.loanDurationDays ?? '',
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.name')}</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.label')}</label>
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('settings.publicTypes.subscriptionDurationDays')}
          </label>
          <input
            type="number"
            min="0"
            placeholder="—"
            value={form.subscriptionDurationDays}
            onChange={(e) => setForm((f) => ({ ...f, subscriptionDurationDays: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.loanDurationDays')}</label>
          <input
            type="number"
            min="0"
            placeholder="—"
            value={form.loanDurationDays}
            onChange={(e) => setForm((f) => ({ ...f, loanDurationDays: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.ageMin')}</label>
          <input
            type="number"
            min="0"
            placeholder="—"
            value={form.ageMin}
            onChange={(e) => setForm((f) => ({ ...f, ageMin: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.ageMax')}</label>
          <input
            type="number"
            min="0"
            placeholder="—"
            value={form.ageMax}
            onChange={(e) => setForm((f) => ({ ...f, ageMax: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.subscriptionPrice')}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="—"
            value={form.subscriptionPrice}
            onChange={(e) => setForm((f) => ({ ...f, subscriptionPrice: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('settings.publicTypes.maxLoans')}</label>
          <input
            type="number"
            min="0"
            placeholder="—"
            value={form.maxLoans}
            onChange={(e) => setForm((f) => ({ ...f, maxLoans: e.target.value }))}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Save className="h-4 w-4" />}
          onClick={() =>
            onSave({
              name: form.name?.trim() || undefined,
              label: form.label?.trim() || undefined,
              subscriptionDurationDays: form.subscriptionDurationDays ? Number(form.subscriptionDurationDays) : null,
              ageMin: form.ageMin ? Number(form.ageMin) : null,
              ageMax: form.ageMax ? Number(form.ageMax) : null,
              subscriptionPrice: form.subscriptionPrice ? Math.round(parseFloat(form.subscriptionPrice) * 100) : null,
              maxLoans: form.maxLoans ? Number(form.maxLoans) : null,
              loanDurationDays: form.loanDurationDays ? Number(form.loanDurationDays) : null,
            })
          }
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

type OverrideUiRow = {
  key: string;
  /** Synced from GET — persisted default row cannot be removed without Save. */
  fromServer: boolean;
  mediaType: MediaType | null;
  duration: number;
  nbMax: number;
  nbRenews: number;
  renewMode: 'inherit' | LoanSettingsRenewAt;
};

function sortOverrideUiRows(rows: OverrideUiRow[]): OverrideUiRow[] {
  return [...rows].sort((a, b) => {
    if (a.mediaType == null && b.mediaType != null) return -1;
    if (a.mediaType != null && b.mediaType == null) return 1;
    if (a.mediaType == null || b.mediaType == null) return 0;
    return String(a.mediaType).localeCompare(String(b.mediaType));
  });
}

function validateOverrideRowsForReplace(
  sortedRows: OverrideUiRow[],
  t: (key: string) => string,
):
  | { ok: true; settings: PublicTypeLoanSettingInput[] }
  | { ok: false; message: string } {
  if (sortedRows.length === 0) {
    return { ok: false, message: t('settings.publicTypes.overridesValidationEmpty') };
  }
  const defaults = sortedRows.filter((r) => r.mediaType == null);
  if (defaults.length !== 1) {
    return { ok: false, message: t('settings.publicTypes.overridesValidationDefaultCount') };
  }
  const concrete = sortedRows.map((r) => r.mediaType).filter((m): m is MediaType => m != null);
  if (new Set(concrete).size !== concrete.length) {
    return { ok: false, message: t('settings.publicTypes.overridesValidationDuplicateMedia') };
  }
  const settings: PublicTypeLoanSettingInput[] = sortedRows.map((r) => ({
    mediaType: r.mediaType,
    duration: r.duration,
    nbMax: r.nbMax,
    nbRenews: r.nbRenews,
    renewAt: r.renewMode === 'inherit' ? null : r.renewMode,
  }));
  return { ok: true, settings };
}

function rekeyOverrideRow(row: OverrideUiRow, newMt: MediaType | null): OverrideUiRow {
  if (row.key.startsWith('pending:')) {
    return { ...row, mediaType: newMt };
  }
  return {
    ...row,
    mediaType: newMt,
    key: newMt == null ? 'row-default' : `row-${newMt}`,
  };
}

function computeRowsAfterMediaTypeChange(
  prev: OverrideUiRow[],
  rowKey: string,
  nextMt: MediaType | null,
  t: (key: string) => string,
): { next: OverrideUiRow[]; error?: string } {
  const row = prev.find((r) => r.key === rowKey);
  if (!row) return { next: prev };

  if (nextMt === null) {
    const otherDefault = prev.find((r) => r.key !== rowKey && r.mediaType == null);
    if (!otherDefault) {
      return {
        next: prev.map((r) => (r.key === rowKey ? rekeyOverrideRow(r, null) : r)),
      };
    }
    const used = new Set(
      prev
        .filter((r) => r.key !== otherDefault.key && r.key !== rowKey)
        .map((r) => r.mediaType)
        .filter((m): m is MediaType => m != null),
    );
    const free = MEDIA_TYPE_VALUES.find((m) => !used.has(m));
    if (!free) {
      return { next: prev, error: t('settings.publicTypes.overridesCannotMoveDefault') };
    }
    return {
      next: prev.map((r) => {
        if (r.key === rowKey) return rekeyOverrideRow(r, null);
        if (r.key === otherDefault.key) return rekeyOverrideRow(r, free);
        return r;
      }),
    };
  }

  if (row.mediaType == null && !prev.some((r) => r.key !== rowKey && r.mediaType == null)) {
    return { next: prev, error: t('settings.publicTypes.overridesMustKeepOneDefault') };
  }

  if (prev.some((r) => r.key !== rowKey && r.mediaType === nextMt)) {
    return { next: prev, error: t('settings.publicTypes.overridesValidationDuplicateMedia') };
  }

  return {
    next: prev.map((r) => (r.key === rowKey ? rekeyOverrideRow(r, nextMt) : r)),
  };
}

function overrideRowMediaTypeOptions(
  rows: OverrideUiRow[],
  rowKey: string,
  t: (key: string) => string,
  getMediaTypeKey: (mt: MediaType | string) => string,
): { value: string; label: string }[] {
  const row = rows.find((r) => r.key === rowKey);
  if (!row) return [];
  const others = rows.filter((r) => r.key !== rowKey);
  const otherHasDefault = others.some((r) => r.mediaType == null);
  const otherUsed = new Set(others.map((r) => r.mediaType).filter((m): m is MediaType => m != null));

  const opts: { value: string; label: string }[] = [];
  if (!otherHasDefault || row.mediaType == null) {
    opts.push({ value: '', label: t('settings.mediaTypeDefault') });
  }
  for (const mt of MEDIA_TYPE_VALUES) {
    if (mt === row.mediaType || !otherUsed.has(mt)) {
      opts.push({ value: mt, label: t(`items.mediaType.${getMediaTypeKey(mt)}`) });
    }
  }
  return opts;
}

function PublicTypeLoanOverrideRow({
  row,
  globalLoanSettings,
  mediaTypeOptions,
  onFieldChange,
  onMediaTypeChange,
  onDeleteRow,
}: {
  row: OverrideUiRow;
  globalLoanSettings: LoanSettings[];
  mediaTypeOptions: { value: string; label: string }[];
  onFieldChange: (key: string, patch: Partial<Omit<OverrideUiRow, 'key' | 'fromServer'>>) => void;
  onMediaTypeChange: (rowKey: string, rawValue: string) => void;
  onDeleteRow: (row: OverrideUiRow) => void;
}) {
  const { t } = useTranslation();
  const inheritedRenewalLabel = globalRenewInheritLabel(globalLoanSettings, row.mediaType, (k) => t(k));
  const showDelete = row.mediaType != null || !row.fromServer;

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      <td className="px-4 py-3">
        <select
          value={row.mediaType ?? ''}
          onChange={(e) => onMediaTypeChange(row.key, e.target.value)}
          className="max-w-[min(100%,14rem)] px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm min-w-[140px]"
          aria-label={t('settings.publicTypes.mediaType')}
        >
          {mediaTypeOptions.map((opt) => (
            <option key={opt.value === '' ? '__default__' : opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={row.duration}
          onChange={(e) => onFieldChange(row.key, { duration: parseInt(e.target.value, 10) || 0 })}
          className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          min={1}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={row.nbMax}
          onChange={(e) => onFieldChange(row.key, { nbMax: parseInt(e.target.value, 10) || 0 })}
          className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          min={1}
          title={
            row.mediaType == null
              ? t('settings.publicTypes.nbMaxDefaultLabel')
              : t('settings.publicTypes.nbMaxPerMediaLabel')
          }
          aria-label={
            row.mediaType == null
              ? t('settings.publicTypes.nbMaxDefaultLabel')
              : t('settings.publicTypes.nbMaxPerMediaLabel')
          }
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={row.nbRenews}
          onChange={(e) => onFieldChange(row.key, { nbRenews: parseInt(e.target.value, 10) || 0 })}
          className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          min={0}
        />
      </td>
      <td className="px-4 py-3 min-w-[200px]">
        <select
          value={row.renewMode}
          onChange={(e) => {
            const v = e.target.value;
            onFieldChange(row.key, { renewMode: v === 'inherit' ? 'inherit' : (v as LoanSettingsRenewAt) });
          }}
          className="max-w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
          aria-label={t('settings.publicTypes.renewAt')}
        >
          <option value="inherit">{t('settings.publicTypes.renewAtInherit')}</option>
          <option value="now">{t('settings.renewAtNow')}</option>
          <option value="at_due_date">{t('settings.renewAtDueDate')}</option>
        </select>
        {row.renewMode === 'inherit' && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('settings.publicTypes.renewAtEffectiveGlobal', { label: inheritedRenewalLabel })}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {showDelete ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onDeleteRow(row)}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title={t('common.delete')}
              aria-label={t('common.delete')}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <span
            className="inline-block text-gray-300 dark:text-gray-600 text-xs tabular-nums"
            title={t('settings.publicTypes.defaultOverrideRowNotDeletable')}
            aria-label={t('settings.publicTypes.defaultOverrideRowNotDeletable')}
          >
            —
          </span>
        )}
      </td>
    </tr>
  );
}

function LoanOverridesForm({
  publicTypeId,
  overrides,
  globalLoanSettings,
  onSaveAll,
  getMediaTypeKey,
}: {
  publicTypeId: string;
  overrides: PublicTypeLoanSettings[];
  globalLoanSettings: LoanSettings[];
  onSaveAll: (id: string, settings: PublicTypeLoanSettingInput[]) => Promise<void>;
  getMediaTypeKey: (mt: MediaType | string) => string;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<OverrideUiRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const overridesSig = useMemo(
    () =>
      JSON.stringify(
        overrides.map((o) => [o.mediaType, o.duration, o.nbMax, o.nbRenews, o.renewAt]),
      ),
    [overrides],
  );

  useEffect(() => {
    setRows(
      overrides.map((o) => ({
        key: o.mediaType == null ? 'row-default' : `row-${o.mediaType}`,
        fromServer: true,
        mediaType: o.mediaType,
        duration: o.duration,
        nbMax: o.nbMax,
        nbRenews: o.nbRenews,
        renewMode: o.renewAt == null ? 'inherit' : o.renewAt,
      })),
    );
  }, [publicTypeId, overridesSig]);

  const sortedRows = useMemo(() => sortOverrideUiRows(rows), [rows]);

  const addFooterDisabled =
    sortedRows.some((r) => r.mediaType === null) &&
    MEDIA_TYPE_VALUES.every((m) => sortedRows.some((r) => r.mediaType === m));

  const handleAddRow = () => {
    const hasDefault = sortedRows.some((r) => r.mediaType === null);
    const used = new Set(
      sortedRows.map((r) => r.mediaType).filter((m): m is MediaType => m != null),
    );
    if (!hasDefault) {
      setRows((rs) => [
        ...rs,
        {
          key: `pending:${crypto.randomUUID()}`,
          fromServer: false,
          mediaType: null,
          duration: 14,
          nbMax: 3,
          nbRenews: 1,
          renewMode: 'inherit',
        },
      ]);
      return;
    }
    const firstUnused = MEDIA_TYPE_VALUES.find((m) => !used.has(m));
    if (firstUnused) {
      setRows((rs) => [
        ...rs,
        {
          key: `pending:${crypto.randomUUID()}`,
          fromServer: false,
          mediaType: firstUnused,
          duration: 14,
          nbMax: 3,
          nbRenews: 1,
          renewMode: 'inherit',
        },
      ]);
    }
  };

  const handleMediaTypeChange = (rowKey: string, rawValue: string) => {
    const nextMt: MediaType | null = rawValue === '' ? null : (rawValue as MediaType);
    let message: string | undefined;
    setRows((prev) => {
      const out = computeRowsAfterMediaTypeChange(prev, rowKey, nextMt, t);
      if (out.error) {
        message = out.error;
        return prev;
      }
      return out.next;
    });
    if (message) setSaveError(message);
    else setSaveError('');
  };

  const handleFieldChange = (key: string, patch: Partial<Omit<OverrideUiRow, 'key' | 'fromServer'>>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const handleDeleteRow = (row: OverrideUiRow) => {
    setRows((rs) => rs.filter((r) => r.key !== row.key));
  };

  const handleSaveAll = async () => {
    setSaveError('');
    const v = validateOverrideRowsForReplace(sortedRows, t);
    if (!v.ok) {
      setSaveError(v.message);
      return;
    }
    setIsSaving(true);
    try {
      await onSaveAll(publicTypeId, v.settings);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.publicTypes.loanOverrides')}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('settings.publicTypes.overrideRenewAtNote')}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('settings.loanLimitsResolutionHint')}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {t('common.type')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {t('settings.durationDays')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {t('settings.maxLoans')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                {t('settings.maxRenewals')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase min-w-[200px]">
                {t('settings.renewAt')}
              </th>
              <th className="px-4 py-3 w-12 text-right" aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('settings.publicTypes.overridesEmptyHint')}
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <PublicTypeLoanOverrideRow
                  key={row.key}
                  row={row}
                  globalLoanSettings={globalLoanSettings}
                  mediaTypeOptions={overrideRowMediaTypeOptions(
                    sortedRows,
                    row.key,
                    t,
                    getMediaTypeKey,
                  )}
                  onFieldChange={handleFieldChange}
                  onMediaTypeChange={handleMediaTypeChange}
                  onDeleteRow={handleDeleteRow}
                />
              ))
            )}
            <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
              <td className="px-4 py-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={handleAddRow}
                  disabled={addFooterDisabled}
                  aria-label={t('settings.publicTypes.addOverride')}
                >
                  {t('common.add')}
                </Button>
              </td>
              <td colSpan={5} className="px-4 py-3" aria-hidden />
            </tr>
          </tbody>
        </table>
      </div>

      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={() => void handleSaveAll()}
          isLoading={isSaving}
          disabled={sortedRows.length === 0}
          leftIcon={<Save className="h-4 w-4" />}
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

function PublicTypeCreateModal({ onSave, onCancel }: { onSave: (data: CreatePublicType) => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    label: '',
    subscriptionDurationDays: '',
    ageMin: '',
    ageMax: '',
    subscriptionPrice: '',
    maxLoans: '',
    loanDurationDays: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.label.trim()) return;
    onSave({
      name: form.name.trim(),
      label: form.label.trim(),
      subscriptionDurationDays: form.subscriptionDurationDays ? Number(form.subscriptionDurationDays) : null,
      ageMin: form.ageMin ? Number(form.ageMin) : null,
      ageMax: form.ageMax ? Number(form.ageMax) : null,
      subscriptionPrice: form.subscriptionPrice ? Math.round(parseFloat(form.subscriptionPrice) * 100) : null,
      maxLoans: form.maxLoans ? Number(form.maxLoans) : null,
      loanDurationDays: form.loanDurationDays ? Number(form.loanDurationDays) : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.publicTypes.add')}</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label={t('settings.publicTypes.name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <Input label={t('settings.publicTypes.label')} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required />
          <Input label={t('settings.publicTypes.subscriptionDurationDays')} type="number" value={form.subscriptionDurationDays} onChange={(e) => setForm((f) => ({ ...f, subscriptionDurationDays: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('settings.publicTypes.ageMin')} type="number" value={form.ageMin} onChange={(e) => setForm((f) => ({ ...f, ageMin: e.target.value }))} />
            <Input label={t('settings.publicTypes.ageMax')} type="number" value={form.ageMax} onChange={(e) => setForm((f) => ({ ...f, ageMax: e.target.value }))} />
          </div>
          <Input label={t('settings.publicTypes.subscriptionPrice')} type="number" step="0.01" min="0" value={form.subscriptionPrice} onChange={(e) => setForm((f) => ({ ...f, subscriptionPrice: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('settings.publicTypes.maxLoans')} type="number" value={form.maxLoans} onChange={(e) => setForm((f) => ({ ...f, maxLoans: e.target.value }))} />
            <Input label={t('settings.publicTypes.loanDurationDays')} type="number" value={form.loanDurationDays} onChange={(e) => setForm((f) => ({ ...f, loanDurationDays: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary">{t('common.create')}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

type SettingsTab =
  | 'library'
  | 'loans'
  | 'server'
  | 'maintenance'
  | 'audit'
  | 'sources'
  | 'publicTypes'
  | 'accountTypes'
  | 'emailTemplates'
  | 'z3950';

const SETTINGS_TAB_IDS: SettingsTab[] = [
  'library',
  'loans',
  'publicTypes',
  'accountTypes',
  'emailTemplates',
  'sources',
  'z3950',
  'server',
  'maintenance',
  'audit',
];

// ─── Settings Page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdminUser = isAdmin(user?.accountType);

  const [activeTab, setActiveTab] = useState<SettingsTab>('loans');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectTab = (id: SettingsTab) => {
    if (!isAdminUser && id !== 'library') return;
    setActiveTab(id);
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('tab', id);
        return n;
      },
      { replace: true }
    );
  };

  useEffect(() => {
    const p = searchParams.get('tab');
    const isValid = p && SETTINGS_TAB_IDS.includes(p as SettingsTab);
    if (isValid) {
      const id = p as SettingsTab;
      if (!isAdminUser && id !== 'library') {
        setActiveTab('library');
      } else {
        setActiveTab(id);
      }
    } else if (!isAdminUser) {
      setActiveTab('library');
    } else if (!p) {
      setActiveTab('loans');
    }
  }, [searchParams, isAdminUser]);

  useEffect(() => {
    if (!isAdminUser) {
      setIsLoading(false);
      return;
    }
    const fetchSettings = async () => {
      try {
        const [loanResult, z3950Result] = await Promise.allSettled([
          api.getLoanSettings(),
          api.getZ3950Servers(),
        ]);

        if (loanResult.status === 'rejected') {
          console.error('Error fetching loan settings:', loanResult.reason);
        }
        if (z3950Result.status === 'rejected') {
          console.error('Error fetching Z39.50 servers:', z3950Result.reason);
        }

        const loanSettings =
          loanResult.status === 'fulfilled' ? loanResult.value.loanSettings ?? [] : [];
        const z3950Servers =
          z3950Result.status === 'fulfilled' ? z3950Result.value ?? [] : [];

        setSettings({ loanSettings, z3950Servers });
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchSettings();
  }, [isAdminUser]);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      if (activeTab === 'loans') {
        const data = await api.updateLoanSettings({ loanSettings: settings.loanSettings ?? [] });
        setSettings((prev) =>
          prev ? { ...prev, loanSettings: data.loanSettings ?? prev.loanSettings ?? [] } : prev
        );
      } else if (activeTab === 'z3950') {
        const z3950Servers = await api.updateZ3950Servers(settings.z3950Servers ?? []);
        setSettings((prev) => (prev ? { ...prev, z3950Servers } : prev));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateLoanSetting = <K extends keyof LoanSettings>(index: number, field: K, value: LoanSettings[K]) => {
    if (!settings) return;
    const newSettings = { ...settings };
    newSettings.loanSettings[index] = {
      ...newSettings.loanSettings[index],
      [field]: value,
    };
    setSettings(newSettings);
  };

  const handleAddLoanSettingsRow = () => {
    if (!settings) return;
    const rows = settings.loanSettings;
    const hasDefault = rows.some((s) => s.mediaType === null);
    const usedConcrete = new Set(
      rows.map((s) => s.mediaType).filter((m): m is MediaType => m != null),
    );
    const firstUnused = MEDIA_TYPE_VALUES.find((m) => !usedConcrete.has(m));
    if (!hasDefault) {
      setSettings({
        ...settings,
        loanSettings: [
          ...rows,
          {
            mediaType: null,
            maxLoans: 5,
            maxRenewals: 2,
            durationDays: 21,
            renewAt: 'now',
          },
        ],
      });
    } else if (firstUnused) {
      setSettings({
        ...settings,
        loanSettings: [
          ...rows,
          {
            mediaType: firstUnused,
            maxLoans: 5,
            maxRenewals: 2,
            durationDays: 21,
            renewAt: 'now',
          },
        ],
      });
    }
  };

  const addLoanSettingsRowDisabled =
    !settings ||
    (settings.loanSettings.some((s) => s.mediaType === null) &&
      MEDIA_TYPE_VALUES.every((m) => settings.loanSettings.some((s) => s.mediaType === m)));

  const updateZ3950Server = (index: number, field: keyof Z3950Server, value: string | number | boolean) => {
    if (!settings) return;
    const newSettings = { ...settings };
    newSettings.z3950Servers[index] = {
      ...newSettings.z3950Servers[index],
      [field]: value,
    };
    setSettings(newSettings);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdminUser && !settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">{t('common.error')}</p>
      </div>
    );
  }

  const allTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'library', label: t('nav.library'), icon: <Library className="h-5 w-5" /> },
    { id: 'loans', label: t('settings.loanSettings'), icon: <BookOpen className="h-5 w-5" /> },
    { id: 'publicTypes', label: t('settings.publicTypes.title'), icon: <Users className="h-5 w-5" /> },
    { id: 'accountTypes', label: t('settings.accountTypes.title'), icon: <Shield className="h-5 w-5" /> },
    { id: 'emailTemplates', label: t('settings.emailTemplates.title'), icon: <Mail className="h-5 w-5" /> },
    { id: 'sources', label: t('settings.sources.title'), icon: <Package className="h-5 w-5" /> },
    { id: 'z3950', label: t('settings.z3950Servers'), icon: <Server className="h-5 w-5" /> },
    { id: 'server', label: t('settings.server.title'), icon: <Cog className="h-5 w-5" /> },
    { id: 'maintenance', label: t('settings.maintenance.title'), icon: <Wrench className="h-5 w-5" /> },
    { id: 'audit', label: t('settings.audit.title'), icon: <ScrollText className="h-5 w-5" /> },
  ];

  const tabs = isAdminUser ? allTabs : allTabs.filter((tab) => tab.id === 'library');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>
        {activeTab === 'z3950' && (
          <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
            {t('common.save')}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex flex-wrap gap-1 sm:gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Library (identity, hours) */}
      {activeTab === 'library' && (
        <Card>
          <CardHeader title={t('library.title')} subtitle={t('library.subtitle')} />
          <div className="px-4 pb-6 sm:px-6">
            <LibrarySettingsPanel />
          </div>
        </Card>
      )}

      {/* Loan settings */}
      {activeTab === 'loans' && settings && (
      <Card>
        <CardHeader
          title={t('settings.loanSettings')}
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={handleSave}
              isLoading={isSaving}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {t('common.save')}
            </Button>
          }
        />
        <p className="px-4 sm:px-6 pb-3 text-sm text-gray-500 dark:text-gray-400">{t('settings.renewAtHelp')}</p>
        <p className="px-4 sm:px-6 pb-3 text-xs text-gray-500 dark:text-gray-400">{t('settings.loanLimitsResolutionHint')}</p>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('common.type')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('settings.durationDays')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('settings.maxLoans')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  {t('settings.maxRenewals')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase min-w-[200px]">
                  {t('settings.renewAt')}
                </th>
                <th className="px-4 py-3 w-12 text-right" aria-label={t('common.actions')} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {settings.loanSettings.map((setting, index) => {
                const defaultTakenElsewhere = settings.loanSettings.some(
                  (s, i) => i !== index && s.mediaType === null,
                );
                return (
                <tr key={`${setting.mediaType ?? 'default'}-${index}`}>
                  <td className="px-4 py-3">
                    {setting.mediaType == null ? (
                      <span className="font-medium text-gray-900 dark:text-gray-100 min-w-[140px] inline-block">
                        {t('settings.mediaTypeDefault')}
                      </span>
                    ) : (
                      <select
                        value={setting.mediaType}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateLoanSetting(
                            index,
                            'mediaType',
                            v === '' ? null : (v as MediaType),
                          );
                        }}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-w-[140px]"
                      >
                        <option value="" disabled={defaultTakenElsewhere}>
                          {t('settings.mediaTypeDefault')}
                        </option>
                        {MEDIA_TYPE_VALUES.map((mt) => (
                          <option key={mt} value={mt}>
                            {t(`items.mediaType.${getMediaTypeTranslationKey(mt)}`)}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={setting.durationDays}
                      onChange={(e) => updateLoanSetting(index, 'durationDays', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      min={1}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={setting.maxLoans}
                      onChange={(e) => updateLoanSetting(index, 'maxLoans', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      min={1}
                      title={
                        setting.mediaType == null
                          ? t('settings.maxLoansDefaultLabel')
                          : t('settings.maxLoansPerMediaLabel')
                      }
                      aria-label={
                        setting.mediaType == null
                          ? t('settings.maxLoansDefaultLabel')
                          : t('settings.maxLoansPerMediaLabel')
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={setting.maxRenewals}
                      onChange={(e) => updateLoanSetting(index, 'maxRenewals', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      min={0}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={setting.renewAt}
                      onChange={(e) =>
                        updateLoanSetting(index, 'renewAt', e.target.value as LoanSettingsRenewAt)
                      }
                      className="max-w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                      aria-label={t('settings.renewAt')}
                    >
                      <option value="now">{t('settings.renewAtNow')}</option>
                      <option value="at_due_date">{t('settings.renewAtDueDate')}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {setting.mediaType != null ? (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSettings({
                              ...settings,
                              loanSettings: settings.loanSettings.filter((_, i) => i !== index),
                            });
                          }}
                          className="p-1 text-gray-400 hover:text-red-600"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span
                        className="inline-block text-gray-300 dark:text-gray-600 text-xs tabular-nums"
                        title={t('settings.defaultLoanRowNotDeletable')}
                        aria-label={t('settings.defaultLoanRowNotDeletable')}
                      >
                        —
                      </span>
                    )}
                  </td>
                </tr>
                );
              })}
              <tr className="border-t border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40">
                <td className="px-4 py-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Plus className="h-4 w-4" />}
                    onClick={handleAddLoanSettingsRow}
                    disabled={addLoanSettingsRowDisabled}
                  >
                    {t('common.add')}
                  </Button>
                </td>
                <td colSpan={5} className="px-4 py-3" aria-hidden />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      )}

      {/* Sources */}
      {activeTab === 'sources' && <SourceEditor />}

      {/* Public types */}
      {activeTab === 'publicTypes' && <PublicTypesEditor />}

      {/* Account types (library roles) */}
      {activeTab === 'accountTypes' && <AccountTypesSettings />}

      {/* Email templates */}
      {activeTab === 'emailTemplates' && <EmailTemplatesSettings />}

      {/* Z39.50 servers */}
      {activeTab === 'z3950' && settings && (
      <Card>
        <CardHeader
          title={t('settings.z3950Servers')}
          action={
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setSettings({
                  ...settings,
                  z3950Servers: [
                    ...settings.z3950Servers,
                    {
                      id: '',
                      name: t('z3950.server'),
                      address: '',
                      port: 210,
                      database: '',
                      format: 'UNIMARC',
                      login: '',
                      password: '',
                      isActive: false,
                    },
                  ],
                });
              }}
            >
              {t('common.add')}
            </Button>
          }
        />
        <div className="space-y-4">
          {settings.z3950Servers.map((server, index) => (
            <div
              key={server.id || `new-${index}`}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <Server className="h-5 w-5 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {server.name || t('z3950.server')}
                  </span>
                  {server.isActive ? (
                    <Badge variant="success">{t('common.active')}</Badge>
                  ) : (
                    <Badge>{t('items.unavailable')}</Badge>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {t('common.active')}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={server.isActive}
                      aria-label={t('common.active')}
                      onClick={() => updateZ3950Server(index, 'isActive', !server.isActive)}
                      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
                        server.isActive
                          ? 'bg-amber-500 dark:bg-amber-600'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none absolute top-1 left-1 block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
                          server.isActive ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('common.delete')}
                    onClick={() => {
                      setSettings({
                        ...settings,
                        z3950Servers: settings.z3950Servers.filter((_, i) => i !== index),
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 transition-opacity ${
                  !server.isActive ? 'opacity-70' : ''
                }`}
              >
                <Input
                  label={t('common.name')}
                  value={server.name}
                  disabled={!server.isActive}
                  onChange={(e) => updateZ3950Server(index, 'name', e.target.value)}
                />
                <Input
                  label={t('z3950.server')}
                  value={server.address}
                  disabled={!server.isActive}
                  onChange={(e) => updateZ3950Server(index, 'address', e.target.value)}
                />
                <Input
                  label="Port"
                  type="number"
                  value={server.port}
                  disabled={!server.isActive}
                  onChange={(e) => updateZ3950Server(index, 'port', parseInt(e.target.value))}
                />
                <Input
                  label="Database"
                  value={server.database || ''}
                  disabled={!server.isActive}
                  onChange={(e) => updateZ3950Server(index, 'database', e.target.value)}
                />
              </div>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 transition-opacity ${
                  !server.isActive ? 'opacity-70' : ''
                }`}
              >
                <Input
                  label={t('z3950.login')}
                  type="text"
                  value={server.login || ''}
                  disabled={!server.isActive}
                  onChange={(e) => updateZ3950Server(index, 'login', e.target.value)}
                />
                <Input
                  label={t('z3950.password')}
                  type="password"
                  value={server.password || ''}
                  disabled={!server.isActive}
                  onChange={(e) => updateZ3950Server(index, 'password', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
      )}

      {activeTab === 'server' && <AdminServerSettings />}

      {activeTab === 'maintenance' && <MaintenanceSettings />}

      {activeTab === 'audit' && <AuditLogViewer />}
    </div>
  );
}

