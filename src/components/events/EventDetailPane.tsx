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
import api from '@/services/api';
import { base64ToDataUrl, isImageMime } from '@/utils/eventAttachment';
import { usePublicTypesQuery } from '@/hooks/usePublicTypesQuery';
import { eventPublicTypeDisplayLabel } from '@/utils/eventPublicType';
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS } from './eventDisplayConstants';
import { formatEventDateOnly } from './eventDateFormat';
import EventFlyerImageBlock from './EventFlyerImageBlock';

interface EventDetailPaneProps {
  eventId: string;
  onClose: () => void;
  /** When false, hides the header close control (e.g. single-event layout with no list to return to). */
  showCloseButton?: boolean;
}

type InfoLine = { icon: LucideIcon; label: string; value: string };

export default function EventDetailPane({ eventId, onClose, showCloseButton = true }: EventDetailPaneProps) {
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

  const timeRange =
    detail && (detail.startTime || detail.endTime)
      ? detail.startTime && detail.endTime
        ? `${detail.startTime}–${detail.endTime}`
        : detail.startTime || detail.endTime || ''
      : null;

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
      <div className="flex flex-shrink-0 flex-col gap-4 border-b border-gray-200/80 bg-gradient-to-b from-gray-50/90 to-white px-5 py-4 dark:border-gray-800 dark:from-gray-900 dark:to-gray-900 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white sm:text-2xl">
            {isLoading ? (
              <span className="inline-block h-7 w-2/3 max-w-md rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
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
              <Tag className="h-3.5 w-3.5" aria-hidden />
              {typeLabel}
            </span>
          )}
        </div>

        <div className="flex w-full max-w-full flex-shrink-0 flex-col flex-wrap gap-2 min-[500px]:flex-row min-[500px]:items-stretch min-[500px]:justify-end sm:max-w-[min(100%,32rem)]">
          {detail && !isLoading && (
            <div
              className="inline-flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200/70 bg-amber-50/90 px-3 py-2 text-gray-900 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-white"
              role="status"
              aria-label={[
                formatEventDateOnly(detail.eventDate),
                timeRange ? timeRange : null,
              ]
                .filter(Boolean)
                .join(', ')}
            >
              <span className="inline-flex items-center gap-1.5">
                <Calendar
                  className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="text-base font-semibold tabular-nums">{formatEventDateOnly(detail.eventDate)}</span>
              </span>
              {timeRange ? (
                <span className="inline-flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
                  <span className="text-amber-800/50 dark:text-amber-500/80" aria-hidden>
                    ·
                  </span>
                  <Clock className="h-4 w-4 shrink-0 text-amber-700/80 dark:text-amber-400/90" strokeWidth={2} aria-hidden />
                  <span className="text-base font-semibold">{timeRange}</span>
                </span>
              ) : null}
            </div>
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              className="self-end rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 min-[500px]:self-center dark:hover:bg-gray-800 dark:hover:text-gray-300"
              aria-label={t('common.close')}
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-20 rounded-2xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-16 rounded-2xl bg-gray-100 dark:bg-gray-800" />
              <div className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
            </div>
          ) : !detail ? null : (
            <>
              {attachment && isImageMime(attachment.mime) &&
                (detail.description ? (
                  <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:gap-6">
                    <div className="w-full shrink-0 overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-b from-gray-50/80 to-white shadow-sm ring-1 ring-gray-100/80 sm:max-w-[min(20rem,40vw)] dark:border-gray-600 dark:from-gray-800/50 dark:to-gray-900 dark:ring-gray-800">
                      <div className="w-full p-2 [&>button]:block [&>button]:w-full [&>button]:text-left">
                        <EventFlyerImageBlock
                          variant="panel"
                          dataBase64={attachment.data}
                          mimeType={attachment.mime}
                          modalTitle={detail.name}
                        />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl bg-gray-50/70 px-4 py-3.5 text-left dark:bg-gray-800/40">
                      <p className="text-base leading-relaxed text-gray-700 dark:text-gray-200">{detail.description}</p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-sm overflow-hidden rounded-2xl border border-gray-200/70 bg-gradient-to-b from-gray-50/80 to-white p-2 shadow-sm ring-1 ring-gray-100/80 dark:border-gray-600 dark:from-gray-800/50 dark:to-gray-900 dark:ring-gray-800">
                    <EventFlyerImageBlock
                      variant="panel"
                      dataBase64={attachment.data}
                      mimeType={attachment.mime}
                      modalTitle={detail.name}
                    />
                  </div>
                ))}

              {attachment && !isImageMime(attachment.mime) && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 p-4 dark:bg-gray-800/40">
                  <a
                    href={base64ToDataUrl(attachment.data, attachment.mime)}
                    download={attachment.name}
                    className="inline-flex items-center gap-2 font-medium text-amber-600 hover:underline dark:text-amber-400"
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    {attachment.name}
                  </a>
                </div>
              )}

              {detail.description && !(attachment && isImageMime(attachment.mime)) && (
                <div className="rounded-2xl bg-gray-50/70 px-4 py-3.5 dark:bg-gray-800/40">
                  <p className="text-base leading-relaxed text-gray-700 dark:text-gray-200">{detail.description}</p>
                </div>
              )}

              {detail.notes && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/30">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    {t('profile.notes')}
                  </p>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">{detail.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {!isLoading && detail && secondaryLines.length > 0 && (
          <div className="shrink-0 border-t border-gray-200 bg-gray-50/95 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/60">
            <ul className="grid gap-3 sm:grid-cols-2">
              {secondaryLines.map((row) => (
                <li key={row.label} className="flex gap-3 rounded-lg bg-white/80 p-3 dark:bg-gray-900/50">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                    <row.icon className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {row.label}
                    </p>
                    <p className="mt-0.5 font-medium leading-snug text-gray-900 dark:text-gray-100">{row.value}</p>
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
