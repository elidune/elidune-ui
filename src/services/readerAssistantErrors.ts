/**
 * Maps HTTP statuses from reader-assistant APIs to stable UI buckets.
 * Does not log or stringify request bodies.
 */
export type ReaderAssistantErrorBucket =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'quota'
  | 'temporary_unavailable'
  | 'server'
  | 'unknown';

export function classifyReaderAssistantHttpStatus(status: number | undefined): ReaderAssistantErrorBucket {
  if (status === undefined) return 'unknown';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 400) return 'validation';
  if (status === 422) return 'quota';
  if (status === 501 || status === 503) return 'temporary_unavailable';
  if (status >= 502 && status <= 504) return 'temporary_unavailable';
  if (status >= 500) return 'server';
  return 'unknown';
}

/** True when the list endpoint signals the module is absent or turned off upstream. */
export function isProbeStatusFeatureUnavailable(status: number): boolean {
  return status === 404 || status === 501 || status === 503;
}
