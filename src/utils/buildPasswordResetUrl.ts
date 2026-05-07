/**
 * Template URL for POST /auth/request-password-reset (`resetUrl`).
 * The server replaces the literal substring `<token>` with the actual token.
 */
export function buildPublicPasswordResetTemplateUrl(): string {
  const rawBase = import.meta.env.BASE_URL ?? '/';
  const baseNoSlash = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
  const path = '/reset-password';
  if (baseNoSlash === '') {
    return `${window.location.origin}${path}?token=<token>`;
  }
  return `${window.location.origin}${baseNoSlash}${path}?token=<token>`;
}
