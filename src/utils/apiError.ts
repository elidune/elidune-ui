import type { TFunction } from 'i18next';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';

function toNumericCode(code: unknown): number | null {
  if (typeof code === 'number' && Number.isFinite(code)) {
    return code;
  }
  if (typeof code === 'string' && code.trim() !== '') {
    const parsed = Number(code);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function getApiErrorCode(error: unknown): number | null {
  const data = (error as AxiosError<ApiError>)?.response?.data;
  return toNumericCode(data?.code);
}

/**
 * Get a user-facing error message from an API error response.
 * Uses the server's error code for i18n (errors.apiCode.0 … errors.apiCode.21),
 * then falls back to response message, then generic error.
 */
export function getApiErrorMessage(error: unknown, t: TFunction): string {
  const data = (error as AxiosError<ApiError>)?.response?.data;
  if (!data) {
    if ((error as AxiosError)?.message === 'Network Error') return t('errors.network');
    return t('errors.generic');
  }
  const code = toNumericCode(data.code);
  if (code !== null) {
    const key = `errors.apiCode.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  return t('errors.generic');
}
