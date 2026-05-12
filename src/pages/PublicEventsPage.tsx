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

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['app-public-events'],
    queryFn: () => api.getEvents({ perPage: 50, page: 1 }),
    staleTime: 2 * 60 * 1000,
  });

  const canManage = isLibrarian(user?.accountType);

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('home.upcomingEvents')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('home.upcomingEventsSubtitle')}</p>
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

      <Card
        padding="none"
        className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1 overflow-hidden">
          <PublicEventsPanel
            events={eventsData?.events ?? []}
            isLoading={eventsLoading}
            total={eventsData?.total}
            emptyMessage={t('opac.eventsEmpty')}
          />
        </div>
      </Card>
    </div>
  );
}
