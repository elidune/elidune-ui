import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Bookmark, Plus, Search } from 'lucide-react';
import { Card, CardHeader, Button, Badge, Table, Input, Pagination, Modal, ConfirmDialog, ScrollableListRegion, ResponsiveRecordList, ListSkeleton } from '@/components/common';
import HoldMobileCard from '@/components/holds/HoldMobileCard';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { Biblio, BiblioShort, Hold, UserShort } from '@/types';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import { formatUserShortName } from '@/utils/userDisplay';
import HoldDocumentCell from '@/components/holds/HoldDocumentCell';

function statusBadge(t: (k: string) => string, status: Hold['status']) {
  return (
    <Badge variant={status === 'ready' ? 'success' : 'default'}>{t(`holds.statuses.${status}`)}</Badge>
  );
}

export default function HoldsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);

  const [biblioDraft, setBiblioDraft] = useState('');
  const [biblioResults, setBiblioResults] = useState<BiblioShort[]>([]);
  const [biblioSearching, setBiblioSearching] = useState(false);
  const biblioSeqRef = useRef(0);
  const [selectedBiblio, setSelectedBiblio] = useState<Biblio | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [createNotes, setCreateNotes] = useState('');

  const [createUserDraft, setCreateUserDraft] = useState('');
  const [createUserResults, setCreateUserResults] = useState<UserShort[]>([]);
  const [createUserSearching, setCreateUserSearching] = useState(false);
  const createUserSeqRef = useRef(0);
  const [selectedUserForCreate, setSelectedUserForCreate] = useState<UserShort | null>(null);

  const [listPage, setListPage] = useState(1);
  const [listPerPage, setListPerPage] = useState(50);
  const [cancelHoldId, setCancelHoldId] = useState<string | null>(null);

  useEffect(() => {
    const q = biblioDraft.trim();
    if (!q) {
      biblioSeqRef.current += 1;
      setBiblioResults([]);
      setBiblioSearching(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const seq = ++biblioSeqRef.current;
      setBiblioSearching(true);
      void (async () => {
        try {
          const res = await api.getBiblios({ freesearch: q, perPage: 15, page: 1 });
          if (seq !== biblioSeqRef.current) return;
          setBiblioResults(res.items);
        } catch {
          if (seq !== biblioSeqRef.current) return;
          setBiblioResults([]);
        } finally {
          if (seq === biblioSeqRef.current) setBiblioSearching(false);
        }
      })();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [biblioDraft]);

  useEffect(() => {
    const q = createUserDraft.trim();
    if (!q) {
      createUserSeqRef.current += 1;
      setCreateUserResults([]);
      setCreateUserSearching(false);
      return;
    }
    const timer = window.setTimeout(() => {
      const seq = ++createUserSeqRef.current;
      setCreateUserSearching(true);
      void (async () => {
        try {
          const res = await api.getUsers({ name: q, perPage: 10 });
          if (seq !== createUserSeqRef.current) return;
          setCreateUserResults(res.items);
        } catch {
          if (seq !== createUserSeqRef.current) return;
          setCreateUserResults([]);
        } finally {
          if (seq === createUserSeqRef.current) setCreateUserSearching(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [createUserDraft]);

  const resetCreateForm = () => {
    setBiblioDraft('');
    setBiblioResults([]);
    setSelectedBiblio(null);
    setSelectedItemId(null);
    setCreateNotes('');
    setCreateUserDraft('');
    setCreateUserResults([]);
    setSelectedUserForCreate(null);
  };

  const loadBiblio = async (b: BiblioShort) => {
    try {
      const full = await api.getBiblio(b.id);
      setSelectedBiblio(full);
      setSelectedItemId(full.items?.[0]?.id ?? null);
      setBiblioDraft('');
      setBiblioResults([]);
    } catch (e) {
      console.error(e);
    }
  };

  const activeHoldsQuery = useQuery({
    queryKey: ['activeHolds', listPage, listPerPage],
    queryFn: () =>
      api.getHolds({
        page: listPage,
        perPage: Math.min(200, Math.max(1, listPerPage)),
        activeOnly: true,
      }),
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserForCreate || !selectedItemId) throw new Error(t('holds.selectUser'));
      return api.createHold({
        userId: selectedUserForCreate.id,
        itemId: selectedItemId,
        notes: createNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      resetCreateForm();
      setShowCreateModal(false);
      void queryClient.invalidateQueries({ queryKey: ['activeHolds'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelHold(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['activeHolds'] });
    },
  });

  const cancelCell = (r: Hold) =>
    r.status === 'pending' || r.status === 'ready' ? (
      <Button
        size="sm"
        variant="secondary"
        leftIcon={<Ban className="h-4 w-4" />}
        isLoading={cancelMutation.isPending && cancelMutation.variables === r.id}
        onClick={() => setCancelHoldId(r.id)}
      >
        {t('holds.cancelHold')}
      </Button>
    ) : null;

  const columns = [
    {
      key: 'user',
      header: t('holds.columnUser'),
      render: (r: Hold) => {
        const label = formatUserShortName(r.user) || r.userId;
        return (
          <Link className="text-indigo-600 dark:text-indigo-400 hover:underline" to={`/users/${r.userId}`}>
            {label}
          </Link>
        );
      },
    },
    {
      key: 'item',
      header: t('holds.columnDocument'),
      render: (r: Hold) => <HoldDocumentCell hold={r} />,
    },
    {
      key: 'status',
      header: t('holds.status'),
      render: (r: Hold) => statusBadge(t, r.status),
    },
    {
      key: 'position',
      header: t('holds.position'),
      render: (r: Hold) => r.position,
    },
    {
      key: 'created',
      header: t('holds.createdAt'),
      render: (r: Hold) => new Date(r.createdAt).toLocaleString(),
    },
    {
      key: 'expires',
      header: t('holds.expiresAt'),
      render: (r: Hold) => (r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '—'),
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right' as const,
      render: cancelCell,
    },
  ];

  const listData = activeHoldsQuery.data;
  const totalPages = Math.max(1, listData?.pageCount ?? 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Bookmark className="h-7 w-7 text-amber-600" />
            {t('holds.pageTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('holds.subtitle')}</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreateModal(true)}
        >
          {t('holds.newHoldButton')}
        </Button>
      </div>

      <Card padding="none" className="flex flex-col min-h-0">
        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <CardHeader
            title={t('holds.activeHoldsTitle')}
            subtitle={
              listData != null ? t('holds.activeHoldsCount', { total: listData.total }) : undefined
            }
          />
        </div>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-end gap-3 flex-shrink-0">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t('common.perPage')}
            </label>
            <select
              value={listPerPage}
              onChange={(e) => {
                setListPerPage(Number(e.target.value));
                setListPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm min-w-[5rem]"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ScrollableListRegion aria-label={t('holds.activeHoldsTitle')}>
          {activeHoldsQuery.isLoading && !(listData?.items?.length) ? (
            <ListSkeleton rows={8} />
          ) : (
            <ResponsiveRecordList
              desktop={
                <Table
                  columns={columns}
                  data={listData?.items ?? []}
                  keyExtractor={(r) => r.id}
                  isLoading={false}
                  emptyMessage={t('holds.noActiveHolds')}
                />
              }
              mobile={
                (listData?.items ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                    {t('holds.noActiveHolds')}
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2">
                    {(listData?.items ?? []).map((r) => (
                      <HoldMobileCard
                        key={r.id}
                        hold={r}
                        statusBadge={(s) => statusBadge(t, s)}
                        onCancel={() => setCancelHoldId(r.id)}
                        cancelPending={cancelMutation.isPending && cancelMutation.variables === r.id}
                      />
                    ))}
                  </div>
                )
              }
            />
          )}
        </ScrollableListRegion>
        {listData != null && listData.total > 0 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
            <Pagination currentPage={listPage} totalPages={totalPages} onPageChange={setListPage} />
          </div>
        )}
      </Card>

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
        title={t('holds.createSection')}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              isLoading={createMutation.isPending}
              disabled={!selectedBiblio || !selectedItemId || !selectedUserForCreate}
              onClick={() => void createMutation.mutateAsync()}
            >
              {t('holds.confirmReserve')}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          <div>
            <Input
              label={t('holds.searchBiblio')}
              value={biblioDraft}
              onChange={(e) => setBiblioDraft(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
            {biblioSearching && <p className="text-xs text-gray-500 mt-1">{t('common.loading')}</p>}
            {biblioResults.length > 0 && (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {biblioResults.map((b) => (
                  <li key={b.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => void loadBiblio(b)}
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{b.title}</span>
                      {b.isbn && (
                        <span className="text-gray-500 ml-2 font-mono text-xs">{formatIsbnDisplay(b.isbn)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedBiblio && (
            <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <p className="font-medium text-gray-900 dark:text-white">{selectedBiblio.title}</p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {t('holds.pickSpecimen')}
                </label>
                <select
                  value={selectedItemId ?? ''}
                  onChange={(e) => setSelectedItemId(e.target.value || null)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                >
                  {(selectedBiblio.items ?? []).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.barcode || it.callNumber || it.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <Input
              label={t('holds.pickUser')}
              value={createUserDraft}
              onChange={(e) => setCreateUserDraft(e.target.value)}
              placeholder={t('users.searchPlaceholder')}
            />
            {createUserSearching && <p className="text-xs text-gray-500 mt-1">{t('common.loading')}</p>}
            {createUserResults.length > 0 && (
              <ul className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
                {createUserResults.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        selectedUserForCreate?.id === u.id ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                      }`}
                      onClick={() => {
                        setSelectedUserForCreate(u);
                        setCreateUserDraft('');
                        setCreateUserResults([]);
                      }}
                    >
                      {u.firstname} {u.lastname}{' '}
                      <span className="text-gray-500 font-mono text-xs">{u.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedUserForCreate && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {selectedUserForCreate.firstname} {selectedUserForCreate.lastname}
              </p>
            )}
          </div>

          <Input
            label={t('holds.notesOptional')}
            value={createNotes}
            onChange={(e) => setCreateNotes(e.target.value)}
          />

          {createMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {getApiErrorMessage(createMutation.error, t) || t('holds.createError')}
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={cancelHoldId !== null}
        onClose={() => setCancelHoldId(null)}
        onConfirm={() => {
          const id = cancelHoldId;
          setCancelHoldId(null);
          if (id) void cancelMutation.mutateAsync(id);
        }}
        message={t('holds.cancelConfirm')}
        confirmVariant="danger"
      />
    </div>
  );
}
