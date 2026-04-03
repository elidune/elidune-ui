import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X, Tag, FileText } from 'lucide-react';
import api from '@/services/api';
import { base64ToDataUrl, isImageMime } from '@/utils/eventAttachment';
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS, TARGET_PUBLIC_KEYS } from './eventDisplayConstants';
import { formatEventDateOnly } from './eventDateFormat';
import EventFlyerImageBlock from './EventFlyerImageBlock';

interface EventDetailPaneProps {
  eventId: string;
  onClose: () => void;
}

export default function EventDetailPane({ eventId, onClose }: EventDetailPaneProps) {
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

  const metaRows: Array<{ label: string; value: string | null | undefined }> = detail
    ? [
        { label: t('events.date'), value: formatEventDateOnly(detail.eventDate) },
        {
          label: t('events.startTime'),
          value:
            detail.startTime || detail.endTime
              ? detail.startTime && detail.endTime
                ? `${detail.startTime}–${detail.endTime}`
                : detail.startTime || detail.endTime || ''
              : null,
        },
        { label: t('events.partnerName'), value: detail.partnerName },
        { label: t('events.targetPublicLabel'), value: targetLabel },
        {
          label: t('events.attendeesCount'),
          value: (() => {
            const a = detail.attendeesCount;
            const s = detail.studentsCount;
            if (a != null && s != null) return `${a} + ${s} ${t('events.students')}`;
            if (a != null) return String(a);
            if (s != null) return `${s} ${t('events.students')}`;
            return null;
          })(),
        },
        { label: t('events.schoolName'), value: detail.schoolName },
        { label: t('events.className'), value: detail.className },
      ].filter((r) => r.value)
    : [];

  const attachment = detail?.attachmentDataBase64
    ? {
        data: detail.attachmentDataBase64,
        mime: detail.attachmentMimeType ?? 'application/octet-stream',
        name: detail.attachmentFileName ?? 'attachment',
      }
    : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-gray-900">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-start gap-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
            {isLoading ? (
              <span className="inline-block h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            ) : (
              (detail?.name ?? '—')
            )}
          </h3>
          {detail && (
            <span
              className={`inline-flex mt-1 items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                EVENT_TYPE_COLORS[detail.eventType] ?? EVENT_TYPE_COLORS[6]
              }`}
            >
              <Tag className="h-3 w-3" />
              {typeLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0 transition-colors"
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 py-4 overflow-y-auto flex-1 space-y-4 text-sm">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : !detail ? null : (
          <>
            {metaRows.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {metaRows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-gray-400 dark:text-gray-500 whitespace-nowrap">{row.label}</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {attachment && isImageMime(attachment.mime) &&
              (detail.description ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-start sm:gap-4">
                  <div className="w-full shrink-0 sm:max-w-[min(100%,20rem)]">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 text-left">
                      {t('events.flyer')}
                    </p>
                    <div className="w-full [&_button]:block [&_button]:w-full [&_button]:text-left">
                      <EventFlyerImageBlock
                        variant="panel"
                        dataBase64={attachment.data}
                        mimeType={attachment.mime}
                        modalTitle={detail.name}
                      />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 basis-0 text-left">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 text-left">
                      {t('common.description')}
                    </p>
                    <p className="text-left text-gray-600 dark:text-gray-400 leading-relaxed">{detail.description}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                    {t('events.flyer')}
                  </p>
                  <EventFlyerImageBlock
                    variant="panel"
                    dataBase64={attachment.data}
                    mimeType={attachment.mime}
                    modalTitle={detail.name}
                  />
                </div>
              ))}

            {attachment && !isImageMime(attachment.mime) && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                  {t('events.attachment')}
                </p>
                <a
                  href={base64ToDataUrl(attachment.data, attachment.mime)}
                  download={attachment.name}
                  className="inline-flex items-center gap-2 text-amber-600 dark:text-amber-400 hover:underline font-medium"
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  {attachment.name}
                </a>
              </div>
            )}

            {detail.description && !(attachment && isImageMime(attachment.mime)) && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  {t('common.description')}
                </p>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{detail.description}</p>
              </div>
            )}

            {detail.notes && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                  {t('profile.notes', { defaultValue: 'Notes' })}
                </p>
                <p className="text-gray-600 dark:text-gray-400">{detail.notes}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
