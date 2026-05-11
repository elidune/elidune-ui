import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Mail, MapPin, Phone } from 'lucide-react';
import { Input } from '@/components/common';
import api from '@/services/api';
import type { AccountTypeDefinition, PublicType, User } from '@/types';
import { defaultAccountTypeCode } from '@/utils/accountTypeDisplay';
import { getApiErrorMessage } from '@/utils/apiError';
import { SEX_OPTIONS } from '@/utils/codeLabels';
import { searchFrenchCommunePicks } from '@/utils/frenchCommuneSearch';
import {
  defaultExpiryDateInputOneYearFromNow,
  dateInputToIsoEndOfDayUtc,
  toDateInputValue,
} from '@/utils/userSubscription';

/** Male / female options for the sex select (empty = not specified until user picks). */
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
  | 'birthdate'
  | 'publicType'
  | 'accountType'
  | 'sex'
  | 'addrCity';

function formatCityPostalLine(city: string, zip: string): string {
  const c = city.trim();
  const z = zip.trim();
  if (!c) return '';
  if (!z) return c;
  return `${c} (${z})`;
}

function emptyFormData(accountTypes: AccountTypeDefinition[]): UserFormData {
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
    accountType: defaultAccountTypeCode(accountTypes),
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
    accountType: (user.accountType ?? '').trim().toLowerCase(),
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

function CollapsibleFormSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-100/80 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        )}
      </button>
      {open && <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-gray-200/80 dark:border-gray-700/80">{children}</div>}
    </section>
  );
}

export interface UserEditorFormProps {
  mode: 'create' | 'edit';
  formId: string;
  publicTypes: PublicType[];
  accountTypes: AccountTypeDefinition[];
  /** Required when mode is `edit` */
  user?: User;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: (user?: User) => void | Promise<void>;
}

export default function UserEditorForm({
  mode,
  formId,
  publicTypes,
  accountTypes,
  user,
  onLoadingChange,
  onSuccess,
}: UserEditorFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<UserFormData>(() =>
    mode === 'edit' && user ? formDataFromUser(user) : emptyFormData(accountTypes)
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- full `user` would refire on unrelated updates
  useEffect(() => {
    if (!accountTypes.length) return;
    setFormData((fd) => {
      const listed = accountTypes.some((a) => a.code.toLowerCase() === fd.accountType.toLowerCase());
      if (listed) return fd;
      if (mode === 'edit' && user && fd.accountType === (user.accountType ?? '').trim().toLowerCase()) {
        return fd;
      }
      return { ...fd, accountType: defaultAccountTypeCode(accountTypes) };
    });
  }, [accountTypes, mode, user?.accountType, user?.id]);

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<UserRequiredField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const [cityPostalField, setCityPostalField] = useState(() =>
    mode === 'edit' && user
      ? formatCityPostalLine(user.addrCity ?? '', String(user.addrZipCode ?? ''))
      : ''
  );
  const [communePicks, setCommunePicks] = useState<Awaited<ReturnType<typeof searchFrenchCommunePicks>>>([]);
  const [communeLookupLoading, setCommuneLookupLoading] = useState(false);
  const [communeListOpen, setCommuneListOpen] = useState(false);
  const communeWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      if (!communeWrapRef.current?.contains(ev.target as Node)) {
        setCommuneListOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    const committed = formatCityPostalLine(formData.addrCity, formData.addrZipCode);
    const raw = cityPostalField.trim();
    if (raw !== '' && raw === committed) {
      setCommunePicks([]);
      setCommuneLookupLoading(false);
      return;
    }
    if (raw.length < 2) {
      setCommunePicks([]);
      setCommuneLookupLoading(false);
      return;
    }
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setCommuneLookupLoading(true);
          const picks = await searchFrenchCommunePicks(raw, ac.signal);
          setCommunePicks(picks);
        } catch (e) {
          if ((e as { name?: string }).name === 'AbortError') return;
          setCommunePicks([]);
        } finally {
          if (!ac.signal.aborted) setCommuneLookupLoading(false);
        }
      })();
    }, 300);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [cityPostalField, formData.addrCity, formData.addrZipCode]);

  const requiredMsg = t('validation.required');

  const validateRequired = (
    fd: UserFormData,
    types: AccountTypeDefinition[]
  ): Partial<Record<UserRequiredField, string>> => {
    const err: Partial<Record<UserRequiredField, string>> = {};
    if (!fd.login.trim()) err.login = requiredMsg;
    if (!fd.firstname.trim()) err.firstname = requiredMsg;
    if (!fd.lastname.trim()) err.lastname = requiredMsg;
    if (!fd.birthdate.trim()) err.birthdate = requiredMsg;
    if (!fd.publicType.trim()) err.publicType = requiredMsg;
    if (!fd.sex.trim()) err.sex = requiredMsg;
    if (!fd.addrCity.trim()) err.addrCity = requiredMsg;

    const code = fd.accountType.trim();
    const listed =
      types.length > 0 && types.some((a) => a.code.toLowerCase() === code.toLowerCase());
    if (!code || !listed) err.accountType = requiredMsg;
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
    `w-full min-w-0 h-10 min-h-10 shrink-0 box-border px-3 py-0 text-sm leading-normal rounded-lg border bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
      hasError
        ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        : 'border-gray-300 dark:border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40'
    }`;

  const sectionClass =
    'rounded-lg border p-3 sm:p-3.5 space-y-2.5 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60';

  const sectionTitleClass =
    'text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider';

  const fieldLabelClass =
    'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const requiredMark = (
    <span className="text-red-600 dark:text-red-400 ml-0.5 font-medium" aria-hidden="true">
      *
    </span>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateRequired(formData, accountTypes);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitError(null);
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
      setSubmitError(getApiErrorMessage(error, t));
    } finally {
      onLoadingChange(false);
    }
  };

  const applyCommunePick = (pick: { city: string; zip: string }) => {
    setFormData((prev) => ({
      ...prev,
      addrCity: pick.city,
      addrZipCode: pick.zip,
    }));
    clearFieldError('addrCity');
    setCityPostalField(formatCityPostalLine(pick.city, pick.zip));
    setCommunePicks([]);
    setCommuneListOpen(false);
  };

  const committedCityPostal = formatCityPostalLine(formData.addrCity, formData.addrZipCode);
  const isCityPostalSearchMode =
    cityPostalField.trim() === '' || cityPostalField.trim() !== committedCityPostal;
  const showCommuneSuggestions =
    communeListOpen && cityPostalField.trim().length >= 2 && isCityPostalSearchMode;

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-3">
      {submitError && (
        <div
          className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{submitError}</p>
        </div>
      )}

      <p className="text-xs text-gray-600 dark:text-gray-400 -mt-1">
        <span className="text-red-600 dark:text-red-400 font-medium" aria-hidden="true">
          *
        </span>{' '}
        {t('validation.requiredFieldsLegend')}
      </p>

      <section className={sectionClass}>
        <h4 className={sectionTitleClass}>{t('users.identity')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
        <h4 className={sectionTitleClass}>{t('users.additionalInfo')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
          <div>
            <label htmlFor={`${formId}-account-type`} className={fieldLabelClass}>
              {t('profile.accountType')}
              {requiredMark}
            </label>
            <select
              id={`${formId}-account-type`}
              value={formData.accountType}
              onChange={(e) => {
                setFormData({ ...formData, accountType: e.target.value });
                clearFieldError('accountType');
              }}
              required
              aria-required="true"
              className={selectClass(!!fieldErrors.accountType)}
              aria-invalid={!!fieldErrors.accountType}
            >
              {formData.accountType &&
                !accountTypes.some((a) => a.code.toLowerCase() === formData.accountType.toLowerCase()) && (
                  <option value={formData.accountType}>{formData.accountType}</option>
                )}
              {accountTypes.map((at) => (
                <option key={at.code} value={at.code}>
                  {at.name}
                </option>
              ))}
            </select>
            {fieldErrors.accountType && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.accountType}</p>
            )}
          </div>
         
          <div>
            <label htmlFor={`${formId}-public-type`} className={fieldLabelClass}>
              {t('users.publicType')}
              {requiredMark}
            </label>
            <select
              id={`${formId}-public-type`}
              value={formData.publicType}
              onChange={(e) => {
                setFormData({ ...formData, publicType: e.target.value });
                clearFieldError('publicType');
              }}
              required
              aria-required="true"
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
          <Input
            label={t('profile.birthdate')}
            type="date"
            value={formData.birthdate}
            onChange={(e) => {
              setFormData({ ...formData, birthdate: e.target.value });
              clearFieldError('birthdate');
            }}
            required
            error={fieldErrors.birthdate}
          />
          <div>
            <label htmlFor={`${formId}-sex`} className={fieldLabelClass}>
              {t('users.sex')}
              {requiredMark}
            </label>
            <select
              id={`${formId}-sex`}
              value={formData.sex}
              onChange={(e) => {
                setFormData({ ...formData, sex: e.target.value });
                clearFieldError('sex');
              }}
              required
              aria-required="true"
              className={selectClass(!!fieldErrors.sex)}
            >
              <option value="">{t('common.select')}</option>
              {SEX_M_F_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </option>
              ))}
            </select>
            {fieldErrors.sex && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.sex}</p>}
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h4 className={sectionTitleClass}>{t('users.contact')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start">
          <div className="min-w-0">
            <Input
              label={t('profile.street')}
              value={formData.addrStreet}
              onChange={(e) => setFormData({ ...formData, addrStreet: e.target.value })}
              leftIcon={<MapPin className="h-4 w-4" />}
            />
          </div>

          <div ref={communeWrapRef} className="relative min-w-0">
            <label htmlFor={`${formId}-commune-lookup`} className={fieldLabelClass}>
              {t('users.cityPostalLookup')}
              {requiredMark}
            </label>
            <div className="relative">
              <input
                id={`${formId}-commune-lookup`}
                type="text"
                required
                aria-required="true"
                value={cityPostalField}
                onChange={(e) => {
                  const v = e.target.value;
                  setCityPostalField(v);
                  setFormData((prev) => {
                    const committed = formatCityPostalLine(prev.addrCity, prev.addrZipCode);
                    if (v.trim() === '') {
                      return { ...prev, addrCity: '', addrZipCode: '' };
                    }
                    if (v.trim() !== committed) {
                      return { ...prev, addrCity: '', addrZipCode: '' };
                    }
                    return prev;
                  });
                  clearFieldError('addrCity');
                  setCommuneListOpen(true);
                }}
                onFocus={() => {
                  if (isCityPostalSearchMode && cityPostalField.trim().length >= 2) setCommuneListOpen(true);
                }}
                placeholder={t('users.cityPostalLookupPlaceholder')}
                autoComplete="off"
                aria-invalid={!!fieldErrors.addrCity}
                aria-describedby={fieldErrors.addrCity ? `${formId}-city-postal-error` : undefined}
                className={`w-full rounded-lg border box-border bg-white dark:bg-gray-900 h-10 min-h-10 shrink-0 pl-4 pr-9 py-0 text-sm leading-normal
                text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500
                ${fieldErrors.addrCity ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'}
                focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40`}
              />
              {communeLookupLoading && (
                <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none" aria-hidden>
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {fieldErrors.addrCity && (
              <p id={`${formId}-city-postal-error`} className="mt-1 text-sm text-red-600 dark:text-red-400">
                {fieldErrors.addrCity}
              </p>
            )}
            {showCommuneSuggestions && (
              <ul
                className="absolute z-[100] mt-1 max-h-44 w-full overflow-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 py-1 shadow-lg"
                role="listbox"
              >
                {communeLookupLoading && communePicks.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('users.communeSearchLoading')}</li>
                ) : communePicks.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('users.communeSearchEmpty')}</li>
                ) : (
                  communePicks.map((pick) => (
                    <li key={`${pick.city}-${pick.zip}-${pick.label}`} role="option">
                      <button
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          applyCommunePick(pick);
                        }}
                      >
                        {pick.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        </div>
      </section>

      <CollapsibleFormSection
        title={t('users.subscription')}
        open={subscriptionOpen}
        onToggle={() => setSubscriptionOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
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
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 ${
              formData.expiryUnlimited ? 'bg-amber-500 dark:bg-amber-600' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`pointer-events-none absolute top-0.5 left-0.5 block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                formData.expiryUnlimited ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('users.expiryUnlimited')}</span>
        </div>
        <div className={`grid grid-cols-1 gap-2.5 sm:grid-cols-2 ${formData.expiryUnlimited ? 'opacity-55' : ''}`}>
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
      </CollapsibleFormSection>

      <CollapsibleFormSection title={t('users.notes')} open={notesOpen} onToggle={() => setNotesOpen((v) => !v)}>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40"
          aria-label={t('users.notes')}
        />
      </CollapsibleFormSection>
    </form>
  );
}
