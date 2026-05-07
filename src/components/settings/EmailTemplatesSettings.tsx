import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Save } from 'lucide-react';
import { Card, CardHeader, Button, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { canManageSettings } from '@/types';
import type { EmailTemplateListItem, UpdateEmailTemplateRequest } from '@/types';
import {
  EMAIL_TEMPLATE_VARIABLES,
  EMAIL_TEMPLATES_LIST_QUERY_KEY,
  emailTemplateDetailQueryKey,
} from '@/utils/emailTemplatesConstants';

export default function EmailTemplatesSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = canManageSettings(user?.accountType);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyPlain, setBodyPlain] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: list = [],
    isLoading: listLoading,
    isError: listError,
  } = useQuery({
    queryKey: EMAIL_TEMPLATES_LIST_QUERY_KEY,
    queryFn: () => api.getEmailTemplates(),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, EmailTemplateListItem[]>();
    for (const row of list) {
      const arr = m.get(row.templateId) ?? [];
      arr.push(row);
      m.set(row.templateId, arr);
    }
    return m;
  }, [list]);

  const templateIds = useMemo(() => [...grouped.keys()].sort((a, b) => a.localeCompare(b)), [grouped]);

  const languagesForTemplate = useCallback(
    (tid: string): string[] => {
      const langs = [...new Set((grouped.get(tid) ?? []).map((r) => r.language))];
      return langs.sort((a, b) => {
        const order = (lang: string) => (lang === 'french' ? 0 : lang === 'english' ? 1 : 2);
        return order(a) - order(b);
      });
    },
    [grouped]
  );

  useEffect(() => {
    if (!list.length || selectedTemplateId) return;
    const t0 = templateIds[0];
    if (!t0) return;
    setSelectedTemplateId(t0);
    const langs = languagesForTemplate(t0);
    setSelectedLanguage(langs[0] ?? 'english');
  }, [list, list.length, selectedTemplateId, templateIds, languagesForTemplate]);

  const { data: detail, isLoading: detailLoading, isFetching: detailFetching } = useQuery({
    queryKey:
      selectedTemplateId && selectedLanguage
        ? emailTemplateDetailQueryKey(selectedTemplateId, selectedLanguage)
        : ['settings', 'email-template', 'idle'],
    queryFn: () => api.getEmailTemplate(selectedTemplateId!, selectedLanguage!),
    enabled: !!selectedTemplateId && !!selectedLanguage,
  });

  useEffect(() => {
    if (!detail) return;
    setSubject(detail.subject ?? '');
    setBodyPlain(detail.bodyPlain ?? '');
    setBodyHtml(detail.bodyHtml ?? '');
    setSaveError(null);
  }, [detail]);

  const pickTemplate = (tid: string) => {
    setSelectedTemplateId(tid);
    const langs = languagesForTemplate(tid);
    setSelectedLanguage(langs[0] ?? 'english');
  };

  const dirty = useMemo(() => {
    if (!detail) return false;
    const htmlDraft = bodyHtml.trim() === '' ? null : bodyHtml;
    const htmlOrig = detail.bodyHtml ?? null;
    return (
      subject !== (detail.subject ?? '') ||
      bodyPlain !== (detail.bodyPlain ?? '') ||
      htmlDraft !== htmlOrig
    );
  }, [detail, subject, bodyPlain, bodyHtml]);

  const handleSave = async () => {
    if (!selectedTemplateId || !selectedLanguage || !canEdit) return;
    const payload: UpdateEmailTemplateRequest = {
      subject,
      bodyPlain,
      bodyHtml: bodyHtml.trim() === '' ? null : bodyHtml,
    };
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await api.updateEmailTemplate(selectedTemplateId, selectedLanguage, payload);
      await queryClient.invalidateQueries({ queryKey: EMAIL_TEMPLATES_LIST_QUERY_KEY });
      queryClient.setQueryData(emailTemplateDetailQueryKey(selectedTemplateId, selectedLanguage), updated);
    } catch (err) {
      setSaveError(getApiErrorMessage(err, t));
    } finally {
      setIsSaving(false);
    }
  };

  const varsHelp = selectedTemplateId ? EMAIL_TEMPLATE_VARIABLES[selectedTemplateId] : undefined;

  const langLabel = (lang: string) =>
    lang === 'french' ? t('settings.emailTemplates.langFrench') : t('settings.emailTemplates.langEnglish');

  if (listLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (listError) {
    return (
      <Card>
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('settings.emailTemplates.errorLoad')}</p>
      </Card>
    );
  }

  if (!list.length) {
    return (
      <Card>
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('settings.emailTemplates.empty')}</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,15rem)_1fr] gap-4">
      <Card className="lg:sticky lg:top-4 lg:self-start">
        <CardHeader title={t('settings.emailTemplates.templates')} />
        <nav className="px-3 pb-3 space-y-0.5" aria-label={t('settings.emailTemplates.title')}>
          {templateIds.map((tid) => (
            <button
              key={tid}
              type="button"
              onClick={() => pickTemplate(tid)}
              className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedTemplateId === tid
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <span className="font-mono text-xs break-all">{tid}</span>
            </button>
          ))}
        </nav>
      </Card>

      <Card>
        <CardHeader
          title={t('settings.emailTemplates.editorTitle')}
          action={
            canEdit ? (
              <Button
                type="button"
                size="sm"
                leftIcon={<Save className="h-4 w-4" />}
                isLoading={isSaving}
                disabled={!dirty || detailLoading}
                onClick={() => void handleSave()}
              >
                {t('common.save')}
              </Button>
            ) : null
          }
        />

        {!canEdit ? (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4 mx-4">
            {t('settings.emailTemplates.readOnlyHint')}
          </p>
        ) : null}

        {selectedTemplateId ? (
          <div className="px-4 pb-2 flex flex-wrap gap-1 border-b border-gray-100 dark:border-gray-800">
            {languagesForTemplate(selectedTemplateId).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setSelectedLanguage(lang)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedLanguage === lang
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {langLabel(lang)}
              </button>
            ))}
          </div>
        ) : null}

        <div className="p-4 space-y-4">
          {(detailLoading || detailFetching) && !detail ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : detail ? (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/80 dark:bg-blue-950/30 px-3 py-2.5 text-sm text-blue-900 dark:text-blue-100">
                <Info className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                <div className="space-y-2 min-w-0">
                  <p>{t('settings.emailTemplates.placeholdersIntro')}</p>
                  {varsHelp?.length ? (
                    <p className="font-mono text-xs break-all">
                      {varsHelp.map((v) => `{{${v}}}`).join(' · ')}
                    </p>
                  ) : (
                    <p className="text-blue-800/90 dark:text-blue-200/90">{t('settings.emailTemplates.placeholdersGeneric')}</p>
                  )}
                  <p className="text-xs text-blue-800/80 dark:text-blue-200/80">{t('settings.emailTemplates.htmlTrustedWarning')}</p>
                </div>
              </div>

              <Input
                label={t('settings.emailTemplates.subject')}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={!canEdit}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('settings.emailTemplates.bodyPlain')}
                </label>
                <textarea
                  value={bodyPlain}
                  onChange={(e) => setBodyPlain(e.target.value)}
                  disabled={!canEdit}
                  rows={10}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm resize-y min-h-[8rem] disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('settings.emailTemplates.bodyHtml')}
                </label>
                <textarea
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  disabled={!canEdit}
                  rows={12}
                  placeholder={t('settings.emailTemplates.bodyHtmlPlaceholder')}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm resize-y min-h-[8rem] disabled:opacity-60"
                />
              </div>

              {detail.updatedAt ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('settings.emailTemplates.updatedAt')}{' '}
                  {new Date(detail.updatedAt).toLocaleString()}
                </p>
              ) : null}

              {saveError ? (
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {saveError}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
