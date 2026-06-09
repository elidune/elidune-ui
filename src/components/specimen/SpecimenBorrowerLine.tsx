import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import { formatUserShortName } from '@/utils/userDisplay';

interface SpecimenBorrowerLineProps {
  loanId: string;
}

export default function SpecimenBorrowerLine({ loanId }: SpecimenBorrowerLineProps) {
  const { t } = useTranslation();
  const { data: borrower, isPending } = useQuery({
    queryKey: ['loan-borrower', loanId],
    queryFn: () => api.getLoanBorrower(loanId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isPending) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">
        {t('items.borrowedByLoading')}
      </p>
    );
  }

  if (!borrower) return null;

  const name = formatUserShortName(borrower);

  return (
    <p className="text-sm text-gray-500 dark:text-gray-400">
      {t('items.borrowedBy')}{' '}
      <Link
        to={`/users/${borrower.id}`}
        className="font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
      >
        {name}
      </Link>
    </p>
  );
}
