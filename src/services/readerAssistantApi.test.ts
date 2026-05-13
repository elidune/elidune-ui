import { describe, it, expect } from 'vitest';
import {
  normalizeReaderAssistantMessageResponse,
  normalizeReaderAssistantSession,
} from './readerAssistantApi';

describe('readerAssistantApi normalizers', () => {
  it('normalizes assistant response with snake_case recommendations', () => {
    const raw = {
      session_id: 's-1',
      assistant_message_id: 'm-9',
      answer: 'Try this book.',
      fallback_used: true,
      recommendations: [
        {
          id: 'r1',
          kind: 'in_catalog',
          biblio_id: 'b42',
          rationale: 'Same genre.',
          score: 0.87,
          biblio: {
            title: 'Sample Title',
          },
        },
        {
          id: 'r2',
          kind: 'external',
          external_ref: 'https://example.org/work',
          rationale: 'Not in catalog.',
          score: 12,
        },
      ],
    };
    const n = normalizeReaderAssistantMessageResponse(raw);
    expect(n.sessionId).toBe('s-1');
    expect(n.assistantMessageId).toBe('m-9');
    expect(n.answer).toBe('Try this book.');
    expect(n.fallbackUsed).toBe(true);
    expect(n.recommendations[0].biblioId).toBe('b42');
    expect(n.recommendations[0].kind).toBe('in_catalog');
    expect(n.recommendations[1].externalRef).toBe('https://example.org/work');
    expect(n.recommendations[1].kind).toBe('external');
    expect(n.recommendations[0].biblio?.id).toBe('b42');
  });

  it('normalizes session/session_id and bigint user identifiers', () => {
    expect(
      normalizeReaderAssistantSession({
        session_id: 9007199254740995n,
        user_id: 9007199254740996n,
      }),
    ).toMatchObject({
      id: '9007199254740995',
      userId: '9007199254740996',
    });
    expect(normalizeReaderAssistantSession({ sessionId: 's1', userId: 7 })).toMatchObject({
      id: 's1',
      userId: '7',
    });
  });
});
