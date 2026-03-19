import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Calendar, RotateCcw, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, Button, Badge } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/services/api';
import type { Loan } from '@/types';

export default function MyLoansPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLoans = async () => {
      if (!user?.id) return;
      try {
        const data = await api.getUserLoans(user.id);
        setLoans(data);
      } catch (error) {
        console.error('Error fetching loans:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLoans();
  }, [user?.id]);

  const handleRenewLoan = async (loanId: string) => {
    try {
      await api.renewLoan(loanId);
      // Refresh loans
      if (user?.id) {
        const data = await api.getUserLoans(user.id);
        setLoans(data);
      }
    } catch (error) {
      console.error('Error renewing loan:', error);
    }
  };

  const overdueLoans = loans.filter((l) => l.is_overdue);
  const activeLoans = loans.filter((l) => !l.is_overdue);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('loans.myLoans')}</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {t('loans.count', { count: loans.length })}
        </p>
      </div>

      {/* Overdue loans alert */}
      {overdueLoans.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800 dark:text-red-200">
              {t('loans.overdueCount', { count: overdueLoans.length })}
            </p>
          </div>
        </div>
      )}

      {/* Overdue loans */}
      {overdueLoans.length > 0 && (
        <Card>
          <CardHeader
            title={t('loans.overdue')}
            subtitle={t('items.count', { count: overdueLoans.length })}
          />
          <div className="space-y-3">
            {overdueLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onRenew={handleRenewLoan} isOverdue />
            ))}
          </div>
        </Card>
      )}

      {/* Active loans */}
      <Card>
        <CardHeader
          title={t('loans.activeLoans')}
          subtitle={t('items.count', { count: activeLoans.length })}
        />
        {activeLoans.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>{t('loans.noLoans')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onRenew={handleRenewLoan} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface LoanCardProps {
  loan: Loan;
  onRenew: (id: string) => void;
  isOverdue?: boolean;
}

function LoanCard({ loan, onRenew, isOverdue = false }: LoanCardProps) {
  const { t, i18n } = useTranslation();
  const daysUntilDue = Math.ceil((new Date(loan.issue_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border ${
        isOverdue
          ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
      }`}
    >
      <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
        <BookOpen className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {loan.item.title || t('items.notSpecified')}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
          {(() => {
            const specs = loan.item?.specimens;
            if (specs?.length) {
              const spec = specs.find((s) => s.availability === 1) ?? specs[0];
              return spec?.barcode ?? spec?.id ?? '-';
            }
            return loan.specimen_identification ?? '-';
          })()}
        </p>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span>{t('loans.loanDate')}: {new Date(loan.start_date).toLocaleDateString(i18n.language)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:items-end gap-2">
        <div className="flex items-center gap-2">
          {isOverdue ? (
            <Badge variant="danger">
              {t('loans.overdue')} ({Math.abs(daysUntilDue)})
            </Badge>
          ) : daysUntilDue <= 3 ? (
            <Badge variant="warning">
              {daysUntilDue === 0
                ? t('loans.dueDate')
                : `${daysUntilDue} ${t('stats.timeRange.7d').replace('7 ', '')}`}
            </Badge>
          ) : (
            <Badge variant="success">
              {t('loans.dueDate')}: {new Date(loan.issue_at).toLocaleDateString(i18n.language)}
            </Badge>
          )}
        </div>

        {loan.nb_renews < 2 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRenew(loan.id)}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            {t('loans.renew')} ({2 - loan.nb_renews})
          </Button>
        )}
      </div>
    </div>
  );
}

