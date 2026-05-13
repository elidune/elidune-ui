import { describe, it, expect } from 'vitest';
import {
  classifyReaderAssistantHttpStatus,
  isProbeStatusFeatureUnavailable,
} from './readerAssistantErrors';

describe('readerAssistantErrors', () => {
  it('classifies 401/403/404/400/422', () => {
    expect(classifyReaderAssistantHttpStatus(401)).toBe('unauthorized');
    expect(classifyReaderAssistantHttpStatus(403)).toBe('forbidden');
    expect(classifyReaderAssistantHttpStatus(404)).toBe('not_found');
    expect(classifyReaderAssistantHttpStatus(400)).toBe('validation');
    expect(classifyReaderAssistantHttpStatus(422)).toBe('quota');
  });

  it('classifies 502/503 as temporary unavailability', () => {
    expect(classifyReaderAssistantHttpStatus(503)).toBe('temporary_unavailable');
    expect(classifyReaderAssistantHttpStatus(502)).toBe('temporary_unavailable');
  });

  it('classifies 500+ as server', () => {
    expect(classifyReaderAssistantHttpStatus(500)).toBe('server');
  });

  it('marks probe feature-unavailable statuses', () => {
    expect(isProbeStatusFeatureUnavailable(404)).toBe(true);
    expect(isProbeStatusFeatureUnavailable(501)).toBe(true);
    expect(isProbeStatusFeatureUnavailable(503)).toBe(true);
    expect(isProbeStatusFeatureUnavailable(200)).toBe(false);
    expect(isProbeStatusFeatureUnavailable(502)).toBe(false);
  });
});
