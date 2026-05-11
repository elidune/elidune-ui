import type { Loan } from '@/types';

/** Stable sort: oldest borrow date first. */
export function sortLoansByStartDateAsc(loans: Loan[]): Loan[] {
  return [...loans].sort((a, b) => {
    const c = a.startDate.localeCompare(b.startDate);
    return c !== 0 ? c : a.id.localeCompare(b.id);
  });
}
