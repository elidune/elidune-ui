import JSONbigint from 'json-bigint';

const readerAssistantParser = JSONbigint({ useNativeBigInt: true, strict: true });

/**
 * Parse reader-assistant JSON bodies without losing precision for i64-sized integers.
 * Small integers decode as JavaScript numbers; large ones as bigint (see normalizeApiIdentifier).
 */
export function parseReaderAssistantJson(text: string): unknown {
  return readerAssistantParser.parse(text);
}

/**
 * Canonical string form for API ids that may arrive as string, bigint, or safe integers.
 */
export function normalizeApiIdentifier(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) {
      return String(Math.trunc(value));
    }
    return String(value);
  }
  return String(value);
}

/**
 * Reads the first non-empty id among common Rust/JSON key variants.
 */
export function pickRecordId(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, k)) continue;
    const id = normalizeApiIdentifier(record[k]);
    if (id !== '') return id;
  }
  return '';
}
