import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookMarked, RefreshCw } from 'lucide-react';
import { Card, Button, Table, Badge, Pagination, SearchInput, Modal } from '@/components/common';
import { RenewSubscriptionModal, UserEditorForm } from '@/components/users';
import api from '@/services/api';
import type { UserShort, PublicType } from '@/types';
import { isSubscriptionExpired } from '@/utils/userSubscription';

const USERS_PER_PAGE = 20;

export default function UsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserShort[]>([]);
  const [publicTypes, setPublicTypes] = useState<PublicType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [renewModalUser, setRenewModalUser] = useState<UserShort | null>(null);

  useEffect(() => {
    api.getPublicTypes().then(setPublicTypes).catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getUsers({
        name: searchQuery || undefined,
        page: currentPage,
        perPage: USERS_PER_PAGE,
      });
      setUsers(response.items);
      setTotalUsers(response.total);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, currentPage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setSearchDraft(value);
    setCurrentPage(1);
  };

  const handleRowClick = (user: UserShort) => {
    navigate(`/users/${user.id}`);
  };

  const openRenewModal = (user: UserShort) => setRenewModalUser(user);

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
        return (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {expired && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openRenewModal(user);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-2.5 py-1.5 text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
              >
                <span>{t('users.subscriptionExpired')}</span>
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </button>
            )}
            {!expired && <Badge variant="success">OK</Badge>}
          </div>
        );
      },
    },
  ];

  const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('users.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {t('users.count', { count: totalUsers })}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
          {t('users.newUser')}
        </Button>
      </div>

      {/* Search */}
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

      {/* Users table */}
      <Card padding="none">
        <Table
          columns={columns}
          data={users}
          keyExtractor={(user) => user.id}
          onRowClick={handleRowClick}
          isLoading={isLoading}
          emptyMessage={t('users.noUsers')}
        />
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>

      <RenewSubscriptionModal
        user={renewModalUser}
        isOpen={renewModalUser !== null}
        onClose={() => setRenewModalUser(null)}
        onSuccess={async () => {
          await fetchUsers();
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
            fetchUsers();
          }}
        />
      </Modal>
    </div>
  );
}
