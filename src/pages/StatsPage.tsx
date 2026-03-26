import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Users,
  BookMarked,
  AlertTriangle,
  User,
  Library,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Table2,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Card, CardHeader, Badge, Table, Input } from '@/components/common';
import api from '@/services/api';
import type { Stats, AdvancedStatsParams, MediaType, MediaTypeOption, StatsInterval, UserLoanStats, UserAggregateStats, CatalogStats, CatalogStatsBreakdown } from '@/types';
import { translateStatLabel } from '@/utils/codeLabels';
import StatsAdvancedTab from '@/components/stats/StatsAdvancedTab';

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType | string | null | undefined): string {
  if (!mediaType) return 'unknown';
  const legacyMap: Record<string, string> = {
    u: 'unknown',
    b: 'printedText',
    bc: 'comics',
    p: 'periodic',
    v: 'video',
    vt: 'videoTape',
    vd: 'videoDvd',
    a: 'audio',
    am: 'audioMusic',
    amt: 'audioMusicTape',
    amc: 'audioMusicCd',
    an: 'audioNonMusic',
    ant: 'audioNonMusicTape',
    anc: 'audioNonMusicCd',
    c: 'cdRom',
    i: 'images',
    m: 'multimedia',
  };
  return legacyMap[String(mediaType)] ?? String(mediaType);
}

interface LoanTimeData {
  date: string;
  loans: number;
  returns: number;
}

type UserStatsData = UserLoanStats;

type StatsDetailTab = 'catalog' | 'users' | 'loans' | 'advanced';

export default function StatsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Advanced stats state
  const [isLoadingAdvancedStats, setIsLoadingAdvancedStats] = useState(false);
  const [statsParams, setStatsParams] = useState<AdvancedStatsParams | null>(null);
  
  // Filter states for loan evolution chart
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [interval, setInterval] = useState<StatsInterval>('day');
  const [mediaType, setMediaType] = useState<MediaType | ''>('');
  
  // Timeline state
  const [timelineData, setTimelineData] = useState<LoanTimeData[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  const currentYear = new Date().getFullYear();

  // Catalog stats state (GET /stats/catalog)
  const [catalogStats, setCatalogStats] = useState<CatalogStats | null>(null);
  const [isLoadingCatalogStats, setIsLoadingCatalogStats] = useState(true);
  const [catalogStatsYear, setCatalogStatsYear] = useState<number | 'all'>('all');
  const [catalogStatsBySource, setCatalogStatsBySource] = useState(false);
  const [catalogStatsByMediaType, setCatalogStatsByMediaType] = useState(false);
  const [catalogStatsByPublicType, setCatalogStatsByPublicType] = useState(false);

  // User stats state (GET /stats/users: leaderboard vs aggregate)
  type UserStatsMode = 'leaderboard' | 'aggregate';
  const [userStatsMode, setUserStatsMode] = useState<UserStatsMode>('aggregate');
  const [userStats, setUserStats] = useState<UserStatsData[]>([]);
  const [userStatsAggregate, setUserStatsAggregate] = useState<UserAggregateStats | null>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSortBy, setUserSortBy] = useState<'totalLoans' | 'activeLoans' | 'overdueLoans'>('totalLoans');
  const [userStatsLimit, setUserStatsLimit] = useState(20);
  const [userStatsLeaderboardYear, setUserStatsLeaderboardYear] = useState<number | 'all'>('all');
  const [userStatsAggregateYear, setUserStatsAggregateYear] = useState<number | 'all'>('all');
  const [statsDetailTab, setStatsDetailTab] = useState<StatsDetailTab>('catalog');

  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index);

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

  // Update statsParams when filters change
  useEffect(() => {
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

    setStatsParams(params);
  }, [startDate, endDate, interval, mediaType]);

  // Fetch main stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.getStats();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch advanced stats (loans tab only)
  useEffect(() => {
    if (statsDetailTab !== 'loans' || !statsParams) {
      return;
    }

    setIsLoadingAdvancedStats(true);
    setIsLoadingTimeline(true);

    const fetchAdvancedStats = async () => {
      try {
        const response = await api.getLoanStats(statsParams);
        setTimelineData(response.timeSeries.map(item => ({
          date: item.period,
          loans: item.loans,
          returns: item.returns,
        })));
      } catch (error) {
        console.error('Error fetching loan stats:', error);
        setTimelineData([]);
      } finally {
        setIsLoadingAdvancedStats(false);
        setIsLoadingTimeline(false);
      }
    };

    fetchAdvancedStats();
  }, [statsDetailTab, statsParams]);

  // Helper function to convert year to startDate and endDate
  const yearToDateRange = (year: number) => {
    const startDate = new Date(year, 0, 1); // January 1st
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, 11, 31); // December 31st
    endDate.setHours(23, 59, 59, 999);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  // Fetch catalog stats from API (catalog tab only)
  useEffect(() => {
    if (statsDetailTab !== 'catalog') {
      return;
    }

    const fetchCatalogStats = async () => {
      setIsLoadingCatalogStats(true);
      try {
        const params: {
          startDate?: string;
          endDate?: string;
          bySource?: boolean;
          byMediaType?: boolean;
          byPublicType?: boolean;
        } = {
          bySource: catalogStatsBySource,
          byMediaType: catalogStatsByMediaType,
          byPublicType: catalogStatsByPublicType,
        };

        // Add date range only if a specific year is selected
        if (catalogStatsYear !== 'all') {
          const dateRange = yearToDateRange(catalogStatsYear);
          params.startDate = dateRange.startDate;
          params.endDate = dateRange.endDate;
        }

        const data = await api.getCatalogStats(params);
        setCatalogStats(data);
      } catch (error) {
        console.error('Error fetching catalog stats:', error);
        setCatalogStats(null);
      } finally {
        setIsLoadingCatalogStats(false);
      }
    };

    fetchCatalogStats();
  }, [statsDetailTab, catalogStatsYear, catalogStatsBySource, catalogStatsByMediaType, catalogStatsByPublicType]);

  // Fetch user stats from API (users tab only)
  useEffect(() => {
    if (statsDetailTab !== 'users') {
      return;
    }

    setIsLoadingUsers(true);

    const fetchUserStats = async () => {
      try {
        if (userStatsMode === 'aggregate') {
          const params: {
            startDate?: string;
            endDate?: string;
          } = {};
          
          // Add date range only if a specific year is selected
          if (userStatsAggregateYear !== 'all') {
            const dateRange = yearToDateRange(userStatsAggregateYear);
            params.startDate = dateRange.startDate;
            params.endDate = dateRange.endDate;
          }
          
          const data = await api.getUserAggregateStats(params);
          setUserStatsAggregate(data);
          setUserStats([]);
        } else {
          const params: {
            sortBy?: 'totalLoans' | 'activeLoans' | 'overdueLoans';
            limit?: number;
            startDate?: string;
            endDate?: string;
          } = {
            sortBy: userSortBy,
            limit: userStatsLimit,
          };
          
          // Add date range only if a specific year is selected
          if (userStatsLeaderboardYear !== 'all') {
            const dateRange = yearToDateRange(userStatsLeaderboardYear);
            params.startDate = dateRange.startDate;
            params.endDate = dateRange.endDate;
          }
          
          const data = await api.getUserLoanStats(params);
          const list = Array.isArray(data) ? data : (data as Record<string, unknown>)?.users ?? (data as Record<string, unknown>)?.items ?? [];
          setUserStats(list as UserStatsData[]);
          setUserStatsAggregate(null);
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
        setUserStats([]);
        setUserStatsAggregate(null);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUserStats();
  }, [statsDetailTab, userStatsMode, userSortBy, userStatsLimit, userStatsLeaderboardYear, userStatsAggregateYear]);

  const formatDate = (dateStr: string) => {
    const interval = statsParams?.interval || 'day';
    
    // Handle ISO week format (YYYY-Www)
    if (interval === 'week' && /^\d{4}-W\d{2}$/.test(dateStr)) {
      const [year, week] = dateStr.split('-W');
      return t('stats.weekFormat', { year, week });
    }
    
    // Try to parse as date
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // If not a valid date, return as is
      return dateStr;
    }
    
    switch (interval) {
      case 'year':
        return date.toLocaleDateString(i18n.language, { year: 'numeric' });
      case 'month':
        return date.toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' });
      case 'week':
        return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
      case 'day':
      default:
        return date.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });
    }
  };


  const userColumns = [
    {
      key: 'name',
      header: t('nav.users'),
      render: (user: UserStatsData) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
              {user.firstname?.[0]}{user.lastname?.[0]}
            </span>
          </div>
          <span className="font-medium text-gray-900 dark:text-white">
            {user.firstname} {user.lastname}
          </span>
        </div>
      ),
    },
    {
      key: 'totalLoans',
      header: t('stats.totalLoans'),
      render: (user: UserStatsData) => (
        <span className="text-gray-600 dark:text-gray-300">{user.totalLoans}</span>
      ),
    },
    {
      key: 'activeLoans',
      header: t('stats.activeLoansSort'),
      render: (user: UserStatsData) => (
        <Badge variant={user.activeLoans > 0 ? 'info' : 'default'}>
          {user.activeLoans}
        </Badge>
      ),
    },
    {
      key: 'overdueLoans',
      header: t('stats.overdueLoansSort'),
      render: (user: UserStatsData) => (
        user.overdueLoans > 0 ? (
          <Badge variant="danger">{user.overdueLoans}</Badge>
        ) : (
          <span className="text-gray-400">0</span>
        )
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-gray-700 dark:text-gray-300">{t('common.error')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('stats.loadError')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-[40vh]">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('stats.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400">{t('stats.subtitle')}</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={BookOpen}
          label={t('stats.documents')}
          value={stats.biblios?.total ?? 0}
          color="indigo"
        />
        <StatCard
          icon={Users}
          label={t('stats.activeUsers')}
          value={stats.users?.active ?? 0}
          subtitle={t('stats.totalUsers', { count: stats.users?.total ?? 0 })}
          color="emerald"
        />
        <StatCard
          icon={BookMarked}
          label={t('stats.activeLoans')}
          value={stats.loans?.active ?? 0}
          color="blue"
        />
        <StatCard
          icon={AlertTriangle}
          label={t('stats.overdue')}
          value={stats.loans?.overdue ?? 0}
          color="red"
        />
      </div>

      <div>
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="-mb-px flex flex-wrap gap-x-2 sm:gap-x-8" aria-label={t('stats.title')}>
            <button
              type="button"
              onClick={() => setStatsDetailTab('catalog')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                statsDetailTab === 'catalog'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Library className="h-5 w-5 shrink-0" />
                {t('stats.catalogSection.title')}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatsDetailTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                statsDetailTab === 'users'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 shrink-0" />
                {t('stats.usersSection.title')}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatsDetailTab('loans')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                statsDetailTab === 'loans'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 shrink-0" />
                {t('stats.loansEvolution')}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setStatsDetailTab('advanced')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                statsDetailTab === 'advanced'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Table2 className="h-5 w-5 shrink-0" />
                {t('stats.advanced.tabLabel')}
              </div>
            </button>
          </nav>
        </div>

        <div className="pt-4">
      {statsDetailTab === 'catalog' && (
      <Card padding="none">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Library className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('stats.catalogSection.title')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('stats.catalogSection.subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('stats.year')}</span>
                <select
                  value={catalogStatsYear}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCatalogStatsYear(v === 'all' ? 'all' : Number(v));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="all">{t('stats.usersSection.allYears')}</option>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('stats.catalogSection.breakdowns')}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catalogStatsBySource}
                  onChange={(e) => setCatalogStatsBySource(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.bySource')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catalogStatsByMediaType}
                  onChange={(e) => setCatalogStatsByMediaType(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.byMediaType')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={catalogStatsByPublicType}
                  onChange={(e) => setCatalogStatsByPublicType(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.byPublicType')}</span>
              </label>
            </div>
          </div>
        </div>

        {isLoadingCatalogStats ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : catalogStats ? (
          <div className="p-4 sm:p-6">
            <div className="space-y-6">
              {/* Totals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.activeSpecimens')}</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{catalogStats.totals.activeItems.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.enteredSpecimens')}</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{catalogStats.totals.enteredItems.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.archivedSpecimens')}</p>
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{catalogStats.totals.archivedItems.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.catalogSection.loans')}</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{catalogStats.totals.loans.toLocaleString()}</p>
                </div>
              </div>

              {/* Breakdowns — hierarchical rendering */}
              <CatalogBreakdowns catalogStats={catalogStats} t={t} />
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
          </div>
        )}
      </Card>
      )}

      {statsDetailTab === 'users' && (
      <Card padding="none">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <User className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('stats.usersSection.title')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {userStatsMode === 'leaderboard' ? t('stats.topBorrowers') : t('stats.usersSection.aggregateSubtitle')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('stats.usersSection.mode')}</span>
                <select
                  value={userStatsMode}
                  onChange={(e) => setUserStatsMode(e.target.value as UserStatsMode)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                >
                  <option value="aggregate">{t('stats.usersSection.modeAggregate')}</option>
                  <option value="leaderboard">{t('stats.usersSection.modeLeaderboard')}</option>
                </select>
                {userStatsMode === 'aggregate' && (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('stats.year')}</span>
                    <select
                      value={userStatsAggregateYear}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUserStatsAggregateYear(v === 'all' ? 'all' : Number(v));
                      }}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <option value="all">{t('stats.usersSection.allYears')}</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </>
                )}
                {userStatsMode === 'leaderboard' && (
                  <>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('stats.year')}</span>
                    <select
                      value={userStatsLeaderboardYear}
                      onChange={(e) => {
                        const v = e.target.value;
                        setUserStatsLeaderboardYear(v === 'all' ? 'all' : Number(v));
                      }}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <option value="all">{t('stats.usersSection.allYears')}</option>
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('stats.sortBy')}</span>
                    <select
                      value={userSortBy}
                      onChange={(e) => setUserSortBy(e.target.value as typeof userSortBy)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <option value="totalLoans">{t('stats.totalLoans')}</option>
                      <option value="activeLoans">{t('stats.activeLoansSort')}</option>
                      <option value="overdueLoans">{t('stats.overdueLoansSort')}</option>
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t('stats.usersSection.limit')}</span>
                    <select
                      value={userStatsLimit}
                      onChange={(e) => setUserStatsLimit(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : userStatsMode === 'aggregate' ? (
          <div className="p-4 sm:p-6">
            {userStatsAggregate ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.usersSection.usersTotal')}</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userStatsAggregate.usersTotal.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.usersSection.newUsersTotal')}</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{userStatsAggregate.newUsersTotal.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('stats.usersSection.activeBorrowersTotal')}</p>
                    <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{userStatsAggregate.activeBorrowersTotal.toLocaleString()}</p>
                  </div>
                </div>
                {((userStatsAggregate.newUsersByPublicType?.length ?? 0) > 0 || 
                  (userStatsAggregate.activeBorrowersByPublicType?.length ?? 0) > 0 ||
                  (userStatsAggregate.usersByPublicType?.length ?? 0) > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Colonne 1: Total users */}
                    <div className="space-y-4">
                      {userStatsAggregate.usersByPublicType && userStatsAggregate.usersByPublicType.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('stats.usersSection.usersByPublicType')}</h3>
                          <ul className="space-y-1">
                            {userStatsAggregate.usersByPublicType.map((e) => (
                              <li key={e.label} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{translateStatLabel(t, e.label, 'publicType')}</span>
                                <span className="font-medium">{e.value.toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {/* Colonne 2: Nouveaux inscrits */}
                    <div className="space-y-4">
                      {userStatsAggregate.newUsersByPublicType && userStatsAggregate.newUsersByPublicType.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('stats.usersSection.newUsersByPublicType')}</h3>
                          <ul className="space-y-1">
                            {userStatsAggregate.newUsersByPublicType.map((e) => (
                              <li key={e.label} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{translateStatLabel(t, e.label, 'publicType')}</span>
                                <span className="font-medium">{e.value.toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    {/* Colonne 3: Emprunteurs actifs */}
                    <div className="space-y-4">
                      {userStatsAggregate.activeBorrowersByPublicType && userStatsAggregate.activeBorrowersByPublicType.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('stats.usersSection.activeBorrowersByPublicType')}</h3>
                          <ul className="space-y-1">
                            {userStatsAggregate.activeBorrowersByPublicType.map((e) => (
                              <li key={e.label} className="flex justify-between text-sm">
                                <span className="text-gray-600 dark:text-gray-400">{translateStatLabel(t, e.label, 'publicType')}</span>
                                <span className="font-medium">{e.value.toLocaleString()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.noResults')}</p>
            )}
          </div>
        ) : (
          <Table
            columns={userColumns}
            data={userStats}
            keyExtractor={(user) => user.userId}
            onRowClick={(user) => navigate(`/users/${user.userId}`)}
            emptyMessage={t('common.noResults')}
          />
        )}
      </Card>
      )}

      {statsDetailTab === 'loans' && (
      <Card>
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
          <CardHeader
            title={t('stats.loansEvolution')}
            subtitle={statsParams?.mediaType 
              ? t('stats.loansByType', { 
                  type: t(`items.mediaType.${getMediaTypeTranslationKey(statsParams.mediaType)}`)
                })
              : t('stats.loansPerDay')
            }
          />
        </div>

        <div className="p-4 sm:p-6">
          {(isLoadingTimeline || isLoadingAdvancedStats) ? (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    className="text-gray-500"
                  />
                  <YAxis tick={{ fill: 'currentColor', fontSize: 12 }} className="text-gray-500" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tooltip-bg, #fff)',
                      borderColor: 'var(--tooltip-border, #e5e7eb)',
                      borderRadius: '0.5rem',
                    }}
                    labelFormatter={(label) => {
                      const interval = statsParams?.interval || 'day';
                      
                      // Handle ISO week format (YYYY-Www)
                      if (interval === 'week' && /^\d{4}-W\d{2}$/.test(label)) {
                        const [year, week] = label.split('-W');
                        return t('stats.weekFormat', { year, week });
                      }
                      
                      // Try to parse as date
                      const date = new Date(label);
                      if (isNaN(date.getTime())) {
                        return label;
                      }
                      
                      return date.toLocaleDateString(i18n.language, {
                        weekday: interval === 'day' ? 'long' : undefined,
                        day: 'numeric',
                        month: 'long',
                        year: interval === 'year' ? 'numeric' : undefined,
                      });
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="loans"
                    name={t('stats.chart.loans')}
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorLoans)"
                  />
                  <Area
                    type="monotone"
                    dataKey="returns"
                    name={t('stats.chart.returns')}
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#colorReturns)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-800">
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
        </div>
      </Card>
      )}

      {statsDetailTab === 'advanced' && <StatsAdvancedTab />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Catalog breakdowns – hierarchical display
// The server returns only one root-level list per combination of flags.
// Nesting is detected by checking for byMediaType / byPublicType in entries.
// ---------------------------------------------------------------------------

type TFn = (key: string, options?: Record<string, unknown>) => string;

function CatalogBreakdowns({ catalogStats, t }: { catalogStats: CatalogStats; t: TFn }) {
  // Filter out entries with 0 active specimens (recursively)
  const filterActive = (list?: CatalogStatsBreakdown[]): CatalogStatsBreakdown[] | undefined => {
    if (!list) return undefined;
    const filtered = list
      .filter((e) => e.activeItems > 0)
      .map((e) => ({
        ...e,
        byMediaType: filterActive(e.byMediaType ?? undefined),
        byPublicType: filterActive(e.byPublicType ?? undefined),
      }));
    return filtered.length > 0 ? filtered : undefined;
  };

  const sources = filterActive(catalogStats.bySource ?? undefined);
  const mediaTypes = filterActive(catalogStats.byMediaType ?? undefined);
  const publicTypes = filterActive(catalogStats.byPublicType ?? undefined);

  const hasSources = (sources?.length ?? 0) > 0;
  const hasMedia = (mediaTypes?.length ?? 0) > 0;
  const hasPublic = (publicTypes?.length ?? 0) > 0;

  if (!hasSources && !hasMedia && !hasPublic) return null;

  return (
    <div className="space-y-4">
      {hasSources && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('stats.catalogSection.bySource')}
          </h3>
          <div className="space-y-2">
            {(() => {
              const sourcesTotal = sources!.length > 0 
                ? sources!.reduce((sum, s) => sum + s.activeItems, 0)
                : undefined;
              
              return sources!.map((source, idx) => {
                const sourceLabel = source.sourceName || `Source ${source.sourceId}`;
                const hasNestedMedia = (source.byMediaType?.length ?? 0) > 0;
                const hasNestedPublic = !hasNestedMedia && (source.byPublicType?.length ?? 0) > 0;
                const nestedMediaTotal = hasNestedMedia && source.byMediaType!.length > 0
                  ? source.byMediaType!.reduce((sum, m) => sum + m.activeItems, 0)
                  : undefined;

                if (!hasNestedMedia && !hasNestedPublic) {
                  return <CatalogFlatItem key={source.sourceId ?? idx} label={sourceLabel} item={source} t={t} totalValue={sourcesTotal} />;
                }

                return (
                  <CatalogAccordionItem key={source.sourceId ?? idx} label={sourceLabel} item={source} t={t} totalValue={sourcesTotal}>
                    {hasNestedMedia && (
                      <div className="space-y-2">
                        {source.byMediaType!.map((media, mIdx) => {
                          const mediaLabel = translateStatLabel(t, media.label || '', 'mediaType');
                          const hasNestedPub = (media.byPublicType?.length ?? 0) > 0;

                          if (!hasNestedPub) {
                            return <CatalogFlatItem key={media.label ?? mIdx} label={mediaLabel} item={media} t={t} totalValue={nestedMediaTotal} />;
                          }

                          return (
                            <CatalogAccordionItem key={media.label ?? mIdx} label={mediaLabel} item={media} t={t} nested totalValue={nestedMediaTotal}>
                              <CatalogPublicTypeList items={media.byPublicType!} t={t} />
                            </CatalogAccordionItem>
                          );
                        })}
                      </div>
                    )}
                    {hasNestedPublic && (
                      <CatalogPublicTypeList items={source.byPublicType!} t={t} />
                    )}
                  </CatalogAccordionItem>
                );
              });
            })()}
          </div>
        </div>
      )}

      {hasMedia && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('stats.catalogSection.byMediaType')}
          </h3>
          <div className="space-y-2">
            {(() => {
              const mediaTotal = mediaTypes!.length > 0 
                ? mediaTypes!.reduce((sum, m) => sum + m.activeItems, 0)
                : undefined;
              
              return mediaTypes!.map((media, idx) => {
                const mediaLabel = translateStatLabel(t, media.label || '', 'mediaType');
                const hasNestedPub = (media.byPublicType?.length ?? 0) > 0;

                if (!hasNestedPub) {
                  return <CatalogFlatItem key={media.label ?? idx} label={mediaLabel} item={media} t={t} totalValue={mediaTotal} />;
                }

                return (
                  <CatalogAccordionItem key={media.label ?? idx} label={mediaLabel} item={media} t={t} totalValue={mediaTotal}>
                    <CatalogPublicTypeList items={media.byPublicType!} t={t} />
                  </CatalogAccordionItem>
                );
              });
            })()}
          </div>
        </div>
      )}

      {hasPublic && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('stats.catalogSection.byPublicType')}
          </h3>
          <div className="space-y-2">
            {(() => {
              const publicTotal = publicTypes!.length > 0 
                ? publicTypes!.reduce((sum, p) => sum + p.activeItems, 0)
                : undefined;
              
              return publicTypes!.map((pub, idx) => (
                <CatalogFlatItem
                  key={pub.label ?? idx}
                  label={translateStatLabel(t, pub.label || '', 'publicType')}
                  item={pub}
                  t={t}
                  totalValue={publicTotal}
                />
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

/** 4-column metrics display */
function CatalogMetrics({ item, t, totalValue }: { item: CatalogStatsBreakdown; t: TFn; totalValue?: number }) {
  const percentage = totalValue && totalValue > 0 ? (item.activeItems / totalValue) * 100 : 0;
  
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('stats.catalogSection.active')}</span>
          <p className="font-medium">{item.activeItems.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('stats.catalogSection.entered')}</span>
          <p className="font-medium">{item.enteredItems.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('stats.catalogSection.archived')}</span>
          <p className="font-medium">{item.archivedItems.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">{t('stats.catalogSection.loans')}</span>
          <p className="font-medium">{item.loans.toLocaleString()}</p>
        </div>
      </div>
      {totalValue !== undefined && (
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

/** Simple flat item (no children) */
function CatalogFlatItem({ label, item, t, totalValue }: { label: string; item: CatalogStatsBreakdown; t: TFn; totalValue?: number }) {
  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{label}</p>
      <CatalogMetrics item={item} t={t} totalValue={totalValue} />
    </div>
  );
}

/** Flat list of publicType items — used as leaf level */
function CatalogPublicTypeList({ items, t }: { items: CatalogStatsBreakdown[]; t: TFn }) {
  const totalValue = items.length > 0 
    ? items.reduce((sum, item) => sum + item.activeItems, 0)
    : undefined;
  
  return (
    <div className="space-y-1.5">
      {items.map((pub, idx) => (
        <div key={pub.label ?? idx} className="p-2.5 rounded-md bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            {translateStatLabel(t, pub.label || '', 'publicType')}
          </p>
          <CatalogMetrics item={pub} t={t} totalValue={totalValue} />
        </div>
      ))}
    </div>
  );
}

/** Collapsible accordion item — expands children when it has nested data */
function CatalogAccordionItem({
  label,
  item,
  t,
  nested,
  children,
  totalValue,
}: {
  label: string;
  item: CatalogStatsBreakdown;
  t: TFn;
  nested?: boolean;
  children?: React.ReactNode;
  totalValue?: number;
}) {
  const hasChildren = !!children;
  const [open, setOpen] = useState(false);

  const bgClass = nested
    ? 'bg-white dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/50'
    : 'bg-gray-50 dark:bg-gray-800/50';

  return (
    <div className={`rounded-lg ${bgClass} overflow-hidden`}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen((o) => !o)}
        className={`w-full p-3 text-left ${hasChildren ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/40' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2 mb-1">
          {hasChildren && (
            open
              ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
              : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
          <p className={`text-sm font-medium text-gray-900 dark:text-white ${!hasChildren ? 'ml-6' : ''}`}>
            {label}
          </p>
        </div>
        <CatalogMetrics item={item} t={t} totalValue={totalValue} />
      </button>

      {hasChildren && open && (
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 pb-3 pt-2 ml-4">
          {children}
        </div>
      )}
    </div>
  );
}


interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtitle?: string;
  color: 'indigo' | 'emerald' | 'blue' | 'red';
}

function StatCard({ icon: Icon, label, value, subtitle, color }: StatCardProps) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
