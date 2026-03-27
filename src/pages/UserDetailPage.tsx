import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Trash2,
  Calendar,
  BookMarked,
  Ban,
  RotateCcw,
  RefreshCw,
  Check,
  Filter,
  X,
  BookOpen,
  Newspaper,
  Video,
  Music,
  Disc,
  Image,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicTypesQuery } from '@/hooks/usePublicTypesQuery';
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
import { Card, Button, Badge, Modal, Input, Table, ConfirmDialog, MessageModal, ScrollableListRegion } from '@/components/common';
import api from '@/services/api';
import { getApiErrorCode, getApiErrorMessage } from '@/utils/apiError';
import { isSubscriptionExpired } from '@/utils/userSubscription';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import HoldDocumentCell from '@/components/holds/HoldDocumentCell';
import { RenewSubscriptionModal, UserEditorForm } from '@/components/users';
import { isAdmin, type User as UserType, type Loan, type LoanStatsResponse, type AdvancedStatsParams, type StatsInterval, type MediaType, type Author, type Hold } from '@/types';

const USER_LOANS_PAGE_SIZE = 20;
const USER_HOLDS_PAGE_SIZE = 20;

type UserDetailTab = 'info' | 'activeLoans' | 'pastLoans' | 'holds' | 'stats';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();
  const holdsLoadMoreRef = useRef<HTMLDivElement>(null);
  const activeLoansLoadMoreRef = useRef<HTMLDivElement>(null);
  const pastLoansLoadMoreRef = useRef<HTMLDivElement>(null);

  const [detailTab, setDetailTab] = useState<UserDetailTab>('info');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteUserLoading, setDeleteUserLoading] = useState(false);
  const [deleteUserActiveLoansError, setDeleteUserActiveLoansError] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [forceBorrowDialog, setForceBorrowDialog] = useState<{ message: string; specimenCode: string } | null>(
    null
  );
  const [borrowForceError, setBorrowForceError] = useState<string | null>(null);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isBorrowLoading, setIsBorrowLoading] = useState(false);
  const [loanDetails, setLoanDetails] = useState<Loan | null>(null);
  const [renewError, setRenewError] = useState('');
  const [showRenewSubscriptionModal, setShowRenewSubscriptionModal] = useState(false);

  const [cancellingHoldId, setCancellingHoldId] = useState<string | null>(null);

  const { data: publicTypes = [] } = usePublicTypesQuery();

  // Stats state
  const [loanStats, setLoanStats] = useState<LoanStatsResponse | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [totalLoansAllTime, setTotalLoansAllTime] = useState<number | null>(null);
  const [userStatsFilters, setUserStatsFilters] = useState<{
    startDate: string;
    endDate: string;
    interval: StatsInterval;
  } | null>(null);

  const getDefaultStatsFilters = () => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      interval: 'month' as StatsInterval,
    };
  };

  const {
    data: user,
    isPending: isUserLoading,
    isError: isUserError,
  } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.getUser(id!),
    enabled: !!id,
  });

  useEffect(() => {
    if (isUserError) navigate('/users');
  }, [isUserError, navigate]);

  const {
    data: activeLoansPages,
    isLoading: isLoadingActiveLoans,
    isFetchingNextPage: isFetchingNextActiveLoans,
    hasNextPage: hasNextActivePage,
    fetchNextPage: fetchNextActivePage,
  } = useInfiniteQuery({
    queryKey: ['user-active-loans', id],
    queryFn: ({ pageParam }) =>
      api.getUserLoans(id!, { page: pageParam, perPage: USER_LOANS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return totalLoaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: !!id && detailTab === 'activeLoans',
  });
  const activeLoans = activeLoansPages?.pages.flatMap((p) => p.items) ?? [];
  const activeLoansTotal = activeLoansPages?.pages[0]?.total ?? 0;

  const {
    data: pastLoansPages,
    isLoading: isLoadingPastLoans,
    isFetchingNextPage: isFetchingNextPastLoans,
    hasNextPage: hasNextPastPage,
    fetchNextPage: fetchNextPastPage,
  } = useInfiniteQuery({
    queryKey: ['user-past-loans', id],
    queryFn: ({ pageParam }) =>
      api.getUserLoans(id!, {
        archived: true,
        page: pageParam,
        perPage: USER_LOANS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return totalLoaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: !!id && detailTab === 'pastLoans',
  });
  const pastLoans = pastLoansPages?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const el = activeLoansLoadMoreRef.current;
    const scrollRoot = el?.closest('.app-list-scroll') ?? null;
    if (!el || !scrollRoot || !hasNextActivePage || isFetchingNextActiveLoans || detailTab !== 'activeLoans')
      return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextActivePage();
      },
      { root: scrollRoot, rootMargin: '200px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextActivePage, isFetchingNextActiveLoans, fetchNextActivePage, detailTab]);

  useEffect(() => {
    const el = pastLoansLoadMoreRef.current;
    const scrollRoot = el?.closest('.app-list-scroll') ?? null;
    if (!el || !scrollRoot || !hasNextPastPage || isFetchingNextPastLoans || detailTab !== 'pastLoans') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPastPage();
      },
      { root: scrollRoot, rootMargin: '200px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPastPage, isFetchingNextPastLoans, fetchNextPastPage, detailTab]);

  const refreshLoans = () => {
    if (!user?.id) return;
    void queryClient.invalidateQueries({ queryKey: ['user-active-loans', user.id] });
    void queryClient.invalidateQueries({ queryKey: ['user-past-loans', user.id] });
    void queryClient.invalidateQueries({ queryKey: ['user-holds', user.id] });
  };

  // Init default filters when stats tab is active
  useEffect(() => {
    if (detailTab === 'stats' && user && !userStatsFilters) {
      setUserStatsFilters(getDefaultStatsFilters());
    }
  }, [detailTab, user, userStatsFilters]);

  // Fetch stats when filters or user change
  useEffect(() => {
    if (detailTab !== 'stats' || !user || !userStatsFilters) return;

    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const startDateTime = new Date(userStatsFilters.startDate);
        startDateTime.setHours(0, 0, 0, 0);
        const endDateTime = new Date(userStatsFilters.endDate);
        endDateTime.setHours(23, 59, 59, 999);

        const params: AdvancedStatsParams = {
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          interval: userStatsFilters.interval,
          userId: user.id,
        };

        const fetches: Promise<LoanStatsResponse>[] = [api.getLoanStats(params)];
        if (totalLoansAllTime === null) {
          const allTimeStart = new Date('2000-01-01T00:00:00.000Z');
          fetches.push(
            api.getLoanStats({
              startDate: allTimeStart.toISOString(),
              endDate: new Date().toISOString(),
              interval: 'year',
              userId: user.id,
            })
          );
        }

        const results = await Promise.all(fetches);
        setLoanStats(results[0]);
        if (results[1] !== undefined) {
          setTotalLoansAllTime(results[1].totalLoans);
        }
      } catch (error) {
        console.error('Error fetching loan stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [detailTab, user, userStatsFilters]);

  const formatStatsDate = (dateStr: string) => {
    const interval = userStatsFilters?.interval || 'month';
    if (interval === 'week' && /^\d{4}-W\d{2}$/.test(dateStr)) {
      const [year, week] = dateStr.split('-W');
      return t('stats.weekFormat', { year, week });
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
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

  const handleUserStatsResetFilters = () => {
    setUserStatsFilters(getDefaultStatsFilters());
  };

  const {
    data: holdsPages,
    isLoading: isLoadingHolds,
    isFetchingNextPage: isFetchingNextHolds,
    hasNextPage: hasNextHoldsPage,
    fetchNextPage: fetchNextHoldsPage,
  } = useInfiniteQuery({
    queryKey: ['user-holds', id],
    queryFn: ({ pageParam }) =>
      api.getUserHolds(id!, { page: pageParam, perPage: USER_HOLDS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return totalLoaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
    enabled: !!id && detailTab === 'holds',
  });
  const holds = holdsPages?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const el = holdsLoadMoreRef.current;
    const scrollRoot = el?.closest('.app-list-scroll') ?? null;
    if (!el || !scrollRoot || !hasNextHoldsPage || isFetchingNextHolds || detailTab !== 'holds') return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextHoldsPage();
      },
      { root: scrollRoot, rootMargin: '200px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextHoldsPage, isFetchingNextHolds, fetchNextHoldsPage, detailTab]);

  const handleCancelHold = async (holdId: string) => {
    setCancellingHoldId(holdId);
    try {
      await api.cancelHold(holdId);
      await queryClient.invalidateQueries({ queryKey: ['user-holds', id] });
    } catch {
      // ignore
    } finally {
      setCancellingHoldId(null);
    }
  };

  const STATS_INTERVALS: { value: StatsInterval; label: string }[] = [
    { value: 'day', label: t('stats.interval.day') },
    { value: 'week', label: t('stats.interval.week') },
    { value: 'month', label: t('stats.interval.month') },
    { value: 'year', label: t('stats.interval.year') },
  ];

  const handleDelete = async (force = false) => {
    if (!user) return;
    if (deleteUserLoading) return;
    setDeleteUserLoading(true);
    try {
      await api.deleteUser(user.id, force);
      navigate('/users');
    } catch (error: unknown) {
      const code = getApiErrorCode(error);
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (
        !force &&
        (code === 'business_rule_violation' ||
          (typeof msg === 'string' &&
            (msg.includes('active loans') || msg.includes('force=true'))))
      ) {
        setDeleteUserActiveLoansError(true);
      } else {
        console.error('Error deleting user:', error);
      }
    } finally {
      setDeleteUserLoading(false);
    }
  };

  const handleReturnLoan = async (loanId: string) => {
    try {
      await api.returnLoan(loanId);
      await refreshLoans();
    } catch (error) {
      console.error('Error returning loan:', error);
    }
  };

  const handleRenewLoan = async (loanId: string) => {
    setRenewError('');
    try {
      await api.renewLoan(loanId);
      await refreshLoans();
    } catch (error) {
      console.error('Error renewing loan:', error);
      setRenewError(getApiErrorMessage(error, t) || t('loans.errorRenewingLoan'));
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isUserError) {
    return null;
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Usager non trouvé</p>
      </div>
    );
  }

  const overdueLoans = activeLoans.filter((l) => l.isOverdue);

  const renderLoanTitle = (loan: Loan) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setLoanDetails(loan);
      }}
      className="text-left font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
    >
      {loan.biblio.title || 'Sans titre'}
    </button>
  );

  const formatAuthor = (author?: Author | null) => {
    if (!author) return '-';
    return `${author.firstname || ''} ${author.lastname || ''}`.trim() || '-';
  };

  const getMediaTypeIcon = (mediaType?: MediaType) => {
    const iconClass = 'h-5 w-5';
    const colorClass = 'text-amber-600 dark:text-amber-400';
    switch (mediaType) {
      case 'printedText':
      case 'comics':
        return <BookOpen className={`${iconClass} ${colorClass}`} />;
      case 'periodic':
        return <Newspaper className={`${iconClass} ${colorClass}`} />;
      case 'video':
      case 'videoTape':
      case 'videoDvd':
        return <Video className={`${iconClass} text-red-600 dark:text-red-400`} />;
      case 'audio':
      case 'audioMusic':
      case 'audioMusicTape':
      case 'audioMusicCd':
      case 'audioNonMusic':
      case 'audioNonMusicTape':
      case 'audioNonMusicCd':
        return <Music className={`${iconClass} text-blue-600 dark:text-blue-400`} />;
      case 'cdRom':
        return <Disc className={`${iconClass} text-purple-600 dark:text-purple-400`} />;
      case 'images':
        return <Image className={`${iconClass} text-green-600 dark:text-green-400`} />;
      case 'multimedia':
        return <FileText className={`${iconClass} text-indigo-600 dark:text-indigo-400`} />;
      default:
        return <BookOpen className={`${iconClass} text-gray-600 dark:text-gray-400`} />;
    }
  };

  const loanColumnsActive = [
    {
      key: 'title',
      header: 'Document',
      render: (loan: Loan) => {
        return (
          <div>
            {renderLoanTitle(loan)}
          </div>
        );
      },
    },
    {
      key: 'date',
      header: 'Date emprunt',
      render: (loan: Loan) =>
        new Date(loan.startDate).toLocaleDateString('fr-FR'),
    },
    {
      key: 'expiryAt',
      header: 'Échéance',
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <span>{new Date(loan.expiryAt).toLocaleDateString('fr-FR')}</span>
        </div>
      ),
    },
    {
      key: 'renews',
      header: 'Prolongations',
      render: (loan: Loan) => loan.nbRenews,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (loan: Loan) => (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleRenewLoan(loan.id);
            }}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            Prolonger
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              handleReturnLoan(loan.id);
            }}
            leftIcon={<Check className="h-4 w-4" />}
          >
            Retour
          </Button>
        </div>
      ),
    },
  ];

  const loanColumnsPast = [
    {
      key: 'title',
      header: 'Document',
      render: (loan: Loan) => <div>{renderLoanTitle(loan)}</div>,
    },
    {
      key: 'date',
      header: 'Date emprunt',
      render: (loan: Loan) => new Date(loan.startDate).toLocaleDateString('fr-FR'),
    },
    {
      key: 'returnedAt',
      header: 'Date retour',
      render: (loan: Loan) =>
        loan.returnedAt ? new Date(loan.returnedAt).toLocaleDateString('fr-FR') : '-',
    },
    {
      key: 'renews',
      header: 'Prolongations',
      render: (loan: Loan) => loan.nbRenews,
    },
  ];

  const userHoldColumns = [
    {
      key: 'document',
      header: t('holds.columnDocument'),
      render: (h: Hold) => <HoldDocumentCell hold={h} />,
    },
    {
      key: 'status',
      header: t('holds.status'),
      render: (h: Hold) => (
        <Badge variant={h.status === 'ready' ? 'success' : 'default'}>{t(`holds.statuses.${h.status}`)}</Badge>
      ),
    },
    {
      key: 'position',
      header: t('holds.position'),
      render: (h: Hold) => h.position,
    },
    {
      key: 'created',
      header: t('holds.createdAt'),
      render: (h: Hold) => new Date(h.createdAt).toLocaleString(i18n.language),
    },
    {
      key: 'expires',
      header: t('holds.expiresAt'),
      render: (h: Hold) => (h.expiresAt ? new Date(h.expiresAt).toLocaleString(i18n.language) : '—'),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right' as const,
      render: (h: Hold) =>
        h.status === 'pending' || h.status === 'ready' ? (
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Ban className="h-4 w-4" />}
            isLoading={cancellingHoldId === h.id}
            onClick={() => void handleCancelHold(h.id)}
          >
            {t('holds.cancelHold')}
          </Button>
        ) : null,
    },
  ];

  const statsTabContent = (
    <div className="space-y-6">
      {userStatsFilters && (
        <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('stats.advancedFilters')}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.startDate')}
              </label>
              <Input
                type="date"
                value={userStatsFilters.startDate}
                onChange={(e) => setUserStatsFilters({ ...userStatsFilters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.endDate')}
              </label>
              <Input
                type="date"
                value={userStatsFilters.endDate}
                onChange={(e) => setUserStatsFilters({ ...userStatsFilters, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('stats.intervalLabel')}
              </label>
              <select
                value={userStatsFilters.interval}
                onChange={(e) =>
                  setUserStatsFilters({
                    ...userStatsFilters,
                    interval: e.target.value as StatsInterval,
                  })
                }
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                {STATS_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUserStatsResetFilters}
                leftIcon={<X className="h-4 w-4" />}
              >
                {t('common.reset')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoadingStats ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loanStats ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            {totalLoansAllTime !== null && (
              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{totalLoansAllTime}</p>
                <p className="text-xs text-indigo-700 dark:text-indigo-300">{t('users.totalLoansLabel')}</p>
              </div>
            )}
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{loanStats.totalReturns}</p>
              <p className="text-xs text-green-700 dark:text-green-300">{t('users.returnsInPeriod')}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{loanStats.totalLoans}</p>
              <p className="text-xs text-blue-700 dark:text-blue-300">{t('users.loansInPeriod')}</p>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={loanStats.timeSeries.map((item) => ({
                  date: item.period,
                  loans: item.loans,
                  returns: item.returns,
                }))}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorUserLoans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorUserReturns" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatStatsDate}
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
                    const interval = userStatsFilters?.interval || 'month';
                    if (interval === 'week' && /^\d{4}-W\d{2}$/.test(label)) {
                      const [year, week] = label.split('-W');
                      return t('stats.weekFormat', { year, week });
                    }
                    const date = new Date(label);
                    if (isNaN(date.getTime())) return label;
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
                  fill="url(#colorUserLoans)"
                />
                <Area
                  type="monotone"
                  dataKey="returns"
                  name={t('stats.chart.returns')}
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#colorUserReturns)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('users.noStatsAvailable')}</p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-0 gap-4 h-[calc(100dvh-9rem)] lg:h-[calc(100dvh-5.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/users')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-shrink-0 h-16 w-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {user.firstname?.[0] || '?'}{user.lastname?.[0] || ''}
            </span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {user.firstname} {user.lastname}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {isAdmin(user.accountType) && <Badge>{user.accountType}</Badge>}
              {user.publicType != null && user.publicType !== '' && (() => {
                const pt = publicTypes.find((p) => p.id === String(user.publicType));
                return pt ? <Badge variant="info">{pt.label}</Badge> : null;
              })()}
              {overdueLoans.length > 0 && (
                <Badge variant="danger">{overdueLoans.length} retard{overdueLoans.length > 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:justify-end">
          <Button variant="secondary" onClick={() => setShowBorrowModal(true)} leftIcon={<BookMarked className="h-4 w-4" />}>
            {t('loans.borrow')}
          </Button>
          {user.expiryAt != null && isSubscriptionExpired(user.expiryAt) && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowRenewSubscriptionModal(true)}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              {t('users.renewSubscription')}
            </Button>
          )}
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} leftIcon={<Trash2 className="h-4 w-4" />}>
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <Card padding="none" className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
            <div className="flex flex-nowrap items-center justify-between gap-3 min-w-0">
              <div className="overflow-x-auto min-w-0 flex-1 min-h-0 -mx-0.5 px-0.5">
                <div
                  className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900"
                  role="tablist"
                  aria-label={t('users.title')}
                >
                  {(
                    [
                      { id: 'info' as const, label: t('users.information') },
                      { id: 'activeLoans' as const, label: t('loans.activeLoans') },
                      { id: 'pastLoans' as const, label: t('users.pastLoansTab') },
                      { id: 'holds' as const, label: t('users.holdsTab') },
                      { id: 'stats' as const, label: t('users.loanStatistics') },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={detailTab === tab.id}
                      onClick={() => setDetailTab(tab.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md whitespace-nowrap ${
                        detailTab === tab.id
                          ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {user.createdAt && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 shrink-0 whitespace-nowrap sm:ml-2">
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {t('users.createdAt')}:{' '}
                    {new Date(user.createdAt).toLocaleDateString(i18n.language, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </p>
              )}
            </div>
          </div>

          {renewError && detailTab === 'activeLoans' && (
            <div className="px-4 sm:px-6 pt-3 flex-shrink-0">
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{renewError}</p>
              </div>
            </div>
          )}

          {detailTab === 'info' && (
            <>
              <ScrollableListRegion
                aria-label={t('users.information')}
                className="flex-1 min-h-0 !max-h-none overflow-auto px-3 sm:px-4 py-3"
              >
                <UserEditorForm
                  key={`${user.id}-${user.updateAt ?? ''}`}
                  mode="edit"
                  formId="user-detail-edit-form"
                  user={user}
                  publicTypes={publicTypes}
                  onLoadingChange={setIsEditLoading}
                  onSuccess={(updatedUser) => {
                    if (updatedUser) queryClient.setQueryData<UserType>(['user', id], updatedUser);
                  }}
                />
              </ScrollableListRegion>
              <div className="flex-shrink-0 px-3 sm:px-4 py-2 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                <Button type="submit" form="user-detail-edit-form" isLoading={isEditLoading}>
                  {t('common.save')}
                </Button>
              </div>
            </>
          )}

          {detailTab === 'activeLoans' && (
            <ScrollableListRegion
              aria-label={t('loans.activeLoans')}
              className="flex-1 min-h-0 !max-h-none overflow-auto"
            >
              <Table
                columns={loanColumnsActive}
                data={activeLoans}
                keyExtractor={(loan) => loan.id}
                isLoading={isLoadingActiveLoans && activeLoans.length === 0}
                emptyMessage={t('loans.noLoans')}
              />
              <div ref={activeLoansLoadMoreRef} className="h-4 flex-shrink-0" aria-hidden />
              {isFetchingNextActiveLoans && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{t('common.loading')}</span>
                </div>
              )}
            </ScrollableListRegion>
          )}

          {detailTab === 'pastLoans' && (
            <ScrollableListRegion
              aria-label={t('users.pastLoansTab')}
              className="flex-1 min-h-0 !max-h-none overflow-auto"
            >
              <Table
                columns={loanColumnsPast}
                data={pastLoans}
                keyExtractor={(loan) => loan.id}
                isLoading={isLoadingPastLoans && pastLoans.length === 0}
                emptyMessage={t('loans.noLoans')}
              />
              <div ref={pastLoansLoadMoreRef} className="h-4 flex-shrink-0" aria-hidden />
              {isFetchingNextPastLoans && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{t('common.loading')}</span>
                </div>
              )}
            </ScrollableListRegion>
          )}

          {detailTab === 'holds' && (
            <>
              <ScrollableListRegion aria-label={t('users.holdsTab')} className="flex-1 min-h-0 !max-h-none overflow-auto">
                <>
                  <Table
                    columns={userHoldColumns}
                    data={holds}
                    keyExtractor={(h) => h.id}
                    isLoading={isLoadingHolds && holds.length === 0}
                    emptyMessage={t('holds.noHolds')}
                  />
                  <div ref={holdsLoadMoreRef} className="h-4 flex-shrink-0" aria-hidden />
                  {isFetchingNextHolds && (
                    <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{t('common.loading')}</span>
                    </div>
                  )}
                </>
              </ScrollableListRegion>
            </>
          )}

          {detailTab === 'stats' && (
            <ScrollableListRegion
              aria-label={t('users.loanStatistics')}
              className="flex-1 min-h-0 !max-h-none overflow-auto px-4 sm:px-6 py-4"
            >
              {statsTabContent}
            </ScrollableListRegion>
          )}
        </Card>
      </div>

      {/* Loan details modal */}
      <Modal
        isOpen={loanDetails !== null}
        onClose={() => setLoanDetails(null)}
        title="Détails de l'emprunt"
        size="md"
      >
        {loanDetails && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Document</p>
              <div className="flex items-start gap-3 mt-1">
                <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gray-50 dark:bg-gray-900/30 flex items-center justify-center">
                  {getMediaTypeIcon(loanDetails.biblio.mediaType as MediaType)}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {loanDetails.biblio.title || 'Sans titre'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {formatAuthor(loanDetails.biblio.author)}
                  </p>
                  {loanDetails.biblio.isbn && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {t('items.isbn')}: <span className="font-mono">{formatIsbnDisplay(loanDetails.biblio.isbn)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Début</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(loanDetails.startDate).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {loanDetails.returnedAt ? 'Retour' : 'Échéance'}
                </p>
                <p className="text-gray-900 dark:text-white">
                  {loanDetails.returnedAt
                    ? new Date(loanDetails.returnedAt).toLocaleDateString('fr-FR')
                    : new Date(loanDetails.expiryAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Exemplaire emprunté</p>
              {(() => {
                const ident = loanDetails.itemIdentification;
                const spec = loanDetails.biblio?.items?.find(
                  (s) => (s.barcode != null && ident != null && s.barcode === ident) || s.id === ident
                );
                const barcode = spec?.barcode ?? ident ?? '-';
                const sourceName = spec?.sourceName ?? loanDetails.biblio.sourceName ?? '-';
                return (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t('items.barcode')}: <span className="font-mono">{barcode}</span>
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Source: <span className="font-medium">{sourceName}</span>
                    </p>
                    {spec?.callNumber && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Cote: <span className="font-mono">{spec.callNumber}</span>
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          if (deleteUserLoading) return;
          setShowDeleteModal(false);
          setDeleteUserActiveLoansError(false);
        }}
        title={t('common.confirm')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (deleteUserLoading) return;
                setShowDeleteModal(false);
                setDeleteUserActiveLoansError(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            {deleteUserActiveLoansError ? (
              <Button
                variant="danger"
                disabled={deleteUserLoading}
                isLoading={deleteUserLoading}
                onClick={() => handleDelete(true)}
              >
                {t('users.forceDelete')}
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={deleteUserLoading}
                isLoading={deleteUserLoading}
                onClick={() => handleDelete(false)}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          {deleteUserActiveLoansError
            ? t('users.activeLoansForceDelete')
            : t('users.deleteConfirm', { name: `${user.firstname} ${user.lastname}`.trim() })}
          {!deleteUserActiveLoansError && activeLoansTotal > 0 && (
            <span className="block mt-2 text-amber-600 dark:text-amber-400">
              {t('users.hasLoansWarning', { count: activeLoansTotal })}
            </span>
          )}
        </p>
      </Modal>

      <RenewSubscriptionModal
        user={showRenewSubscriptionModal && user ? user : null}
        isOpen={showRenewSubscriptionModal}
        onClose={() => setShowRenewSubscriptionModal(false)}
        onSuccess={(updated) => {
          queryClient.setQueryData<UserType>(['user', id], updated);
        }}
      />

      {/* Borrow modal */}
      <Modal
        isOpen={showBorrowModal}
        onClose={() => setShowBorrowModal(false)}
        title="Nouvel emprunt"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="submit" form="borrow-user-form" isLoading={isBorrowLoading}>
              Emprunter
            </Button>
          </div>
        }
      >
        <BorrowForm
          formId="borrow-user-form"
          userId={user.id}
          onLoadingChange={setIsBorrowLoading}
          onSuccess={() => {
            setShowBorrowModal(false);
            refreshLoans();
          }}
          onBusinessRuleViolation={(msg, specimenCode) => {
            setShowBorrowModal(false);
            setForceBorrowDialog({
              message: `${msg}\n\n${t('loans.forceBorrowConfirm')}`,
              specimenCode,
            });
          }}
        />
      </Modal>

      <ConfirmDialog
        isOpen={forceBorrowDialog !== null}
        onClose={() => setForceBorrowDialog(null)}
        onConfirm={() => {
          const ctx = forceBorrowDialog;
          setForceBorrowDialog(null);
          if (!ctx) return;
          void (async () => {
            try {
              await api.createLoan({
                userId: user.id,
                itemIdentification: ctx.specimenCode,
                force: true,
              });
              await refreshLoans();
            } catch (e) {
              setBorrowForceError(getApiErrorMessage(e, t) || t('loans.errorCreatingLoan'));
            }
          })();
        }}
        message={forceBorrowDialog?.message ?? ''}
        stackOnTop
      />

      <MessageModal
        isOpen={borrowForceError !== null}
        onClose={() => setBorrowForceError(null)}
        message={borrowForceError ?? ''}
        stackOnTop
      />
    </div>
  );
}

interface BorrowFormProps {
  formId: string;
  userId: string;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
  onBusinessRuleViolation?: (message: string, specimenCode: string) => void;
}

function BorrowForm({
  formId,
  userId,
  onLoadingChange,
  onSuccess,
  onBusinessRuleViolation,
}: BorrowFormProps) {
  const { t } = useTranslation();
  const [specimenCode, setSpecimenCode] = useState('');
  const [error, setError] = useState('');

  const doCreateLoan = async (force = false) => {
    try {
      await api.createLoan({
        userId: userId,
        itemIdentification: specimenCode,
        force: force || undefined,
      });
      setError('');
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { code?: string; message?: string } } };
      const axiosData = axiosErr?.response?.data;
      const errorCode = axiosData?.code ?? '';
      const rawMessage = typeof axiosData?.message === 'string' ? axiosData.message : '';
      const displayMsg = getApiErrorMessage(err, t) || t('loans.errorCreatingLoan');
      const confirmMsg = rawMessage || displayMsg;
      if (errorCode === 'business_rule_violation' && !force) {
        onBusinessRuleViolation?.(confirmMsg, specimenCode.trim());
        return;
      }
      setError(displayMsg);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specimenCode.trim()) return;
    setError('');
    onLoadingChange(true);
    try {
      await doCreateLoan();
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('loans.specimenBarcode')}
        value={specimenCode}
        onChange={(e) => {
          setSpecimenCode(e.target.value);
          if (error) setError('');
        }}
        placeholder={t('loans.scanOrEnterBarcode')}
        autoFocus
        required
      />
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}


