import ISBN from 'isbn3';

/**
 * Format an ISBN for display with standard hyphenation:
 * ISBN-10: four groups (e.g. 2-07-036822-X); ISBN-13: five groups starting with 978 or 979.
 * Invalid checksums or unknown ranges are returned trimmed, unchanged.
 */
export function formatIsbnDisplay(value: string | null | undefined): string {
  if (value == null) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const parsed = ISBN.parse(trimmed);
  if (parsed?.isValid) {
    if (parsed.isIsbn13) return parsed.isbn13h;
    if (parsed.isIsbn10) return parsed.isbn10h ?? trimmed;
  }
  return trimmed;
}

/** Digits and X only, for Z39.50 CQL ISBN index (no hyphens). */
export function stripIsbnForZ3950Query(value: string): string {
  return value.trim().toUpperCase().replace(/[^0-9X]/g, '');
}
