import type { PaginatedResponse } from '@/types';

/**
 * Rust/JSON APIs typically return paginated lists with snake_case keys
 * (`per_page`, `page_count`). The UI uses camelCase (`perPage`, `pageCount`).
 */
export function normalizePaginatedResponse<T>(raw: unknown): PaginatedResponse<T> {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r !== 'object') {
    return { items: [], total: 0, page: 1, perPage: 10, pageCount: 0 };
  }
  const items = (Array.isArray(r.items) ? r.items : []) as T[];
  const total = Number(r.total ?? 0);
  const page = Number(r.page ?? 1);
  const perPage = Number(r.perPage ?? r.per_page ?? 10);
  const pageCountRaw = r.pageCount ?? r.page_count;
  const pageCount =
    typeof pageCountRaw === 'number' && !Number.isNaN(pageCountRaw)
      ? pageCountRaw
      : perPage > 0
        ? Math.ceil(total / perPage)
        : 0;
  return { items, total, page, perPage, pageCount };
}
