import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookMarked, RefreshCw, Loader2 } from 'lucide-react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicTypesQuery } from '@/hooks/usePublicTypesQuery';
import {
  Card,
  Button,
  Table,
  Badge,
  SearchInput,
  Modal,
  ScrollableListRegion,
  ResponsiveRecordList,
  ListSkeleton,
} from '@/components/common';
import { RenewSubscriptionModal, UserEditorForm, UserListCard } from '@/components/users';
import api from '@/services/api';
import type { UserShort } from '@/types';
import { isSubscriptionExpired } from '@/utils/userSubscription';
import { formatSubscriptionExpiryLine } from '@/utils/subscriptionDisplay';

const USERS_PER_PAGE = 20;

export default function UsersPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: publicTypes = [] } = usePublicTypesQuery();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [renewModalUser, setRenewModalUser] = useState<UserShort | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['users', searchQuery],
    queryFn: async ({ pageParam }) =>
      api.getUsers({
        name: searchQuery || undefined,
        page: pageParam,
        perPage: USERS_PER_PAGE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.items?.length) return undefined;
      const loaded = lastPage.page * lastPage.perPage;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  const users = data?.pages.flatMap((p) => p.items) ?? [];
  const totalUsers = data?.pages[0]?.total ?? 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    const scrollRoot = el?.closest('.app-list-scroll') ?? null;
    if (!el || !scrollRoot || !hasNextPage || isFetchingNextPage || !data?.pages?.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage();
      },
      { root: scrollRoot, rootMargin: '200px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, data?.pages?.length]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setSearchDraft(value);
  };

  const handleRowClick = (user: UserShort) => {
    navigate(`/users/${user.id}`);
  };

  const openRenewModal = (user: UserShort) => setRenewModalUser(user);

  const handleRefreshList = () => {
    void queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const columns = [
    {
      key: 'name',
      header: t('common.name'),
      render: (user: UserShort) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              {user.firstname?.[0] || '?'}{user.lastname?.[0] || ''}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {user.firstname} {user.lastname}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.accountType}
              {user.publicType && (() => {
                const pt = publicTypes.find((p) => p.id === String(user.publicType));
                return pt ? <> · {pt.label}</> : null;
              })()}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('users.createdAt'),
      className: 'whitespace-nowrap',
      render: (user: UserShort) =>
        user.createdAt
          ? new Date(user.createdAt).toLocaleDateString(i18n.language, {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—',
    },
    {
      key: 'loans',
      header: t('users.loans'),
      render: (user: UserShort) => {
        const loanCount = user.loans?.length ?? user.nbLoans ?? 0;
        return (
          <div className="flex items-center gap-2">
            <BookMarked className="h-4 w-4 text-gray-400" />
            <span>{loanCount}</span>
            {(user.nbLateLoans || 0) > 0 && (
              <Badge variant="danger" size="sm">
                {user.nbLateLoans} {t('users.lateLoans')}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: t('common.status'),
      align: 'right' as const,
      render: (user: UserShort) => {
        const expired = isSubscriptionExpired(user.expiryAt);
        if (expired) {
          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openRenewModal(user);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors min-h-[44px]"
              >
                <span>{t('users.subscriptionExpired')}</span>
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            </div>
          );
        }
        return (
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-gray-700 dark:text-gray-200">
            {formatSubscriptionExpiryLine(user.expiryAt, t, i18n)}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('users.title')}</h1>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          {t('users.newUser')}
        </Button>
      </div>

      <Card>
        <SearchInput
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder={t('users.searchPlaceholder')}
          submitMode
          onSubmit={handleSearch}
          showSubmitButton
          submitLabel={t('common.search')}
        />
      </Card>

      <Card padding="none" className="flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span>{t('users.count', { count: totalUsers })}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefreshList}
            disabled={isFetching && !isFetchingNextPage}
            leftIcon={
              <RefreshCw className={`h-4 w-4 ${isFetching && !isFetchingNextPage ? 'animate-spin' : ''}`} />
            }
          >
            {t('common.refresh')}
          </Button>
        </div>
        <ScrollableListRegion aria-label={t('users.title')}>
          {isLoading && !users.length ? (
            <ListSkeleton rows={10} />
          ) : (
            <>
              <ResponsiveRecordList
                desktop={
                  <Table
                    columns={columns}
                    data={users}
                    keyExtractor={(user) => user.id}
                    onRowClick={handleRowClick}
                    isLoading={false}
                    emptyMessage={t('users.noUsers')}
                  />
                }
                mobile={
                  users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                      {t('users.noUsers')}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2">
                      {users.map((user) => (
                        <UserListCard
                          key={user.id}
                          user={user}
                          publicTypes={publicTypes}
                          onOpen={() => handleRowClick(user)}
                          onRenew={() => openRenewModal(user)}
                        />
                      ))}
                    </div>
                  )
                }
              />
              <div ref={loadMoreRef} className="h-4 flex-shrink-0" aria-hidden />
              {isFetchingNextPage && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>{t('common.loading')}</span>
                </div>
              )}
            </>
          )}
        </ScrollableListRegion>
      </Card>

      <RenewSubscriptionModal
        user={renewModalUser}
        isOpen={renewModalUser !== null}
        onClose={() => setRenewModalUser(null)}
        onSuccess={async () => {
          await queryClient.invalidateQueries({ queryKey: ['users'] });
        }}
      />

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('users.newUser')}
        size="2xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="submit" form="create-user-form" isLoading={isCreateLoading}>
              {t('common.create')}
            </Button>
          </div>
        }
      >
        <UserEditorForm
          mode="create"
          formId="create-user-form"
          publicTypes={publicTypes}
          onLoadingChange={setIsCreateLoading}
          onSuccess={() => {
            setShowCreateModal(false);
            void queryClient.invalidateQueries({ queryKey: ['users'] });
          }}
        />
      </Modal>
    </div>
  );
}
