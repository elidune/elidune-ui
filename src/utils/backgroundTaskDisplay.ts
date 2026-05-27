import type { TFunction } from 'i18next';
import type {
  BackgroundTask,
  InventoryConsolidationProgressMessage,
  InventoryConsolidationResult,
  MarcBatchImportReport,
  TaskKind,
} from '@/types';

function getMarcBatchImportedCount(imported: unknown): number {
  if (Array.isArray(imported)) return imported.length;
  if (typeof imported === 'number') return imported;
  return 0;
}

function getMarcBatchFailedCount(failed: unknown): number {
  if (Array.isArray(failed)) return failed.length;
  if (typeof failed === 'number') return failed;
  return 0;
}

export function taskKindLabel(kind: TaskKind, t: TFunction): string {
  return t(`backgroundTask.kind.${kind}`);
}

export function isInventoryConsolidationProgressMessage(
  message: unknown
): message is InventoryConsolidationProgressMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    ('phase' in message || 'sessionId' in message || 'deleted' in message)
  );
}

export function formatTaskProgressDetail(task: BackgroundTask, t: TFunction): string | null {
  const progress = task.progress;
  if (!progress) {
    return t(`backgroundTask.status.${task.status}`);
  }

  const message = progress.message;

  if (task.kind === 'inventoryConsolidation' && isInventoryConsolidationProgressMessage(message)) {
    if (message.phase === 'notifying_readers') {
      return t('backgroundTask.consolidation.notifyingReaders', {
        count: message.recipientCount ?? 0,
      });
    }
    return t('backgroundTask.consolidation.archiving', {
      deleted: message.deleted ?? 0,
      skipped: message.skipped ?? 0,
      archivedBiblios: message.archivedBiblios ?? 0,
    });
  }

  if (task.kind === 'marcBatchImport') {
    const formatted = formatMarcTaskProgressMessage(message, t);
    if (formatted) return formatted;
  }

  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  if (progress.total > 0) {
    return `${progress.current} / ${progress.total}`;
  }

  return t(`backgroundTask.status.${task.status}`);
}

export function formatMarcTaskProgressMessage(message: unknown, t: TFunction): string | null {
  if (message == null) return null;
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null && 'failed' in message && 'imported' in message) {
    const o = message as { failed: unknown; imported: unknown };
    return t('backgroundTask.marcImport.completedSummary', {
      imported: getMarcBatchImportedCount(o.imported),
      failed: getMarcBatchFailedCount(o.failed),
    });
  }
  return null;
}

export function formatTaskResultSummary(task: BackgroundTask, t: TFunction): string | null {
  if (task.status === 'failed') {
    return task.error?.trim() || t('backgroundTask.status.failed');
  }
  if (task.status !== 'completed' || task.result == null) return null;

  if (task.kind === 'marcBatchImport') {
    const report = task.result as MarcBatchImportReport;
    return t('backgroundTask.marcImport.completedSummary', {
      imported: report.imported?.length ?? 0,
      failed: report.failed?.length ?? 0,
    });
  }

  if (task.kind === 'inventoryConsolidation') {
    const result = task.result as InventoryConsolidationResult;
    if (result.consolidated) {
      return t('backgroundTask.consolidation.completedSummary', {
        deleted: result.deleted,
        archivedBiblios: result.archivedBiblios,
      });
    }
    return t('backgroundTask.consolidation.partialSummary', {
      deleted: result.deleted,
      skipped: result.skipped.length,
    });
  }

  if (task.kind === 'inventoryBatchScan' && Array.isArray(task.result)) {
    return t('backgroundTask.inventoryBatchScan.completedSummary', {
      count: task.result.length,
    });
  }

  if (task.kind === 'maintenance' && typeof task.result === 'object' && task.result !== null) {
    const reports = (task.result as { reports?: unknown[] }).reports;
    if (Array.isArray(reports)) {
      return t('backgroundTask.maintenance.completedSummary', { count: reports.length });
    }
  }

  return t('backgroundTask.status.completed');
}

export function taskProgressPercent(task: BackgroundTask): number | null {
  const p = task.progress;
  if (!p || p.total <= 0) return null;
  return Math.min(100, (p.current / p.total) * 100);
}

export function isTaskActive(task: BackgroundTask): boolean {
  return task.status === 'pending' || task.status === 'running';
}

export function taskDeepLink(task: BackgroundTask): string | null {
  switch (task.kind) {
    case 'marcBatchImport':
      return '/import-iso';
    case 'maintenance':
      return '/settings';
    case 'inventoryBatchScan':
    case 'inventoryConsolidation':
      return '/inventory';
    default:
      return null;
  }
}

export function getInventorySessionIdFromTask(task: BackgroundTask): string | null {
  if (task.kind === 'inventoryConsolidation') {
    const msg = task.progress?.message;
    if (isInventoryConsolidationProgressMessage(msg) && msg.sessionId) {
      return msg.sessionId;
    }
    const result = task.result;
    if (result && typeof result === 'object' && !Array.isArray(result) && 'sessionId' in result) {
      return String((result as InventoryConsolidationResult).sessionId);
    }
  }
  return null;
}
