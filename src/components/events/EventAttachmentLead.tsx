import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText } from 'lucide-react';
import api from '@/services/api';
import type { Event } from '@/types';
import { isImageMime } from '@/utils/eventAttachment';
import EventFlyerImageBlock from './EventFlyerImageBlock';

interface EventAttachmentLeadProps {
  event: Event;
  isSelected: boolean;
  /** Full-height strip for public event list rows; compact table thumb; square public card */
  layout?: 'compact' | 'listRow' | 'card';
}

export default function EventAttachmentLead({
  event,
  isSelected,
  layout = 'compact',
}: EventAttachmentLeadProps) {
  const imageMime = isImageMime(event.attachmentMimeType);

  const { data, isLoading } = useQuery({
    queryKey: ['public-event', event.id],
    queryFn: () => api.getEvent(event.id),
    enabled: imageMime,
    staleTime: 5 * 60 * 1000,
  });

  const b64 = data?.attachmentDataBase64;
  const mime = data?.attachmentMimeType ?? event.attachmentMimeType;
  const listRow = layout === 'listRow';
  const card = layout === 'card';

  const placeholderBorder = card
    ? isSelected
      ? 'bg-white dark:bg-gray-900 border-amber-300/90 dark:border-amber-700/60'
      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200/90 dark:border-gray-700'
    : listRow
      ? isSelected
        ? 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800'
        : 'bg-amber-50 dark:bg-amber-900/25 border-gray-200 dark:border-gray-700'
      : isSelected
        ? 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800'
        : 'bg-amber-50 dark:bg-amber-900/25 border-transparent';

  if (imageMime) {
    if (isLoading) {
      return (
        <div
          className={
            card
              ? 'h-28 w-28 sm:h-32 sm:w-32 flex-shrink-0 rounded-xl border border-transparent bg-gray-100 dark:bg-gray-800 animate-pulse'
              : listRow
                ? 'flex flex-1 min-h-0 h-full w-full flex-shrink-0 bg-gray-100 dark:bg-gray-800 animate-pulse border-r border-transparent'
                : 'w-8 h-11 rounded flex-shrink-0 bg-gray-100 dark:bg-gray-800 animate-pulse border border-transparent'
          }
        />
      );
    }
    if (b64 && mime && isImageMime(mime)) {
      if (card) {
        return (
          <div className="h-28 w-28 sm:h-32 sm:w-32 flex-shrink-0 overflow-hidden rounded-xl border border-gray-200/90 dark:border-gray-700 shadow-sm">
            <EventFlyerImageBlock
              variant="cardPoster"
              dataBase64={b64}
              mimeType={mime}
              modalTitle={event.name}
              className="min-h-0 flex-1"
            />
          </div>
        );
      }
      if (listRow) {
        return (
          <div className="flex min-h-0 flex-1 flex-col">
            <EventFlyerImageBlock
              variant="listLead"
              dataBase64={b64}
              mimeType={mime}
              modalTitle={event.name}
              className="min-h-0 flex-1"
            />
          </div>
        );
      }
      return (
        <EventFlyerImageBlock
          variant="thumb"
          dataBase64={b64}
          mimeType={mime}
          modalTitle={event.name}
          className="flex-shrink-0"
        />
      );
    }
  }

  if (event.attachmentFileName && !imageMime) {
    return (
      <div
        title={event.attachmentFileName}
        className={
          card
            ? `h-28 w-28 sm:h-32 sm:w-32 flex-shrink-0 rounded-xl border flex items-center justify-center transition-colors ${placeholderBorder}`
            : listRow
              ? `flex flex-1 min-h-0 h-full w-full items-center justify-center border-r transition-colors ${placeholderBorder}`
              : `w-8 h-11 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${placeholderBorder}`
        }
      >
        <FileText
          className={`${card ? 'h-7 w-7' : listRow ? 'h-5 w-5' : 'h-4 w-4'} ${
            isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-amber-700 dark:text-amber-500'
          }`}
        />
      </div>
    );
  }

  return (
    <div
      className={
        card
          ? `h-28 w-28 sm:h-32 sm:w-32 flex-shrink-0 rounded-xl border flex items-center justify-center transition-colors ${placeholderBorder}`
          : listRow
            ? `flex flex-1 min-h-0 h-full w-full items-center justify-center border-r transition-colors ${placeholderBorder}`
            : `w-8 h-11 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${placeholderBorder}`
      }
    >
      <Calendar
        className={`${card ? 'h-7 w-7' : listRow ? 'h-5 w-5' : 'h-4 w-4'} ${
          isSelected ? 'text-amber-600 dark:text-amber-400' : 'text-amber-700 dark:text-amber-500'
        }`}
      />
    </div>
  );
}
