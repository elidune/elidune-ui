import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, RotateCcw, Save, Send, AlertTriangle, Check, X } from 'lucide-react';
import { Card, CardHeader, Button, Input, Badge, ConfirmDialog } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { AdminConfigSectionKey, ConfigSectionInfo } from '@/types';

function SectionCard({
  title,
  children,
  overridden,
  overridable,
}: {
  title: string;
  children: React.ReactNode;
  overridden: boolean;
  overridable: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <div className="flex items-center gap-2">
          {overridden ? (
            <Badge variant="default">{t('settings.server.overridden')}</Badge>
          ) : (
            <Badge variant="success">{t('settings.server.fileDefault')}</Badge>
          )}
          {!overridable && <span className="text-xs text-gray-500">{t('settings.server.notOverridable')}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

function pickSection(sections: ConfigSectionInfo[], key: AdminConfigSectionKey): ConfigSectionInfo | undefined {
  return sections.find((s) => s.key === key);
}

export default function AdminServerSettings() {
  const { t } = useTranslation();
  const [sections, setSections] = useState<ConfigSectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<AdminConfigSectionKey | null>(null);
  const [testTo, setTestTo] = useState('');
  const [resetSectionKey, setResetSectionKey] = useState<AdminConfigSectionKey | null>(null);
  const [testing, setTesting] = useState(false);

  const [emailValue, setEmailValue] = useState<Record<string, unknown>>({});
  const [smtpPasswordRedacted, setSmtpPasswordRedacted] = useState(false);
  const [loggingValue, setLoggingValue] = useState<Record<string, unknown>>({});
  const [remindersValue, setRemindersValue] = useState<Record<string, unknown>>({});
  const [auditValue, setAuditValue] = useState<Record<string, unknown>>({});
  const [holdsValue, setHoldsValue] = useState<Record<string, unknown>>({});

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const showOk = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const syncFormFromSection = useCallback((key: AdminConfigSectionKey, value: unknown) => {
    const o = (value as Record<string, unknown>) ?? {};
    switch (key) {
      case 'email': {
        const redacted = o.smtp_password === '[redacted]';
        const em = { ...o };
        if (redacted) delete em.smtp_password;
        setEmailValue(em);
        setSmtpPasswordRedacted(redacted);
        break;
      }
      case 'logging':
        setLoggingValue({ ...o });
        break;
      case 'reminders':
        setRemindersValue({ ...o });
        break;
      case 'audit':
        setAuditValue({ ...o });
        break;
      case 'holds':
        setHoldsValue({ ...o });
        break;
      default:
        break;
    }
  }, []);

  const applySectionsToForms = useCallback(
    (list: ConfigSectionInfo[]) => {
      for (const key of ['email', 'logging', 'reminders', 'audit', 'holds'] as const) {
        const v = pickSection(list, key)?.value;
        if (v !== undefined) syncFormFromSection(key, v);
      }
    },
    [syncFormFromSection]
  );

  const load = useCallback(async () => {
    setLoading(true);
    clearMessages();
    try {
      const data = await api.getAdminConfig();
      setSections(data.sections);
      applySectionsToForms(data.sections);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.server.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, applySectionsToForms]);

  useEffect(() => {
    void load();
  }, [load]);

  const getMeta = (key: AdminConfigSectionKey) =>
    pickSection(sections, key) ?? {
      key,
      value: {},
      overridden: false,
      overridable: true,
    };

  const saveSection = async (key: AdminConfigSectionKey, value: Record<string, unknown>) => {
    clearMessages();
    setSavingKey(key);
    try {
      const updated = await api.putAdminConfigSection(key, value);
      setSections((prev) => {
        const rest = prev.filter((s) => s.key !== key);
        return [...rest, updated].sort((a, b) => a.key.localeCompare(b.key));
      });
      syncFormFromSection(key, updated.value);
      showOk(t('settings.server.saveSuccess', { section: key }));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.server.saveError'));
    } finally {
      setSavingKey(null);
    }
  };

  const saveEmail = () => {
    const payload: Record<string, unknown> = { ...emailValue };
    const pwd = payload.smtp_password;
    if (pwd === '[redacted]' || pwd === '') {
      delete payload.smtp_password;
    }
    if (smtpPasswordRedacted && (pwd === undefined || pwd === '' || pwd === '[redacted]')) {
      setError(t('settings.server.smtpPasswordRequired'));
      return;
    }
    void saveSection('email', payload);
  };

  const performResetSection = async (key: AdminConfigSectionKey) => {
    clearMessages();
    setSavingKey(key);
    try {
      const updated = await api.deleteAdminConfigSection(key);
      setSections((prev) => {
        const rest = prev.filter((s) => s.key !== key);
        return [...rest, updated].sort((a, b) => a.key.localeCompare(b.key));
      });
      syncFormFromSection(key, updated.value);
      showOk(t('settings.server.resetSuccess', { section: key }));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.server.resetError'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleTestEmail = async () => {
    const to = testTo.trim();
    if (!to) return;
    clearMessages();
    setTesting(true);
    try {
      await api.postAdminEmailTest(to);
      showOk(t('settings.server.testEmailSuccess'));
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('settings.server.testEmailError'));
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader title={t('settings.server.title')} />
        <div className="flex items-center justify-center h-24">
          <div className="h-6 w-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  const emailMeta = getMeta('email');
  const loggingMeta = getMeta('logging');
  const remindersMeta = getMeta('reminders');
  const auditMeta = getMeta('audit');
  const holdsMeta = getMeta('holds');

  const str = (v: unknown) => (v == null ? '' : String(v));
  const num = (v: unknown, d: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

  return (
    <Card>
      <CardHeader title={t('settings.server.title')} subtitle={t('settings.server.subtitle')} />
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
        <SectionCard
          title={t('settings.server.sections.email')}
          overridden={emailMeta.overridden}
          overridable={emailMeta.overridable}
        >
          {smtpPasswordRedacted && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
              {t('settings.server.smtpRedactedHint')}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('settings.server.smtpHost')}
              value={str(emailValue.smtp_host)}
              onChange={(e) => setEmailValue((v) => ({ ...v, smtp_host: e.target.value }))}
              disabled={!emailMeta.overridable}
            />
            <Input
              label={t('settings.server.smtpPort')}
              type="number"
              value={str(emailValue.smtp_port)}
              onChange={(e) =>
                setEmailValue((v) => ({ ...v, smtp_port: parseInt(e.target.value, 10) || 0 }))
              }
              disabled={!emailMeta.overridable}
            />
            <Input
              label={t('settings.server.smtpFrom')}
              value={str(emailValue.smtp_from)}
              onChange={(e) => setEmailValue((v) => ({ ...v, smtp_from: e.target.value }))}
              disabled={!emailMeta.overridable}
            />
            <Input
              label={t('settings.server.smtpFromName')}
              value={str(emailValue.smtp_from_name)}
              onChange={(e) => setEmailValue((v) => ({ ...v, smtp_from_name: e.target.value }))}
              disabled={!emailMeta.overridable}
            />
            <Input
              label={t('settings.server.smtpUsername')}
              value={str(emailValue.smtp_username)}
              onChange={(e) => setEmailValue((v) => ({ ...v, smtp_username: e.target.value }))}
              disabled={!emailMeta.overridable}
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.server.smtpPassword')}
              </label>
              <input
                type="password"
                value={str(emailValue.smtp_password)}
                onChange={(e) =>
                  setEmailValue((v) => ({ ...v, smtp_password: e.target.value || undefined }))
                }
                placeholder={smtpPasswordRedacted ? '••••••••' : ''}
                disabled={!emailMeta.overridable}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={bool(emailValue.smtp_use_tls, true)}
                onChange={(e) => setEmailValue((v) => ({ ...v, smtp_use_tls: e.target.checked }))}
                disabled={!emailMeta.overridable}
                className="rounded border-gray-300 dark:border-gray-700 text-indigo-600"
              />
              {t('settings.server.smtpUseTls')}
            </label>
            <div className="sm:col-span-2">
              <Input
                label={t('settings.server.templatesDir')}
                value={str(emailValue.templates_dir)}
                onChange={(e) => setEmailValue((v) => ({ ...v, templates_dir: e.target.value }))}
                disabled={!emailMeta.overridable}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={savingKey === 'email'}
              disabled={!emailMeta.overridable}
              onClick={saveEmail}
            >
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              isLoading={savingKey === 'email'}
              disabled={!emailMeta.overridden || !emailMeta.overridable}
              onClick={() => setResetSectionKey('email')}
            >
              {t('settings.server.resetToFile')}
            </Button>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {t('settings.server.testEmail')}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px]">
                <Input
                  label={t('settings.server.testEmailTo')}
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="test@example.com"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<Send className="h-4 w-4" />}
                isLoading={testing}
                onClick={() => void handleTestEmail()}
                disabled={!testTo.trim()}
              >
                {t('settings.server.sendTest')}
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title={t('settings.server.sections.logging')}
          overridden={loggingMeta.overridden}
          overridable={loggingMeta.overridable}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.server.logLevel')}
              </label>
              <select
                value={str(loggingValue.level) || 'info'}
                onChange={(e) => setLoggingValue((v) => ({ ...v, level: e.target.value }))}
                disabled={!loggingMeta.overridable}
                className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              >
                {['trace', 'debug', 'info', 'warn', 'error'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.server.logFormat')}
              </label>
              <select
                value={str(loggingValue.format) || 'pretty'}
                onChange={(e) => setLoggingValue((v) => ({ ...v, format: e.target.value }))}
                disabled={!loggingMeta.overridable}
                className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              >
                {['pretty', 'plain', 'json'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t('settings.server.logOutput')}
              </label>
              <select
                value={str(loggingValue.output) || 'stdout'}
                onChange={(e) => setLoggingValue((v) => ({ ...v, output: e.target.value }))}
                disabled={!loggingMeta.overridable}
                className="px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              >
                {['stdout', 'stderr', 'file', 'syslog'].map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('settings.server.logFilePath')}
              value={str(loggingValue.file_path)}
              onChange={(e) => setLoggingValue((v) => ({ ...v, file_path: e.target.value || null }))}
              disabled={!loggingMeta.overridable}
            />
            <Input
              label={t('settings.server.logFileRotation')}
              value={str(loggingValue.file_rotation)}
              onChange={(e) => setLoggingValue((v) => ({ ...v, file_rotation: e.target.value || null }))}
              disabled={!loggingMeta.overridable}
              placeholder="daily"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={savingKey === 'logging'}
              disabled={!loggingMeta.overridable}
              onClick={() => void saveSection('logging', { ...loggingValue })}
            >
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              isLoading={savingKey === 'logging'}
              disabled={!loggingMeta.overridden || !loggingMeta.overridable}
              onClick={() => setResetSectionKey('logging')}
            >
              {t('settings.server.resetToFile')}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={t('settings.server.sections.reminders')}
          overridden={remindersMeta.overridden}
          overridable={remindersMeta.overridable}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={bool(remindersValue.enabled, true)}
                onChange={(e) => setRemindersValue((v) => ({ ...v, enabled: e.target.checked }))}
                disabled={!remindersMeta.overridable}
                className="rounded border-gray-300 dark:border-gray-700 text-indigo-600"
              />
              {t('settings.server.remindersEnabled')}
            </label>
            <Input
              label={t('settings.server.frequencyDays')}
              type="number"
              min={1}
              value={str(num(remindersValue.frequency_days, 7))}
              onChange={(e) =>
                setRemindersValue((v) => ({
                  ...v,
                  frequency_days: parseInt(e.target.value, 10) || 1,
                }))
              }
              disabled={!remindersMeta.overridable}
            />
            <Input
              label={t('settings.server.sendTime')}
              value={str(remindersValue.send_time) || '09:00'}
              onChange={(e) => setRemindersValue((v) => ({ ...v, send_time: e.target.value }))}
              placeholder="HH:MM"
              disabled={!remindersMeta.overridable}
            />
            <Input
              label={t('settings.server.smtpThrottleMs')}
              type="number"
              min={0}
              value={str(num(remindersValue.smtp_throttle_ms as number, 100))}
              onChange={(e) =>
                setRemindersValue((v) => ({
                  ...v,
                  smtp_throttle_ms: parseInt(e.target.value, 10) || 0,
                }))
              }
              disabled={!remindersMeta.overridable}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={savingKey === 'reminders'}
              disabled={!remindersMeta.overridable}
              onClick={() => void saveSection('reminders', { ...remindersValue })}
            >
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              isLoading={savingKey === 'reminders'}
              disabled={!remindersMeta.overridden || !remindersMeta.overridable}
              onClick={() => setResetSectionKey('reminders')}
            >
              {t('settings.server.resetToFile')}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={t('settings.server.sections.audit')}
          overridden={auditMeta.overridden}
          overridable={auditMeta.overridable}
        >
          <Input
            label={t('settings.server.retentionDays')}
            type="number"
            min={1}
            value={str(num(auditValue.retention_days as number, 365))}
            onChange={(e) =>
              setAuditValue((v) => ({
                ...v,
                retention_days: parseInt(e.target.value, 10) || 1,
              }))
            }
            disabled={!auditMeta.overridable}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={savingKey === 'audit'}
              disabled={!auditMeta.overridable}
              onClick={() => void saveSection('audit', { ...auditValue })}
            >
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              isLoading={savingKey === 'audit'}
              disabled={!auditMeta.overridden || !auditMeta.overridable}
              onClick={() => setResetSectionKey('audit')}
            >
              {t('settings.server.resetToFile')}
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title={t('settings.server.sections.holds')}
          overridden={holdsMeta.overridden}
          overridable={holdsMeta.overridable}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t('settings.server.readyExpiryDays')}
              type="number"
              min={1}
              value={str(num(holdsValue.ready_expiry_days as number, 14))}
              onChange={(e) =>
                setHoldsValue((v) => ({
                  ...v,
                  ready_expiry_days: parseInt(e.target.value, 10) || 1,
                }))
              }
              disabled={!holdsMeta.overridable}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={bool(holdsValue.overridable, true)}
                onChange={(e) =>
                  setHoldsValue((v) => ({ ...v, overridable: e.target.checked }))
                }
                disabled={!holdsMeta.overridable}
                className="rounded border-gray-300 dark:border-gray-700 text-indigo-600"
              />
              {t('settings.server.holdsOverridable')}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Save className="h-4 w-4" />}
              isLoading={savingKey === 'holds'}
              disabled={!holdsMeta.overridable}
              onClick={() =>
                void saveSection('holds', {
                  ready_expiry_days: num(holdsValue.ready_expiry_days as number, 14),
                  overridable: bool(holdsValue.overridable, true),
                })
              }
            >
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<RotateCcw className="h-4 w-4" />}
              isLoading={savingKey === 'holds'}
              disabled={!holdsMeta.overridden || !holdsMeta.overridable}
              onClick={() => setResetSectionKey('holds')}
            >
              {t('settings.server.resetToFile')}
            </Button>
          </div>
        </SectionCard>
      </div>

      <ConfirmDialog
        isOpen={resetSectionKey !== null}
        onClose={() => setResetSectionKey(null)}
        onConfirm={() => {
          const key = resetSectionKey;
          setResetSectionKey(null);
          if (key) void performResetSection(key);
        }}
        message={
          resetSectionKey
            ? t('settings.server.resetConfirm', { section: resetSectionKey })
            : ''
        }
        confirmVariant="danger"
      />
    </Card>
  );
}
