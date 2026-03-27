import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button, Input } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { isLibrarian } from '@/types';
import type { Item, UserShort } from '@/types';
import { formatUserShortName } from '@/utils/userDisplay';

export interface PlaceHoldDialogProps {
  open: boolean;
  onClose: () => void;
  specimen: Item;
  biblioTitle: string;
  accountType?: string;
  currentUserId: string;
  onSuccess?: () => void;
}

type TargetMode = 'self' | 'other';

export default function PlaceHoldDialog({
  open,
  onClose,
  specimen,
  biblioTitle,
  accountType,
  currentUserId,
  onSuccess,
}: PlaceHoldDialogProps) {
  const { t } = useTranslation();
  const staff = isLibrarian(accountType);
  const [targetMode, setTargetMode] = useState<TargetMode>('self');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserShort[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserShort | null>(null);
  const userSearchSeqRef = useRef(0);

  const { data: queue = [], isLoading: queueLoading } = useQuery({
    queryKey: ['itemHolds', specimen.id],
    queryFn: () => api.getItemHolds(specimen.id),
    enabled: open && staff,
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    if (!open) {
      setNotes('');
      setError(null);
      setTargetMode('self');
      setSelectedUser(null);
      setUserSearchDraft('');
      setUserSearchResults([]);
    }
  }, [open]);

  useEffect(() => {
    const query = userSearchDraft.trim();
    if (!query) {
      userSearchSeqRef.current += 1;
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const seq = ++userSearchSeqRef.current;
      setIsSearchingUsers(true);
      void (async () => {
        try {
          const response = await api.getUsers({ name: query, perPage: 10 });
          if (seq !== userSearchSeqRef.current) return;
          setUserSearchResults(response.items);
        } catch {
          if (seq !== userSearchSeqRef.current) return;
          setUserSearchResults([]);
        } finally {
          if (seq === userSearchSeqRef.current) setIsSearchingUsers(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [userSearchDraft]);

  const borrowed = specimen.borrowed === true;
  const queueAhead = queue.length;
  const nextPosition = queueAhead + 1;

  const resolveTargetUserId = (): string | null => {
    if (!staff) return currentUserId;
    if (targetMode === 'self') return currentUserId;
    return selectedUser?.id ?? null;
  };

  const handleConfirm = async () => {
    const uid = resolveTargetUserId();
    if (!uid) {
      setError(t('holds.selectUser'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createHold({
        userId: uid,
        itemId: specimen.id,
        notes: notes.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, t) || t('holds.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  const specimenLabel = specimen.barcode || specimen.callNumber || specimen.id;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={t('holds.dialogTitle')}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void handleConfirm()} isLoading={submitting}>
            {t('holds.confirmReserve')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{biblioTitle}</p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('items.specimens')}: <span className="font-mono">{specimenLabel}</span>
          </p>
        </div>

        {staff && queueLoading && (
          <p className="text-gray-500">{t('common.loading')}</p>
        )}

        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 space-y-1">
          {borrowed && <p>{t('holds.hintBorrowed')}</p>}
          {!borrowed && staff && queueAhead > 0 && (
            <p>{t('holds.hintQueue', { count: queueAhead, position: nextPosition })}</p>
          )}
          {!borrowed && !(staff && queueAhead > 0) && (
            <p>{t('holds.hintNotifyWhenReady')}</p>
          )}
        </div>

        {staff && queueAhead > 0 && !queueLoading && (
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
            {queue.map((h) => (
              <li key={h.id}>
                <span className="font-medium">{formatUserShortName(h.user) || h.userId}</span>
              </li>
            ))}
          </ol>
        )}

        {staff && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {t('holds.reserveFor')}
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reserve-target"
                checked={targetMode === 'self'}
                onChange={() => {
                  setTargetMode('self');
                  setSelectedUser(null);
                }}
                className="text-indigo-600"
              />
              {t('holds.forMe')}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="reserve-target"
                checked={targetMode === 'other'}
                onChange={() => setTargetMode('other')}
                className="text-indigo-600"
              />
              {t('holds.forUser')}
            </label>
            {targetMode === 'other' && (
              <div className="pl-6 space-y-2">
                <Input
                  label={t('users.searchPlaceholder')}
                  value={userSearchDraft}
                  onChange={(e) => setUserSearchDraft(e.target.value)}
                  placeholder={t('common.search')}
                />
                {isSearchingUsers && (
                  <p className="text-xs text-gray-500">{t('common.loading')}</p>
                )}
                {userSearchResults.length > 0 && (
                  <ul className="max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                    {userSearchResults.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                            selectedUser?.id === u.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                          }`}
                          onClick={() => setSelectedUser(u)}
                        >
                          {u.firstname} {u.lastname}
                          <span className="text-gray-500 ml-2 font-mono text-xs">{u.id}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {selectedUser && (
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('holds.selectedUser')}: {selectedUser.firstname} {selectedUser.lastname}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <Input
          label={t('holds.notesOptional')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
