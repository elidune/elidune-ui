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

function isBlobLike(data: unknown): data is Blob {
  return typeof Blob !== 'undefined' && data instanceof Blob;
}

/** i18n key for HTTP status when the body has no usable message. */
function httpStatusToMessageKey(status: number): string | null {
  if (status === 429) return 'errors.tooManyRequests';
  const specific: Record<number, string> = {
    400: 'errors.http.badRequest',
    401: 'errors.http.unauthorized',
    403: 'errors.http.forbidden',
    404: 'errors.http.notFound',
    405: 'errors.http.methodNotAllowed',
    408: 'errors.http.requestTimeout',
    409: 'errors.http.conflict',
    413: 'errors.http.payloadTooLarge',
    414: 'errors.http.uriTooLong',
    415: 'errors.http.unsupportedMedia',
    422: 'errors.http.unprocessable',
    501: 'errors.http.notImplemented',
  };
  if (specific[status]) return specific[status];
  if (status >= 500 && status <= 599) {
    if (status === 502 || status === 503 || status === 504) return 'errors.http.badGateway';
    return 'errors.http.serverError';
  }
  if (status >= 400 && status <= 499) return 'errors.http.clientError';
  return null;
}

function translateKey(t: TFunction, key: string): string | null {
  const msg = t(key);
  return msg === key ? null : msg;
}

/**
 * Get a user-facing error message from an API error response.
 * Order: rate limit (429) → API error code → response body message → HTTP status → network / timeout → generic.
 */
export function getApiErrorMessage(error: unknown, t: TFunction): string {
  const axiosError = error as AxiosError<ApiError>;
  const status = axiosError?.response?.status;
  const rawData = axiosError?.response?.data;

  if (status === 429) {
    return t('errors.tooManyRequests');
  }

  const code = getApiErrorCode(error);
  if (code !== null) {
    const fromCode = translateKey(t, `errors.apiCode.${code}`);
    if (fromCode !== null) return fromCode;
  }

  let data = rawData;
  if (isBlobLike(rawData)) {
    data = undefined;
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as ApiError;
    if (typeof d.message === 'string' && d.message.trim()) return d.message.trim();
    if (typeof d.error === 'string' && d.error.trim()) return d.error.trim();
  }

  if (status != null) {
    const httpKey = httpStatusToMessageKey(status);
    if (httpKey) {
      const fromHttp = translateKey(t, httpKey);
      if (fromHttp !== null) return fromHttp;
    }
  }

  if (!axiosError?.response) {
    if (axiosError?.message === 'Network Error') return t('errors.network');
    if (axiosError?.code === 'ECONNABORTED') return t('errors.timeout');
    return t('errors.generic');
  }

  return t('errors.generic');
}
