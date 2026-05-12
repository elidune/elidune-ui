import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useLibrary } from '@/contexts/LibraryContext';
import api from '@/services/api';
import { Button, Input, Card } from '@/components/common';
import { getApiErrorMessage } from '@/utils/apiError';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { libraryName } = useLibrary();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = (searchParams.get('token') ?? '').trim();

  const [tokenPasted, setTokenPasted] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const effectiveToken = tokenFromUrl || tokenPasted.trim();
  const needsTokenField = !tokenFromUrl;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!effectiveToken) {
      setError(t('auth.passwordReset.tokenRequired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('profile.passwordMismatch'));
      return;
    }

    if (newPassword.length < 4) {
      setError(t('profile.passwordTooShort'));
      return;
    }

    setIsLoading(true);
    try {
      await api.resetPasswordFromToken({ token: effectiveToken, newPassword });
      setSuccess(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError(t('auth.passwordReset.invalidOrExpiredToken'));
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.passwordReset.resetTitle')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">{t('auth.passwordReset.resetSubtitle')}</p>
          {libraryName ? (
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">{libraryName}</p>
          ) : null}
        </div>

        {success ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{t('auth.passwordReset.resetSuccess')}</p>
            <Button type="button" variant="primary" className="w-full" size="lg" onClick={() => navigate('/')}>
              {t('auth.passwordReset.signIn')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {needsTokenField ? (
              <>
                <Input
                  label={t('auth.passwordReset.tokenLabel')}
                  type="text"
                  value={tokenPasted}
                  onChange={(e) => setTokenPasted(e.target.value)}
                  required
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('auth.passwordReset.tokenHint')}</p>
              </>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('auth.passwordReset.tokenFromLink')}</p>
            )}

            <Input
              label={t('auth.newPassword')}
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            <Input
              label={t('auth.confirmPassword')}
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {error ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : null}

            <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
              {t('auth.passwordReset.submitNewPassword')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
