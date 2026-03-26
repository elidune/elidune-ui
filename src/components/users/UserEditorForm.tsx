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

export type UserFormData = {
  login: string;
  password: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  barcode: string;
  birthdate: string;
  addrStreet: string;
  addrZipCode: string;
  addrCity: string;
  notes: string;
  fee: string;
  groupId: string;
  publicType: string;
  accountType: string;
  expiryUnlimited: boolean;
  expiryAt: string;
};

function emptyFormData(): UserFormData {
  return {
    login: '',
    password: '',
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    barcode: '',
    birthdate: '',
    addrStreet: '',
    addrZipCode: '',
    addrCity: '',
    notes: '',
    fee: '',
    groupId: '',
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
    email: user.email || '',
    phone: user.phone || '',
    barcode: user.barcode || '',
    birthdate: user.birthdate || '',
    addrStreet: user.addrStreet || '',
    addrZipCode: user.addrZipCode?.toString() || '',
    addrCity: user.addrCity || '',
    notes: user.notes || '',
    fee: user.fee || '',
    groupId: user.groupId?.toString() || '',
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
    email: formData.email || undefined,
    phone: formData.phone || undefined,
    barcode: formData.barcode || undefined,
    birthdate: formData.birthdate || undefined,
    addrStreet: formData.addrStreet || undefined,
    addrZipCode: formData.addrZipCode ? parseInt(formData.addrZipCode, 10) : undefined,
    addrCity: formData.addrCity || undefined,
    notes: formData.notes || undefined,
    fee: formData.fee || undefined,
    groupId: formData.groupId ? String(formData.groupId) : undefined,
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

  const ACCOUNT_TYPES = [
    { value: 'reader', label: t('users.reader') },
    { value: 'librarian', label: t('users.librarian') },
    { value: 'admin', label: t('users.administrator') },
    { value: 'guest', label: t('users.guest') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {t('users.identity')}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('users.identifier')}
          value={formData.login}
          onChange={(e) => setFormData({ ...formData, login: e.target.value })}
          required={mode === 'create'}
        />
        <Input
          label={t('auth.password')}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder={mode === 'edit' ? t('profile.leaveBlankPassword') : undefined}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('profile.firstName')}
          value={formData.firstname}
          onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
        />
        <Input
          label={t('profile.lastName')}
          value={formData.lastname}
          onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
        />
      </div>

      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
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

      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
        {t('profile.address')}
      </h4>
      <Input
        label={t('profile.street')}
        value={formData.addrStreet}
        onChange={(e) => setFormData({ ...formData, addrStreet: e.target.value })}
        leftIcon={<MapPin className="h-4 w-4" />}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('profile.zipCode')}
          value={formData.addrZipCode}
          onChange={(e) => setFormData({ ...formData, addrZipCode: e.target.value })}
        />
        <Input
          label={t('profile.city')}
          value={formData.addrCity}
          onChange={(e) => setFormData({ ...formData, addrCity: e.target.value })}
        />
      </div>

      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
        {t('users.additionalInfo')}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('profile.barcode')}
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
        />
        <Input
          label={t('profile.birthdate')}
          type="date"
          value={formData.birthdate}
          onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('profile.accountType')}
          </label>
          <select
            value={formData.accountType}
            onChange={(e) => setFormData({ ...formData, accountType: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('users.fee')}
          value={formData.fee}
          onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label={t('users.groupId')}
          type="number"
          value={formData.groupId}
          onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
        />
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.publicType')}
          </label>
          <select
            value={formData.publicType}
            onChange={(e) => setFormData({ ...formData, publicType: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">{t('common.select')}</option>
            {publicTypes.map((pt) => (
              <option key={pt.id} value={String(pt.id)}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-1">
        {t('users.subscription')}
      </h4>
      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.expiryUnlimited}
            onChange={(e) =>
              setFormData({
                ...formData,
                expiryUnlimited: e.target.checked,
              })
            }
            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('users.subscriptionUnlimited')}
          </span>
        </label>
        {!formData.expiryUnlimited && (
          <Input
            label={t('users.subscriptionExpiry')}
            type="date"
            value={formData.expiryAt}
            onChange={(e) => setFormData({ ...formData, expiryAt: e.target.value })}
          />
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('users.notes')}
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
        />
      </div>
    </form>
  );
}
