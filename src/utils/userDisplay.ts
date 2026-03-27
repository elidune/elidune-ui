import type { UserShort } from '@/types';

/** Display name for embedded user in lists (holds, loans, etc.). */
export function formatUserShortName(user: UserShort | null | undefined): string {
  if (!user) return '';
  const name = [user.firstname, user.lastname].filter(Boolean).join(' ').trim();
  return name || user.id;
}
