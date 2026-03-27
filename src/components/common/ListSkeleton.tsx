interface ListSkeletonProps {
  rows?: number;
}

/** Placeholder rows while a list query is loading (initial load). */
export default function ListSkeleton({ rows = 8 }: ListSkeletonProps) {
  return (
    <div className="p-4 space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 animate-pulse"
        >
          <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/5" />
            <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
