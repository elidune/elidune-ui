import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, UserCircle, Mail, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';
import { Card, Button, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { useLibrary } from '@/contexts/LibraryContext';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { FirstSetupRequest, UpdateLibraryInfoRequest, FirstSetupEmailOverride } from '@/types';
import { toServerLanguage, type SupportedLanguage } from '@/locales';

const STEPS = 4;

function hasLibraryIdentity(lib: UpdateLibraryInfoRequest): boolean {
  const name = lib.name?.trim() ?? '';
  const city = lib.addrCity?.trim() ?? '';
  return name.length > 0 || city.length > 0;
}

function smtpPayloadHasValues(e: FirstSetupEmailOverride): boolean {
  return Object.values(e).some((v) => v !== undefined && v !== '' && v !== false);
}

export default function FirstSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { completeFirstSetup } = useAuth();
  const { refreshLibraryInfo } = useLibrary();

  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const [library, setLibrary] = useState<{
    name: string;
    addrLine1: string;
    addrLine2: string;
    addrPostcode: string;
    addrCity: string;
    addrCountry: string;
    email: string;
    phones: string[];
  }>({
    name: '',
    addrLine1: '',
    addrLine2: '',
    addrPostcode: '',
    addrCity: '',
    addrCountry: '',
    email: '',
    phones: [],
  });

  const [admin, setAdmin] = useState({
    login: '',
    password: '',
    password2: '',
    firstname: '',
    lastname: '',
    sex: 'm' as 'm' | 'f',
    birthdate: '',
    email: '',
    uiLanguage: 'fr' as SupportedLanguage,
  });

  const [smtp, setSmtp] = useState<FirstSetupEmailOverride>({
    smtpHost: '',
    smtpPort: undefined,
    smtpUsername: '',
    smtpPassword: '',
    smtpFrom: '',
    smtpFromName: '',
    smtpUseTls: true,
  });

  const libraryPayload = useMemo((): UpdateLibraryInfoRequest => {
    return {
      name: library.name.trim() || null,
      addrLine1: library.addrLine1.trim() || null,
      addrLine2: library.addrLine2.trim() || null,
      addrPostcode: library.addrPostcode.trim() || null,
      addrCity: library.addrCity.trim() || null,
      addrCountry: library.addrCountry.trim() || null,
      email: library.email.trim() || null,
      phones: library.phones.filter((p) => p.trim() !== ''),
    };
  }, [library]);

  const mutation = useMutation({
    mutationFn: (body: FirstSetupRequest) => api.postFirstSetup(body),
    onSuccess: async (response) => {
      await completeFirstSetup(response);
      await refreshLibraryInfo();
      await queryClient.invalidateQueries({ queryKey: ['health'] });
      navigate('/', { replace: true });
    },
  });

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!hasLibraryIdentity(libraryPayload)) {
        return t('firstSetup.validation.libraryIdentity');
      }
    }
    if (s === 2) {
      if (!admin.login.trim()) return t('firstSetup.validation.login');
      if (admin.password.length < 8) return t('firstSetup.validation.passwordMin');
      if (admin.password !== admin.password2) return t('firstSetup.validation.passwordMatch');
      if (!admin.firstname.trim() || !admin.lastname.trim()) {
        return t('firstSetup.validation.name');
      }
      if (!admin.birthdate) return t('firstSetup.validation.birthdate');
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    if (step < STEPS - 1) setStep((x) => x + 1);
  };

  const goBack = () => {
    setLocalError(null);
    if (step > 0) setStep((x) => x - 1);
  };

  const submit = () => {
    const err = validateStep(2);
    if (err) {
      setLocalError(err);
      setStep(2);
      return;
    }
    if (!hasLibraryIdentity(libraryPayload)) {
      setLocalError(t('firstSetup.validation.libraryIdentity'));
      setStep(1);
      return;
    }

    const port =
      smtp.smtpPort !== undefined && Number.isFinite(smtp.smtpPort)
        ? smtp.smtpPort
        : undefined;

    const emailPart: FirstSetupEmailOverride | undefined = smtpPayloadHasValues(smtp)
      ? {
          smtpHost: smtp.smtpHost || undefined,
          smtpPort: port,
          smtpUsername: smtp.smtpUsername || undefined,
          smtpPassword: smtp.smtpPassword || undefined,
          smtpFrom: smtp.smtpFrom || undefined,
          smtpFromName: smtp.smtpFromName || undefined,
          smtpUseTls: smtp.smtpUseTls,
        }
      : undefined;

    const body: FirstSetupRequest = {
      admin: {
        login: admin.login.trim(),
        password: admin.password,
        firstname: admin.firstname.trim(),
        lastname: admin.lastname.trim(),
        sex: admin.sex,
        birthdate: admin.birthdate,
        email: admin.email.trim() || undefined,
        language: toServerLanguage(admin.uiLanguage),
      },
      library: libraryPayload,
      email: emailPart,
    };

    setLocalError(null);
    mutation.mutate(body);
  };

  const apiErr = mutation.error ? getApiErrorMessage(mutation.error, t) : null;

  const stepIcons = [Sparkles, Building2, UserCircle, Mail];
  const StepIcon = stepIcons[step] ?? Sparkles;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        <Card className="shadow-xl border border-gray-200/80 dark:border-gray-700/80">
          <div className="flex items-start gap-3 mb-6">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
              <StepIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t(`firstSetup.steps.${step}.title`)}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t(`firstSetup.steps.${step}.description`)}
              </p>
            </div>
          </div>

          {step === 0 && (
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
              {t('firstSetup.welcomeBody')}
            </p>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 rounded-lg px-3 py-2">
                {t('firstSetup.libraryHint')}
              </p>
              <Field
                label={t('firstSetup.fields.libraryName')}
                value={library.name}
                onChange={(v) => setLibrary((s) => ({ ...s, name: v }))}
              />
              <Field
                label={t('firstSetup.fields.addrCity')}
                value={library.addrCity}
                onChange={(v) => setLibrary((s) => ({ ...s, addrCity: v }))}
              />
              <Field
                label={t('firstSetup.fields.addrLine1')}
                value={library.addrLine1}
                onChange={(v) => setLibrary((s) => ({ ...s, addrLine1: v }))}
              />
              <Field
                label={t('firstSetup.fields.addrLine2')}
                value={library.addrLine2}
                onChange={(v) => setLibrary((s) => ({ ...s, addrLine2: v }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('firstSetup.fields.addrPostcode')}
                  value={library.addrPostcode}
                  onChange={(v) => setLibrary((s) => ({ ...s, addrPostcode: v }))}
                />
                <Field
                  label={t('firstSetup.fields.addrCountry')}
                  value={library.addrCountry}
                  onChange={(v) => setLibrary((s) => ({ ...s, addrCountry: v }))}
                />
              </div>
              <Field
                label={t('firstSetup.fields.libraryEmail')}
                type="email"
                value={library.email}
                onChange={(v) => setLibrary((s) => ({ ...s, email: v }))}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('firstSetup.fields.firstname')}
                  value={admin.firstname}
                  onChange={(v) => setAdmin((s) => ({ ...s, firstname: v }))}
                  autoComplete="given-name"
                />
                <Field
                  label={t('firstSetup.fields.lastname')}
                  value={admin.lastname}
                  onChange={(v) => setAdmin((s) => ({ ...s, lastname: v }))}
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('firstSetup.fields.sex')}
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={admin.sex}
                  onChange={(e) =>
                    setAdmin((s) => ({ ...s, sex: e.target.value as 'm' | 'f' }))
                  }
                >
                  <option value="m">{t('firstSetup.sex.m')}</option>
                  <option value="f">{t('firstSetup.sex.f')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('firstSetup.fields.birthdate')}
                </label>
                <Input
                  type="date"
                  value={admin.birthdate}
                  onChange={(e) => setAdmin((s) => ({ ...s, birthdate: e.target.value }))}
                />
              </div>
              <Field
                label={t('firstSetup.fields.login')}
                value={admin.login}
                onChange={(v) => setAdmin((s) => ({ ...s, login: v }))}
                autoComplete="username"
              />
              <Field
                label={t('firstSetup.fields.password')}
                type="password"
                value={admin.password}
                onChange={(v) => setAdmin((s) => ({ ...s, password: v }))}
                autoComplete="new-password"
              />
              <Field
                label={t('firstSetup.fields.password2')}
                type="password"
                value={admin.password2}
                onChange={(v) => setAdmin((s) => ({ ...s, password2: v }))}
                autoComplete="new-password"
              />
              <Field
                label={t('firstSetup.fields.adminEmail')}
                type="email"
                value={admin.email}
                onChange={(v) => setAdmin((s) => ({ ...s, email: v }))}
                autoComplete="email"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('firstSetup.fields.uiLanguage')}
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={admin.uiLanguage}
                  onChange={(e) =>
                    setAdmin((s) => ({ ...s, uiLanguage: e.target.value as SupportedLanguage }))
                  }
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('firstSetup.smtpIntro')}</p>
              <Field
                label={t('firstSetup.fields.smtpHost')}
                value={smtp.smtpHost ?? ''}
                onChange={(v) => setSmtp((s) => ({ ...s, smtpHost: v }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={t('firstSetup.fields.smtpPort')}
                  value={smtp.smtpPort != null ? String(smtp.smtpPort) : ''}
                  onChange={(v) =>
                    setSmtp((s) => ({
                      ...s,
                      smtpPort: v ? parseInt(v, 10) : undefined,
                    }))
                  }
                />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(smtp.smtpUseTls)}
                      onChange={(e) => setSmtp((s) => ({ ...s, smtpUseTls: e.target.checked }))}
                    />
                    {t('firstSetup.fields.smtpUseTls')}
                  </label>
                </div>
              </div>
              <Field
                label={t('firstSetup.fields.smtpUsername')}
                value={smtp.smtpUsername ?? ''}
                onChange={(v) => setSmtp((s) => ({ ...s, smtpUsername: v }))}
              />
              <Field
                label={t('firstSetup.fields.smtpPassword')}
                type="password"
                value={smtp.smtpPassword ?? ''}
                onChange={(v) => setSmtp((s) => ({ ...s, smtpPassword: v }))}
              />
              <Field
                label={t('firstSetup.fields.smtpFrom')}
                value={smtp.smtpFrom ?? ''}
                onChange={(v) => setSmtp((s) => ({ ...s, smtpFrom: v }))}
              />
              <Field
                label={t('firstSetup.fields.smtpFromName')}
                value={smtp.smtpFromName ?? ''}
                onChange={(v) => setSmtp((s) => ({ ...s, smtpFromName: v }))}
              />
            </div>
          )}

          {(localError || apiErr) && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {localError || apiErr}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={goBack}
              disabled={step === 0 || mutation.isPending}
              className="inline-flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.previous')}
            </Button>

            {step < STEPS - 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1"
              >
                {t('common.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1"
              >
                {mutation.isPending ? t('common.loading') : t('firstSetup.finish')}
              </Button>
            )}
          </div>
        </Card>

        <p className="text-center text-xs text-gray-500 dark:text-gray-500 mt-6">
          Elidune — {t('firstSetup.footer')}
        </p>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  const { label, value, onChange, type = 'text', autoComplete } = props;
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
    </div>
  );
}
