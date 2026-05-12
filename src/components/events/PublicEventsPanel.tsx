import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, GraduationCap, Tag, Users } from 'lucide-react';
import type { Event } from '@/types';
import EventAttachmentLead from './EventAttachmentLead';
import { formatEventListWhenCaption } from './eventDateFormat';
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS } from './eventDisplayConstants';
import { eventTimesFromRow } from '@/utils/eventTimes';
import { usePublicTypesQuery } from '@/hooks/usePublicTypesQuery';
import { eventPublicTypeDisplayLabel } from '@/utils/eventPublicType';

export interface PublicEventsPanelProps {
  events: Event[];
  isLoading: boolean;
  /** When set, header shows "{{count}} event(s)" */
  total?: number;
  emptyMessage: string;
}

function compareEvents(a: Event, b: Event): number {
  const da = b.eventDate.localeCompare(a.eventDate);
  if (da !== 0) return da;
  const ta = a.startTime ?? '';
  const tb = b.startTime ?? '';
  return tb.localeCompare(ta);
}

export default function PublicEventsPanel({
  events,
  isLoading,
  total,
  emptyMessage,
}: PublicEventsPanelProps) {
  const { t, i18n } = useTranslation();
  const { data: publicTypes = [] } = usePublicTypesQuery();

  const sortedEvents = useMemo(() => [...events].sort(compareEvents), [events]);

  return (
    <div className="grid min-h-0 min-w-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden self-stretch">
      <div className="flex-shrink-0 border-b border-gray-200/90 bg-gray-50/90 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/40">
        <h3 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
          {total !== undefined ? t('events.count', { count: total }) : t('events.currentEvents')}
        </h3>
      </div>

      <div
        className="min-h-0 bg-gray-50/70 px-3 py-4 [scrollbar-gutter:stable] sm:px-5 dark:bg-gray-950/30"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="flex w-full min-w-0 flex-col gap-4" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse gap-4 rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/50 sm:p-5"
              >
                <div className="h-28 w-28 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800 sm:h-32 sm:w-32" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                  <div className="h-5 rounded-md bg-gray-100 dark:bg-gray-800 sm:w-4/5" />
                  <div className="h-3 rounded-md bg-gray-100 dark:bg-gray-800 sm:w-full" />
                  <div className="h-3 rounded-md bg-gray-100 dark:bg-gray-800 sm:w-2/3" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-6 w-24 rounded-full bg-gray-100 dark:bg-gray-800" />
                    <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-gray-800" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length === 0 ? (
          <p
            role="status"
            aria-live="polite"
            className="w-full px-1 py-12 text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400"
          >
            {emptyMessage}
          </p>
        ) : (
          <ul className="flex w-full min-w-0 list-none flex-col gap-4">
            {sortedEvents.map((event) => {
              const typeNum = Number(event.eventType);
              const typeKey =
                !Number.isNaN(typeNum)
                  ? (EVENT_TYPE_KEYS[typeNum] ?? 'events.types.other')
                  : 'events.types.other';
              const { startTime, endTime } = eventTimesFromRow(event);
              const whenLine = formatEventListWhenCaption(
                event.eventDate,
                i18n.language,
                startTime,
                endTime,
              );
              const targetLabel = eventPublicTypeDisplayLabel(event.publicType, publicTypes);
              const attendeesLine = (() => {
                const a = event.attendeesCount;
                const s = event.studentsCount;
                if (a != null && s != null) return `${a} + ${s} ${t('events.students')}`;
                if (a != null) return String(a);
                if (s != null) return `${s} ${t('events.students')}`;
                return null;
              })();

              const bodyText = event.description?.trim() || event.notes?.trim() || null;
              const isNotesOnly = !event.description?.trim() && Boolean(event.notes?.trim());

              return (
                <li key={event.id}>
                  <article
                    aria-label={`${event.name} - ${whenLine}`}
                    className="w-full rounded-2xl border border-gray-200/90 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900/60 dark:hover:shadow-black/20"
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
                      <div className="flex shrink-0 justify-center sm:justify-start">
                        <EventAttachmentLead event={event} isSelected={false} layout="card" />
                      </div>

                      {/* Card body: top row = title (left) + type/target badges (top-right); then date, detail, meta */}
                      <div className="relative flex min-w-0 flex-1 flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="min-w-0 flex-1 pr-1 text-lg font-bold leading-snug tracking-tight text-gray-900 dark:text-white sm:text-xl">
                            {event.name}
                          </h4>
                          <div className="flex max-w-[min(100%,14rem)] shrink-0 flex-wrap items-start justify-end gap-2 sm:max-w-[55%]">
                            <span
                              className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                EVENT_TYPE_COLORS[!Number.isNaN(typeNum) ? typeNum : 6] ?? EVENT_TYPE_COLORS[6]
                              }`}
                            >
                              <Tag className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="min-w-0 break-words">{t(typeKey)}</span>
                            </span>
                            {targetLabel && (
                              <span className="max-w-full break-words rounded-md bg-amber-100/90 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-300/70 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/70">
                                {targetLabel}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">
                          {whenLine}
                        </p>

                        {bodyText && (
                          <div className="min-w-0">
                            {isNotesOnly && (
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                {t('profile.notes')}
                              </p>
                            )}
                            <p className="line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                              {bodyText}
                            </p>
                          </div>
                        )}

                        <ul className="mt-1 flex list-none flex-col gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          {event.partnerName && (
                            <li className="flex gap-2">
                              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                              <span className="min-w-0 leading-snug">
                                <span className="font-medium text-gray-500 dark:text-gray-500">
                                  {t('events.partnerName')}:{' '}
                                </span>
                                {event.partnerName}
                              </span>
                            </li>
                          )}
                          {event.schoolName && (
                            <li className="flex gap-2">
                              <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                              <span className="min-w-0 leading-snug">
                                <span className="font-medium text-gray-500 dark:text-gray-500">
                                  {t('events.schoolName')}:{' '}
                                </span>
                                {event.schoolName}
                              </span>
                            </li>
                          )}
                          {event.className && (
                            <li className="flex gap-2">
                              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                              <span className="min-w-0 leading-snug">
                                <span className="font-medium text-gray-500 dark:text-gray-500">
                                  {t('events.className')}:{' '}
                                </span>
                                {event.className}
                              </span>
                            </li>
                          )}
                          {attendeesLine && (
                            <li className="flex gap-2">
                              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
                              <span className="leading-snug">
                                <span className="font-medium text-gray-500 dark:text-gray-500">
                                  {t('events.attendeesCount')}:{' '}
                                </span>
                                {attendeesLine}
                              </span>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
