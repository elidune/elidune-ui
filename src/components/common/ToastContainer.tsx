import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import type { ToastVariant } from '@/contexts/ToastContext';

const variantStyles: Record<
  ToastVariant,
  { container: string; icon: typeof Info }
> = {
  info: {
    container:
      'border-indigo-200 bg-white dark:border-indigo-800 dark:bg-gray-900 text-gray-900 dark:text-gray-100',
    icon: Info,
  },
  success: {
    container:
      'border-green-200 bg-white dark:border-green-800 dark:bg-gray-900 text-gray-900 dark:text-gray-100',
    icon: CheckCircle,
  },
  error: {
    container:
      'border-red-200 bg-white dark:border-red-800 dark:bg-gray-900 text-gray-900 dark:text-gray-100',
    icon: AlertCircle,
  },
};

export default function ToastContainer() {
  const { t } = useTranslation();
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => {
        const styles = variantStyles[toast.variant];
        const Icon = styles.icon;
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg ${styles.container}`}
          >
            <Icon
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                toast.variant === 'success'
                  ? 'text-green-600 dark:text-green-400'
                  : toast.variant === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-indigo-600 dark:text-indigo-400'
              }`}
              aria-hidden
            />
            <p className="flex-1 text-sm leading-snug">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={t('common.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
