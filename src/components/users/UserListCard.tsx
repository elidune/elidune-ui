import { BookMarked, ChevronRight, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/common';
import type { PublicType, UserShort } from '@/types';
import { isSubscriptionExpired } from '@/utils/userSubscription';
import { formatSubscriptionExpiryLine } from '@/utils/subscriptionDisplay';

interface UserListCardProps {
  user: UserShort;
  publicTypes: PublicType[];
  onOpen: () => void;
  onRenew: () => void;
}

export default function UserListCard({ user, publicTypes, onOpen, onRenew }: UserListCardProps) {
  const { t, i18n } = useTranslation();
  const loanCount = user.loans?.length ?? user.nbLoans ?? 0;
  const expired = isSubscriptionExpired(user.expiryAt);
  const publicLabel = user.publicType
    ? publicTypes.find((p) => p.id === String(user.publicType))?.label
    : null;

  const created =
    user.createdAt != null && user.createdAt !== ''
      ? new Date(user.createdAt).toLocaleDateString(i18n.language, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '—';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="w-full text-left flex items-stretch gap-3 p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors min-h-[4.5rem] cursor-pointer"
    >
      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {user.firstname?.[0] || '?'}{user.lastname?.[0] || ''}
        </span>
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {user.firstname} {user.lastname}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {user.accountType}
          {publicLabel ? <> · {publicLabel}</> : null}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
          <span>
            {t('users.createdAt')}: {created}
          </span>
          <span className="inline-flex items-center gap-1">
            <BookMarked className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {loanCount}
            {(user.nbLateLoans || 0) > 0 && (
              <Badge variant="danger" size="sm">
                {user.nbLateLoans} {t('users.lateLoans')}
              </Badge>
            )}
          </span>
        </div>
        <div className="pt-1 flex flex-wrap items-center gap-2">
          {expired ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRenew();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-xs font-medium text-red-800 dark:text-red-200 min-h-[44px]"
            >
              {t('users.renewSubscription')}
              <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          ) : (
            <span className="text-xs text-gray-600 dark:text-gray-300">
              {formatSubscriptionExpiryLine(user.expiryAt, t, i18n)}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 self-center text-gray-400 dark:text-gray-500">
        <ChevronRight className="h-5 w-5" aria-hidden />
      </div>
    </div>
  );
}
