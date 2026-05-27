import { useTranslation } from 'react-i18next';
import { Building2, GraduationCap, Tag, Users } from 'lucide-react';
import type { Event, PublicType } from '@/types';
import { formatEventListWhenCaption } from './eventDateFormat';
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS } from './eventDisplayConstants';
import { eventTimesFromRow } from '@/utils/eventTimes';
import { eventPublicTypeDisplayLabel } from '@/utils/eventPublicType';

export interface PublicEventDetailsContentProps {
  event: Event;
  publicTypes: PublicType[];
  /** List card truncates description; overlay shows full text. */
  variant?: 'card' | 'overlay';
  /** Overlay header shows the title separately. */
  hideTitle?: boolean;
}

export default function PublicEventDetailsContent({
  event,
  publicTypes,
  variant = 'card',
  hideTitle = false,
}: PublicEventDetailsContentProps) {
  const { t, i18n } = useTranslation();
  const isOverlay = variant === 'overlay';

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
  const description = event.description?.trim() || null;
  const notes = event.notes?.trim() || null;
  const bodyText = description || notes;
  const isNotesOnly = !description && Boolean(notes);

  const attendeesLine = (() => {
    const a = event.attendeesCount;
    const s = event.studentsCount;
    if (a != null && s != null) return `${a} + ${s} ${t('events.students')}`;
    if (a != null) return String(a);
    if (s != null) return `${s} ${t('events.students')}`;
    return null;
  })();

  const TitleTag = isOverlay ? 'h2' : 'h4';

  return (
    <div className={`relative flex min-w-0 flex-col ${isOverlay ? 'gap-4' : 'gap-2'}`}>
      <div
        className={`flex items-start gap-3 ${hideTitle ? 'flex-wrap' : 'justify-between'}`}
      >
        {!hideTitle && (
          <TitleTag
            className={`min-w-0 flex-1 pr-1 font-bold leading-snug tracking-tight text-gray-900 dark:text-white ${
              isOverlay ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'
            }`}
          >
            {event.name}
          </TitleTag>
        )}
        <div
          className={`flex flex-wrap items-start gap-2 ${
            hideTitle ? '' : 'max-w-[min(100%,14rem)] shrink-0 justify-end sm:max-w-[55%]'
          }`}
        >
          <span
            className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 font-medium ${
              isOverlay ? 'text-xs' : 'text-[11px]'
            } ${EVENT_TYPE_COLORS[!Number.isNaN(typeNum) ? typeNum : 6] ?? EVENT_TYPE_COLORS[6]}`}
          >
            <Tag className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0 break-words">{t(typeKey)}</span>
          </span>
          {targetLabel && (
            <span
              className={`max-w-full break-words rounded-md bg-amber-100/90 px-2 py-0.5 font-medium text-amber-900 ring-1 ring-amber-300/70 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-700/70 ${
                isOverlay ? 'text-xs' : 'text-[11px]'
              }`}
            >
              {targetLabel}
            </span>
          )}
        </div>
      </div>

      <p
        className={`font-medium tabular-nums text-gray-500 dark:text-gray-400 ${
          isOverlay ? 'text-sm sm:text-base' : 'text-xs'
        }`}
      >
        {whenLine}
      </p>

      {bodyText && (
        <div className="min-w-0">
          {isNotesOnly && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {t('profile.notes')}
            </p>
          )}
          <p
            className={`leading-relaxed text-gray-600 dark:text-gray-300 ${
              isOverlay ? 'text-base sm:text-lg whitespace-pre-wrap' : 'line-clamp-3 text-sm'
            }`}
          >
            {bodyText}
          </p>
        </div>
      )}

      {isOverlay && description && notes && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/30">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('profile.notes')}
          </p>
          <p className="mt-2 text-base leading-relaxed whitespace-pre-wrap text-gray-600 dark:text-gray-400">
            {notes}
          </p>
        </div>
      )}

      <ul
        className={`mt-1 flex list-none flex-col text-gray-600 dark:text-gray-400 ${
          isOverlay ? 'gap-2.5 text-sm sm:text-base' : 'gap-1.5 text-xs'
        }`}
      >
        {event.partnerName && (
          <li className="flex gap-2">
            <Building2
              className={`mt-0.5 shrink-0 text-gray-400 ${isOverlay ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
              aria-hidden
            />
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
            <GraduationCap
              className={`mt-0.5 shrink-0 text-gray-400 ${isOverlay ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
              aria-hidden
            />
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
            <Users
              className={`mt-0.5 shrink-0 text-gray-400 ${isOverlay ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
              aria-hidden
            />
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
            <Users
              className={`mt-0.5 shrink-0 text-gray-400 ${isOverlay ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
              aria-hidden
            />
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
  );
}
