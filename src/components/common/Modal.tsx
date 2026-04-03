import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /** Renders above other modals (e.g. nested error dialog). */
  stackOnTop?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  stackOnTop = false,
}: ModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };

  return (
    <div
      className={`fixed inset-0 flex items-stretch sm:items-center justify-center p-0 sm:p-4 ${stackOnTop ? 'z-[100]' : 'z-50'}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — full viewport on narrow screens for usability */}
      <div
        className={`relative w-full ${sizes[size]} max-sm:max-w-none max-sm:min-h-[100dvh] sm:max-h-[90vh] max-h-[100dvh] bg-white dark:bg-gray-900 rounded-none sm:rounded-xl shadow-2xl overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)]`}
      >
        {/* Header — title centered; chrome LTR so close stays visual right under dir=rtl */}
        <div
          className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-6 py-4 dark:border-gray-800"
          dir="ltr"
        >
          <div className="h-9 w-9 shrink-0" aria-hidden />
          <h2
            className="min-w-0 flex-1 truncate text-center text-lg font-semibold text-gray-900 dark:text-white"
            dir="auto"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
