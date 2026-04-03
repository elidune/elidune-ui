import { useTranslation } from 'react-i18next';
import { Calendar, ChevronRight, Clock, Tag, Users } from 'lucide-react';
import type { Event } from '@/types';
import EventAttachmentLead from './EventAttachmentLead';
import EventDetailPane from './EventDetailPane';
import { formatEventDateOnly } from './eventDateFormat';
import { EVENT_TYPE_COLORS, EVENT_TYPE_KEYS } from './eventDisplayConstants';

interface PublicEventsPanelProps {
  events: Event[];
  isLoading: boolean;
  /** When set, header shows "{{count}} event(s)" */
  total?: number;
  selectedEventId: string | null;
  onSelectEvent: (id: string | null) => void;
  emptyMessage: string;
}

export default function PublicEventsPanel({
  events,
  isLoading,
  total,
  selectedEventId,
  onSelectEvent,
  emptyMessage,
}: PublicEventsPanelProps) {
  const { t } = useTranslation();

  return (
    <>
      <div
        className={`flex flex-col overflow-hidden flex-shrink-0 min-h-0 ${
          selectedEventId ? 'w-72 border-r border-gray-100 dark:border-gray-800' : 'flex-1'
        }`}
      >
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {total !== undefined ? t('events.count', { count: total }) : t('events.currentEvents')}
          </h3>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-2 min-h-0">
          {isLoading ? (
            <div className="py-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-stretch gap-0 border-b border-gray-50 dark:border-gray-800/50 last:border-0 animate-pulse overflow-hidden rounded-lg"
                >
                  <div className="w-20 flex-shrink-0 min-h-[5.5rem] bg-gray-100 dark:bg-gray-800" />
                  <div className="flex-1 space-y-2 py-3.5 pl-3 pr-2">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                    <div className="h-5 w-20 bg-gray-100 dark:bg-gray-800 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400 leading-relaxed px-2">
              {emptyMessage}
            </p>
          ) : (
            <div>
              {events.map((event) => {
                const isSelected = selectedEventId === event.id;
                const typeKey = EVENT_TYPE_KEYS[event.eventType] ?? 'events.types.other';
                const timeLine =
                  event.startTime && event.endTime
                    ? `${event.startTime}–${event.endTime}`
                    : event.startTime || event.endTime || null;

                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onSelectEvent(isSelected ? null : event.id)}
                    className={`w-full min-h-[5.5rem] text-left flex items-stretch gap-0 border-b border-gray-50 dark:border-gray-800/50 last:border-0 rounded-lg overflow-hidden px-0 -mx-2 transition-colors ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex w-20 flex-shrink-0 flex-col self-stretch overflow-hidden min-h-0">
                      <div className="flex min-h-0 flex-1 flex-col">
                        <EventAttachmentLead event={event} isSelected={isSelected} layout="listRow" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 py-3.5 pl-3 pr-1">
                      <p
                        className={`text-base font-medium truncate ${
                          isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {event.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0 opacity-70" />
                          {formatEventDateOnly(event.eventDate)}
                        </span>
                        {timeLine && (
                          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-500">
                            <Clock className="h-3 w-3" />
                            {timeLine}
                          </span>
                        )}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            EVENT_TYPE_COLORS[event.eventType] ?? EVENT_TYPE_COLORS[6]
                          }`}
                        >
                          <Tag className="h-2.5 w-2.5" />
                          {t(typeKey)}
                        </span>
                        {event.attendeesCount != null && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                            <Users className="h-3 w-3" />
                            {event.attendeesCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center pr-2.5 flex-shrink-0">
                      <ChevronRight
                        className={`h-5 w-5 transition-colors ${
                          isSelected ? 'text-amber-500 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedEventId && (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          <EventDetailPane eventId={selectedEventId} onClose={() => onSelectEvent(null)} />
        </div>
      )}
    </>
  );
}
