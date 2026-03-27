import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import type { PublicType } from '@/types';

/** Shared cache for GET /public_types (used by users list, user detail, etc.). */
export const PUBLIC_TYPES_QUERY_KEY = ['public-types'] as const;

export function usePublicTypesQuery() {
  return useQuery<PublicType[]>({
    queryKey: PUBLIC_TYPES_QUERY_KEY,
    queryFn: () => api.getPublicTypes(),
  });
}
