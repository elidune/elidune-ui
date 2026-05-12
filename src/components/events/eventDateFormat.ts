export function parseEventLocalDate(dateStr: string): Date | null {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** YYYY-MM for grouping and sorting upcoming events. */
export function eventMonthBucketKey(dateStr: string): string {
  const d = parseEventLocalDate(dateStr);
  if (!d) return '0000-00';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function formatEventMonthYearHeading(dateStr: string, locale: string): string {
  const d = parseEventLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function formatEventDateOnly(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

/** One-line caption for list cards: weekday + short date, optional time range. */
export function formatEventListWhenCaption(
  dateStr: string,
  locale: string,
  startTime: string | null,
  endTime: string | null,
): string {
  const timePart =
    startTime && endTime ? `${startTime}–${endTime}` : startTime || endTime || null;
  const d = parseEventLocalDate(dateStr);
  if (!d) {
    return [dateStr, timePart].filter(Boolean).join(' · ');
  }
  const weekday = d.toLocaleDateString(locale, { weekday: 'short' });
  const datePart = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  let s = `${weekday} ${datePart}`;
  if (timePart) s += ` · ${timePart}`;
  return s;
}
