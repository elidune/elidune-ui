import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Save } from 'lucide-react';
import { Card, CardHeader, Button, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import { ACCOUNT_TYPES_QUERY_KEY, useAccountTypesQuery } from '@/hooks/useAccountTypesQuery';
import { getApiErrorMessage } from '@/utils/apiError';
import { isAdmin } from '@/types';
import type { AccountTypeDefinition, AccountTypeRightLevel, UpdateAccountTypeRequest } from '@/types';

const RIGHT_FIELDS = [
  'itemsRights',
  'usersRights',
  'loansRights',
  'itemsArchiveRights',
  'borrowsRights',
  'settingsRights',
  'eventsRights',
] as const;

type RightField = (typeof RIGHT_FIELDS)[number];

function cloneTypes(list: AccountTypeDefinition[]): AccountTypeDefinition[] {
  return list.map((r) => ({ ...r }));
}

function normRight(v: string | null | undefined): string {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'n' || s === 'r' || s === 'w' ? s : '';
}

function buildAccountTypeUpdate(
  orig: AccountTypeDefinition,
  next: AccountTypeDefinition
): UpdateAccountTypeRequest | null {
  const body: UpdateAccountTypeRequest = {};
  if ((next.name ?? '').trim() !== (orig.name ?? '').trim()) {
    body.name = (next.name ?? '').trim();
  }
  for (const k of RIGHT_FIELDS) {
    const o = normRight(orig[k]);
    const n = normRight(next[k]);
    if (o !== n) {
      body[k] = n === '' ? null : (n as AccountTypeRightLevel);
    }
  }
  if (Object.keys(body).length === 0) return null;
  return body;
}

export default function AccountTypesSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = isAdmin(user?.accountType);

  const { data, isLoading, isError } = useAccountTypesQuery();
  const [rows, setRows] = useState<AccountTypeDefinition[]>([]);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (data?.length) setRows(cloneTypes(data));
  }, [data]);

  const showReloginHint = useCallback(() => {
    setBanner(t('settings.accountTypes.reloginHint'));
    window.setTimeout(() => setBanner(null), 9000);
  }, [t]);

  const updateRow = (code: string, patch: Partial<AccountTypeDefinition>) => {
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, ...patch } : r)));
    setRowError(null);
  };

  const handleSaveRow = async (code: string) => {
    const orig = data?.find((r) => r.code === code);
    const cur = rows.find((r) => r.code === code);
    if (!orig || !cur) return;
    const body = buildAccountTypeUpdate(orig, cur);
    if (!body) return;

    setSavingCode(code);
    setRowError(null);
    try {
      await api.updateAccountType(code, body);
      await queryClient.invalidateQueries({ queryKey: ACCOUNT_TYPES_QUERY_KEY });
      showReloginHint();
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setRowError(t('settings.accountTypes.forbidden'));
      } else {
        setRowError(getApiErrorMessage(err, t));
      }
    } finally {
      setSavingCode(null);
    }
  };

  const rightSelectClass =
    'min-w-[4.5rem] max-w-[6rem] px-1.5 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-xs';

  if (isLoading && data === undefined) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="rounded-2xl border-gray-200/80 dark:border-gray-800/80 shadow-sm overflow-hidden">
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('settings.accountTypes.errorLoad')}</p>
      </Card>
    );
  }

  if (!data?.length) {
    return (
      <Card className="rounded-2xl border-gray-200/80 dark:border-gray-800/80 shadow-sm overflow-hidden">
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('settings.accountTypes.empty')}</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-gray-200/80 dark:border-gray-800/80 shadow-sm overflow-hidden">
      <CardHeader title={t('settings.accountTypes.title')} />
      <p className="text-sm text-gray-600 dark:text-gray-400 px-4 -mt-2 mb-4">{t('settings.accountTypes.subtitle')}</p>

      {!canEdit ? (
        <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 mb-4 mx-4">
          {t('settings.accountTypes.readOnlyHint')}
        </p>
      ) : null}

      {banner ? (
        <p className="text-sm text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2 mb-4 mx-4">
          {banner}
        </p>
      ) : null}

      {rowError ? (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-4 mx-4">
          {rowError}
        </p>
      ) : null}

      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full min-w-[56rem] text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-2 font-medium text-gray-600 dark:text-gray-400">
                {t('settings.accountTypes.code')}
              </th>
              <th className="text-left py-2 pr-2 font-medium text-gray-600 dark:text-gray-400">
                {t('settings.accountTypes.name')}
              </th>
              {RIGHT_FIELDS.map((field) => (
                <th
                  key={field}
                  className="text-left py-2 px-1 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap"
                >
                  {t(`settings.accountTypes.rights.${field}`)}
                </th>
              ))}
              {canEdit ? (
                <th className="py-2 pl-2 w-24 text-right font-medium text-gray-600 dark:text-gray-400">
                  {t('common.actions')}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => {
              const orig = data.find((r) => r.code === row.code)!;
              const dirty = buildAccountTypeUpdate(orig, row) !== null;
              return (
                <tr key={row.code}>
                  <td className="py-2 pr-2 font-mono text-xs text-gray-700 dark:text-gray-300">{row.code}</td>
                  <td className="py-2 pr-2 min-w-[8rem]">
                    {canEdit ? (
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(row.code, { name: e.target.value })}
                        className="text-sm py-1.5"
                      />
                    ) : (
                      <span className="text-gray-900 dark:text-white">{row.name}</span>
                    )}
                  </td>
                  {RIGHT_FIELDS.map((field) => (
                    <td key={field} className="py-2 px-1">
                      {canEdit ? (
                        <select
                          value={normRight(row[field])}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateRow(row.code, {
                              [field]: v === '' ? null : v,
                            } as Pick<AccountTypeDefinition, RightField>);
                          }}
                          className={rightSelectClass}
                          aria-label={t(`settings.accountTypes.rights.${field}`)}
                        >
                          <option value="">{t('settings.accountTypes.level.none')}</option>
                          <option value="n">{t('settings.accountTypes.level.n')}</option>
                          <option value="r">{t('settings.accountTypes.level.r')}</option>
                          <option value="w">{t('settings.accountTypes.level.w')}</option>
                        </select>
                      ) : (
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                          {normRight(row[field]) || '—'}
                        </span>
                      )}
                    </td>
                  ))}
                  {canEdit ? (
                    <td className="py-2 pl-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!dirty || savingCode !== null}
                        isLoading={savingCode === row.code}
                        leftIcon={<Save className="h-3.5 w-3.5" />}
                        onClick={() => void handleSaveRow(row.code)}
                      >
                        {t('common.save')}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
