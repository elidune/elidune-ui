import { BookMarked, ChevronRight, Edit, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/common';
import type { PublicType, UserShort } from '@/types';
import { isSubscriptionExpired } from '@/utils/userSubscription';
import { formatSubscriptionExpiryLine } from '@/utils/subscriptionDisplay';
import { LIST_ROW_ICON_BTN, LIST_ROW_ICON_BTN_DANGER, LIST_ROW_ICON_BTN_MUTED } from '@/utils/listRowActionIconClass';

interface UserListCardProps {
  user: UserShort;
  publicTypes: PublicType[];
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRenew: () => void;
  editLabel: string;
  deleteLabel: string;
  renewLabel: string;
  actionsAriaLabel: string;
}

export default function UserListCard({
  user,
  publicTypes,
  onOpen,
  onEdit,
  onDelete,
  onRenew,
  editLabel,
  deleteLabel,
  renewLabel,
  actionsAriaLabel,
}: UserListCardProps) {
  const { t, i18n } = useTranslation();
  const loanCount = user.loans?.length ?? user.nbLoans ?? 0;
  const renewDisabled = !isSubscriptionExpired(user.expiryAt);
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
    <div className="flex items-stretch border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors min-h-[4.5rem]">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left flex items-stretch gap-3 p-4"
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
          <p className="text-xs text-gray-600 dark:text-gray-300 pt-0.5">
            <span className="text-gray-500 dark:text-gray-400">{t('users.subscriptionExpiry')}: </span>
            {formatSubscriptionExpiryLine(user.expiryAt, t, i18n)}
          </p>
        </div>
        <div className="flex-shrink-0 self-center text-gray-400 dark:text-gray-500 pr-1">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </div>
      </button>
      <div
        className="flex items-center gap-1.5 px-2 border-l border-gray-100 dark:border-gray-800 shrink-0"
        role="group"
        aria-label={actionsAriaLabel}
      >
        <button
          type="button"
          className={LIST_ROW_ICON_BTN}
          title={editLabel}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Edit className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={LIST_ROW_ICON_BTN_DANGER}
          title={deleteLabel}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          className={LIST_ROW_ICON_BTN_MUTED}
          title={renewLabel}
          disabled={renewDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!renewDisabled) onRenew();
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
