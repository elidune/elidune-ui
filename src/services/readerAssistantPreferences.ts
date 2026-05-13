/** User preferences for reader assistant (no tokens or sensitive content). */

const KEY_INCLUDE_EXTERNAL = 'reader_assistant_include_external_default';
const KEY_LAST_SESSION = 'reader_assistant_last_session_id';
const KEY_LOCAL_TITLES = 'reader_assistant_local_session_titles';

function readJsonTitles(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY_LOCAL_TITLES);
    if (!raw) return {};
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string' && val.trim()) out[k] = val.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function saveJsonTitles(titles: Record<string, string>): void {
  localStorage.setItem(KEY_LOCAL_TITLES, JSON.stringify(titles));
}

export function loadIncludeExternalDefault(): boolean {
  try {
    return localStorage.getItem(KEY_INCLUDE_EXTERNAL) === '1';
  } catch {
    return false;
  }
}

export function saveIncludeExternalDefault(value: boolean): void {
  try {
    localStorage.setItem(KEY_INCLUDE_EXTERNAL, value ? '1' : '0');
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function loadLastSessionId(): string | null {
  try {
    const v = localStorage.getItem(KEY_LAST_SESSION);
    return v && v.trim() !== '' ? v.trim() : null;
  } catch {
    return null;
  }
}

export function saveLastSessionId(sessionId: string | null): void {
  try {
    if (sessionId == null || sessionId === '') localStorage.removeItem(KEY_LAST_SESSION);
    else localStorage.setItem(KEY_LAST_SESSION, sessionId);
  } catch {
    /* ignore */
  }
}

export function getLocalSessionTitle(sessionId: string): string | undefined {
  return readJsonTitles()[sessionId];
}

export function setLocalSessionTitle(sessionId: string, title: string): void {
  const next = readJsonTitles();
  const t = title.trim();
  if (t === '') delete next[sessionId];
  else next[sessionId] = t;
  saveJsonTitles(next);
}

export function removeLocalSessionTitle(sessionId: string): void {
  const next = readJsonTitles();
  delete next[sessionId];
  saveJsonTitles(next);
}
