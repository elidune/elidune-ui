import { describe, it, expect } from 'vitest';
import { normalizeApiIdentifier, parseReaderAssistantJson } from '@/utils/readerAssistantJson';

describe('readerAssistantJson', () => {
  it('parses i64 integers as bigint preserving precision', () => {
    const text =
      '{"id":9007199254740993,"user_id":9007199254740994,"small":42,"sid":"explicit-string"}';
    const o = parseReaderAssistantJson(text) as Record<string, unknown>;

    expect(typeof o.id).toBe('bigint');
    expect(typeof o.small).toBe('number');

    expect(normalizeApiIdentifier(o.id)).toBe('9007199254740993');
    expect(normalizeApiIdentifier(o.user_id)).toBe('9007199254740994');
    expect(normalizeApiIdentifier(o.small)).toBe('42');
    expect(normalizeApiIdentifier(o.sid)).toBe('explicit-string');
  });
});
