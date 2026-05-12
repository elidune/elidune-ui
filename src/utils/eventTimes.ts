/** Read start/end times from an Event or snake_case API payload. */
export function eventTimesFromRow(row: unknown): { startTime: string | null; endTime: string | null } {
  if (!row || typeof row !== 'object') {
    return { startTime: null, endTime: null };
  }
  const o = row as Record<string, unknown>;
  const st = o.startTime ?? o.start_time;
  const et = o.endTime ?? o.end_time;
  const startTime = typeof st === 'string' && st.trim() ? st.trim() : null;
  const endTime = typeof et === 'string' && et.trim() ? et.trim() : null;
  return { startTime, endTime };
}

export function formatEventTimeRange(startTime: string | null, endTime: string | null): string | null {
  if (startTime && endTime) return `${startTime}–${endTime}`;
  if (startTime) return startTime;
  if (endTime) return endTime;
  return null;
}
