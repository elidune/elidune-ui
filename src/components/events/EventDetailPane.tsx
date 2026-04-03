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
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS, TARGET_PUBLIC_KEYS } from './eventDisplayConstants';
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

  const { data: detail, isLoading } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => api.getEvent(eventId),
    staleTime: 5 * 60 * 1000,
  });

  const typeLabel = detail
    ? t(EVENT_TYPE_KEYS[detail.eventType] ?? 'events.types.other', {
        defaultValue: String(detail.eventType),
      })
    : '';

  const targetLabel =
    detail?.targetPublic != null && TARGET_PUBLIC_KEYS[detail.targetPublic]
      ? t(TARGET_PUBLIC_KEYS[detail.targetPublic])
      : detail?.targetPublic != null
        ? String(detail.targetPublic)
        : null;

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
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex items-start gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug tracking-tight">
            {isLoading ? (
              <span className="inline-block h-5 w-2/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ) : (
              (detail?.name ?? '—')
            )}
          </h3>
          {detail && (
            <span
              className={`inline-flex mt-2 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                EVENT_TYPE_COLORS[detail.eventType] ?? EVENT_TYPE_COLORS[6]
              }`}
            >
              <Tag className="h-3.5 w-3.5" />
              {typeLabel}
            </span>
          )}
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0 transition-colors"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="px-5 py-5 overflow-y-auto flex-1 space-y-5 text-sm">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-32 rounded-xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : !detail ? null : (
          <>
            {/* When — date & time */}
            <div className="rounded-xl border border-amber-200/90 dark:border-amber-800/50 bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/40 dark:via-gray-900 dark:to-amber-950/20 p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:min-w-[12rem]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-900/50 dark:text-amber-300">
                    <Calendar className="h-5 w-5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/90 dark:text-amber-400/90">
                      {t('events.date')}
                    </p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatEventDateOnly(detail.eventDate)}
                    </p>
                  </div>
                </div>
                {timeRange ? (
                  <div className="flex min-w-0 flex-1 items-start gap-3 sm:min-w-[12rem] sm:border-l sm:border-amber-200/80 sm:pl-6 dark:sm:border-amber-800/50">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/90 text-amber-700 shadow-sm ring-1 ring-amber-200/80 dark:bg-gray-800/80 dark:text-amber-300 dark:ring-amber-800/50">
                      <Clock className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800/90 dark:text-amber-400/90">
                        {t('events.startTime')}
                      </p>
                      <p className="mt-0.5 text-lg font-semibold text-gray-900 dark:text-white">{timeRange}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Contact & practical info */}
            {secondaryLines.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/50 p-4 shadow-sm">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {secondaryLines.map((row) => (
                    <li key={row.label} className="flex gap-3 rounded-lg bg-white/70 p-3 dark:bg-gray-900/40">
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

            {attachment && isImageMime(attachment.mime) &&
              (detail.description ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-start sm:gap-6">
                  <div className="w-full shrink-0 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/50 shadow-sm dark:border-gray-700 dark:bg-gray-800/30 sm:max-w-[min(100%,20rem)]">
                    <div className="w-full p-2 [&>button]:block [&>button]:w-full [&>button]:text-left">
                      <EventFlyerImageBlock
                        variant="panel"
                        dataBase64={attachment.data}
                        mimeType={attachment.mime}
                        modalTitle={detail.name}
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 basis-0 rounded-xl border border-gray-100 bg-white/80 p-4 text-left shadow-sm dark:border-gray-700 dark:bg-gray-900/30">
                    <p className="leading-relaxed text-gray-600 dark:text-gray-300">{detail.description}</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/50 p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800/30">
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
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {t('events.attachment')}
                </p>
                <a
                  href={base64ToDataUrl(attachment.data, attachment.mime)}
                  download={attachment.name}
                  className="mt-2 inline-flex items-center gap-2 font-medium text-amber-600 hover:underline dark:text-amber-400"
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  {attachment.name}
                </a>
              </div>
            )}

            {detail.description && !(attachment && isImageMime(attachment.mime)) && (
              <div className="rounded-xl border border-gray-100 bg-white/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/30">
                <p className="leading-relaxed text-gray-600 dark:text-gray-300">{detail.description}</p>
              </div>
            )}

            {detail.notes && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 dark:border-gray-600 dark:bg-gray-800/30">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {t('profile.notes', { defaultValue: 'Notes' })}
                </p>
                <p className="mt-2 text-gray-600 dark:text-gray-400">{detail.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
