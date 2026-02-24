import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Plus, Trash2, Server, BookOpen, Archive, Pencil, Merge, Package, Check, X, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, Button, Input, Badge } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { Settings, LoanSettings, Z3950Server, MediaType, Source } from '@/types';

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType): string {
  const keyMap: Record<MediaType, string> = {
    'u': 'unknown',
    'b': 'printedText',
    'bc': 'comics',
    'p': 'periodic',
    'v': 'video',
    'vt': 'videoTape',
    'vd': 'videoDvd',
    'a': 'audio',
    'am': 'audioMusic',
    'amt': 'audioMusicTape',
    'amc': 'audioMusicCd',
    'an': 'audioNonMusic',
    'c': 'cdRom',
    'i': 'images',
    'm': 'multimedia',
  };
  return keyMap[mediaType] || 'unknown';
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
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Merge state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

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

  const handleRenameConfirm = async (id: number) => {
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

  const handleArchive = async (source: Source) => {
    clearMessages();
    if (!confirm(t('settings.sources.archiveConfirm', { name: source.name }))) return;
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

  const toggleSelect = (id: number) => {
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

  const activeSources = sources.filter(s => !s.is_archive);
  const archivedSources = sources.filter(s => !!s.is_archive);

  const renderSourceRow = (source: Source) => {
    const isArchived = !!source.is_archive;
    const isRenaming = renamingId === source.id;
    const isSelected = selectedIds.has(source.id);

    return (
      <div
        key={source.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${
          isSelected
            ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
        } ${isArchived ? 'opacity-60' : ''}`}
      >
        {/* Checkbox for merge mode */}
        {mergeMode && !isArchived && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(source.id)}
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
              onClick={() => handleArchive(source)}
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
    </Card>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSettings();
        setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await api.updateSettings(settings);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateLoanSetting = (index: number, field: keyof LoanSettings, value: string | number) => {
    if (!settings) return;
    const newSettings = { ...settings };
    newSettings.loan_settings[index] = {
      ...newSettings.loan_settings[index],
      [field]: value,
    };
    setSettings(newSettings);
  };

  const updateZ3950Server = (index: number, field: keyof Z3950Server, value: string | number | boolean) => {
    if (!settings) return;
    const newSettings = { ...settings };
    newSettings.z3950_servers[index] = {
      ...newSettings.z3950_servers[index],
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

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">{t('common.error')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>
        <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" />}>
          {t('common.save')}
        </Button>
      </div>

      {/* Loan settings */}
      <Card>
        <CardHeader
          title={t('settings.loanSettings')}
        />
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {settings.loan_settings.map((setting, index) => (
                <tr key={setting.media_type}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {t(`items.mediaType.${getMediaTypeTranslationKey(setting.media_type)}`)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={setting.duration_days}
                      onChange={(e) => updateLoanSetting(index, 'duration_days', parseInt(e.target.value))}
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      min={1}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={setting.max_loans}
                      onChange={(e) => updateLoanSetting(index, 'max_loans', parseInt(e.target.value))}
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      min={1}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      value={setting.max_renewals}
                      onChange={(e) => updateLoanSetting(index, 'max_renewals', parseInt(e.target.value))}
                      className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      min={0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Sources */}
      <SourceEditor />

      {/* Z39.50 servers */}
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
                  z3950_servers: [
                    ...settings.z3950_servers,
                    {
                      id: 0,
                      name: t('z3950.server'),
                      address: '',
                      port: 210,
                      database: '',
                      format: 'UNIMARC',
                      login: '',
                      password: '',
                      is_active: false,
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
          {settings.z3950_servers.map((server, index) => (
            <div
              key={server.id || `new-${index}`}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {server.name || t('z3950.server')}
                  </span>
                  {server.is_active ? (
                    <Badge variant="success">{t('common.active')}</Badge>
                  ) : (
                    <Badge>{t('items.unavailable')}</Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSettings({
                      ...settings,
                      z3950_servers: settings.z3950_servers.filter((_, i) => i !== index),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Input
                  label={t('common.name')}
                  value={server.name}
                  onChange={(e) => updateZ3950Server(index, 'name', e.target.value)}
                />
                <Input
                  label={t('z3950.server')}
                  value={server.address}
                  onChange={(e) => updateZ3950Server(index, 'address', e.target.value)}
                />
                <Input
                  label="Port"
                  type="number"
                  value={server.port}
                  onChange={(e) => updateZ3950Server(index, 'port', parseInt(e.target.value))}
                />
                <Input
                  label="Database"
                  value={server.database || ''}
                  onChange={(e) => updateZ3950Server(index, 'database', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <Input
                  label={t('z3950.login')}
                  type="text"
                  value={server.login || ''}
                  onChange={(e) => updateZ3950Server(index, 'login', e.target.value)}
                />
                <Input
                  label={t('z3950.password')}
                  type="password"
                  value={server.password || ''}
                  onChange={(e) => updateZ3950Server(index, 'password', e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  id={`active-${index}`}
                  checked={server.is_active}
                  onChange={(e) => updateZ3950Server(index, 'is_active', e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor={`active-${index}`} className="text-sm text-gray-700 dark:text-gray-300">
                  {t('common.active')}
                </label>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

