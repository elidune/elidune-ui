import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { Card, Button } from '@/components/common';
import PublicEventsPanel from '@/components/events/PublicEventsPanel';
import { useAuth } from '@/contexts/AuthContext';
import { isLibrarian } from '@/types';
import api from '@/services/api';

export default function PublicEventsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const userDismissedEventSelectionRef = useRef(false);

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['app-public-events'],
    queryFn: () => api.getEvents({ perPage: 50, page: 1 }),
    staleTime: 2 * 60 * 1000,
  });

  const eventRows = eventsData?.events;

  const handleSelectEvent = useCallback((id: string | null) => {
    if (id === null) userDismissedEventSelectionRef.current = true;
    else userDismissedEventSelectionRef.current = false;
    setSelectedEventId(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedEventId) {
        if (eventRows?.length === 1) return;
        userDismissedEventSelectionRef.current = true;
        setSelectedEventId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEventId, eventRows]);

  // Keep list selection in sync with fetched events (default first row; respect user dismiss).
  /* eslint-disable react-hooks/set-state-in-effect -- sync selection with fetched list */
  useEffect(() => {
    if (eventsLoading) return;
    if (!eventRows || eventRows.length === 0) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId((prev) => {
      const inList = prev != null && eventRows.some((e) => e.id === prev);
      if (inList) return prev;
      if (prev === null && userDismissedEventSelectionRef.current) return null;
      userDismissedEventSelectionRef.current = false;
      return eventRows[0].id;
    });
  }, [eventRows, eventsLoading]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canManage = isLibrarian(user?.accountType);

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('home.upcomingEvents')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('home.upcomingEventsSubtitle')}</p>
        </div>
        {canManage && (
          <Button
            type="button"
            variant="secondary"
            className="shrink-0"
            leftIcon={<CalendarDays className="h-4 w-4" />}
            onClick={() => navigate('/events/manage')}
          >
            {t('events.manageEvents')}
          </Button>
        )}
      </div>

      <Card padding="none" className="overflow-hidden flex flex-col min-h-[380px] max-h-[min(560px,calc(100vh-14rem))]">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <PublicEventsPanel
            events={eventsData?.events ?? []}
            isLoading={eventsLoading}
            total={eventsData?.total}
            selectedEventId={selectedEventId}
            onSelectEvent={handleSelectEvent}
            emptyMessage={t('opac.eventsEmpty')}
          />
        </div>
      </Card>
    </div>
  );
}
