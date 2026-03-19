import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Mail,
  Phone,
  KeyRound,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Briefcase,
  AtSign,
  Shield,
  ShieldOff,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardHeader, Button, Input, Modal } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import api from '@/services/api';
import type { SupportedLanguage } from '@/locales';
import type { TwoFactorMethod } from '@/types';
import { OCCUPATION_OPTIONS } from '@/utils/codeLabels';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const { language, setLanguage, availableLanguages, languageNames, languageFlags } = useLanguage();

  // Profile form state
  const [profileData, setProfileData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    login: '',
    addr_street: '',
    addr_zip_code: '',
    addr_city: '',
    occupation_id: '',
    birthdate: '',
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 2FA state
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAMethod, setTwoFAMethod] = useState<TwoFactorMethod>('totp');
  const [twoFASetupData, setTwoFASetupData] = useState<{
    provisioning_uri?: string;
    recovery_codes: string[];
  } | null>(null);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [isDisabling2FA, setIsDisabling2FA] = useState(false);
  const [twoFAError, setTwoFAError] = useState('');
  const [copiedRecoveryCodes, setCopiedRecoveryCodes] = useState(false);

  // Initialize form data when user changes
  useEffect(() => {
    if (user) {
      setProfileData({
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        email: user.email || '',
        phone: user.phone || '',
        login: user.login || user.username || '',
        addr_street: user.addr_street || '',
        addr_zip_code: user.addr_zip_code?.toString() || '',
        addr_city: user.addr_city || '',
        occupation_id: user.occupation_id?.toString() || '',
        birthdate: user.birthdate || '',
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdatingProfile(true);
    setProfileError('');
    setProfileSuccess(false);

    try {
      await api.updateProfile({
        firstname: profileData.firstname || undefined,
        lastname: profileData.lastname || undefined,
        email: profileData.email || undefined,
        phone: profileData.phone || undefined,
        login: profileData.login || undefined,
        addr_street: profileData.addr_street || undefined,
        addr_zip_code: profileData.addr_zip_code ? parseInt(profileData.addr_zip_code, 10) : undefined,
        addr_city: profileData.addr_city || undefined,
        occupation_id: profileData.occupation_id ? parseInt(profileData.occupation_id, 10) : undefined,
        birthdate: profileData.birthdate || undefined,
      });
      await refreshProfile();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setProfileError(t('profile.updateError'));
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'));
      return;
    }

    if (passwordData.newPassword.length < 4) {
      setPasswordError(t('profile.passwordTooShort'));
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess(false);

    try {
      await api.updateProfile({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
      });
      setPasswordSuccess(true);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating password:', error);
      setPasswordError(t('profile.updateError'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLanguageChange = async (newLang: SupportedLanguage) => {
    await setLanguage(newLang);
  };

  const handleSetup2FA = async () => {
    setIsSettingUp2FA(true);
    setTwoFAError('');
    
    try {
      const response = await api.setup2FA({ method: twoFAMethod });
      setTwoFASetupData(response);
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      setTwoFAError(t('profile.2fa.setupError'));
    } finally {
      setIsSettingUp2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    setIsDisabling2FA(true);
    setTwoFAError('');
    
    try {
      await api.disable2FA();
      await refreshProfile();
      setShow2FAModal(false);
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      setTwoFAError(t('profile.2fa.disableError'));
    } finally {
      setIsDisabling2FA(false);
    }
  };

  const handleCopyRecoveryCodes = () => {
    if (twoFASetupData?.recovery_codes) {
      navigator.clipboard.writeText(twoFASetupData.recovery_codes.join('\n'));
      setCopiedRecoveryCodes(true);
      setTimeout(() => setCopiedRecoveryCodes(false), 2000);
    }
  };

  const handleClose2FAModal = async () => {
    if (twoFASetupData) {
      // 2FA was set up successfully, refresh profile
      await refreshProfile();
    }
    setShow2FAModal(false);
    setTwoFASetupData(null);
    setTwoFAError('');
    setCopiedRecoveryCodes(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('profile.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('profile.subtitle')}
        </p>
      </div>

      {/* Profile card */}
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-shrink-0 h-16 w-16 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {user?.firstname?.[0] || user?.username?.[0] || '?'}
              {user?.lastname?.[0] || ''}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {user?.firstname} {user?.lastname}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              {user?.account_type} • @{user?.username}
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-6">
          {/* Personal Information Section */}
          <div>
            <CardHeader title={t('profile.personalInfo')} />
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('profile.firstName')}
                  value={profileData.firstname}
                  onChange={(e) => setProfileData({ ...profileData, firstname: e.target.value })}
                  leftIcon={<User className="h-4 w-4" />}
                />
                <Input
                  label={t('profile.lastName')}
                  value={profileData.lastname}
                  onChange={(e) => setProfileData({ ...profileData, lastname: e.target.value })}
                  leftIcon={<User className="h-4 w-4" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('profile.loginUsername')}
                  value={profileData.login}
                  onChange={(e) => setProfileData({ ...profileData, login: e.target.value })}
                  leftIcon={<AtSign className="h-4 w-4" />}
                  hint={t('profile.loginHint')}
                />
                <Input
                  label={t('profile.email')}
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  leftIcon={<Mail className="h-4 w-4" />}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('profile.phone')}
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  leftIcon={<Phone className="h-4 w-4" />}
                />
                <Input
                  label={t('profile.birthdate')}
                  type="date"
                  value={profileData.birthdate}
                  onChange={(e) => setProfileData({ ...profileData, birthdate: e.target.value })}
                  leftIcon={<Calendar className="h-4 w-4" />}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('profile.occupation')}
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <select
                    value={profileData.occupation_id}
                    onChange={(e) => setProfileData({ ...profileData, occupation_id: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">{t('common.select')}</option>
                    {OCCUPATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div>
            <CardHeader title={t('profile.address')} />
            <div className="space-y-4 mt-4">
              <Input
                label={t('profile.street')}
                value={profileData.addr_street}
                onChange={(e) => setProfileData({ ...profileData, addr_street: e.target.value })}
                leftIcon={<MapPin className="h-4 w-4" />}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('profile.zipCode')}
                  type="number"
                  value={profileData.addr_zip_code}
                  onChange={(e) => setProfileData({ ...profileData, addr_zip_code: e.target.value })}
                />
                <Input
                  label={t('profile.city')}
                  value={profileData.addr_city}
                  onChange={(e) => setProfileData({ ...profileData, addr_city: e.target.value })}
                />
              </div>
            </div>
          </div>

          {profileError && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {profileError}
            </div>
          )}

          {profileSuccess && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              {t('profile.profileUpdated')}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              isLoading={isUpdatingProfile}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Language card */}
      <Card>
        <CardHeader
          title={t('profile.language')}
          subtitle={t('profile.languageHint')}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              className={`
                flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                ${language === lang
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
            >
              <span className="text-xl">{languageFlags[lang]}</span>
              <span className={`text-sm font-medium ${
                language === lang
                  ? 'text-indigo-700 dark:text-indigo-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {languageNames[lang]}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Password card */}
      <Card>
        <CardHeader
          title={t('profile.changePassword')}
          subtitle={t('profile.passwordHint')}
        />

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="relative">
            <Input
              label={t('auth.currentPassword')}
              type={showCurrentPassword ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              leftIcon={<KeyRound className="h-4 w-4" />}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <Input
                label={t('auth.newPassword')}
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                leftIcon={<KeyRound className="h-4 w-4" />}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Input
              label={t('auth.confirmPassword')}
              type={showNewPassword ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              leftIcon={<KeyRound className="h-4 w-4" />}
            />
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4" />
              {t('profile.passwordChanged')}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              isLoading={isUpdatingPassword}
              disabled={!passwordData.newPassword || !passwordData.confirmPassword}
              leftIcon={<KeyRound className="h-4 w-4" />}
            >
              {t('profile.changePassword')}
            </Button>
          </div>
        </form>
      </Card>

      {/* 2FA Security card */}
      <Card>
        <CardHeader
          title={t('profile.2fa.title')}
          subtitle={t('profile.2fa.subtitle')}
        />

        <div className="space-y-4">
          {/* Current 2FA status */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              {user?.two_factor_enabled ? (
                <>
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                    <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('profile.2fa.enabled')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.two_factor_method === 'email' 
                        ? t('profile.2fa.methodEmail')
                        : t('profile.2fa.methodTotp')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <ShieldOff className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {t('profile.2fa.disabled')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('profile.2fa.disabledHint')}
                    </p>
                  </div>
                </>
              )}
            </div>

            <Button
              variant={user?.two_factor_enabled ? 'secondary' : 'primary'}
              onClick={() => setShow2FAModal(true)}
              leftIcon={user?.two_factor_enabled 
                ? <ShieldOff className="h-4 w-4" /> 
                : <Shield className="h-4 w-4" />}
            >
              {user?.two_factor_enabled 
                ? t('profile.2fa.disable')
                : t('profile.2fa.enable')}
            </Button>
          </div>
        </div>
      </Card>

      {/* 2FA Setup/Disable Modal */}
      <Modal
        isOpen={show2FAModal}
        onClose={handleClose2FAModal}
        title={user?.two_factor_enabled ? t('profile.2fa.disableTitle') : t('profile.2fa.setupTitle')}
        footer={
          user?.two_factor_enabled ? (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={handleClose2FAModal}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDisable2FA}
                isLoading={isDisabling2FA}
                leftIcon={<ShieldOff className="h-4 w-4" />}
              >
                {t('profile.2fa.confirmDisable')}
              </Button>
            </div>
          ) : twoFASetupData ? (
            <div className="flex justify-end">
              <Button onClick={handleClose2FAModal}>
                {t('common.close')}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={handleClose2FAModal}>
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSetup2FA}
                isLoading={isSettingUp2FA}
                leftIcon={<Shield className="h-4 w-4" />}
              >
                {t('profile.2fa.setup')}
              </Button>
            </div>
          )
        }
      >
        {user?.two_factor_enabled ? (
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              {t('profile.2fa.disableWarning')}
            </p>
            {twoFAError && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {twoFAError}
              </div>
            )}
          </div>
        ) : twoFASetupData ? (
          <div className="space-y-6">
            {twoFASetupData.provisioning_uri && (
              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {t('profile.2fa.scanQR')}
                </p>
                <div className="inline-block p-4 bg-white rounded-lg">
                  <QRCodeSVG 
                    value={twoFASetupData.provisioning_uri}
                    size={192}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('profile.2fa.recoveryCodes')}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyRecoveryCodes}
                  leftIcon={copiedRecoveryCodes ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                >
                  {copiedRecoveryCodes ? t('common.copied') : t('common.copy')}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('profile.2fa.recoveryCodesHint')}
              </p>
              <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg font-mono text-sm">
                {twoFASetupData.recovery_codes.map((code, index) => (
                  <div key={index} className="text-gray-700 dark:text-gray-300">
                    {code}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-gray-600 dark:text-gray-400">
              {t('profile.2fa.chooseMethod')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setTwoFAMethod('totp')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  twoFAMethod === 'totp'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Smartphone className={`h-6 w-6 mb-2 ${
                  twoFAMethod === 'totp' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
                }`} />
                <p className={`font-medium ${
                  twoFAMethod === 'totp' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {t('profile.2fa.totpOption')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('profile.2fa.totpDescription')}
                </p>
              </button>

              <button
                onClick={() => setTwoFAMethod('email')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  twoFAMethod === 'email'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Mail className={`h-6 w-6 mb-2 ${
                  twoFAMethod === 'email' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
                }`} />
                <p className={`font-medium ${
                  twoFAMethod === 'email' ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {t('profile.2fa.emailOption')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {t('profile.2fa.emailDescription')}
                </p>
              </button>
            </div>

            {twoFAError && (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                {twoFAError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
