import type { TFunction } from 'i18next';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/types';

export function getApiErrorCode(error: unknown): string | null {
  const data = (error as AxiosError<ApiError>)?.response?.data;
  if (typeof data?.code === 'string' && data.code.trim() !== '') {
    return data.code.trim();
  }
  return null;
}

/**
 * Get a user-facing error message from an API error response.
 * Uses the server's string error code for i18n (errors.apiCode.not_found, etc.),
 * then falls back to the response message, then a generic error.
 * Also handles HTTP 429 (rate limiting on /auth/login).
 */
export function getApiErrorMessage(error: unknown, t: TFunction): string {
  const axiosError = error as AxiosError<ApiError>;

  if (axiosError?.response?.status === 429) {
    return t('errors.tooManyRequests');
  }

  const data = axiosError?.response?.data;
  if (!data) {
    if (axiosError?.message === 'Network Error') return t('errors.network');
    return t('errors.generic');
  }

  const code = getApiErrorCode(error);
  if (code !== null) {
    const key = `errors.apiCode.${code}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }

  if (typeof data.message === 'string' && data.message.trim()) return data.message.trim();
  if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
  return t('errors.generic');
}
