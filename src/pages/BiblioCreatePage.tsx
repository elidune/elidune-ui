import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { Button, Modal } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems } from '@/types';
import api from '@/services/api';
import type { DuplicateConfirmationRequired } from '@/types';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import BiblioEditorForm, { type CreateBiblioPayload } from '@/components/items/BiblioEditorForm';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<Record<string, unknown>>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existingId !== 'string') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
}

export default function BiblioCreatePage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isLoading, setIsLoading] = useState(false);
  const [confirmReplaceModal, setConfirmReplaceModal] = useState<{
    existingId: string;
    isbn?: string;
    existingTitle?: string | null;
  } | null>(null);
  const [confirmReplaceLoading, setConfirmReplaceLoading] = useState(false);
  const [confirmReplaceError, setConfirmReplaceError] = useState<string | null>(null);
  const lastCreatePayloadRef = useRef<CreateBiblioPayload | null>(null);

  useEffect(() => {
    if (!confirmReplaceModal) return;
    if (confirmReplaceModal.existingTitle !== undefined) return;
    const existingId = confirmReplaceModal.existingId;
    let cancelled = false;

    (async () => {
      try {
        const existing = await api.getBiblio(existingId);
        if (cancelled) return;
        setConfirmReplaceModal((prev) => {
          if (!prev || prev.existingId !== existingId) return prev;
          return { ...prev, existingTitle: existing.title ?? null };
        });
      } catch {
        if (cancelled) return;
        setConfirmReplaceModal((prev) => {
          if (!prev || prev.existingId !== existingId) return prev;
          return { ...prev, existingTitle: null };
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [confirmReplaceModal]);

  const goToDetail = (biblioId: string | null | undefined) => {
    queryClient.invalidateQueries({ queryKey: ['biblios'] });
    if (biblioId) {
      navigate(`/biblios/${biblioId}`);
    } else {
      navigate('/biblios');
    }
  };

  const handleSubmitCreate = async (payload: CreateBiblioPayload) => {
    lastCreatePayloadRef.current = payload;
    setIsLoading(true);
    try {
      const created = await api.createBiblio(payload);
      goToDetail(created.biblio.id ?? null);
    } catch (error) {
      const confirm = getDuplicateConfirmationRequired(error);
      if (confirm) {
        setConfirmReplaceError(null);
        setConfirmReplaceModal({
          existingId: confirm.existingId,
          isbn: payload.isbn || undefined,
          existingTitle: undefined,
        });
      } else {
        console.error('Error creating item:', error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReplaceExisting = async () => {
    if (!confirmReplaceModal || !lastCreatePayloadRef.current) return;
    setConfirmReplaceLoading(true);
    setConfirmReplaceError(null);
    try {
      const created = await api.createBiblio(lastCreatePayloadRef.current, {
        confirmReplaceExistingId: confirmReplaceModal.existingId,
      });
      setConfirmReplaceModal(null);
      goToDetail(created.biblio.id ?? null);
    } catch (err) {
      console.error('Error confirming replace existing item:', err);
      setConfirmReplaceError(getApiErrorMessage(err, t));
    } finally {
      setConfirmReplaceLoading(false);
    }
  };

  const handleCreateNewDuplicateIsbn = async () => {
    if (!confirmReplaceModal || !lastCreatePayloadRef.current) return;
    setConfirmReplaceLoading(true);
    setConfirmReplaceError(null);
    try {
      const created = await api.createBiblio(lastCreatePayloadRef.current, { allowDuplicateIsbn: true });
      setConfirmReplaceModal(null);
      goToDetail(created.biblio.id ?? null);
    } catch (err) {
      console.error('Error creating item with duplicate ISBN:', err);
      setConfirmReplaceError(getApiErrorMessage(err, t));
    } finally {
      setConfirmReplaceLoading(false);
    }
  };

  if (!canManageItems(user?.accountType)) {
    return <Navigate to="/biblios" replace />;
  }

  return (
    <div className="max-w-[min(100%,96rem)] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200/80 dark:border-gray-800/80">
        <div className="max-w-[min(100%,96rem)] mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/biblios')}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {t('items.add')}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <Button variant="secondary" type="button" onClick={() => navigate('/biblios')}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="biblio-create-form" isLoading={isLoading}>
              {t('common.create')}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-8 lg:p-10 shadow-sm">
        <BiblioEditorForm
          mode="create"
          formId="biblio-create-form"
          onSubmitCreate={handleSubmitCreate}
        />
      </div>

      <Modal
        isOpen={!!confirmReplaceModal}
        onClose={() => {
          if (confirmReplaceLoading) return;
          setConfirmReplaceModal(null);
          setConfirmReplaceError(null);
        }}
        title={t('importMarc.duplicateIsbnTitle')}
        size="lg"
        footer={
          confirmReplaceModal ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (confirmReplaceLoading) return;
                  setConfirmReplaceModal(null);
                  setConfirmReplaceError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button variant="secondary" onClick={handleCreateNewDuplicateIsbn} isLoading={confirmReplaceLoading}>
                {t('importMarc.duplicateIsbnCreateNew')}
              </Button>
              <Button onClick={handleConfirmReplaceExisting} isLoading={confirmReplaceLoading}>
                {t('importMarc.duplicateIsbnReplace')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {confirmReplaceModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('importMarc.duplicateIsbnPrompt', {
                isbn: confirmReplaceModal.isbn ? formatIsbnDisplay(confirmReplaceModal.isbn) : '-',
                title: confirmReplaceModal.existingTitle || t('items.notSpecified'),
              })}
            </p>
            {confirmReplaceError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {confirmReplaceError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
