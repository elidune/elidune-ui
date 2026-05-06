import type { PublicType } from '@/types';

/** Resolved label from GET /public-types when `name` matches; otherwise the raw `name`. */
export function eventPublicTypeDisplayLabel(
  publicType: string | null | undefined,
  publicTypes: PublicType[],
): string | null {
  if (publicType == null || publicType.trim() === '') return null;
  const pt = publicTypes.find((p) => p.name === publicType);
  return pt?.label ?? publicType;
}
