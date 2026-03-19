import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users, BookMarked, TrendingUp, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, Badge } from '@/components/common';
import { isLibrarian } from '@/types';
import api from '@/services/api';
import type { Stats, Loan } from '@/types';

export default function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, loansData] = await Promise.all([
          isLibrarian(user?.account_type) ? api.getStats() : null,
          user?.id ? api.getUserLoans(user.id) : [],
        ]);
        if (statsData) setStats(statsData);
        setMyLoans(loansData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const overdueLoans = myLoans.filter((loan) => loan.is_overdue);

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-gradient-to-r from-gray-700 to-gray-900 rounded-2xl p-6 sm:p-8 text-white">
        <div className="flex items-center gap-2">
          <img src="/elidune_logo.png" alt="Elidune" className="h-30 w-30 mb-2" />
          <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            {t('nav.home')}, {user?.firstname || user?.username}
          </h1>
          <p className="text-gray-100">
            {t('auth.loginSubtitle')}
          </p>
          </div>
        </div>
      </div>

      {/* Overdue loans alert */}
      {overdueLoans.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {t('loans.overdueCount', { count: overdueLoans.length })}
            </p>
          </div>
        </div>
      )}

      {/* Stats cards (for librarians) */}
      {isLibrarian(user?.account_type) && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={BookOpen}
            label={t('stats.documents')}
            value={stats.items.total}
            color="gray"
          />
          <StatCard
            icon={Users}
            label={t('stats.activeUsers')}
            value={stats.users.active}
            color="emerald"
          />
          <StatCard
            icon={BookMarked}
            label={t('stats.activeLoans')}
            value={stats.loans.active}
            color="amber"
          />
          <StatCard
            icon={TrendingUp}
            label={t('stats.overdue')}
            value={stats.loans.overdue}
            color="red"
          />
        </div>
      )}

      {/* My loans */}
      <Card>
        <CardHeader
          title={t('loans.myLoans')}
          subtitle={t('loans.count', { count: myLoans.length })}
          action={
            <Link
              to="/my-loans"
              className="text-sm text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              {t('common.view')} <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : myLoans.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BookMarked className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{t('loans.noLoans')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myLoans.slice(0, 5).map((loan) => (
              <div
                key={loan.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {loan.item.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('loans.dueDate')}: {new Date(loan.issue_at).toLocaleDateString()}
                  </p>
                </div>
                {loan.is_overdue && (
                  <Badge variant="danger">{t('loans.overdue')}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickActionCard
          to="/items"
          icon={BookOpen}
          title={t('nav.catalog')}
          description={t('items.searchPlaceholder')}
        />
        {isLibrarian(user?.account_type) && (
          <>
            <QuickActionCard
              to="/users"
              icon={Users}
              title={t('nav.users')}
              description={t('users.searchPlaceholder')}
            />
            <QuickActionCard
              to="/stats"
              icon={TrendingUp}
              title={t('nav.stats')}
              description={t('stats.subtitle')}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: 'gray' | 'emerald' | 'amber' | 'red';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
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
        </div>
      </div>
    </Card>
  );
}

interface QuickActionCardProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function QuickActionCard({ to, icon: Icon, title, description }: QuickActionCardProps) {
  return (
    <Link
      to={to}
      className="block p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-lg transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

