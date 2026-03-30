import type { ReactNode } from 'react';

/**
 * Root class for scroll containers so features like IntersectionObserver can use
 * `element.closest('.app-list-scroll')` site-wide.
 */
export const APP_LIST_SCROLL_ROOT_CLASS = 'app-list-scroll';

const SCROLL_CLASSES = `${APP_LIST_SCROLL_ROOT_CLASS} overflow-auto max-h-[calc(100vh-18rem)] min-h-0`;

/** Grows inside a flex column parent so the list scrolls instead of the page (e.g. inventory). */
const SCROLL_FILL_CLASSES = `${APP_LIST_SCROLL_ROOT_CLASS} flex-1 min-h-0 overflow-auto`;

interface ScrollableListRegionProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
  /** Use when the parent is a flex column with bounded height; this region takes remaining space. */
  fill?: boolean;
}

/**
 * Fixed-height band for list/table content: page chrome stays static, only this region scrolls.
 * Same strategy as Users / Biblios catalog lists.
 */
export default function ScrollableListRegion({
  children,
  className,
  'aria-label': ariaLabel,
  fill = false,
}: ScrollableListRegionProps) {
  const base = fill ? SCROLL_FILL_CLASSES : SCROLL_CLASSES;
  return (
    <div className={className ? `${base} ${className}` : base} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
