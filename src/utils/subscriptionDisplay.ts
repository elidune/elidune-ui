import type { TFunction } from 'i18next';
import type { i18n as I18n } from 'i18next';
import { isSubscriptionExpired } from '@/utils/userSubscription';

export type SubscriptionDisplayState = 'unlimited' | 'active' | 'expired';

export function getSubscriptionDisplayState(expiryAt: string | null | undefined): SubscriptionDisplayState {
  if (expiryAt == null || expiryAt === '') return 'unlimited';
  const t = new Date(expiryAt).getTime();
  if (Number.isNaN(t)) return 'unlimited';
  if (isSubscriptionExpired(expiryAt)) return 'expired';
  return 'active';
}

/**
 * Localized one-line label for membership / subscription (list views).
 */
export function formatSubscriptionExpiryLine(
  expiryAt: string | null | undefined,
  t: TFunction,
  i18n: I18n
): string {
  const state = getSubscriptionDisplayState(expiryAt);
  if (state === 'unlimited') return t('users.subscriptionUnlimited');
  if (state === 'expired') return t('users.subscriptionExpired');
  const d = new Date(expiryAt as string);
  return t('users.subscriptionValidUntil', {
    date: d.toLocaleDateString(i18n.language, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  });
}
