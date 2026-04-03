/** eventType: 0=animation … 6=other — aligned with EventsPage */
export const EVENT_TYPE_COLORS: Record<number, string> = {
  0: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  3: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  4: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  5: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  6: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
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

export const TARGET_PUBLIC_KEYS: Record<number, string> = {
  97: 'events.targetPublic.adult',
  106: 'events.targetPublic.children',
};
