import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MapPin } from 'lucide-react';
import { Input } from '@/components/common';
import api from '@/services/api';
import type { PublicType, User } from '@/types';
import {
  defaultExpiryDateInputOneYearFromNow,
  dateInputToIsoEndOfDayUtc,
  toDateInputValue,
} from '@/utils/userSubscription';
import { SEX_OPTIONS } from '@/utils/codeLabels';

/** Male / female options for the sex select (empty = not specified). */
const SEX_M_F_OPTIONS = SEX_OPTIONS.filter((o) => o.value === 'm' || o.value === 'f');

export type UserFormData = {
  login: string;
  password: string;
  firstname: string;
  lastname: string;
  sex: string;
  email: string;
  phone: string;
  barcode: string;
  birthdate: string;
  addrStreet: string;
  addrZipCode: string;
  addrCity: string;
  notes: string;
  fee: string;
  publicType: string;
  accountType: string;
  expiryUnlimited: boolean;
  expiryAt: string;
};

type UserRequiredField =
  | 'login'
  | 'firstname'
  | 'lastname'
  | 'publicType'
  | 'addrCity';

function emptyFormData(): UserFormData {
  return {
    login: '',
    password: '',
    firstname: '',
    lastname: '',
    sex: '',
    email: '',
    phone: '',
    barcode: '',
    birthdate: '',
    addrStreet: '',
    addrZipCode: '',
    addrCity: '',
    notes: '',
    fee: '',
    publicType: '',
    accountType: 'reader',
    expiryUnlimited: false,
    expiryAt: defaultExpiryDateInputOneYearFromNow(),
  };
}

function formDataFromUser(user: User): UserFormData {
  return {
    login: user.login || '',
    password: '',
    firstname: user.firstname || '',
    lastname: user.lastname || '',
    sex: user.sex === 'm' || user.sex === 'f' ? user.sex : '',
    email: user.email || '',
    phone: user.phone || '',
    barcode: user.barcode || '',
    birthdate: user.birthdate || '',
    addrStreet: user.addrStreet || '',
    addrZipCode: user.addrZipCode?.toString() || '',
    addrCity: user.addrCity || '',
    notes: user.notes || '',
    fee: user.fee || '',
    publicType: user.publicType?.toString() || '',
    accountType: (user.accountType || 'reader').toLowerCase(),
    expiryUnlimited: !user.expiryAt,
    expiryAt: user.expiryAt
      ? toDateInputValue(new Date(user.expiryAt))
      : defaultExpiryDateInputOneYearFromNow(),
  };
}

function buildPayload(formData: UserFormData): Record<string, unknown> {
  return {
    login: formData.login || undefined,
    firstname: formData.firstname || undefined,
    lastname: formData.lastname || undefined,
    sex: formData.sex || undefined,
    email: formData.email || undefined,
    phone: formData.phone || undefined,
    barcode: formData.barcode || undefined,
    birthdate: formData.birthdate || undefined,
    addrStreet: formData.addrStreet || undefined,
    addrZipCode: formData.addrZipCode ? parseInt(formData.addrZipCode, 10) : undefined,
    addrCity: formData.addrCity || undefined,
    notes: formData.notes || undefined,
    fee: formData.fee || undefined,
    publicType: formData.publicType ? String(formData.publicType) : undefined,
    accountType: formData.accountType || undefined,
    ...(formData.expiryUnlimited
      ? { expiryAt: null }
      : {
          expiryAt: dateInputToIsoEndOfDayUtc(
            formData.expiryAt || defaultExpiryDateInputOneYearFromNow()
          ),
        }),
  };
}

export interface UserEditorFormProps {
  mode: 'create' | 'edit';
  formId: string;
  publicTypes: PublicType[];
  /** Required when mode is `edit` */
  user?: User;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: (user?: User) => void | Promise<void>;
}

export default function UserEditorForm({
  mode,
  formId,
  publicTypes,
  user,
  onLoadingChange,
  onSuccess,
}: UserEditorFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<UserFormData>(() =>
    mode === 'edit' && user ? formDataFromUser(user) : emptyFormData()
  );
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<UserRequiredField, string>>>({});

  const requiredMsg = t('validation.required');

  const validateRequired = (fd: UserFormData): Partial<Record<UserRequiredField, string>> => {
    const err: Partial<Record<UserRequiredField, string>> = {};
    if (!fd.login.trim()) err.login = requiredMsg;
    if (!fd.firstname.trim()) err.firstname = requiredMsg;
    if (!fd.lastname.trim()) err.lastname = requiredMsg;
    if (!fd.publicType.trim()) err.publicType = requiredMsg;
    if (!fd.addrCity.trim()) err.addrCity = requiredMsg;
    return err;
  };

  const clearFieldError = (key: UserRequiredField) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const selectClass = (hasError: boolean) =>
    `w-full min-w-0 px-4 py-2.5 rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        : 'border-gray-300 dark:border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40'
    }`;

  const sectionClass =
    'rounded-xl border p-4 sm:p-5 space-y-4 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60';

  const ACCOUNT_TYPES = [
    { value: 'reader', label: t('users.reader') },
    { value: 'librarian', label: t('users.librarian') },
    { value: 'admin', label: t('users.administrator') },
    { value: 'guest', label: t('users.guest') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateRequired(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    onLoadingChange(true);
    try {
      const base = buildPayload(formData);
      if (mode === 'create') {
        const createData: Record<string, unknown> = {
          ...base,
          login: formData.login,
          password: formData.password || undefined,
        };
        const created = await api.createUser(createData as Partial<User> & { password?: string });
        await onSuccess(created);
      } else {
        if (!user) return;
        const updateData: Record<string, unknown> = { ...base };
        if (formData.password) {
          updateData.password = formData.password;
        }
        const updated = await api.updateUser(user.id, updateData);
        await onSuccess(updated);
      }
    } catch (error) {
      console.error(mode === 'create' ? 'Error creating user:' : 'Error updating user:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  const accountSelectClass =
    'w-full min-w-0 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40';

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <section className={sectionClass}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {t('users.identity')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('profile.firstName')}
            value={formData.firstname}
            onChange={(e) => {
              setFormData({ ...formData, firstname: e.target.value });
              clearFieldError('firstname');
            }}
            required
            error={fieldErrors.firstname}
          />
          <Input
            label={t('profile.lastName')}
            value={formData.lastname}
            onChange={(e) => {
              setFormData({ ...formData, lastname: e.target.value });
              clearFieldError('lastname');
            }}
            required
            error={fieldErrors.lastname}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label={t('users.identifier')}
            value={formData.login}
            onChange={(e) => {
              setFormData({ ...formData, login: e.target.value });
              clearFieldError('login');
            }}
            required
            error={fieldErrors.login}
          />
          <Input
            label={t('profile.barcode')}
            value={formData.barcode}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          />
          <Input
            label={t('auth.password')}
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={mode === 'edit' ? t('profile.leaveBlankPassword') : undefined}
          />
        </div>
     
      </section>


   

      <section className={sectionClass}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {t('users.additionalInfo')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('profile.accountType')}
            </label>
            <select
              value={formData.accountType}
              onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
              className={accountSelectClass}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t('profile.birthdate')}
            type="date"
            value={formData.birthdate}
            onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.publicType')}
            </label>
            <select
              value={formData.publicType}
              onChange={(e) => {
                setFormData({ ...formData, publicType: e.target.value });
                clearFieldError('publicType');
              }}
              required
              className={selectClass(!!fieldErrors.publicType)}
            >
              <option value="">{t('common.select')}</option>
              {publicTypes.map((pt) => (
                <option key={pt.id} value={String(pt.id)}>
                  {pt.label}
                </option>
              ))}
            </select>
            {fieldErrors.publicType && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.publicType}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('users.sex')}
            </label>
            <select
              value={formData.sex}
              onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
              className={selectClass(false)}
            >
              <option value="">{t('common.select')}</option>
              {SEX_M_F_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {t('users.subscription')}
        </h4>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={formData.expiryUnlimited}
              aria-label={t('users.subscriptionUnlimited')}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  expiryUnlimited: !prev.expiryUnlimited,
                }))
              }
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
                formData.expiryUnlimited
                  ? 'bg-amber-500 dark:bg-amber-600'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`pointer-events-none absolute top-1 left-1 block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  formData.expiryUnlimited ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('users.expiryUnlimited')}
            </span>
          </div>
          <div
            className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${formData.expiryUnlimited ? 'opacity-55' : ''}`}
          >
            <Input
              label={t('users.subscriptionExpiry')}
              type="date"
              value={formData.expiryAt}
              onChange={(e) => setFormData({ ...formData, expiryAt: e.target.value })}
              disabled={formData.expiryUnlimited}
            />
            <Input
              label={t('users.fee')}
              value={formData.fee}
              onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
              disabled={formData.expiryUnlimited}
            />
          </div>
        </div>
      </section>
      <section className={sectionClass}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {t('users.contact')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('profile.email')}
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            leftIcon={<Mail className="h-4 w-4" />}
          />
          <Input
            label={t('profile.phone')}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            leftIcon={<Phone className="h-4 w-4" />}
          />
        </div>
       
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] gap-4">
          <Input
            label={t('profile.street')}
            value={formData.addrStreet}
            onChange={(e) => setFormData({ ...formData, addrStreet: e.target.value })}
            leftIcon={<MapPin className="h-4 w-4" />}
          />
          <div className="w-full max-w-[7rem] md:max-w-none">
            <Input
              label={t('profile.zipCode')}
              value={formData.addrZipCode}
              onChange={(e) => setFormData({ ...formData, addrZipCode: e.target.value })}
              inputMode="numeric"
              autoComplete="postal-code"
            />
          </div>
          <Input
            label={t('profile.city')}
            value={formData.addrCity}
            onChange={(e) => {
              setFormData({ ...formData, addrCity: e.target.value });
              clearFieldError('addrCity');
            }}
            required
            error={fieldErrors.addrCity}
          />
        </div>
      </section>
      <section className={sectionClass}>
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {t('users.notes')}
        </h4>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
          aria-label={t('users.notes')}
        />
      </section>
    </form>
  );
}
