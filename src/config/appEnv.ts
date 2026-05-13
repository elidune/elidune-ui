/**
 * Build-time / front configuration (Vite env). No secrets here.
 */
const rawBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

/** API base path or absolute URL (must include `/api/v1` path when using a full host). */
export const API_BASE_URL = rawBase && rawBase.length > 0 ? rawBase : '/api/v1';

const flag = (import.meta.env.VITE_FEATURE_AI_CHAT as string | undefined)?.trim()?.toLowerCase();

/**
 * Reader assistant UI is shown only when explicitly enabled at build time.
 * Omitted or any value other than `true`/`1` disables the feature.
 */
export function isReaderAssistantFeatureEnabled(): boolean {
  return flag === 'true' || flag === '1';
}
