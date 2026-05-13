import type { AxiosRequestConfig } from 'axios';
import type {
  PaginatedResponse,
  ReaderRecommendation,
  ReaderRecommendationKind,
  ReaderAssistantAskBody,
  ReaderAssistantChatTurn,
  ReaderAssistantSession,
  ReaderAssistantSessionCreateBody,
  ReaderAssistantSessionDetail,
  ReaderAssistantUserMessageBody,
  ReaderAssistantMessageResponse,
  BiblioShort,
} from '@/types';
import api from '@/services/api';
import { normalizePaginatedResponse } from '@/utils/serverJson';
import { normalizeApiIdentifier, parseReaderAssistantJson, pickRecordId } from '@/utils/readerAssistantJson';

function s(v: unknown): string {
  return v == null ? '' : String(v);
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRecommendation(raw: unknown): ReaderRecommendation {
  const r = raw as Record<string, unknown>;
  const kindRaw = String(r.kind ?? '').trim();
  const kind: ReaderRecommendationKind = kindRaw === 'external' ? 'external' : 'in_catalog';
  let biblio: BiblioShort | null | undefined =
    r.biblio === null || r.biblio === undefined
      ? (r.biblio as null | undefined)
      : ({ ...(r.biblio as BiblioShort) } as BiblioShort);
  const biblioIdRaw = r.biblioId ?? r.biblio_id;
  if (biblio && !(biblio as BiblioShort).id && biblioIdRaw != null) {
    biblio = { ...(biblio as BiblioShort), id: normalizeApiIdentifier(biblioIdRaw) };
  }
  const biblioId =
    biblioIdRaw !== null && biblioIdRaw !== undefined ? normalizeApiIdentifier(biblioIdRaw) : null;
  return {
    id: pickRecordId(r, ['id', 'recommendation_id', 'recommendationId']),
    kind,
    biblioId: biblioId !== '' ? biblioId : null,
    biblio: biblio ?? null,
    externalRef:
      r.externalRef != null
        ? s(r.externalRef)
        : r.external_ref != null
          ? s(r.external_ref)
          : null,
    score: num(r.score, 0),
    rationale: s(r.rationale),
  };
}

/** Normalizes POST message / POST ask response bodies (camelCase + snake_case). */
export function normalizeReaderAssistantMessageResponse(data: unknown): ReaderAssistantMessageResponse {
  const r = data as Record<string, unknown>;
  const recRaw = r.recommendations;
  const recommendations = Array.isArray(recRaw) ? (recRaw as unknown[]).map(normalizeRecommendation) : [];
  return {
    sessionId: pickRecordId(r, ['sessionId', 'session_id']),
    assistantMessageId: pickRecordId(r, ['assistantMessageId', 'assistant_message_id', 'message_id', 'messageId']),
    answer: s(r.answer),
    provider: r.provider != null ? s(r.provider) : null,
    model: r.model != null ? s(r.model) : null,
    fallbackUsed: Boolean(r.fallbackUsed ?? r.fallback_used),
    recommendations,
  };
}

export function normalizeReaderAssistantSession(raw: unknown): ReaderAssistantSession {
  const r = raw as Record<string, unknown>;
  const titleRaw = r.title;
  const deletedRaw = r.deletedAt ?? r.deleted_at;
  const createdRaw = r.createdAt ?? r.created_at;
  const updatedRaw = r.updatedAt ?? r.updated_at;
  return {
    id: pickRecordId(r, ['id', 'session_id', 'sessionId']),
    userId: pickRecordId(r, ['userId', 'user_id']),
    title: titleRaw === null || titleRaw === undefined || titleRaw === '' ? null : s(titleRaw),
    createdAt:
      createdRaw !== null && createdRaw !== undefined
        ? normalizeApiIdentifier(createdRaw) || s(createdRaw)
        : '',
    updatedAt:
      updatedRaw !== null && updatedRaw !== undefined
        ? normalizeApiIdentifier(updatedRaw) || s(updatedRaw)
        : '',
    deletedAt:
      deletedRaw === null || deletedRaw === undefined || deletedRaw === ''
        ? null
        : normalizeApiIdentifier(deletedRaw) || s(deletedRaw),
  };
}

export function normalizeReaderAssistantChatTurn(raw: unknown): ReaderAssistantChatTurn {
  const r = raw as Record<string, unknown>;
  const roleRaw = String(r.role ?? '').trim();
  const role: 'user' | 'assistant' = roleRaw === 'assistant' ? 'assistant' : 'user';
  const recRaw = r.recommendations;
  const recommendations = Array.isArray(recRaw)
    ? (recRaw as unknown[]).map(normalizeRecommendation)
    : undefined;
  const createdRaw = r.createdAt ?? r.created_at;
  return {
    id: pickRecordId(r, ['id', 'message_id', 'messageId']),
    role,
    content: s(r.content),
    createdAt:
      createdRaw !== null && createdRaw !== undefined
        ? normalizeApiIdentifier(createdRaw) || s(createdRaw)
        : null,
    recommendations,
    fallbackUsed:
      role === 'assistant' ? Boolean(r.fallbackUsed ?? r.fallback_used) : undefined,
    provider: role === 'assistant' && r.provider != null ? s(r.provider) : null,
    model: role === 'assistant' && r.model != null ? s(r.model) : null,
  };
}

export function normalizeReaderAssistantSessionDetail(raw: unknown): ReaderAssistantSessionDetail {
  const base = normalizeReaderAssistantSession(raw);
  const r = raw as Record<string, unknown>;
  const msgs = r.messages;
  const messages = Array.isArray(msgs)
    ? (msgs as unknown[]).map(normalizeReaderAssistantChatTurn)
    : undefined;
  return { ...base, messages };
}

/**
 * Axios default JSON parsing maps large i64 integers to unsafe JS numbers — corrupting ids before we see them.
 * Reader-assistant uses text + json-bigint so session/user/message ids survive round-trip stringification in URLs/cache.
 */
async function requestReaderAssistantJson<T>(
  config: Omit<AxiosRequestConfig, 'responseType' | 'transformResponse'>,
): Promise<T> {
  const res = await api.axiosClient.request<string>({
    ...config,
    responseType: 'text',
    transformResponse: [(data: unknown): unknown => data],
  });

  const raw = res.data;
  if (raw == null || String(raw).trim() === '') {
    return undefined as T;
  }

  try {
    return parseReaderAssistantJson(String(raw)) as T;
  } catch {
    throw new SyntaxError('reader-assistant: response body is not valid JSON');
  }
}

export const readerAssistantApi = {
  async probeList(): Promise<number> {
    const res = await api.axiosClient.request<string>({
      method: 'get',
      url: '/reader-assistant/sessions',
      params: { page: 1, perPage: 1 },
      validateStatus: (status) => status < 600,
      responseType: 'text',
      transformResponse: [(data: unknown): unknown => data],
    });
    return res.status;
  },

  async createSession(body?: ReaderAssistantSessionCreateBody): Promise<ReaderAssistantSession> {
    const data = await requestReaderAssistantJson<unknown>({
      method: 'post',
      url: '/reader-assistant/sessions',
      data: body ?? {},
    });
    return normalizeReaderAssistantSession(data);
  },

  async listSessions(page = 1, perPage = 20): Promise<PaginatedResponse<ReaderAssistantSession>> {
    const data = await requestReaderAssistantJson<unknown>({
      method: 'get',
      url: '/reader-assistant/sessions',
      params: { page, perPage },
    });
    const paginated = normalizePaginatedResponse<unknown>(data);
    return {
      ...paginated,
      items: paginated.items.map(normalizeReaderAssistantSession),
    };
  },

  async getSession(id: string): Promise<ReaderAssistantSessionDetail> {
    const data = await requestReaderAssistantJson<unknown>({
      method: 'get',
      url: `/reader-assistant/sessions/${id}`,
    });
    return normalizeReaderAssistantSessionDetail(data);
  },

  async deleteSession(id: string): Promise<void> {
    await api.axiosClient.request<string>({
      method: 'delete',
      url: `/reader-assistant/sessions/${id}`,
      responseType: 'text',
      transformResponse: [(data: unknown): unknown => data],
    });
  },

  async postMessage(
    sessionId: string,
    body: ReaderAssistantUserMessageBody,
  ): Promise<ReaderAssistantMessageResponse> {
    const data = await requestReaderAssistantJson<unknown>({
      method: 'post',
      url: `/reader-assistant/sessions/${sessionId}/messages`,
      data: body,
    });
    return normalizeReaderAssistantMessageResponse(data);
  },

  async ask(body: ReaderAssistantAskBody): Promise<ReaderAssistantMessageResponse> {
    const data = await requestReaderAssistantJson<unknown>({
      method: 'post',
      url: '/ask',
      data: body,
    });
    return normalizeReaderAssistantMessageResponse(data);
  },
};
