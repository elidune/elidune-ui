import type { ReactNode } from 'react';

interface ResponsiveRecordListProps {
  /** Table or dense desktop list — hidden below `md`. */
  desktop: ReactNode;
  /** Stacked cards or list — visible only below `md`. */
  mobile: ReactNode;
  /** Optional wrapper classes for both slots (e.g. padding). */
  className?: string;
}

/**
 * Standard list pattern: data table from `md` up, card stack on small screens.
 * Same data source for both; no duplicate fetching.
 */
export default function ResponsiveRecordList({ desktop, mobile, className = '' }: ResponsiveRecordListProps) {
  return (
    <>
      <div className={`hidden md:block ${className}`.trim()}>{desktop}</div>
      <div className={`md:hidden ${className}`.trim()}>{mobile}</div>
    </>
  );
}
