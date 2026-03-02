import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Edit,
  Trash2,
  User,
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
import type { User as UserType, Loan, LoanStatsResponse, AdvancedStatsParams, StatsInterval } from '@/types';
import { PUBLIC_TYPE_OPTIONS, STATUS_OPTIONS } from '@/utils/codeLabels';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [user, setUser] = useState<UserType | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);

  // Stats state
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
    const fetchData = async () => {
      if (!id) return;
      try {
        const [userData, loansData] = await Promise.all([
          api.getUser(id),
          api.getUserLoans(id),
        ]);
        setUser(userData);
        setLoans(loansData);
      } catch (error) {
        console.error('Error fetching user:', error);
        navigate('/users');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

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
      // Refresh loans
      if (user) {
        const loansData = await api.getUserLoans(user.id);
        setLoans(loansData);
      }
    } catch (error) {
      console.error('Error returning loan:', error);
    }
  };

  const handleRenewLoan = async (loanId: string) => {
    try {
      await api.renewLoan(loanId);
      // Refresh loans
      if (user) {
        const loansData = await api.getUserLoans(user.id);
        setLoans(loansData);
      }
    } catch (error) {
      console.error('Error renewing loan:', error);
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

  const overdueLoans = loans.filter((l) => l.is_overdue);

  const loanColumns = [
    {
      key: 'title',
      header: 'Document',
      render: (loan: Loan) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {loan.item.title || 'Sans titre'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loan.specimen_identification}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date emprunt',
      render: (loan: Loan) =>
        new Date(loan.start_date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'issue_date',
      header: 'Échéance',
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <span>{new Date(loan.issue_date).toLocaleDateString('fr-FR')}</span>
          {loan.is_overdue && <Badge variant="danger">Retard</Badge>}
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
              <Badge>{user.account_type}</Badge>
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
            {user.crea_date && (
              <InfoRow
                icon={Calendar}
                label={t('users.createdAt')}
                value={new Date(user.crea_date).toLocaleDateString(i18n.language, {
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
              <CardHeader
                title={t('loans.activeLoans')}
                subtitle={`${loans.length} ${t('loans.count', { count: loans.length })}`}
              />
            </div>
            <Table
              columns={loanColumns}
              data={loans}
              keyExtractor={(loan) => loan.id}
              emptyMessage={t('loans.noLoans')}
            />
          </Card>
        </div>
      </div>

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
      >
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Êtes-vous sûr de vouloir supprimer le compte de {user.firstname} {user.lastname} ?
          {loans.length > 0 && (
            <span className="block mt-2 text-amber-600 dark:text-amber-400">
              ⚠️ Cet usager a encore {loans.length} emprunt(s) en cours.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Supprimer
          </Button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Modifier l'usager"
        size="lg"
      >
        <EditUserForm
          user={user}
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
      >
        <BorrowForm
          userId={user.id}
          onSuccess={() => {
            setShowBorrowModal(false);
            // Refresh loans
            api.getUserLoans(user.id).then(setLoans);
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
  user: UserType;
  onSuccess: (user: UserType) => void;
}

function EditUserForm({ user, onSuccess }: EditUserFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
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
    { value: 'Reader', label: t('users.reader') },
    { value: 'Librarian', label: t('users.librarian') },
    { value: 'Administrator', label: t('users.administrator') },
    { value: 'Guest', label: t('users.guest') },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
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
        group_id: formData.group_id ? parseInt(formData.group_id) : undefined,
        public_type: formData.public_type ? parseInt(formData.public_type) : undefined,
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
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
            {PUBLIC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
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

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

interface BorrowFormProps {
  userId: string;
  onSuccess: () => void;
}

function BorrowForm({ userId, onSuccess }: BorrowFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [specimenCode, setSpecimenCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await api.createLoan({
        user_id: userId,
        specimen_identification: specimenCode,
      });
      onSuccess();
    } catch (err) {
      setError('Impossible de créer l\'emprunt. Vérifiez le code-barre.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Code-barre de l'exemplaire"
        value={specimenCode}
        onChange={(e) => setSpecimenCode(e.target.value)}
        placeholder="Scanner ou saisir le code-barre"
        autoFocus
        required
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          Emprunter
        </Button>
      </div>
    </form>
  );
}


