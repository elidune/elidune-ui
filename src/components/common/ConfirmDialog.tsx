import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import Button from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  stackOnTop?: boolean;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  message,
  title,
  confirmLabel,
  cancelLabel,
  confirmVariant = 'primary',
  stackOnTop = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('common.confirm');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resolvedTitle}
      size="sm"
      stackOnTop={stackOnTop}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{message}</p>
    </Modal>
  );
}
