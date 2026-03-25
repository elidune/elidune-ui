import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Filter, X } from 'lucide-react';
import { Button, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, type MediaType, type MediaTypeOption } from '@/types';
import api from '@/services/api';
import type { StatsInterval, AdvancedStatsParams, UserShort } from '@/types';

interface StatsFiltersProps {
  onFiltersChange: (params: AdvancedStatsParams) => void;
  isLoading?: boolean;
}

export default function StatsFilters({ onFiltersChange }: StatsFiltersProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isUserAdmin = isAdmin(user?.accountType);

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [interval, setInterval] = useState<StatsInterval>('day');
  const [mediaType, setMediaType] = useState<MediaType | ''>('');
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<UserShort[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const MEDIA_TYPES: MediaTypeOption[] = [
    { value: '', label: t('stats.allTypes') },
    { value: 'unknown', label: t('items.mediaType.unknown') },
    { value: 'printedText', label: t('items.mediaType.printedText') },
    { value: 'comics', label: t('items.mediaType.comics') },
    { value: 'periodic', label: t('items.mediaType.periodic') },
    { value: 'video', label: t('items.mediaType.video') },
    { value: 'videoTape', label: t('items.mediaType.videoTape') },
    { value: 'videoDvd', label: t('items.mediaType.videoDvd') },
    { value: 'audio', label: t('items.mediaType.audio') },
    { value: 'audioMusic', label: t('items.mediaType.audioMusic') },
    { value: 'audioMusicTape', label: t('items.mediaType.audioMusicTape') },
    { value: 'audioMusicCd', label: t('items.mediaType.audioMusicCd') },
    { value: 'audioNonMusic', label: t('items.mediaType.audioNonMusic') },
    { value: 'cdRom', label: t('items.mediaType.cdRom') },
    { value: 'images', label: t('items.mediaType.images') },
    { value: 'multimedia', label: t('items.mediaType.multimedia') },
  ];

  const INTERVALS: { value: StatsInterval; label: string }[] = [
    { value: 'day', label: t('stats.interval.day') },
    { value: 'week', label: t('stats.interval.week') },
    { value: 'month', label: t('stats.interval.month') },
    { value: 'year', label: t('stats.interval.year') },
  ];

  useEffect(() => {
    if (isUserAdmin && showFilters) {
      setIsLoadingUsers(true);
      api.getUsers({ perPage: 100 })
        .then((response) => setUsers(response.items))
        .catch((error) => console.error('Error fetching users:', error))
        .finally(() => setIsLoadingUsers(false));
    }
  }, [isUserAdmin, showFilters]);

  useEffect(() => {
    // Convert dates to ISO 8601 format with time
    const startDateTime = new Date(startDate);
    startDateTime.setHours(0, 0, 0, 0);
    const endDateTime = new Date(endDate);
    endDateTime.setHours(23, 59, 59, 999);

    const params: AdvancedStatsParams = {
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      interval,
    };

    if (mediaType) {
      params.mediaType = mediaType;
    }

    if (selectedUserId) {
      params.userId = selectedUserId;
    } else if (!isUserAdmin && user?.id) {
      params.userId = user.id;
    }

    onFiltersChange(params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, interval, mediaType, selectedUserId, user?.id, isUserAdmin]);

  const handleReset = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    setStartDate(date.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
    setInterval('day');
    setMediaType('');
    setSelectedUserId(undefined);
  };

  const hasActiveFilters = mediaType !== '' || selectedUserId !== undefined || interval !== 'day';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('stats.advancedFilters')}
          </h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<Filter className="h-4 w-4" />}
        >
          {showFilters ? t('common.hideFilters') : t('common.showFilters')}
        </Button>
      </div>

      {showFilters && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.startDate')}
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.endDate')}
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.intervalLabel')}
              </label>
              <select
                value={interval}
                onChange={(e) => setInterval(e.target.value as StatsInterval)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                {INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.mediaType')}
              </label>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as MediaType | '')}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                {MEDIA_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isUserAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.user')}
              </label>
              <select
                value={selectedUserId || ''}
                onChange={(e) => setSelectedUserId(e.target.value || undefined)}
                disabled={isLoadingUsers}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
              >
                <option value="">{t('stats.allUsers')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstname} {u.lastname} ({u.accountType})
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isUserAdmin && user && (
            <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {t('stats.viewingMyStats', { name: `${user.firstname} ${user.lastname}` })}
              </p>
            </div>
          )}

          {hasActiveFilters && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset} leftIcon={<X className="h-4 w-4" />}>
                {t('common.reset')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
