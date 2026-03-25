import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLibrary } from '@/contexts/LibraryContext';
import api from '@/services/api';
import { Button, Input, Card } from '@/components/common';

export default function MustChangePasswordPage() {
  const { t } = useTranslation();
  const { mustChangePassword, logout } = useAuth();
  const { libraryName } = useLibrary();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!mustChangePassword || !api.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

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
      await api.changePassword({ newPassword: newPassword });
      logout();
      navigate('/login', { replace: true });
    } catch {
      setError(t('profile.updateError'));
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/50 mb-4">
            <KeyRound className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('auth.mustChangePasswordTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
            {t('auth.mustChangePasswordSubtitle')}
          </p>
          {libraryName && (
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-2">{libraryName}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('auth.newPassword')}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label={t('auth.confirmPassword')}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
          />

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
            {t('auth.mustChangePasswordSubmit')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
