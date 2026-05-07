import type { AccountTypeDefinition } from '@/types';

export function accountTypeDisplayName(
  types: AccountTypeDefinition[],
  code: string | null | undefined
): string {
  if (code == null || String(code).trim() === '') return '—';
  const raw = String(code).trim();
  const lower = raw.toLowerCase();
  const match = types.find((t) => t.code.toLowerCase() === lower);
  return match?.name ?? raw;
}

export function defaultAccountTypeCode(types: AccountTypeDefinition[]): string {
  const reader = types.find((t) => t.code.toLowerCase() === 'reader');
  if (reader) return reader.code;
  return types[0]?.code ?? '';
}
