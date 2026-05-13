import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Loader2, MessageSquarePlus, Pencil, Sparkles, Trash2, ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import Input from '@/components/common/Input';
import ReaderAssistantChatThread from '@/components/reader-assistant/ReaderAssistantChatThread';
import ReaderAssistantChatInput from '@/components/reader-assistant/ReaderAssistantChatInput';
import { readerAssistantApi } from '@/services/readerAssistantApi';
import {
  classifyReaderAssistantHttpStatus,
  isProbeStatusFeatureUnavailable,
} from '@/services/readerAssistantErrors';
import {
  getApiErrorMessage,
} from '@/utils/apiError';
import {
  loadIncludeExternalDefault,
  loadLastSessionId,
  saveIncludeExternalDefault,
  saveLastSessionId,
  getLocalSessionTitle,
  setLocalSessionTitle,
  removeLocalSessionTitle,
} from '@/services/readerAssistantPreferences';
import type { ReaderAssistantChatTurn, ReaderAssistantMessageResponse, ReaderAssistantSession } from '@/types';

const SESSION_PAGE = 25;
const PENDING_USER_MSG_ID = 'pending-user';

function turnFromAssistantResponse(res: ReaderAssistantMessageResponse): ReaderAssistantChatTurn {
  return {
    id: res.assistantMessageId,
    role: 'assistant',
    content: res.answer,
    recommendations: res.recommendations,
    fallbackUsed: res.fallbackUsed,
    provider: res.provider,
    model: res.model,
  };
}

/** Flattens paginated infinite query pages into deduplicated sessions (by id). */
function flattenSessions(
  pages: { items: ReaderAssistantSession[] }[] | undefined,
): ReaderAssistantSession[] {
  if (!pages) return [];
  const map = new Map<string, ReaderAssistantSession>();
  for (const page of pages) {
    for (const s of page.items) {
      map.set(s.id, s);
    }
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export default function ReaderAssistantPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [includeExternal, setIncludeExternalState] = useState(loadIncludeExternalDefault);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [mergedMessages, setMergedMessages] = useState<ReaderAssistantChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'sessions' | 'chat'>('sessions');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const lastSentPayloadRef = useRef<{ sessionId: string; content: string } | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);

  const setIncludeExternal = useCallback((v: boolean) => {
    setIncludeExternalState(v);
    saveIncludeExternalDefault(v);
  }, []);

  selectedSessionIdRef.current = selectedSessionId;

  const probeQuery = useQuery({
    queryKey: ['reader-assistant', 'probe'],
    queryFn: () => readerAssistantApi.probeList(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const availability = useMemo(() => {
    if (probeQuery.isLoading || probeQuery.isFetching) return 'loading' as const;
    if (probeQuery.error) return 'probe_error' as const;
    const status = probeQuery.data;
    if (status === undefined) return 'loading' as const;
    if (isProbeStatusFeatureUnavailable(status)) return 'unavailable' as const;
    if (status === 403) return 'denied' as const;
    if (status >= 400) return 'unavailable' as const;
    return 'available' as const;
  }, [probeQuery.isLoading, probeQuery.isFetching, probeQuery.error, probeQuery.data]);

  const sessionsQuery = useInfiniteQuery({
    queryKey: ['reader-assistant', 'sessions', 'paginated'],
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) => readerAssistantApi.listSessions(pageParam, SESSION_PAGE),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.pageCount ? lastPage.page + 1 : undefined,
    enabled: availability === 'available',
    placeholderData: keepPreviousData,
  });

  const flatSessions = useMemo(
    () => flattenSessions(sessionsQuery.data?.pages),
    [sessionsQuery.data],
  );

  useEffect(() => {
    if (availability !== 'available' || flatSessions.length === 0) return;
    setSelectedSessionId((cur) => {
      if (cur && flatSessions.some((s) => s.id === cur)) return cur;
      const saved = loadLastSessionId();
      if (saved && flatSessions.some((s) => s.id === saved)) return saved;
      return flatSessions[0].id;
    });
  }, [availability, flatSessions]);

  useEffect(() => {
    if (selectedSessionId) saveLastSessionId(selectedSessionId);
    else saveLastSessionId(null);
  }, [selectedSessionId]);

  const detailQuery = useQuery({
    queryKey: ['reader-assistant', 'session', selectedSessionId],
    queryFn: () => readerAssistantApi.getSession(selectedSessionId as string),
    enabled: availability === 'available' && !!selectedSessionId,
  });

  useEffect(() => {
    if (!detailQuery.data || detailQuery.data.id !== selectedSessionId) return;
    setMergedMessages(detailQuery.data.messages ?? []);
    lastSentPayloadRef.current = null;
  }, [detailQuery.data, selectedSessionId]);

  const createSessionMutation = useMutation({
    mutationFn: () => readerAssistantApi.createSession(),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['reader-assistant', 'sessions', 'paginated'] });
      setSelectedSessionId(session.id);
      setMergedMessages([]);
      setMobilePanel('chat');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => readerAssistantApi.deleteSession(id),
    onSuccess: async (_, id) => {
      removeLocalSessionTitle(id);
      if (selectedSessionIdRef.current === id) {
        setSelectedSessionId(null);
        setMergedMessages([]);
      }
      await queryClient.invalidateQueries({ queryKey: ['reader-assistant', 'sessions', 'paginated'] });
      await queryClient.removeQueries({ queryKey: ['reader-assistant', 'session', id] });
      setDeleteTargetId(null);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({
      sessionId,
      content,
    }: {
      sessionId: string;
      content: string;
      includeExternal: boolean;
    }) => readerAssistantApi.postMessage(sessionId, { content, includeExternal }),
    onMutate: async ({ sessionId, content }) => {
      lastSentPayloadRef.current = { sessionId, content };
      const userTurn: ReaderAssistantChatTurn = {
        id: PENDING_USER_MSG_ID,
        role: 'user',
        content,
      };
      setMergedMessages((prev) => [...prev.filter((m) => m.id !== PENDING_USER_MSG_ID), userTurn]);
    },
    onError: (error) => {
      const pendingSessionId = lastSentPayloadRef.current?.sessionId ?? null;
      setMergedMessages((prev) => prev.filter((m) => m.id !== PENDING_USER_MSG_ID));
      if (
        isAxiosError(error) &&
        error.response?.status === 404 &&
        pendingSessionId !== null &&
        selectedSessionIdRef.current === pendingSessionId
      ) {
        setSelectedSessionId(null);
        void queryClient.invalidateQueries({ queryKey: ['reader-assistant', 'sessions', 'paginated'] });
      }
    },
    onSuccess: async (response, vars) => {
      const anchorUser: ReaderAssistantChatTurn = {
        id: `u-${vars.sessionId}-${response.assistantMessageId}`,
        role: 'user',
        content: vars.content,
      };
      const assistant = turnFromAssistantResponse(response);
      setMergedMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== PENDING_USER_MSG_ID);
        return [...withoutPending, anchorUser, assistant];
      });
      await queryClient.invalidateQueries({ queryKey: ['reader-assistant', 'sessions', 'paginated'] });
      lastSentPayloadRef.current = null;
      setDraft('');
    },
  });

  const submitMessage = () => {
    const text = draft.trim();
    if (!text || !selectedSessionId || sendMutation.isPending) return;
    sendMutation.mutate({
      sessionId: selectedSessionId,
      content: text,
      includeExternal,
    });
  };

  const sendErrorBucket = sendMutation.error
    ? classifyReaderAssistantHttpStatus(
        isAxiosError(sendMutation.error) ? sendMutation.error.response?.status : undefined,
      )
    : null;

  const showQuotaBanner = sendMutation.isError && sendErrorBucket === 'quota';
  const showSendErrorBanner = sendMutation.isError && !showQuotaBanner;

  const dismissSendError = () => sendMutation.reset();

  function sessionLabel(session: ReaderAssistantSession): string {
    return getLocalSessionTitle(session.id) ?? session.title ?? t('readerAssistant.sessionFallbackTitle');
  }

  const openRename = (session: ReaderAssistantSession) => {
    setRenameTargetId(session.id);
    setRenameDraft(sessionLabel(session));
  };

  const commitRename = () => {
    if (renameTargetId == null) return;
    const sid = renameTargetId;
    const meta = flatSessions.find((s) => s.id === sid);
    const prevLabel = meta
      ? getLocalSessionTitle(meta.id) ?? meta.title ?? t('readerAssistant.sessionFallbackTitle')
      : '';
    const next = renameDraft.trim();
    setRenameTargetId(null);
    if (!next || next === prevLabel) return;
    setLocalSessionTitle(sid, next);
  };

  if (availability === 'loading') {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
            <div className="h-96 rounded-xl bg-gray-200 dark:bg-gray-700" />
            <div className="h-96 rounded-xl bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </div>
    );
  }

  if (availability === 'probe_error') {
    return (
      <div className="max-w-lg mx-auto p-12 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-gray-400" aria-hidden />
        <h1 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
          {t('readerAssistant.probeErrorTitle')}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('readerAssistant.probeErrorBody')}</p>
        <Button type="button" className="mt-6" onClick={() => void probeQuery.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (availability === 'denied') {
    return (
      <div className="max-w-lg mx-auto p-12 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-gray-400" aria-hidden />
        <h1 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">{t('readerAssistant.deniedTitle')}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('readerAssistant.deniedBody')}</p>
      </div>
    );
  }

  if (availability === 'unavailable') {
    return (
      <div className="max-w-lg mx-auto p-12 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-gray-400" aria-hidden />
        <h1 className="mt-6 text-xl font-semibold text-gray-900 dark:text-white">
          {t('readerAssistant.featureUnavailableTitle')}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t('readerAssistant.featureUnavailableBody')}</p>
      </div>
    );
  }

  const sessionListSkeleton = sessionsQuery.isLoading;

  const selectedSessionMeta = flatSessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 min-h-[calc(100vh-6rem)] flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-amber-500" aria-hidden />
            {t('readerAssistant.pageTitle')}
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('readerAssistant.subtitle')}</p>
        </div>
      </header>

      {showQuotaBanner && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-900/25 dark:border-amber-600/60 dark:text-amber-100">
          {t('readerAssistant.banner.quotaExceeded')}
          <button
            type="button"
            onClick={() => dismissSendError()}
            className="ml-3 underline text-inherit hover:no-underline"
          >
            {t('readerAssistant.banner.dismiss')}
          </button>
        </div>
      )}

      {showSendErrorBanner && sendMutation.error && (
        <div className="rounded-lg border border-red-400/60 bg-red-50 px-4 py-3 text-sm text-red-950 dark:bg-red-900/25 dark:border-red-700/60 dark:text-red-100 flex flex-wrap justify-between gap-2">
          <span>{getApiErrorMessage(sendMutation.error, t)}</span>
          <button type="button" className="underline text-inherit" onClick={() => dismissSendError()}>
            {t('readerAssistant.banner.dismiss')}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        {/* Sessions column */}
        <aside
          className={`flex min-h-[320px] flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:max-h-[calc(100vh-14rem)] ${
            mobilePanel === 'chat' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-800">
            <Button
              type="button"
              size="sm"
              leftIcon={<MessageSquarePlus className="h-4 w-4" />}
              isLoading={createSessionMutation.isPending}
              onClick={() => createSessionMutation.mutate()}
              className="flex-1 shrink"
            >
              {t('readerAssistant.newSession')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sessionListSkeleton ? (
              <div className="space-y-2 animate-pulse" aria-busy aria-label={t('common.loading')}>
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800" />
                ))}
              </div>
            ) : sessionsQuery.error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{t('readerAssistant.sessionListError')}</p>
            ) : flatSessions.length === 0 ? (
              <p className="text-sm text-gray-500 px-2 py-8 text-center">{t('readerAssistant.noSessions')}</p>
            ) : (
              <ul className="space-y-1">
                {flatSessions.map((s) => (
                  <li key={s.id}>
                    <div
                      className={`flex flex-col gap-2 rounded-lg p-2 transition-colors ${
                        selectedSessionId === s.id
                          ? 'bg-amber-50 dark:bg-amber-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/80'
                      }`}
                    >
                      {renameTargetId === s.id ? (
                        <Input
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="w-full text-sm"
                          aria-label={t('readerAssistant.renameField')}
                          autoFocus
                          onBlur={() => commitRename()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setRenameTargetId(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSessionId(s.id);
                              setMobilePanel('chat');
                              void queryClient.invalidateQueries({
                                queryKey: ['reader-assistant', 'session', s.id],
                              });
                            }}
                            className={`min-w-0 flex-1 text-left truncate rounded px-2 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                              selectedSessionId === s.id
                                ? 'font-semibold text-amber-800 dark:text-amber-200'
                                : ''
                            }`}
                          >
                            {sessionLabel(s)}
                          </button>
                          <button
                            type="button"
                            className="shrink-0 p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
                            aria-label={t('readerAssistant.renameAction')}
                            onClick={() => openRename(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="shrink-0 p-2 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/25"
                            aria-label={t('readerAssistant.deleteAction')}
                            onClick={() => setDeleteTargetId(s.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {sessionsQuery.hasNextPage && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                isLoading={sessionsQuery.isFetchingNextPage}
                onClick={() => void sessionsQuery.fetchNextPage()}
              >
                {t('readerAssistant.loadMoreSessions')}
              </Button>
            </div>
          )}
        </aside>

        {/* Chat column */}
        <section
          className={`flex min-h-[420px] flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 lg:max-h-[calc(100vh-14rem)] ${
            mobilePanel === 'sessions' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
            <button
              type="button"
              className="lg:hidden p-2 -ml-1 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              aria-label={t('readerAssistant.backToSessions')}
              onClick={() => setMobilePanel('sessions')}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="flex-1 min-w-0 text-lg font-semibold text-gray-900 dark:text-white truncate flex items-center gap-2">
              {selectedSessionMeta ? sessionLabel(selectedSessionMeta) : t('readerAssistant.noSessionSelected')}
              {detailQuery.isFetching && selectedSessionId ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-gray-400" aria-hidden />
              ) : null}
            </h2>
          </div>

          {!selectedSessionId ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 gap-4">
              <p className="text-sm max-w-sm">{t('readerAssistant.pickSession')}</p>
            </div>
          ) : (
            <>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
                  checked={includeExternal}
                  onChange={(e) => setIncludeExternal(e.target.checked)}
                />
                {t('readerAssistant.includeExternal')}
              </label>

              <ReaderAssistantChatThread
                messages={mergedMessages}
                isLoadingHistory={detailQuery.isFetching && mergedMessages.length === 0}
              />

              <ReaderAssistantChatInput
                draft={draft}
                onDraftChange={setDraft}
                onSubmit={submitMessage}
                isSubmitting={sendMutation.isPending}
                disabled={!selectedSessionId}
              />
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
        confirmVariant="danger"
        title={t('readerAssistant.deleteConfirmTitle')}
        message={t('readerAssistant.deleteConfirmBody')}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
