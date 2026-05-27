import { useInfiniteQuery } from '@tanstack/react-query';
import api from '@/services/api';

export const PUBLIC_EVENTS_PAGE_SIZE = 10;

export function usePublicEventsInfiniteQuery(queryKey: readonly unknown[]) {
  return useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      api.getEvents({ page: pageParam, perPage: PUBLIC_EVENTS_PAGE_SIZE }),
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage?.events?.length) return undefined;
      const loaded = lastPageParam * PUBLIC_EVENTS_PAGE_SIZE;
      return loaded < lastPage.total ? lastPageParam + 1 : undefined;
    },
  });
}
