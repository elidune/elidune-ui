import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { useLibrary } from '@/contexts/LibraryContext';
import api from '@/services/api';
import { Button, Input, Card } from '@/components/common';
import { getApiErrorMessage } from '@/utils/apiError';
import { buildPublicPasswordResetTemplateUrl } from '@/utils/buildPasswordResetUrl';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { libraryName } = useLibrary();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError(t('auth.passwordReset.identifierRequired'));
      return;
    }

    setIsLoading(true);
    try {
      await api.requestPasswordReset({
        identifier: trimmed,
        resetUrl: buildPublicPasswordResetTemplateUrl(),
      });
      setSubmitted(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setSubmitted(true);
      } else {
        setError(getApiErrorMessage(err, t));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-200 dark:bg-amber-900/30 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-200 dark:bg-gray-800/30 rounded-full blur-3xl opacity-50" />
      </div>

      <Card className="w-full max-w-md relative">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('auth.2fa.backToLogin')}
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/50 mb-4">
            <KeyRound className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.passwordReset.forgotTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t('auth.passwordReset.forgotSubtitle')}</p>
          {libraryName ? (
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">{libraryName}</p>
          ) : null}
        </div>

        {submitted ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{t('auth.passwordReset.requestSuccess')}</p>
            <Button type="button" variant="primary" className="w-full" size="lg" onClick={() => navigate('/')}>
              {t('auth.passwordReset.signIn')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.passwordReset.identifierLabel')}
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
            {error ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : null}
            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              {t('auth.passwordReset.submitRequest')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
