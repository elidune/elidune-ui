/** eventType: 0=animation … 6=other — aligned with EventsPage */
export const EVENT_TYPE_COLORS: Record<number, string> = {
  0: 'bg-purple-100 text-purple-900 ring-1 ring-purple-300/70 dark:bg-purple-900/50 dark:text-purple-100 dark:ring-purple-700/70',
  1: 'bg-blue-100 text-blue-900 ring-1 ring-blue-300/70 dark:bg-blue-900/50 dark:text-blue-100 dark:ring-blue-700/70',
  2: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300/70 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-700/70',
  3: 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300/70 dark:bg-indigo-900/50 dark:text-indigo-100 dark:ring-indigo-700/70',
  4: 'bg-green-100 text-green-900 ring-1 ring-green-300/70 dark:bg-green-900/50 dark:text-green-100 dark:ring-green-700/70',
  5: 'bg-pink-100 text-pink-900 ring-1 ring-pink-300/70 dark:bg-pink-900/50 dark:text-pink-100 dark:ring-pink-700/70',
  6: 'bg-gray-100 text-gray-900 ring-1 ring-gray-300/70 dark:bg-gray-700 dark:text-gray-100 dark:ring-gray-600',
};

export const EVENT_TYPE_KEYS: Record<number, string> = {
  0: 'events.types.animation',
  1: 'events.types.schoolVisit',
  2: 'events.types.exhibition',
  3: 'events.types.conference',
  4: 'events.types.workshop',
  5: 'events.types.show',
  6: 'events.types.other',
};
