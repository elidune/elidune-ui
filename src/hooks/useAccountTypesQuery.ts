import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { AccountTypeDefinition } from '@/types';

export const ACCOUNT_TYPES_QUERY_KEY = ['account-types'] as const;

export function useAccountTypesQuery() {
  return useQuery<AccountTypeDefinition[]>({
    queryKey: ACCOUNT_TYPES_QUERY_KEY,
    queryFn: () => api.getAccountTypes(),
  });
}
