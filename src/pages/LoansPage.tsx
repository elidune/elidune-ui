import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  User,
  BookMarked,
  RotateCcw,
  Check,
  Search,
  CreditCard,
  X,
  AlertTriangle,
  Calendar,
  BookOpen,
  Bell,
  Send,
  FlaskConical,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Table, Input, Modal } from '@/components/common';
import Pagination from '@/components/common/Pagination';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/types';
import type { User as UserType, Loan, UserShort, OverdueLoanInfo, ReminderReport } from '@/types';

type TabType = 'borrow' | 'return' | 'overdue';

function maxReminderSentAt(loans: OverdueLoanInfo[]): string | null {
  let best: string | null = null;
  for (const l of loans) {
    const t = l.last_reminder_sent_at;
    if (!t) continue;
    if (!best || t > best) best = t;
  }
  return best;
}

export default function LoansPage() {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const userIsAdmin = isAdmin(authUser?.account_type);
  const [activeTab, setActiveTab] = useState<TabType>('borrow');
  
  // Borrow section state
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserShort[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [isBorrowLoading, setIsBorrowLoading] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const userBarcodeInputRef = useRef<HTMLInputElement>(null);

  // Return section state
  const [returnBarcodeInput, setReturnBarcodeInput] = useState('');
  const returnBarcodeInputRef = useRef<HTMLInputElement>(null);
  const [returnResult, setReturnResult] = useState<{ status: string; loan: Loan } | null>(null);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  const [overduePage, setOverduePage] = useState(1);
  const [overduePerPage, setOverduePerPage] = useState(50);
  const [overdueData, setOverdueData] = useState<{ loans: OverdueLoanInfo[]; total: number } | null>(null);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [reminderReport, setReminderReport] = useState<ReminderReport | null>(null);
  const [reminderSending, setReminderSending] = useState(false);

  const loadOverdue = useCallback(async () => {
    setOverdueLoading(true);
    setOverdueError(null);
    try {
      const data = await api.getOverdueLoans({ page: overduePage, per_page: overduePerPage });
      setOverdueData({ loans: data.loans, total: Number(data.total) });
    } catch (e: unknown) {
      setOverdueError(getApiErrorMessage(e, t) || t('loans.overdueLoadError'));
      setOverdueData(null);
    } finally {
      setOverdueLoading(false);
    }
  }, [t, overduePage, overduePerPage]);

  useEffect(() => {
    if (activeTab !== 'overdue') return;
    void loadOverdue();
  }, [activeTab, loadOverdue]);

  const overdueByUser = useMemo(() => {
    if (!overdueData?.loans.length) return [];
    const m = new Map<number, OverdueLoanInfo[]>();
    for (const loan of overdueData.loans) {
      const list = m.get(loan.user_id) ?? [];
      list.push(loan);
      m.set(loan.user_id, list);
    }
    return Array.from(m.entries()).sort((a, b) => {
      const fa = `${a[1][0]?.lastname ?? ''} ${a[1][0]?.firstname ?? ''}`.trim();
      const fb = `${b[1][0]?.lastname ?? ''} ${b[1][0]?.firstname ?? ''}`.trim();
      return fa.localeCompare(fb, undefined, { sensitivity: 'base' });
    });
  }, [overdueData?.loans]);

  const overdueTotalPages = overdueData
    ? Math.max(1, Math.ceil(overdueData.total / overduePerPage))
    : 1;

  const handleSendReminders = async (dryRun: boolean) => {
    if (!dryRun && !confirm(t('loans.sendRemindersConfirm'))) return;
    setReminderSending(true);
    setReminderReport(null);
    setOverdueError(null);
    try {
      const report = await api.sendOverdueReminders({ dry_run: dryRun });
      setReminderReport(report);
      if (!dryRun) void loadOverdue();
    } catch (e: unknown) {
      setOverdueError(getApiErrorMessage(e, t) || t('loans.sendRemindersError'));
    } finally {
      setReminderSending(false);
    }
  };

  const handleUserSearch = async () => {
    const query = userSearchDraft.trim();
    if (!query) {
      setUserSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const response = await api.getUsers({
        name: query,
        per_page: 10,
      });
      setUserSearchResults(response.items);
    } catch (error) {
      console.error('Error searching users:', error);
      setUserSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Load user details and loans when user is selected
  useEffect(() => {
    if (!selectedUser) {
      setLoans([]);
      return;
    }

    const loadUserLoans = async () => {
      setIsLoadingLoans(true);
      try {
        const loansData = await api.getUserLoans(selectedUser.id);
        setLoans(loansData);
      } catch (error) {
        console.error('Error loading loans:', error);
      } finally {
        setIsLoadingLoans(false);
      }
    };

    loadUserLoans();
  }, [selectedUser]);

  const handleUserSelect = async (user: UserShort) => {
    try {
      const fullUser = await api.getUser(user.id);
      setSelectedUser(fullUser);
      setUserSearchDraft('');
      setUserSearchResults([]);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleUserBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    try {
      const response = await api.getUsers({
        barcode: barcode.trim(),
        per_page: 1,
      });

      if (response.items.length > 0) {
        const fullUser = await api.getUser(response.items[0].id);
        setSelectedUser(fullUser);
        setUserSearchDraft('');
        setUserSearchResults([]);
        if (userBarcodeInputRef.current) {
          userBarcodeInputRef.current.value = '';
        }
      } else {
        alert(t('loans.userNotFound', { barcode }));
      }
    } catch (error) {
      console.error('Error finding user by barcode:', error);
      alert(t('loans.errorFindingUser'));
    }
  };

  const handleBorrow = async (specimenBarcode: string, force = false) => {
    if (!selectedUser || !specimenBarcode.trim()) {
      throw new Error(t('loans.noUserSelected'));
    }

    try {
      await api.createLoan({
        user_id: selectedUser.id,
        specimen_identification: specimenBarcode.trim(),
        force: force || undefined,
      });
      // Refresh loans
      const loansData = await api.getUserLoans(selectedUser.id);
      setLoans(loansData);
    } catch (error: unknown) {
      const axiosData = (error as { response?: { data?: { message?: string } } })?.response?.data;
      const rawMessage = typeof axiosData?.message === 'string' ? axiosData.message : '';
      const isMaxLoans = /maximum\s*(total\s*)?loans(\s+for this document type)?\s*reached/i.test(rawMessage);
      const displayMsg = getApiErrorMessage(error, t) || t('loans.errorCreatingLoan');
      const confirmMsg = rawMessage || displayMsg;
      if (isMaxLoans && !force && window.confirm(`${confirmMsg}\n\n${t('loans.forceBorrowConfirm')}`)) {
        return handleBorrow(specimenBarcode, true);
      }
      throw new Error(displayMsg);
    }
  };

  const handleReturn = async (loanId: string) => {
    try {
      await api.returnLoan(loanId);
      // Refresh loans
      if (selectedUser) {
        const loansData = await api.getUserLoans(selectedUser.id);
        setLoans(loansData);
      }
    } catch (error: unknown) {
      console.error('Error returning loan:', error);
      throw new Error(getApiErrorMessage(error, t) || t('loans.errorReturningLoan'));
    }
  };

  const handleReturnByBarcode = async (specimenBarcode: string) => {
    if (!specimenBarcode.trim()) {
      throw new Error(t('loans.barcodeRequired'));
    }

    setIsProcessingReturn(true);
    setReturnError('');
    setReturnResult(null);

    try {
      const result = await api.returnLoanByBarcode(specimenBarcode.trim());
      setReturnResult(result);
      setReturnBarcodeInput('');
      // Auto-focus for next scan
      setTimeout(() => {
        returnBarcodeInputRef.current?.focus();
      }, 500);
    } catch (error: unknown) {
      console.error('Error returning loan:', error);
      setReturnError(getApiErrorMessage(error, t) || t('loans.errorReturningLoan'));
      setTimeout(() => {
        returnBarcodeInputRef.current?.focus();
        returnBarcodeInputRef.current?.select();
      }, 100);
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const loanColumns = [
    {
      key: 'title',
      header: t('loans.document'),
      render: (loan: Loan) => {
        const specs = loan.item?.specimens;
        const spec = specs?.length ? (specs.find((s) => s.availability === 1) ?? specs[0]) : null;
        const specimenBarcode = spec ? (spec.barcode ?? spec.id) : loan.specimen_identification;
        return (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {loan.item.title || t('loans.noTitle')}
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5 mt-0.5">
              {loan.item.isbn && (
                <p>
                  {t('items.isbn')}: <span className="font-mono">{loan.item.isbn}</span>
                </p>
              )}
              <p>{t('items.barcode')}: <span className="font-mono">{specimenBarcode ?? '-'}</span></p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'date',
      header: t('loans.borrowDate'),
      render: (loan: Loan) =>
        new Date(loan.start_date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'issue_at',
      header: t('loans.dueDate'),
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <span>{new Date(loan.issue_at).toLocaleDateString('fr-FR')}</span>
          {loan.is_overdue && <Badge variant="danger">{t('loans.overdue')}</Badge>}
        </div>
      ),
    },
    {
      key: 'renews',
      header: t('loans.renewals'),
      render: (loan: Loan) => loan.nb_renews,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleRenewLoan(loan.id);
            }}
            leftIcon={<RotateCcw className="h-4 w-4" />}
          >
            {t('loans.renew')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              handleReturn(loan.id);
            }}
            leftIcon={<Check className="h-4 w-4" />}
          >
            {t('loans.return')}
          </Button>
        </div>
      ),
    },
  ];

  const handleRenewLoan = async (loanId: string) => {
    try {
      await api.renewLoan(loanId);
      // Refresh loans
      if (selectedUser) {
        const loansData = await api.getUserLoans(selectedUser.id);
        setLoans(loansData);
      }
    } catch (error: unknown) {
      console.error('Error renewing loan:', error);
      alert(getApiErrorMessage(error, t) || t('loans.errorRenewingLoan'));
    }
  };

  const overdueLoans = loans.filter((l) => l.is_overdue);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('loans.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('loans.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setActiveTab('borrow');
              setReturnResult(null);
              setReturnError('');
              setReminderReport(null);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'borrow'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookMarked className="h-5 w-5" />
              {t('loans.borrow')}
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('return');
              setReturnResult(null);
              setReturnError('');
              setReminderReport(null);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'return'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              {t('loans.return')}
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('overdue');
              setReturnResult(null);
              setReturnError('');
              setReminderReport(null);
            }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'overdue'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('loans.overdueTab')}
            </div>
          </button>
        </nav>
      </div>

      {/* Borrow Tab */}
      {activeTab === 'borrow' && (
        <>
          {/* User Selection */}
          <Card>
            <CardHeader title={t('loans.selectUser')} />
            <div className="space-y-4">
              {/* User barcode scan */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('loans.scanUserCard')}
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const barcode = (e.currentTarget.elements.namedItem('userBarcode') as HTMLInputElement)?.value;
                    if (barcode) {
                      handleUserBarcodeScan(barcode);
                    }
                  }}
                >
                  <div className="flex gap-2">
                    <Input
                      ref={userBarcodeInputRef}
                      name="userBarcode"
                      placeholder={t('loans.scanOrEnterBarcode')}
                      leftIcon={<CreditCard className="h-4 w-4" />}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const barcode = (e.target as HTMLInputElement).value;
                          if (barcode) {
                            handleUserBarcodeScan(barcode);
                          }
                        }
                      }}
                    />
                  </div>
                </form>
              </div>

              {/* User search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('loans.searchByName')}
                </label>
                <div className="relative">
                  <div className="flex gap-2">
                    <Input
                      value={userSearchDraft}
                      onChange={(e) => setUserSearchDraft(e.target.value)}
                      placeholder={t('loans.searchUserPlaceholder')}
                      leftIcon={<Search className="h-4 w-4" />}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleUserSearch();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => void handleUserSearch()}
                      leftIcon={<Search className="h-4 w-4" />}
                      disabled={isSearchingUsers}
                    >
                      {t('common.search')}
                    </Button>
                  </div>
                  {userSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleUserSelect(user)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-3"
                        >
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                              {user.firstname?.[0] || '?'}{user.lastname?.[0] || ''}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {user.firstname} {user.lastname}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.account_type}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected user info */}
              {selectedUser && (
                <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                          {selectedUser.firstname?.[0] || '?'}{selectedUser.lastname?.[0] || ''}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {selectedUser.firstname} {selectedUser.lastname}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedUser.account_type}
                          {selectedUser.barcode && ` · ${t('profile.barcode')}: ${selectedUser.barcode}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(null);
                        setLoans([]);
                        setUserSearchDraft('');
                      }}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      {t('common.clear')}
                    </Button>
                  </div>
                  {overdueLoans.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">
                        {t('loans.overdueCount', { count: overdueLoans.length })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Loans list */}
          {selectedUser && (
            <Card padding="none">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <CardHeader
                    title={t('loans.activeLoans')}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setShowBorrowModal(true)}
                    leftIcon={<BookMarked className="h-4 w-4" />}
                  >
                    {t('loans.borrow')}
                  </Button>
                </div>
              </div>
              <Table
                columns={loanColumns}
                data={loans}
                keyExtractor={(loan) => loan.id}
                isLoading={isLoadingLoans}
                emptyMessage={t('loans.noLoans')}
              />
            </Card>
          )}

          {/* Borrow Modal */}
          <Modal
            isOpen={showBorrowModal}
            onClose={() => {
              setShowBorrowModal(false);
              setBarcodeInput('');
            }}
            title={t('loans.newLoan')}
            footer={
              <div className="flex justify-end gap-2">
                <Button type="submit" form="loans-borrow-form" isLoading={isBorrowLoading}>
                  {t('loans.borrow')}
                </Button>
              </div>
            }
          >
            <BorrowForm
              formId="loans-borrow-form"
              onBorrow={handleBorrow}
              barcodeInput={barcodeInput}
              setBarcodeInput={setBarcodeInput}
              barcodeInputRef={barcodeInputRef}
              onLoadingChange={setIsBorrowLoading}
              onSuccess={() => {
                setShowBorrowModal(false);
                setBarcodeInput('');
              }}
            />
          </Modal>
        </>
      )}

      {/* Return Tab */}
      {activeTab === 'return' && (
        <Card>
          <CardHeader title={t('loans.returnLoan')} />
          <div className="space-y-6">
            {/* Barcode input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('loans.scanSpecimenBarcode')}
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (returnBarcodeInput.trim()) {
                    handleReturnByBarcode(returnBarcodeInput);
                  }
                }}
              >
                <Input
                  ref={returnBarcodeInputRef}
                  value={returnBarcodeInput}
                  onChange={(e) => {
                    setReturnBarcodeInput(e.target.value);
                    setReturnError('');
                    setReturnResult(null);
                  }}
                  placeholder={t('loans.scanOrEnterBarcode')}
                  leftIcon={<BookOpen className="h-4 w-4" />}
                  autoFocus
                  disabled={isProcessingReturn}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && returnBarcodeInput.trim()) {
                      e.preventDefault();
                      handleReturnByBarcode(returnBarcodeInput);
                    }
                  }}
                />
              </form>
            </div>

            {/* Error display */}
            {returnError && (
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      {returnError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Return result display */}
            {returnResult && (
              <div className="p-6 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                      {t('loans.returnSuccess')}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {t('loans.returnProcessed')}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  {/* Document info */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {t('loans.document')}
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.title')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {returnResult.loan.item.title || t('loans.noTitle')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loans.specimenBarcode')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {returnResult.loan.specimen_identification}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* User info */}
                  {returnResult.loan.user && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                      <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t('users.title')}
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.name')}</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {returnResult.loan.user.firstname} {returnResult.loan.user.lastname}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{t('profile.accountType')}</p>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {returnResult.loan.user.account_type}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Loan dates */}
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {t('loans.loanDetails')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loans.borrowDate')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {new Date(returnResult.loan.start_date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loans.dueDate')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {new Date(returnResult.loan.issue_at).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loans.renewals')}</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {returnResult.loan.nb_renews}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t('loans.status')}</p>
                        <Badge variant={returnResult.loan.is_overdue ? 'danger' : 'success'}>
                          {returnResult.loan.is_overdue ? t('loans.overdue') : t('loans.returned')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {isProcessingReturn && (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </Card>
      )}

      {activeTab === 'overdue' && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t('loans.overdueTab')}
              action={
                userIsAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<FlaskConical className="h-4 w-4" />}
                      isLoading={reminderSending}
                      onClick={() => void handleSendReminders(true)}
                    >
                      {t('loans.remindersDryRun')}
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      leftIcon={<Send className="h-4 w-4" />}
                      isLoading={reminderSending}
                      onClick={() => void handleSendReminders(false)}
                    >
                      {t('loans.sendOverdueReminders')}
                    </Button>
                  </div>
                ) : null
              }
            />
            <div className="px-4 pb-2 space-y-2">
              {!userIsAdmin && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('loans.remindersAdminOnly')}</p>
              )}
              {overdueError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {overdueError}
                </div>
              )}
            </div>
            {reminderReport && (
              <div className="mx-4 mb-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-900/20 p-4 text-sm space-y-2">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {reminderReport.dry_run ? t('loans.reminderDryRunResult') : t('loans.reminderSendResult')}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('loans.reminderReportEmails', { count: reminderReport.emails_sent })} ·{' '}
                  {t('loans.reminderReportLoans', { count: reminderReport.loans_reminded })}
                </p>
                {reminderReport.details.length > 0 && (
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto">
                    {reminderReport.details.map((d) => (
                      <li key={d.user_id}>
                        {d.firstname} {d.lastname} ({d.email}) — {d.loan_count}
                      </li>
                    ))}
                  </ul>
                )}
                {reminderReport.errors.length > 0 && (
                  <ul className="text-red-700 dark:text-red-400 text-xs space-y-1">
                    {reminderReport.errors.map((e) => (
                      <li key={`${e.user_id}-${e.email}`}>
                        {e.email}: {e.error_message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="px-4 pb-4 space-y-4">
              {overdueLoading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : overdueByUser.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">{t('loans.noOverdueLoans')}</p>
              ) : (
                <div className="space-y-3">
                  {overdueByUser.map(([uid, loans]) => {
                    const u = loans[0];
                    const lastAny = maxReminderSentAt(loans);
                    return (
                      <details
                        key={uid}
                        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden"
                      >
                        <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <span className="font-medium text-gray-900 dark:text-white">
                            <Link
                              to={`/users/${uid}`}
                              className="text-indigo-600 dark:text-indigo-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {u.firstname} {u.lastname}
                            </Link>
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">{u.user_email ?? '—'}</span>
                          <Badge variant="danger">
                            {t('loans.overdueLoansCount', { count: loans.length })}
                          </Badge>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t('loans.lastReminderAny')}:{' '}
                            {lastAny
                              ? new Date(lastAny).toLocaleString('fr-FR')
                              : t('loans.neverReminded')}
                          </span>
                        </summary>
                        <div className="border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left text-gray-600 dark:text-gray-400">
                                <th className="px-3 py-2">{t('loans.document')}</th>
                                <th className="px-3 py-2">{t('loans.specimenBarcode')}</th>
                                <th className="px-3 py-2">{t('loans.dueDate')}</th>
                                <th className="px-3 py-2">{t('loans.lastReminderAt')}</th>
                                <th className="px-3 py-2">{t('loans.reminderCount')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                              {loans.map((row) => (
                                <tr key={row.loan_id}>
                                  <td className="px-3 py-2">
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {row.title || t('loans.noTitle')}
                                    </div>
                                    {row.authors && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">{row.authors}</div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-xs">{row.specimen_barcode ?? '—'}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {row.issue_at
                                      ? new Date(row.issue_at).toLocaleDateString('fr-FR')
                                      : '—'}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {row.last_reminder_sent_at
                                      ? new Date(row.last_reminder_sent_at).toLocaleString('fr-FR')
                                      : t('loans.neverReminded')}
                                  </td>
                                  <td className="px-3 py-2">{row.reminder_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
              {overdueData && overdueData.total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {t('loans.overdueTotal', { total: overdueData.total })}
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      {t('common.perPage')}
                      <select
                        value={overduePerPage}
                        onChange={(e) => {
                          setOverduePerPage(Number(e.target.value));
                          setOverduePage(1);
                        }}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1 text-sm"
                      >
                        {[25, 50, 100, 200].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Pagination
                      currentPage={overduePage}
                      totalPages={overdueTotalPages}
                      onPageChange={setOverduePage}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

interface BorrowFormProps {
  formId: string;
  onBorrow: (barcode: string) => Promise<void>;
  barcodeInput: string;
  setBarcodeInput: (value: string) => void;
  barcodeInputRef: React.RefObject<HTMLInputElement | null>;
  onLoadingChange: (loading: boolean) => void;
  onSuccess?: () => void;
}

function BorrowForm({ formId, onBorrow, barcodeInput, setBarcodeInput, barcodeInputRef, onLoadingChange, onSuccess }: BorrowFormProps) {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setError('');
    onLoadingChange(true);
    try {
      await onBorrow(barcodeInput);
      setBarcodeInput('');
      setError('');
      if (onSuccess) {
        onSuccess();
      } else {
        barcodeInputRef.current?.focus();
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, t) || t('loans.errorCreatingLoan'));
      setTimeout(() => {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }, 100);
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <Input
        ref={barcodeInputRef}
        label={t('loans.specimenBarcode')}
        value={barcodeInput}
        onChange={(e) => {
          setBarcodeInput(e.target.value);
          if (error) setError('');
        }}
        placeholder={t('loans.scanOrEnterBarcode')}
        autoFocus
        required
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
    </form>
  );
}
