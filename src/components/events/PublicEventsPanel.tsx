import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Event, PublicType } from '@/types';
import EventAttachmentLead from './EventAttachmentLead';
import EventPublicOverlay from './EventPublicOverlay';
import PublicEventDetailsContent from './PublicEventDetailsContent';
import { formatEventListWhenCaption } from './eventDateFormat';
import { APP_LIST_SCROLL_ROOT_CLASS } from '@/components/common';
import { usePublicEventsInfiniteQuery } from '@/hooks/events/usePublicEventsInfiniteQuery';
import { eventTimesFromRow, isPastEventDate } from '@/utils/eventTimes';
import { usePublicTypesQuery } from '@/hooks/usePublicTypesQuery';

export interface PublicEventsPanelProps {
  queryKey?: readonly unknown[];
  emptyMessage: string;
}

function compareUpcomingEvents(a: Event, b: Event): number {
  const da = a.eventDate.localeCompare(b.eventDate);
  if (da !== 0) return da;
  const ta = a.startTime ?? '';
  const tb = b.startTime ?? '';
  return ta.localeCompare(tb);
}

function comparePastEvents(a: Event, b: Event): number {
  const da = b.eventDate.localeCompare(a.eventDate);
  if (da !== 0) return da;
  const ta = a.startTime ?? '';
  const tb = b.startTime ?? '';
  return tb.localeCompare(ta);
}

function splitEventsByDate(events: Event[]): { upcoming: Event[]; past: Event[] } {
  const upcoming: Event[] = [];
  const past: Event[] = [];
  for (const event of events) {
    if (isPastEventDate(event.eventDate)) {
      past.push(event);
    } else {
      upcoming.push(event);
    }
  }
  upcoming.sort(compareUpcomingEvents);
  past.sort(comparePastEvents);
  return { upcoming, past };
}

function dedupeEvents(events: Event[]): Event[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

interface PublicEventCardProps {
  event: Event;
  publicTypes: PublicType[];
  dimmed?: boolean;
}

function PublicEventCard({ event, publicTypes, dimmed = false }: PublicEventCardProps) {
  const { i18n } = useTranslation();
  const [overlayOpen, setOverlayOpen] = useState(false);
  const { startTime, endTime } = eventTimesFromRow(event);
  const whenLine = formatEventListWhenCaption(
    event.eventDate,
    i18n.language,
    startTime,
    endTime,
  );

  const openOverlay = () => setOverlayOpen(true);

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        aria-label={`${event.name} - ${whenLine}`}
        onClick={openOverlay}
        onKeyDown={(eventKey) => {
          if (eventKey.key === 'Enter' || eventKey.key === ' ') {
            eventKey.preventDefault();
            openOverlay();
          }
        }}
        className={`w-full cursor-pointer rounded-2xl border border-gray-200/90 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:shadow-black/20 dark:focus-visible:ring-offset-gray-950 ${
          dimmed ? 'opacity-70 saturate-[0.75]' : ''
        }`}
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
          <div className="flex shrink-0 justify-center sm:justify-start">
            <EventAttachmentLead
              event={event}
              isSelected={false}
              layout="card"
              interactive={false}
            />
          </div>

          <PublicEventDetailsContent event={event} publicTypes={publicTypes} variant="card" />
        </div>
      </article>

      <EventPublicOverlay
        event={event}
        publicTypes={publicTypes}
        isOpen={overlayOpen}
        onClose={() => setOverlayOpen(false)}
      />
    </>
  );
}

function PastEventsSeparator() {
  const { t } = useTranslation();
  return (
    <li role="separator" aria-label={t('events.pastEvents')} className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {t('events.pastEvents')}
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </li>
  );
}

export default function PublicEventsPanel({
  queryKey = ['public-events'],
  emptyMessage,
}: PublicEventsPanelProps) {
  const { t } = useTranslation();
  const { data: publicTypes = [] } = usePublicTypesQuery();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = usePublicEventsInfiniteQuery(queryKey);

  const events = useMemo(
    () => dedupeEvents(data?.pages.flatMap((page) => page.events) ?? []),
    [data?.pages],
  );

  const { upcoming, past } = useMemo(() => splitEventsByDate(events), [events]);
  const hasEvents = upcoming.length > 0 || past.length > 0;

  useEffect(() => {
    const el = loadMoreRef.current;
    const scrollRoot = el?.closest(`.${APP_LIST_SCROLL_ROOT_CLASS}`) ?? null;
    if (!el || !scrollRoot || !hasNextPage || isFetchingNextPage || !data?.pages?.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { root: scrollRoot, rootMargin: '200px', threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data?.pages?.length]);

  return (
    <div className="grid min-h-0 min-w-0 w-full flex-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden self-stretch">
  
      <div
        className={`${APP_LIST_SCROLL_ROOT_CLASS} min-h-0 overflow-y-auto bg-gray-50/70 px-3 py-4 [scrollbar-gutter:stable] sm:px-5 dark:bg-gray-950/30`}
        aria-busy={isLoading || isFetchingNextPage}
      >
        {isLoading ? (
          <div className="flex w-full min-w-0 flex-col gap-4" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
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
        ) : !hasEvents ? (
          <p
            role="status"
            aria-live="polite"
            className="w-full px-1 py-12 text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400"
          >
            {emptyMessage}
          </p>
        ) : (
          <ul className="flex w-full min-w-0 list-none flex-col gap-4">
            {upcoming.length === 0 && past.length > 0 && (
              <li>
                <p className="px-1 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t('events.noCurrentEvents')}
                </p>
              </li>
            )}
            {upcoming.map((event) => (
              <li key={event.id}>
                <PublicEventCard event={event} publicTypes={publicTypes} />
              </li>
            ))}
            {past.length > 0 && (
              <>
                <PastEventsSeparator />
                {past.map((event) => (
                  <li key={event.id}>
                    <PublicEventCard event={event} publicTypes={publicTypes} dimmed />
                  </li>
                ))}
              </>
            )}
            {(hasNextPage || isFetchingNextPage) && (
              <li aria-hidden={!isFetchingNextPage}>
                <div
                  ref={loadMoreRef}
                  className="flex h-4 flex-shrink-0 items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400"
                  aria-live="polite"
                >
                  {isFetchingNextPage ? t('common.loading') : null}
                </div>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
