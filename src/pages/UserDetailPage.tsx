import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
  Users,
  Mail,
  Phone,
  Calendar,
  BookMarked,
  RotateCcw,
  Check,
  BarChart3,
  ChevronDown,
  ChevronUp,
  MapPin,
  Hash,
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
import { Card, CardHeader, Button, Badge, Modal, Input, Table } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { isAdmin, type User as UserType, type Loan, type LoanStatsResponse, type AdvancedStatsParams, type StatsInterval, type MediaType, type Author, type PublicType } from '@/types';
import { STATUS_OPTIONS } from '@/utils/codeLabels';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [user, setUser] = useState<UserType | null>(null);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [pastLoans, setPastLoans] = useState<Loan[]>([]);
  const [activeLoansTab, setActiveLoansTab] = useState<'active' | 'past'>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPastLoans, setIsLoadingPastLoans] = useState(false);
  const [hasLoadedPastLoans, setHasLoadedPastLoans] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isBorrowLoading, setIsBorrowLoading] = useState(false);
  const [loanDetails, setLoanDetails] = useState<Loan | null>(null);
  const [renewError, setRenewError] = useState('');

  // Stats state
  const [publicTypes, setPublicTypes] = useState<PublicType[]>([]);
  const [showStats, setShowStats] = useState(false);
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

  useEffect(() => {
    api.getPublicTypes().then(setPublicTypes).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [userData, activeLoansData] = await Promise.all([
          api.getUser(id),
          api.getUserLoans(id),
        ]);
        setUser(userData);
        setActiveLoans(activeLoansData);
        setPastLoans([]);
        setHasLoadedPastLoans(false);
      } catch (error) {
        console.error('Error fetching user:', error);
        navigate('/users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const refreshLoans = async () => {
    if (!user?.id) return;
    const activeLoansData = await api.getUserLoans(user.id);
    setActiveLoans(activeLoansData);
    if (hasLoadedPastLoans) {
      const pastLoansData = await api.getUserLoans(user.id, { archived: true });
      setPastLoans(pastLoansData);
    }
  };

  useEffect(() => {
    const loadPast = async () => {
      if (!user?.id) return;
      if (activeLoansTab !== 'past') return;
      if (hasLoadedPastLoans) return;
      setIsLoadingPastLoans(true);
      try {
        const pastLoansData = await api.getUserLoans(user.id, { archived: true });
        setPastLoans(pastLoansData);
        setHasLoadedPastLoans(true);
      } catch (error) {
        console.error('Error fetching past loans:', error);
      } finally {
        setIsLoadingPastLoans(false);
      }
    };
    loadPast();
  }, [activeLoansTab, user?.id, hasLoadedPastLoans]);

  // Init default filters when stats section is expanded
  useEffect(() => {
    if (showStats && user && !userStatsFilters) {
      setUserStatsFilters(getDefaultStatsFilters());
    }
  }, [showStats, user, userStatsFilters]);

  // Fetch stats when filters or user change
  useEffect(() => {
    if (!showStats || !user || !userStatsFilters) return;

    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const startDateTime = new Date(userStatsFilters.startDate);
        startDateTime.setHours(0, 0, 0, 0);
        const endDateTime = new Date(userStatsFilters.endDate);
        endDateTime.setHours(23, 59, 59, 999);

        const params: AdvancedStatsParams = {
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
          interval: userStatsFilters.interval,
          user_id: user.id,
        };

        const fetches: Promise<LoanStatsResponse>[] = [api.getLoanStats(params)];
        if (totalLoansAllTime === null) {
          const allTimeStart = new Date('2000-01-01T00:00:00.000Z');
          fetches.push(
            api.getLoanStats({
              start_date: allTimeStart.toISOString(),
              end_date: new Date().toISOString(),
              interval: 'year',
              user_id: user.id,
            })
          );
        }

        const results = await Promise.all(fetches);
        setLoanStats(results[0]);
        if (results[1] !== undefined) {
          setTotalLoansAllTime(results[1].total_loans);
        }
      } catch (error) {
        console.error('Error fetching loan stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, [showStats, user, userStatsFilters]);

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

  const STATS_INTERVALS: { value: StatsInterval; label: string }[] = [
    { value: 'day', label: t('stats.interval.day') },
    { value: 'week', label: t('stats.interval.week') },
    { value: 'month', label: t('stats.interval.month') },
    { value: 'year', label: t('stats.interval.year') },
  ];

  const handleDelete = async () => {
    if (!user) return;
    try {
      await api.deleteUser(user.id);
      navigate('/users');
    } catch (error) {
      console.error('Error deleting user:', error);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Usager non trouvé</p>
      </div>
    );
  }

  const overdueLoans = activeLoans.filter((l) => l.is_overdue);

  const renderLoanTitle = (loan: Loan) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setLoanDetails(loan);
      }}
      className="text-left font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
    >
      {loan.item.title || 'Sans titre'}
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
        new Date(loan.start_date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'issue_at',
      header: 'Échéance',
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <span>{new Date(loan.issue_at).toLocaleDateString('fr-FR')}</span>
        </div>
      ),
    },
    {
      key: 'renews',
      header: 'Prolongations',
      render: (loan: Loan) => loan.nb_renews,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
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
      render: (loan: Loan) => new Date(loan.start_date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'returned_at',
      header: 'Date retour',
      render: (loan: Loan) =>
        loan.returned_at ? new Date(loan.returned_at).toLocaleDateString('fr-FR') : '-',
    },
    {
      key: 'renews',
      header: 'Prolongations',
      render: (loan: Loan) => loan.nb_renews,
    },
  ];

  return (
    <div className="space-y-6">
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
              {isAdmin(user.account_type) && <Badge>{user.account_type}</Badge>}
              {user.public_type != null && user.public_type !== '' && (() => {
                const pt = publicTypes.find((p) => p.id === String(user.public_type));
                return pt ? <Badge variant="info">{pt.label}</Badge> : null;
              })()}
              {overdueLoans.length > 0 && (
                <Badge variant="danger">{overdueLoans.length} retard{overdueLoans.length > 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowBorrowModal(true)} leftIcon={<BookMarked className="h-4 w-4" />}>
            Emprunter
          </Button>
          <Button variant="secondary" onClick={() => setShowEditModal(true)} leftIcon={<Edit className="h-4 w-4" />}>
            Modifier
          </Button>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} leftIcon={<Trash2 className="h-4 w-4" />}>
            Supprimer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User info */}
        <Card>
          <CardHeader title={t('users.information')} />
          <div className="space-y-4">
            <InfoRow icon={User} label={t('users.identifier')} value={user.username || user.login} />
            <InfoRow icon={Mail} label={t('profile.email')} value={user.email} />
            <InfoRow icon={Phone} label={t('profile.phone')} value={user.phone} />
            <InfoRow icon={Hash} label={t('profile.barcode')} value={user.barcode} />
            {user.public_type != null && user.public_type !== '' && (
              <InfoRow
                icon={Users}
                label={t('users.publicType')}
                value={publicTypes.find((p) => p.id === String(user.public_type))?.label ?? String(user.public_type)}
              />
            )}
            {user.created_at && (
              <InfoRow
                icon={Calendar}
                label={t('users.createdAt')}
                value={new Date(user.created_at).toLocaleDateString(i18n.language, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              />
            )}
          </div>
        </Card>

        {/* Loans */}
        <div className="lg:col-span-2">
          <Card padding="none">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900">
                <button
                  type="button"
                  onClick={() => setActiveLoansTab('active')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md ${
                    activeLoansTab === 'active'
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Emprunts en cours
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLoansTab('past')}
                  className={`ml-1 px-3 py-1.5 text-sm font-medium rounded-md ${
                    activeLoansTab === 'past'
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Emprunts passés
                </button>
              </div>
              {renewError && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">{renewError}</p>
                </div>
              )}
            </div>
            <div className="h-[60vh] overflow-y-auto">
              <Table
                columns={activeLoansTab === 'active' ? loanColumnsActive : loanColumnsPast}
                data={
                  activeLoansTab === 'active'
                    ? activeLoans
                    : isLoadingPastLoans
                      ? []
                      : pastLoans
                }
                keyExtractor={(loan) => loan.id}
                emptyMessage={activeLoansTab === 'past' && isLoadingPastLoans ? 'Chargement…' : t('loans.noLoans')}
              />
            </div>
          </Card>
        </div>
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
                  {getMediaTypeIcon(loanDetails.item.media_type as MediaType)}
                </div>
                <div className="min-w-0">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {loanDetails.item.title || 'Sans titre'}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {formatAuthor(loanDetails.item.author)}
                  </p>
                  {loanDetails.item.isbn && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      {t('items.isbn')}: <span className="font-mono">{loanDetails.item.isbn}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Début</p>
                <p className="text-gray-900 dark:text-white">
                  {new Date(loanDetails.start_date).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {loanDetails.returned_at ? 'Retour' : 'Échéance'}
                </p>
                <p className="text-gray-900 dark:text-white">
                  {loanDetails.returned_at
                    ? new Date(loanDetails.returned_at).toLocaleDateString('fr-FR')
                    : new Date(loanDetails.issue_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-500 dark:text-gray-400">Exemplaire emprunté</p>
              {(() => {
                const ident = loanDetails.specimen_identification;
                const spec = loanDetails.item?.specimens?.find(
                  (s) => (s.barcode != null && ident != null && s.barcode === ident) || s.id === ident
                );
                const barcode = spec?.barcode ?? ident ?? '-';
                const sourceName = spec?.source_name ?? loanDetails.item.source_name ?? '-';
                return (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t('items.barcode')}: <span className="font-mono">{barcode}</span>
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Source: <span className="font-medium">{sourceName}</span>
                    </p>
                    {spec?.call_number && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Cote: <span className="font-mono">{spec.call_number}</span>
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* Loan statistics section */}
      <Card>
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setShowStats(!showStats)}
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('users.loanStatistics')}
              </h3>
              {totalLoansAllTime !== null && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('users.totalLoansAllTime', { count: totalLoansAllTime })}
                </p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {showStats ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </div>

        {showStats && (
          <div className="mt-6">
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
                      onChange={(e) =>
                        setUserStatsFilters({ ...userStatsFilters, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('stats.endDate')}
                    </label>
                    <Input
                      type="date"
                      value={userStatsFilters.endDate}
                      onChange={(e) =>
                        setUserStatsFilters({ ...userStatsFilters, endDate: e.target.value })
                      }
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
                      <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                        {totalLoansAllTime}
                      </p>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">
                        {t('users.totalLoansLabel')}
                      </p>
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {loanStats.total_returns}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {t('users.returnsInPeriod')}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {loanStats.total_loans}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      {t('users.loansInPeriod')}
                    </p>
                  </div>
                </div>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={loanStats.time_series.map((item) => ({
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
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {t('users.noStatsAvailable')}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmer la suppression"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Supprimer
            </Button>
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          Êtes-vous sûr de vouloir supprimer le compte de {user.firstname} {user.lastname} ?
          {activeLoans.length > 0 && (
            <span className="block mt-2 text-amber-600 dark:text-amber-400">
              ⚠️ Cet usager a encore {activeLoans.length} emprunt(s) en cours.
            </span>
          )}
        </p>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Modifier l'usager"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="submit" form="edit-user-form" isLoading={isEditLoading}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <EditUserForm
          formId="edit-user-form"
          user={user}
          publicTypes={publicTypes}
          onLoadingChange={setIsEditLoading}
          onSuccess={(updatedUser) => {
            setUser(updatedUser);
            setShowEditModal(false);
          }}
        />
      </Modal>

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
        />
      </Modal>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-gray-900 dark:text-white">{value || 'Non renseigné'}</p>
      </div>
    </div>
  );
}

interface EditUserFormProps {
  formId: string;
  user: UserType;
  publicTypes: PublicType[];
  onLoadingChange: (loading: boolean) => void;
  onSuccess: (user: UserType) => void;
}

function EditUserForm({ formId, user, publicTypes, onLoadingChange, onSuccess }: EditUserFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    login: user.login || '',
    firstname: user.firstname || '',
    lastname: user.lastname || '',
    email: user.email || '',
    phone: user.phone || '',
    barcode: user.barcode || '',
    birthdate: user.birthdate || '',
    addr_street: user.addr_street || '',
    addr_zip_code: user.addr_zip_code?.toString() || '',
    addr_city: user.addr_city || '',
    notes: user.notes || '',
    fee: user.fee || '',
    group_id: user.group_id?.toString() || '',
    public_type: user.public_type?.toString() || '',
    status: user.status?.toString() || '',
    account_type: user.account_type || 'Reader',
    password: '',
  });

  const ACCOUNT_TYPES = [
    { value: 'reader', label: t('users.reader') },
    { value: 'librarian', label: t('users.librarian') },
    { value: 'admin', label: t('users.administrator') },
    { value: 'guest', label: t('users.guest') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onLoadingChange(true);
    try {
      const updateData: Record<string, unknown> = {
        login: formData.login || undefined,
        firstname: formData.firstname || undefined,
        lastname: formData.lastname || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        barcode: formData.barcode || undefined,
        birthdate: formData.birthdate || undefined,
        addr_street: formData.addr_street || undefined,
        addr_zip_code: formData.addr_zip_code ? parseInt(formData.addr_zip_code) : undefined,
        addr_city: formData.addr_city || undefined,
        notes: formData.notes || undefined,
        fee: formData.fee || undefined,
        group_id: formData.group_id ? String(formData.group_id) : undefined,
        public_type: formData.public_type ? String(formData.public_type) : undefined,
        status: formData.status ? parseInt(formData.status) : undefined,
        account_type: formData.account_type || undefined,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      const updated = await api.updateUser(user.id, updateData);
      onSuccess(updated);
    } catch (error) {
      console.error('Error updating user:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {/* Identity */}
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {t('users.identity')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('users.identifier')}
          value={formData.login}
          onChange={(e) => setFormData({ ...formData, login: e.target.value })}
        />
        <Input
          label={t('auth.password')}
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          placeholder={t('profile.leaveBlankPassword')}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('profile.firstName')}
          value={formData.firstname}
          onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
        />
        <Input
          label={t('profile.lastName')}
          value={formData.lastname}
          onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
        />
      </div>

      {/* Contact */}
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">
        {t('users.contact')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('profile.email')}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          leftIcon={<Mail className="h-4 w-4" />}
        />
        <Input
          label={t('profile.phone')}
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          leftIcon={<Phone className="h-4 w-4" />}
        />
      </div>

      {/* Address */}
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">
        {t('profile.address')}
      </h4>
      <Input
        label={t('profile.street')}
        value={formData.addr_street}
        onChange={(e) => setFormData({ ...formData, addr_street: e.target.value })}
        leftIcon={<MapPin className="h-4 w-4" />}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('profile.zipCode')}
          value={formData.addr_zip_code}
          onChange={(e) => setFormData({ ...formData, addr_zip_code: e.target.value })}
        />
        <Input
          label={t('profile.city')}
          value={formData.addr_city}
          onChange={(e) => setFormData({ ...formData, addr_city: e.target.value })}
        />
      </div>

      {/* Additional info */}
      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider pt-2">
        {t('users.additionalInfo')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('profile.barcode')}
          value={formData.barcode}
          onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
        />
        <Input
          label={t('profile.birthdate')}
          type="date"
          value={formData.birthdate}
          onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('profile.accountType')}
          </label>
          <select
            value={formData.account_type}
            onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {ACCOUNT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('users.fee')}
          value={formData.fee}
          onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          label={t('users.groupId')}
          type="number"
          value={formData.group_id}
          onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.publicType')}
          </label>
          <select
            value={formData.public_type}
            onChange={(e) => setFormData({ ...formData, public_type: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">{t('common.select')}</option>
            {publicTypes.map((pt) => (
              <option key={pt.id} value={String(pt.id)}>
                {pt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('users.statusField')}
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="">{t('common.select')}</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('users.notes')}
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
        />
      </div>

    </form>
  );
}

interface BorrowFormProps {
  formId: string;
  userId: string;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
}

function BorrowForm({ formId, userId, onLoadingChange, onSuccess }: BorrowFormProps) {
  const { t } = useTranslation();
  const [specimenCode, setSpecimenCode] = useState('');
  const [error, setError] = useState('');

  const doCreateLoan = async (force = false) => {
    try {
      await api.createLoan({
        user_id: userId,
        specimen_identification: specimenCode,
        force: force || undefined,
      });
      setError('');
      onSuccess();
    } catch (err: unknown) {
      const axiosData = (err as { response?: { data?: { message?: string } } })?.response?.data;
      const rawMessage = typeof axiosData?.message === 'string' ? axiosData.message : '';
      const isMaxLoans = /maximum\s*(total\s*)?loans(\s+for this document type)?\s*reached/i.test(rawMessage);
      const displayMsg = getApiErrorMessage(err, t) || t('loans.errorCreatingLoan');
      const confirmMsg = rawMessage || displayMsg;
      if (isMaxLoans && !force && window.confirm(`${confirmMsg}\n\n${t('loans.forceBorrowConfirm')}`)) {
        return doCreateLoan(true);
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
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}


