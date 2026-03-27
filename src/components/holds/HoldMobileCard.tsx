import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import { Button } from '@/components/common';
import HoldDocumentCell from '@/components/holds/HoldDocumentCell';
import type { Hold } from '@/types';
import { formatUserShortName } from '@/utils/userDisplay';

interface HoldMobileCardProps {
  hold: Hold;
  statusBadge: (status: Hold['status']) => ReactNode;
  onCancel: () => void;
  cancelPending: boolean;
}

export default function HoldMobileCard({
  hold,
  statusBadge,
  onCancel,
  cancelPending,
}: HoldMobileCardProps) {
  const { t, i18n } = useTranslation();
  const userLabel = formatUserShortName(hold.user) || hold.userId;
  const showCancel = hold.status === 'pending' || hold.status === 'ready';

  return (
    <div className="p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Link className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline min-w-0" to={`/users/${hold.userId}`}>
          {userLabel}
        </Link>
        {statusBadge(hold.status)}
      </div>
      <div className="text-sm">
        <HoldDocumentCell hold={hold} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
        <div>
          <span className="text-gray-500 block">{t('holds.position')}</span>
          {hold.position}
        </div>
        <div>
          <span className="text-gray-500 block">{t('holds.createdAt')}</span>
          {new Date(hold.createdAt).toLocaleString(i18n.language)}
        </div>
        <div className="col-span-2">
          <span className="text-gray-500">{t('holds.expiresAt')}: </span>
          {hold.expiresAt ? new Date(hold.expiresAt).toLocaleString(i18n.language) : '—'}
        </div>
      </div>
      {showCancel && (
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Ban className="h-4 w-4" />}
          isLoading={cancelPending}
          onClick={onCancel}
        >
          {t('holds.cancelHold')}
        </Button>
      )}
    </div>
  );
}
