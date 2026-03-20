import { useState, useRef, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, Shield, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { Button, Input, Card } from '@/components/common';

function TwoFactorVerification() {
  const { t } = useTranslation();
  const { pending2FA, verify2FA, verifyRecovery, cancel2FA } = useAuth();
  const navigate = useNavigate();
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i];
    }
    setCode(newCode);
    // Focus the input after the last pasted digit
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (useRecoveryCode) {
        await verifyRecovery(recoveryCode.trim());
      } else {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
          setError(t('auth.2fa.invalidCode'));
          setIsLoading(false);
          return;
        }
        await verify2FA(fullCode, trustDevice);
      }
      navigate('/');
    } catch {
      setError(t('auth.2fa.invalidCode'));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const methodLabel = pending2FA?.method === 'email' 
    ? t('auth.2fa.emailMethod') 
    : t('auth.2fa.totpMethod');

  return (
    <Card className="w-full max-w-md relative">
      <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/50 mb-4">
          <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('auth.2fa.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {useRecoveryCode ? t('auth.2fa.recoverySubtitle') : methodLabel}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {useRecoveryCode ? (
          <Input
            label={t('auth.2fa.recoveryCode')}
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder={t('auth.2fa.recoveryPlaceholder')}
            leftIcon={<KeyRound className="h-4 w-4" />}
            autoFocus
          />
        ) : (
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-mono font-bold
                  border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                  focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20
                  transition-colors"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!useRecoveryCode && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 dark:focus:ring-amber-500 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t('auth.2fa.trustDevice')}
            </span>
          </label>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          isLoading={isLoading}
          disabled={useRecoveryCode ? !recoveryCode.trim() : code.some(d => !d)}
        >
          {t('auth.2fa.verify')}
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => {
            setUseRecoveryCode(!useRecoveryCode);
            setError('');
            setCode(['', '', '', '', '', '']);
            setRecoveryCode('');
            setTrustDevice(false);
          }}
          className="w-full text-sm text-amber-600 dark:text-amber-400 hover:underline"
        >
          {useRecoveryCode ? t('auth.2fa.useCode') : t('auth.2fa.useRecovery')}
        </button>
        
        <button
          type="button"
          onClick={cancel2FA}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('auth.2fa.backToLogin')}
        </button>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated, pending2FA } = useAuth();
  const { libraryName } = useLibrary();
  const navigate = useNavigate();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { requires2FA } = await login({ username, password });
      if (!requires2FA) {
        navigate('/');
      }
      // If requires2FA, the pending2FA state will trigger showing TwoFactorVerification
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-200 dark:bg-amber-900/30 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-200 dark:bg-gray-800/30 rounded-full blur-3xl opacity-50" />
      </div>

      {pending2FA ? (
        <TwoFactorVerification />
      ) : (
        <Card className="w-full max-w-md relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <img src="/elidune_logo.png" alt="Elidune" className="h-24 w-24" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {libraryName ?? t('auth.loginTitle')}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t('auth.username')}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.yourIdentifier')}
              required
              autoComplete="username"
            />

            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.yourPassword')}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
              leftIcon={<LogIn className="h-5 w-5" />}
            >
              {t('auth.loginButton')}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            {t('footer.copyright')}
          </p>
        </Card>
      )}
    </div>
  );
}

