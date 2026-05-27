import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBackgroundTasks } from '@/contexts/BackgroundTasksContext';
import type { BackgroundTask } from '@/types';
import { isLibrarian } from '@/types';
import {
  formatTaskProgressDetail,
  formatTaskResultSummary,
  isTaskActive,
  taskDeepLink,
  taskKindLabel,
  taskProgressPercent,
} from '@/utils/backgroundTaskDisplay';

function TaskRow({ task }: { task: BackgroundTask }) {
  const { t } = useTranslation();
  const active = isTaskActive(task);
  const percent = taskProgressPercent(task);
  const detail = active
    ? formatTaskProgressDetail(task, t)
    : formatTaskResultSummary(task, t);
  const href = taskDeepLink(task);

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 text-sm ${
        task.status === 'failed'
          ? 'border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30'
          : active
            ? 'border-indigo-200 bg-white dark:border-indigo-800 dark:bg-gray-900/60'
            : 'border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {active ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />
          ) : task.status === 'completed' ? (
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {taskKindLabel(task.kind, t)}
          </p>
          {detail && (
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 break-words">{detail}</p>
          )}
          {active && percent != null && (
            <div className="mt-2">
              <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
                <span>{t('backgroundTask.progress')}</span>
                <span className="tabular-nums">
                  {task.progress!.current} / {task.progress!.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
          {href && (
            <Link
              to={href}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('backgroundTask.openRelatedPage')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/** Sidebar nav item: opens the tasks drawer. */
export function BackgroundTasksNavItem({
  className = '',
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { activeCount, unreadCount, drawerOpen, toggleDrawer } = useBackgroundTasks();

  if (!isLibrarian(user?.accountType)) return null;

  const showActiveBadge = activeCount > 0;
  const showUnreadBadge = !showActiveBadge && unreadCount > 0;
  const isHighlighted = drawerOpen;

  return (
    <button
      type="button"
      onClick={() => {
        toggleDrawer();
        onNavigate?.();
      }}
      aria-expanded={drawerOpen}
      aria-controls="background-tasks-drawer"
      aria-label={
        showActiveBadge
          ? t('backgroundTask.trigger.activeLabel', { count: activeCount })
          : t('backgroundTask.trigger.label')
      }
      className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
        isHighlighted
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      } ${className}`}
    >
      {showActiveBadge ? (
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400"
          aria-hidden
        />
      ) : (
        <Activity
          className={`h-5 w-5 shrink-0 ${
            isHighlighted
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          aria-hidden
        />
      )}
      <span className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <span className="truncate">{t('nav.tasks')}</span>
        <span className="flex items-center gap-1.5 shrink-0">
          {showActiveBadge && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white tabular-nums">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
          {showUnreadBadge && (
            <span
              className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-gray-900"
              aria-label={t('backgroundTask.trigger.unreadLabel')}
            />
          )}
          <ChevronRight
            className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
              drawerOpen ? 'rotate-180' : ''
            } ${
              isHighlighted
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
            aria-hidden
          />
        </span>
      </span>
    </button>
  );
}

/** @deprecated Use BackgroundTasksNavItem in sidebar navigation. */
export function BackgroundTasksTrigger(props: { className?: string }) {
  return <BackgroundTasksNavItem {...props} />;
}

/** Slide-over drawer listing background tasks. */
export function BackgroundTasksDrawer() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tasks, activeCount, drawerOpen, setDrawerOpen } = useBackgroundTasks();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, setDrawerOpen]);

  if (!isLibrarian(user?.accountType) || !drawerOpen) return null;

  return (
    <>
      <div
        className="fixed top-0 right-0 bottom-0 left-64 z-[55] bg-black/40"
        aria-hidden
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        id="background-tasks-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="background-tasks-drawer-title"
        className="fixed top-0 left-64 z-[60] flex h-full w-[min(calc(100vw-16rem),36rem)] flex-col border-r border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h2
              id="background-tasks-drawer-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              {t('backgroundTask.drawer.title')}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {activeCount > 0
                ? t('backgroundTask.drawer.activeSubtitle', { count: activeCount })
                : t('backgroundTask.drawer.idleSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {t('backgroundTask.drawer.empty')}
            </p>
          ) : (
            tasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </div>
      </aside>
    </>
  );
}

/** Combined panel: mount trigger + drawer in layout. */
export default function BackgroundTasksPanel() {
  return (
    <>
      <BackgroundTasksDrawer />
    </>
  );
}
