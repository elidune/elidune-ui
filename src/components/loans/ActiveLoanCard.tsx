import { Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Badge } from '@/components/common';
import type { Loan } from '@/types';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';

interface ActiveLoanCardProps {
  loan: Loan;
  onRenew: () => void;
  onReturn: () => void;
}

export default function ActiveLoanCard({ loan, onRenew, onReturn }: ActiveLoanCardProps) {
  const { t, i18n } = useTranslation();
  const specs = loan.biblio?.items;
  const spec = specs?.length ? (specs.find((s) => s.borrowed) ?? specs[0]) : null;
  const specimenBarcode = spec ? (spec.barcode ?? spec.id) : loan.itemIdentification;

  const df = (d: string) =>
    new Date(d).toLocaleDateString(i18n.language, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 space-y-3">
      <div>
        <p className="font-medium text-gray-900 dark:text-white">{loan.biblio.title || t('loans.noTitle')}</p>
        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5 mt-1">
          {loan.biblio.isbn && (
            <p>
              {t('items.isbn')}: <span className="font-mono">{formatIsbnDisplay(loan.biblio.isbn)}</span>
            </p>
          )}
          <p>
            {t('items.barcode')}: <span className="font-mono">{specimenBarcode ?? '-'}</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
        <div>
          <span className="text-gray-500 block">{t('loans.borrowDate')}</span>
          {df(loan.startDate)}
        </div>
        <div>
          <span className="text-gray-500 block">{t('loans.dueDate')}</span>
          <span className="inline-flex items-center gap-1 flex-wrap">
            {df(loan.expiryAt)}
            {loan.isOverdue && <Badge variant="danger">{t('loans.overdue')}</Badge>}
          </span>
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">{t('loans.renewals')}: </span>
          {loan.nbRenews}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={onRenew} leftIcon={<RotateCcw className="h-4 w-4" />}>
          {t('loans.renew')}
        </Button>
        <Button size="sm" variant="primary" onClick={onReturn} leftIcon={<Check className="h-4 w-4" />}>
          {t('loans.return')}
        </Button>
      </div>
    </div>
  );
}
