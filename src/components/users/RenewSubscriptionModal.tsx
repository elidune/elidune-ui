import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Input, Button, MessageModal } from '@/components/common';
import api from '@/services/api';
import type { User } from '@/types';
import { getApiErrorMessage } from '@/utils/apiError';
import {
  computeRenewedExpiryAt,
  dateInputToIsoEndOfDayUtc,
  toDateInputValue,
} from '@/utils/userSubscription';

export type RenewSubscriptionSubject = {
  id: string;
  expiryAt?: string | null;
  createdAt?: string | null;
};

interface RenewSubscriptionModalProps {
  user: RenewSubscriptionSubject | null;
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful renewal with the updated user from the API */
  onSuccess: (user: User) => void | Promise<void>;
}

/**
 * Shared modal to set membership expiry (same flow as the users list “expired” renew).
 */
export default function RenewSubscriptionModal({
  user,
  isOpen,
  onClose,
  onSuccess,
}: RenewSubscriptionModalProps) {
  const { t } = useTranslation();
  const [renewExpiryDate, setRenewExpiryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const proposedIso = computeRenewedExpiryAt(user.expiryAt, user.createdAt);
    setRenewExpiryDate(toDateInputValue(new Date(proposedIso)));
  }, [user]);

  const handleConfirm = async () => {
    if (!user) return;
    const ymd =
      renewExpiryDate ||
      toDateInputValue(new Date(computeRenewedExpiryAt(user.expiryAt, user.createdAt)));
    setSubmitting(true);
    try {
      const updated = await api.updateUser(user.id, {
        expiryAt: dateInputToIsoEndOfDayUtc(ymd),
      });
      await onSuccess(updated);
      onClose();
    } catch (error) {
      console.error('Error renewing subscription:', error);
      setErrorMessage(getApiErrorMessage(error, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => !submitting && onClose()}
        title={t('users.renewSubscriptionModalTitle')}
        size="md"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleConfirm()} isLoading={submitting}>
              {t('users.renewSubscriptionConfirm')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('users.renewSubscriptionModalIntro')}
        </p>
        <Input
          label={t('users.renewSubscriptionNewExpiry')}
          type="date"
          value={renewExpiryDate}
          onChange={(e) => setRenewExpiryDate(e.target.value)}
        />
      </Modal>
      <MessageModal
        isOpen={errorMessage !== null}
        onClose={() => setErrorMessage(null)}
        message={errorMessage ?? ''}
        stackOnTop
      />
    </>
  );
}
