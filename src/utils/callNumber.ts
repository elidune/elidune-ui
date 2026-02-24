/**
 * Builds a suggested call number: [CATEGORY_CODE]-[YEAR]-[FIRST_3_LETTERS_OF_NAME]
 * Example: Zoology + 2024 + Smith -> ZOO-2024-SMI
 */
export function buildSuggestedCallNumber(options: {
  categoryCode?: string | null;
  year?: number | string | null;
  authorOrCollectorName?: string | null;
}): string {
  const category = (options.categoryCode || 'GEN').toString().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'GEN';
  const year = options.year
    ? typeof options.year === 'number'
      ? options.year
      : parseInt(String(options.year).trim().slice(0, 4), 10)
    : new Date().getFullYear();
  const validYear = Number.isFinite(year) && year >= 1000 && year <= 9999 ? year : new Date().getFullYear();
  const namePart = (options.authorOrCollectorName || '')
    .trim()
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .pop(); // last name or last word
  const threeLetters = namePart ? namePart.slice(0, 3).toUpperCase() : 'XXX';
  return `${category}-${validYear}-${threeLetters}`;
}

/** Regex: alphanumeric, spaces, dots and dashes (e.g. E2 571.8 GAS). */
export const CALL_NUMBER_PATTERN = /^[A-Za-z0-9\s.-]*$/;

export function validateCallNumber(value: string): boolean {
  if (value === '') return true;
  return CALL_NUMBER_PATTERN.test(value);
}
