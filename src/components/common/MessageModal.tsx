import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';

export interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Message body (plain text). */
  message: string;
  /** Modal title; defaults to “Error” for danger, “Notice” otherwise. */
  title?: string;
  variant?: 'default' | 'danger';
  /** Use when another modal is open so this stacks above it. */
  stackOnTop?: boolean;
}

/**
 * Simple acknowledgement dialog (replaces native `alert()`).
 */
export default function MessageModal({
  isOpen,
  onClose,
  message,
  title,
  variant = 'danger',
  stackOnTop = false,
}: MessageModalProps) {
  const { t } = useTranslation();
  const resolvedTitle =
    title ?? (variant === 'danger' ? t('common.error') : t('common.notice'));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      size="sm"
      stackOnTop={stackOnTop}
      footer={
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            {t('common.ok')}
          </Button>
        </div>
      }
    >
      <p
        className={
          variant === 'danger'
            ? 'text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap'
            : 'text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap'
        }
      >
        {message}
      </p>
    </Modal>
  );
}
