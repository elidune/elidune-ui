import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Scan,
  Trash2,
  X,
} from 'lucide-react';
import { Badge, Button, Input, Modal, ScrollableListRegion } from '@/components/common';
import api from '@/services/api';
import type { Author, Item } from '@/types';
import { getApiErrorCode, getApiErrorMessage } from '@/utils/apiError';

const RESOLVE_DEBOUNCE_MS = 250;

type ResolvedSpecimen = {
  barcode: string;
  specimenId: string;
  biblioId: string;
  biblioTitle: string;
  authorLabel: string;
};

type Preview =
  | { kind: 'idle' }
  | { kind: 'loading'; barcode: string }
  | { kind: 'ok'; data: ResolvedSpecimen }
  | { kind: 'error'; barcode: string; message: string };

type LogEntry =
  | { kind: 'success'; id: string; ts: number; data: ResolvedSpecimen }
  | { kind: 'duplicate'; id: string; ts: number; barcode: string; title: string }
  | { kind: 'error'; id: string; ts: number; barcode: string; message: string };

export interface BatchDeleteSpecimensDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * When provided, scanning is restricted to specimens that belong to this biblio.
   * Match is performed locally against `items` (no API search round-trip).
   */
  restrictToBiblio?: {
    id: string;
    title?: string | null;
    authorLabel?: string;
    items?: Item[] | null;
  } | null;
  /** Invoked after each successful deletion so the parent can invalidate caches. */
  onSpecimenDeleted?: (specimenId: string, biblioId: string) => void;
}

function formatAuthorsLabel(authors?: Author[] | null): string {
  if (!authors?.length) return '';
  return authors
    .map((a) => `${a.firstname || ''} ${a.lastname || ''}`.trim())
    .filter(Boolean)
    .join(', ');
}

function getStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

function entryId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function BatchDeleteSpecimensDialog({
  isOpen,
  onClose,
  restrictToBiblio = null,
  onSpecimenDeleted,
}: BatchDeleteSpecimensDialogProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const resolveSeqRef = useRef(0);

  const [barcode, setBarcode] = useState('');
  const [preview, setPreview] = useState<Preview>({ kind: 'idle' });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [forceDelete, setForceDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const restrictedTitle = restrictToBiblio?.title?.trim() || '';
  const restrictedAuthor = restrictToBiblio?.authorLabel?.trim() || '';

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      // Reset transient state when closed; keep journal until next open for review.
      setBarcode('');
      setPreview({ kind: 'idle' });
      setIsDeleting(false);
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    }
  }, [isOpen]);

  /**
   * Resolve a barcode to a specimen. Server endpoint `GET /items/barcode/:bc` is the source of
   * truth; when scanning is restricted to a single biblio, we additionally enforce that the
   * resolved specimen belongs to it.
   */
  const resolveBarcode = useCallback(
    async (bc: string): Promise<ResolvedSpecimen> => {
      const trimmed = bc.trim();
      const biblio = await api.getItemByBarcode(trimmed);
      const specimen = biblio.items?.find(
        (s) => (s.barcode ?? '').trim() === trimmed && s.id != null,
      );
      if (!specimen || !biblio.id) {
        // Server returned a record but the matching copy is missing — treat as not-found.
        throw Object.assign(new Error('not_found'), { response: { status: 404 } });
      }
      if (restrictToBiblio && biblio.id !== restrictToBiblio.id) {
        throw new Error('not_in_biblio');
      }
      return {
        barcode: trimmed,
        specimenId: specimen.id,
        biblioId: biblio.id,
        biblioTitle: (biblio.title ?? '').trim() || t('items.notSpecified'),
        authorLabel: restrictToBiblio
          ? restrictedAuthor || formatAuthorsLabel(biblio.authors)
          : formatAuthorsLabel(biblio.authors),
      };
    },
    [restrictToBiblio, restrictedAuthor, t],
  );

  const triggerResolve = useCallback(
    async (bc: string) => {
      const trimmed = bc.trim();
      if (!trimmed) {
        setPreview({ kind: 'idle' });
        return;
      }

      const seq = ++resolveSeqRef.current;
      setPreview({ kind: 'loading', barcode: trimmed });
      try {
        const data = await resolveBarcode(trimmed);
        if (seq !== resolveSeqRef.current) return;
        setPreview({ kind: 'ok', data });
      } catch (err: unknown) {
        if (seq !== resolveSeqRef.current) return;
        let message: string;
        if (err instanceof Error && err.message === 'not_in_biblio') {
          message = t('items.batchDeleteScan.notInBiblio', { barcode: trimmed });
        } else {
          const status = getStatus(err);
          if (status === 404) {
            message = t('items.batchDeleteScan.notFound', { barcode: trimmed });
          } else if (status === 410) {
            message = t('items.batchDeleteScan.biblioArchived', { barcode: trimmed });
          } else {
            message = getApiErrorMessage(err, t);
          }
        }
        setPreview({ kind: 'error', barcode: trimmed, message });
      }
    },
    [resolveBarcode, t],
  );

  /** Schedule a debounced resolve after the last keystroke / scan burst. */
  const scheduleResolve = useCallback(
    (bc: string) => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void triggerResolve(bc);
      }, RESOLVE_DEBOUNCE_MS);
    },
    [triggerResolve],
  );

  const handleChange = (value: string) => {
    setBarcode(value);
    // Any change invalidates the current preview to avoid stale matches on re-scan.
    resolveSeqRef.current += 1;
    if (!value.trim()) {
      setPreview({ kind: 'idle' });
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    setPreview({ kind: 'loading', barcode: value.trim() });
    scheduleResolve(value);
  };

  const appendLog = useCallback((entry: LogEntry) => {
    setLog((prev) => [entry, ...prev].slice(0, 200));
  }, []);

  const performDelete = useCallback(
    async (data: ResolvedSpecimen) => {
      setIsDeleting(true);
      try {
        await api.deleteItem(data.specimenId, forceDelete);
        appendLog({ kind: 'success', id: entryId(), ts: Date.now(), data });
        onSpecimenDeleted?.(data.specimenId, data.biblioId);
        setBarcode('');
        setPreview({ kind: 'idle' });
        resolveSeqRef.current += 1;
      } catch (err: unknown) {
        const code = getApiErrorCode(err);
        const rawMsg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
        const borrowed =
          !forceDelete &&
          (code === 'business_rule_violation' ||
            code === 'conflict' ||
            (typeof rawMsg === 'string' && (rawMsg.includes('borrowed') || rawMsg.includes('force=true'))));
        const message = borrowed
          ? t('items.batchDeleteScan.borrowedHint')
          : getApiErrorMessage(err, t);
        appendLog({
          kind: 'error',
          id: entryId(),
          ts: Date.now(),
          barcode: data.barcode,
          message,
        });
        setPreview({ kind: 'error', barcode: data.barcode, message });
      } finally {
        setIsDeleting(false);
        focusInput();
      }
    },
    [appendLog, focusInput, forceDelete, onSpecimenDeleted, t],
  );

  const handleEnter = useCallback(() => {
    const trimmed = barcode.trim();
    if (!trimmed || isDeleting) return;

    // Already deleted in this session — log duplicate, don't call DELETE again.
    const previous = log.find((e) => e.kind === 'success' && e.data.barcode === trimmed) as
      | Extract<LogEntry, { kind: 'success' }>
      | undefined;
    if (previous) {
      appendLog({
        kind: 'duplicate',
        id: entryId(),
        ts: Date.now(),
        barcode: trimmed,
        title: previous.data.biblioTitle,
      });
      setBarcode('');
      setPreview({ kind: 'idle' });
      resolveSeqRef.current += 1;
      focusInput();
      return;
    }

    if (preview.kind === 'ok' && preview.data.barcode === trimmed) {
      void performDelete(preview.data);
      return;
    }

    // Phase 1: first Enter (or Enter while still loading / errored) → resolve, don't delete.
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void triggerResolve(trimmed);
  }, [appendLog, barcode, focusInput, isDeleting, log, performDelete, preview, triggerResolve]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEnter();
    }
  };

  const clearJournal = () => setLog([]);

  const successCount = useMemo(() => log.filter((e) => e.kind === 'success').length, [log]);

  const hint = restrictToBiblio
    ? t('items.batchDeleteScan.hintRestricted', { title: restrictedTitle || t('items.notSpecified') })
    : t('items.batchDeleteScan.hintGlobal');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('items.batchDeleteScan.title')}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearJournal}
            disabled={log.length === 0}
            leftIcon={<X className="h-4 w-4" />}
          >
            {t('items.batchDeleteScan.clearJournal')}
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {t('items.batchDeleteScan.deletedCount', { count: successCount })}
            </span>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{hint}</p>

        <div className="relative">
          <Input
            ref={inputRef}
            label={t('items.batchDeleteScan.inputLabel')}
            value={barcode}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('items.batchDeleteScan.inputPlaceholder')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={isDeleting}
            leftIcon={<Scan className="h-4 w-4" />}
            rightIcon={isDeleting ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
            aria-describedby="batch-delete-preview"
          />
          <BarcodePreview preview={preview} id="batch-delete-preview" />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 select-none">
          <input
            type="checkbox"
            checked={forceDelete}
            onChange={(e) => setForceDelete(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-amber-600 focus:ring-amber-500/30"
          />
          <span>{t('items.batchDeleteScan.forceCheckbox')}</span>
        </label>
        {forceDelete && (
          <p className="text-xs text-amber-700 dark:text-amber-400 -mt-2">
            {t('items.batchDeleteScan.forceWarning')}
          </p>
        )}

        <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('items.batchDeleteScan.journalTitle')}
            </h4>
            <Badge variant="default" size="sm">
              {t('items.batchDeleteScan.entries', { count: log.length })}
            </Badge>
          </div>
          {log.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
              {t('items.batchDeleteScan.journalEmpty')}
            </p>
          ) : (
            <ScrollableListRegion
              className="!max-h-72 border border-gray-100 dark:border-gray-800 rounded-lg"
              aria-label={t('items.batchDeleteScan.journalTitle')}
            >
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {log.map((entry) => (
                  <li key={entry.id} className="px-3 py-2">
                    <JournalRow entry={entry} />
                  </li>
                ))}
              </ul>
            </ScrollableListRegion>
          )}
        </div>
      </div>
    </Modal>
  );
}

function BarcodePreview({ preview, id }: { preview: Preview; id: string }) {
  const { t } = useTranslation();

  if (preview.kind === 'idle') return null;

  if (preview.kind === 'loading') {
    return (
      <div
        id={id}
        role="status"
        className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-gray-600 dark:text-gray-300"
      >
        <Loader2 className="h-4 w-4 animate-spin text-gray-400 shrink-0" />
        <span className="truncate">
          {t('items.batchDeleteScan.previewLoading', { barcode: preview.barcode })}
        </span>
      </div>
    );
  }

  if (preview.kind === 'error') {
    return (
      <div
        id={id}
        role="alert"
        className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300"
      >
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span className="min-w-0 break-words">{preview.message}</span>
      </div>
    );
  }

  const { biblioTitle, authorLabel, barcode } = preview.data;
  return (
    <div
      id={id}
      role="status"
      className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-sm"
    >
      <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-emerald-900 dark:text-emerald-100 truncate">{biblioTitle}</p>
        <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 truncate">
          {authorLabel ? `${authorLabel} · ` : ''}
          <span className="font-mono">{barcode}</span>
        </p>
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
          {t('items.batchDeleteScan.pressEnterToDelete')}
        </p>
      </div>
    </div>
  );
}

function JournalRow({ entry }: { entry: LogEntry }) {
  const { t } = useTranslation();

  if (entry.kind === 'success') {
    const { biblioTitle, authorLabel, barcode } = entry.data;
    return (
      <div className="flex items-start gap-2">
        <Trash2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-900 dark:text-gray-100 truncate" title={biblioTitle}>
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-1.5">
              {barcode}
            </span>
            {biblioTitle}
          </p>
          {authorLabel && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{authorLabel}</p>
          )}
        </div>
        <Badge variant="success" size="sm">
          {t('items.batchDeleteScan.statusDeleted')}
        </Badge>
      </div>
    );
  }

  if (entry.kind === 'duplicate') {
    return (
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-700 dark:text-gray-200 truncate">
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-1.5">
              {entry.barcode}
            </span>
            {t('items.batchDeleteScan.duplicateMessage', { title: entry.title })}
          </p>
        </div>
        <Badge variant="warning" size="sm">
          {t('items.batchDeleteScan.statusDuplicate')}
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-1.5">
            {entry.barcode}
          </span>
        </p>
        <p className="text-xs text-red-700 dark:text-red-300 break-words">{entry.message}</p>
      </div>
      <Badge variant="danger" size="sm">
        {t('items.batchDeleteScan.statusError')}
      </Badge>
    </div>
  );
}
