/** YYYY-MM-DD for HTML date inputs */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() + years);
  return out;
}

export function defaultExpiryDateInputOneYearFromNow(): string {
  return toDateInputValue(addYears(new Date(), 1));
}

/** Date-only string → ISO end-of-day UTC for consistent API payloads */
export function dateInputToIsoEndOfDayUtc(dateYmd: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  if (!y || !m || !d) return new Date(dateYmd).toISOString();
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)).toISOString();
}

export function isSubscriptionExpired(expiryAt: string | null | undefined): boolean {
  if (expiryAt == null || expiryAt === '') return false;
  const t = new Date(expiryAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

/**
 * Renew: new expiry = now + (previous expiry − createdAt), i.e. same subscription length.
 */
export function computeRenewedExpiryAt(
  expiryAt: string | null | undefined,
  createdAt: string | null | undefined
): string {
  const exp = expiryAt != null && expiryAt !== '' ? new Date(expiryAt).getTime() : NaN;
  const cre = createdAt != null && createdAt !== '' ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(exp) || !Number.isFinite(cre)) {
    return addYears(new Date(), 1).toISOString();
  }
  const durationMs = exp - cre;
  if (durationMs <= 0) {
    return addYears(new Date(), 1).toISOString();
  }
  return new Date(Date.now() + durationMs).toISOString();
}
