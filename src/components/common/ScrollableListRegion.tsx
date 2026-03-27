import type { ReactNode } from 'react';

/**
 * Root class for scroll containers so features like IntersectionObserver can use
 * `element.closest('.app-list-scroll')` site-wide.
 */
export const APP_LIST_SCROLL_ROOT_CLASS = 'app-list-scroll';

const SCROLL_CLASSES = `${APP_LIST_SCROLL_ROOT_CLASS} overflow-auto max-h-[calc(100vh-18rem)] min-h-0`;

interface ScrollableListRegionProps {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

/**
 * Fixed-height band for list/table content: page chrome stays static, only this region scrolls.
 * Same strategy as Users / Biblios catalog lists.
 */
export default function ScrollableListRegion({
  children,
  className,
  'aria-label': ariaLabel,
}: ScrollableListRegionProps) {
  return (
    <div className={className ? `${SCROLL_CLASSES} ${className}` : SCROLL_CLASSES} aria-label={ariaLabel}>
      {children}
    </div>
  );
}
