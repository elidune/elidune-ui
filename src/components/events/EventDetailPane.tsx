import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  X,
  Tag,
  FileText,
  Calendar,
  Clock,
  Users,
  Building2,
  GraduationCap,
  UserCircle,
} from 'lucide-react';
import type { Event } from '@/types';
import api from '@/services/api';
import { base64ToDataUrl, isImageMime } from '@/utils/eventAttachment';
import { usePublicTypesQuery } from '@/hooks/usePublicTypesQuery';
import { eventPublicTypeDisplayLabel } from '@/utils/eventPublicType';
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS } from './eventDisplayConstants';
import { formatEventDateOnly } from './eventDateFormat';
import { eventTimesFromRow, formatEventTimeRange } from '@/utils/eventTimes';
import EventFlyerImageBlock from './EventFlyerImageBlock';

interface EventDetailPaneProps {
  eventId: string;
  onClose: () => void;
  /** When false, hides the header close control (e.g. single-event layout with no list to return to). */
  showCloseButton?: boolean;
  /** List row for the same event — used to show times when GET /events/:id omits them or uses different keys. */
  listEvent?: Event | null;
}

type InfoLine = { icon: LucideIcon; label: string; value: string };

export default function EventDetailPane({
  eventId,
  onClose,
  showCloseButton = true,
  listEvent = null,
}: EventDetailPaneProps) {
  const { t } = useTranslation();
  const { data: publicTypes = [] } = usePublicTypesQuery();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => api.getEvent(eventId),
    staleTime: 5 * 60 * 1000,
  });

  const eventTypeNum =
    detail != null && detail.eventType != null && !Number.isNaN(Number(detail.eventType))
      ? Number(detail.eventType)
      : null;
  const typeLabel =
    detail && eventTypeNum != null
      ? t(EVENT_TYPE_KEYS[eventTypeNum] ?? 'events.types.other')
      : '';

  const targetLabel =
    detail != null ? eventPublicTypeDisplayLabel(detail.publicType, publicTypes) : null;

  const detailTimes = detail ? eventTimesFromRow(detail) : { startTime: null, endTime: null };
  const listTimes = listEvent ? eventTimesFromRow(listEvent) : { startTime: null, endTime: null };
  const mergedStart = detailTimes.startTime ?? listTimes.startTime;
  const mergedEnd = detailTimes.endTime ?? listTimes.endTime;
  const timeRange = formatEventTimeRange(mergedStart, mergedEnd);

  const attendeesLine = detail
    ? (() => {
        const a = detail.attendeesCount;
        const s = detail.studentsCount;
        if (a != null && s != null) return `${a} + ${s} ${t('events.students')}`;
        if (a != null) return String(a);
        if (s != null) return `${s} ${t('events.students')}`;
        return null;
      })()
    : null;

  const secondaryLines: InfoLine[] = [];
  if (detail?.partnerName) {
    secondaryLines.push({
      icon: Building2,
      label: t('events.partnerName'),
      value: detail.partnerName,
    });
  }
  if (targetLabel) {
    secondaryLines.push({
      icon: UserCircle,
      label: t('events.targetPublicLabel'),
      value: targetLabel,
    });
  }
  if (attendeesLine) {
    secondaryLines.push({
      icon: Users,
      label: t('events.attendeesCount'),
      value: attendeesLine,
    });
  }
  if (detail?.schoolName) {
    secondaryLines.push({
      icon: GraduationCap,
      label: t('events.schoolName'),
      value: detail.schoolName,
    });
  }
  if (detail?.className) {
    secondaryLines.push({
      icon: Users,
      label: t('events.className'),
      value: detail.className,
    });
  }

  const attachment = detail?.attachmentDataBase64
    ? {
        data: detail.attachmentDataBase64,
        mime: detail.attachmentMimeType ?? 'application/octet-stream',
        name: detail.attachmentFileName ?? 'attachment',
      }
    : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-gray-900">
      <header className="flex shrink-0 flex-col gap-3 border-b border-gray-200/90 px-4 py-4 dark:border-gray-800 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white">
              {isLoading ? (
                <span className="inline-block h-8 w-2/3 max-w-md animate-pulse rounded-md bg-gray-100 dark:bg-gray-800" />
              ) : (
                (detail?.name ?? '—')
              )}
            </h3>
            {detail && typeLabel && (
              <span
                className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  EVENT_TYPE_COLORS[eventTypeNum ?? 6] ?? EVENT_TYPE_COLORS[6]
                }`}
              >
                <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {typeLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {detail && !isLoading && (
              <div
                className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 tabular-nums dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100"
                role="status"
                aria-label={[
                  formatEventDateOnly(detail.eventDate),
                  timeRange ? timeRange : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                  <span className="text-sm font-semibold sm:text-base">{formatEventDateOnly(detail.eventDate)}</span>
                </span>
                {timeRange ? (
                  <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                    <span className="text-gray-300 dark:text-gray-600" aria-hidden>
                      ·
                    </span>
                    <Clock className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" strokeWidth={2} aria-hidden />
                    <span className="text-sm font-semibold sm:text-base">{timeRange}</span>
                  </span>
                ) : null}
              </div>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isLoading ? (
          <div className="mx-auto min-h-0 flex-1 space-y-4 px-4 py-5 animate-pulse sm:px-5">
            <div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : !detail ? null : (() => {
          const hasImage = attachment && isImageMime(attachment.mime);
          const hasImageDescRow = Boolean(hasImage && detail.description);
          const hasImageOnly = Boolean(hasImage && !detail.description);

          return (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              {hasImageDescRow ? (
                <>
                  <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:gap-6">
                    <div className="flex w-full max-w-full shrink-0 flex-col items-center lg:max-w-[min(44vw,22rem)] xl:max-w-[min(38vw,24rem)]">
                      <div className="flex w-full max-w-full justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50 p-2 dark:border-gray-700 dark:bg-gray-800/30">
                        <EventFlyerImageBlock
                          variant="panel"
                          fillAvailable
                          dataBase64={attachment!.data}
                          mimeType={attachment!.mime}
                          modalTitle={detail.name}
                        />
                      </div>
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto text-sm lg:flex-1">
                      <p className="text-base leading-relaxed text-gray-700 dark:text-gray-200">
                        {detail.description}
                      </p>
                    </div>
                  </div>
                  {detail.notes && (
                    <div className="mx-auto w-full max-w-3xl shrink-0 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          {t('profile.notes')}
                        </p>
                        <p className="mt-2 leading-relaxed text-gray-600 dark:text-gray-400">{detail.notes}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : hasImageOnly ? (
                <>
                  <div className="flex shrink-0 flex-col items-center px-4 py-4 sm:px-5">
                    <div className="flex w-full max-w-[min(100%,28rem)] justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50/50 p-2 dark:border-gray-700 dark:bg-gray-800/30">
                      <EventFlyerImageBlock
                        variant="panel"
                        fillAvailable
                        dataBase64={attachment!.data}
                        mimeType={attachment!.mime}
                        modalTitle={detail.name}
                      />
                    </div>
                  </div>
                  {detail.notes && (
                    <div className="mx-auto w-full max-w-3xl shrink-0 border-t border-gray-100 px-4 py-4 dark:border-gray-800 sm:px-5">
                      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          {t('profile.notes')}
                        </p>
                        <p className="mt-2 leading-relaxed text-gray-600 dark:text-gray-400">{detail.notes}</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 text-sm sm:px-5">
                  {attachment && !isImageMime(attachment.mime) && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                      <a
                        href={base64ToDataUrl(attachment.data, attachment.mime)}
                        download={attachment.name}
                        className="inline-flex items-center gap-2 font-medium text-amber-600 hover:underline dark:text-amber-400"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        {attachment.name}
                      </a>
                    </div>
                  )}

                  {detail.description && (
                    <p className="max-w-prose text-base leading-relaxed text-gray-700 dark:text-gray-200">
                      {detail.description}
                    </p>
                  )}

                  {detail.notes && (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/30">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {t('profile.notes')}
                      </p>
                      <p className="mt-2 leading-relaxed text-gray-600 dark:text-gray-400">{detail.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {!isLoading && detail && secondaryLines.length > 0 && (
          <div className="shrink-0 border-t border-gray-200/90 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/50 sm:px-5">
            <ul className="mx-auto grid max-w-3xl gap-2 sm:grid-cols-2 sm:gap-3">
              {secondaryLines.map((row) => (
                <li
                  key={row.label}
                  className="flex gap-2.5 rounded-lg border border-gray-100 bg-white px-2.5 py-2 dark:border-gray-800 dark:bg-gray-950/40"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <row.icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {row.label}
                    </p>
                    <p className="mt-0.5 text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">{row.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
