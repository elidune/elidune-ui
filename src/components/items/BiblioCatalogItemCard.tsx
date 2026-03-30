import { ChevronRight, Edit, Trash2 } from 'lucide-react';
import type { BiblioShort, Author } from '@/types';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import { LIST_ROW_ICON_BTN, LIST_ROW_ICON_BTN_DANGER } from '@/utils/listRowActionIconClass';

interface BiblioCatalogItemCardProps {
  item: BiblioShort;
  mediaIcon: React.ReactNode;
  mediaBgClassName: string;
  formatAuthor: (author?: Author | null) => string;
  notSpecified: string;
  statusBadge: React.ReactNode;
  onOpen: () => void;
  canManage?: boolean;
  editLabel?: string;
  deleteLabel?: string;
  actionsAriaLabel?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function BiblioCatalogItemCard({
  item,
  mediaIcon,
  mediaBgClassName,
  formatAuthor,
  notSpecified,
  statusBadge,
  onOpen,
  canManage = false,
  editLabel,
  deleteLabel,
  actionsAriaLabel,
  onEdit,
  onDelete,
}: BiblioCatalogItemCardProps) {
  const list = item.items ?? [];
  const total = list.length;
  const available = list.filter((s) => s.borrowable === true && !s.borrowed).length;
  const specimensText =
    total === 0 ? '—' : `${available}/${total}`;

  return (
    <div className="flex items-stretch border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left flex items-stretch gap-3 p-4"
      >
        <div
          className={`flex-shrink-0 h-12 w-12 rounded-lg flex items-center justify-center ${mediaBgClassName}`}
        >
          {mediaIcon}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-medium text-gray-900 dark:text-white line-clamp-2">
            {item.title || notSpecified}
          </p>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate">
            {formatIsbnDisplay(item.isbn)}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{formatAuthor(item.author)}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">{specimensText}</span>
            {statusBadge}
          </div>
        </div>
        <div className="flex-shrink-0 self-center text-gray-400 dark:text-gray-500">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </div>
      </button>
      {canManage && onEdit && onDelete && (
        <div
          className="flex items-center gap-1.5 pr-3 pl-1 border-l border-gray-100 dark:border-gray-800 shrink-0"
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
        </div>
      )}
    </div>
  );
}
