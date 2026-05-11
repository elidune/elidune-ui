import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Link } from 'react-router-dom';
import {
  BookMarked,
  RotateCcw,
  Check,
  Search,
  CreditCard,
  X,
  AlertTriangle,
  BookOpen,
  Bell,
  Send,
  FlaskConical,
  ChevronDown,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Table, Input, MessageModal, ConfirmDialog, ScrollableListRegion, ResponsiveRecordList, ListSkeleton } from '@/components/common';
import ActiveLoanCard from '@/components/loans/ActiveLoanCard';
import Pagination from '@/components/common/Pagination';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { sortLoansByStartDateAsc } from '@/utils/sortLoans';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import { LoanMediaTypeBadge } from '@/utils/mediaTypeIcon';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin } from '@/types';
import type { User as UserType, Loan, UserShort, OverdueLoanInfo, ReminderReport } from '@/types';

type TabType = 'borrow' | 'return' | 'overdue';

const BORROW_LOANS_PAGE_SIZE = 20;

function maxReminderSentAt(loans: OverdueLoanInfo[]): string | null {
  let best: string | null = null;
  for (const l of loans) {
    const t = l.lastReminderSentAt;
    if (!t) continue;
    if (!best || t > best) best = t;
  }
  return best;
}

/** Calendar days since due date (0 if not past). */
function daysPastDue(expiryAt: string | null): number {
  if (!expiryAt) return 0;
  const due = new Date(expiryAt);
  const today = new Date();
  const d0 = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const d1 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((d1 - d0) / 86400000));
}

export default function LoansPage() {
  const { t, i18n } = useTranslation();
  const { user: authUser } = useAuth();
  const userIsAdmin = isAdmin(authUser?.accountType);
  const [activeTab, setActiveTab] = useState<TabType>('borrow');
  
  // Borrow section state
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loansPage, setLoansPage] = useState(1);
  const [loansTotal, setLoansTotal] = useState(0);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserShort[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
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
  const [renewError, setRenewError] = useState('');
  const [messageDialog, setMessageDialog] = useState<string | null>(null);

  const [overduePage, setOverduePage] = useState(1);
  const [overduePerPage, setOverduePerPage] = useState(50);
  const [overdueData, setOverdueData] = useState<{ loans: OverdueLoanInfo[]; total: number } | null>(null);
  const [overdueLoading, setOverdueLoading] = useState(false);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [overdueLoanAction, setOverdueLoanAction] = useState<{ loanId: string; op: 'return' | 'renew' } | null>(
    null,
  );
  /** Keeps <details> open per user after renew/return refresh when they still have overdue loans */
  const [overdueOpenByUser, setOverdueOpenByUser] = useState<Record<string, boolean>>({});
  const [reminderReport, setReminderReport] = useState<ReminderReport | null>(null);
  const [reminderSending, setReminderSending] = useState(false);
  const [sendRemindersConfirmOpen, setSendRemindersConfirmOpen] = useState(false);
  const [forceBorrowDialog, setForceBorrowDialog] = useState<{ message: string } | null>(null);
  const forceBorrowResolveRef = useRef<((v: boolean) => void) | null>(null);

  /** Restore keyboard/scanner focus to the visible barcode field after dialogs close. */
  const focusScanInput = useCallback(() => {
    const apply = () => {
      if (activeTab === 'return') {
        returnBarcodeInputRef.current?.focus();
        return;
      }
      if (activeTab === 'borrow') {
        if (selectedUser) {
          barcodeInputRef.current?.focus();
        } else {
          userBarcodeInputRef.current?.focus();
        }
      }
    };
    requestAnimationFrame(() => {
      apply();
      setTimeout(apply, 0);
      setTimeout(apply, 100);
    });
  }, [activeTab, selectedUser]);

  const resetBorrowFlow = useCallback(() => {
    setSelectedUser(null);
    setLoans([]);
    setLoansTotal(0);
    setLoansPage(1);
    setUserSearchDraft('');
    setUserSearchResults([]);
    setBarcodeInput('');
    setRenewError('');
    if (userBarcodeInputRef.current) {
      userBarcodeInputRef.current.value = '';
    }
  }, []);

  const prevActiveTabRef = useRef<TabType | null>(null);

  useEffect(() => {
    const prev = prevActiveTabRef.current;
    if (activeTab === 'borrow' && prev !== null && prev !== 'borrow') {
      resetBorrowFlow();
      requestAnimationFrame(() => {
        userBarcodeInputRef.current?.focus();
        setTimeout(() => userBarcodeInputRef.current?.focus(), 0);
      });
    }
    if (activeTab === 'return' && prev !== null && prev !== 'return') {
      requestAnimationFrame(() => {
        returnBarcodeInputRef.current?.focus();
        setTimeout(() => returnBarcodeInputRef.current?.focus(), 0);
        setTimeout(() => returnBarcodeInputRef.current?.focus(), 100);
      });
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, resetBorrowFlow]);

  /** Keep return barcode field focused for scanner workflow after each submit and when the recap updates. */
  useEffect(() => {
    if (activeTab !== 'return' || isProcessingReturn) return;
    const run = () => returnBarcodeInputRef.current?.focus();
    requestAnimationFrame(() => {
      run();
      setTimeout(run, 0);
      setTimeout(run, 100);
    });
  }, [activeTab, isProcessingReturn, returnResult]);

  const loadOverdue = useCallback(async () => {
    setOverdueLoading(true);
    setOverdueError(null);
    try {
      const data = await api.getOverdueLoans({ page: overduePage, perPage: overduePerPage });
      setOverdueData({ loans: data.loans, total: Number(data.total) });
    } catch (e: unknown) {
      setOverdueError(getApiErrorMessage(e, t) || t('loans.overdueLoadError'));
      setOverdueData(null);
    } finally {
      setOverdueLoading(false);
    }
  }, [t, overduePage, overduePerPage]);

  const handleOverdueReturn = useCallback(
    async (loanId: string) => {
      setOverdueLoanAction({ loanId, op: 'return' });
      try {
        await api.returnLoan(loanId);
        setOverdueError(null);
        await loadOverdue();
      } catch (e: unknown) {
        setOverdueError(getApiErrorMessage(e, t) || t('loans.errorReturningLoan'));
      } finally {
        setOverdueLoanAction(null);
      }
    },
    [loadOverdue, t],
  );

  const handleOverdueRenew = useCallback(
    async (loanId: string) => {
      setOverdueLoanAction({ loanId, op: 'renew' });
      try {
        await api.renewLoan(loanId);
        setOverdueError(null);
        await loadOverdue();
      } catch (e: unknown) {
        setOverdueError(getApiErrorMessage(e, t) || t('loans.errorRenewingLoan'));
      } finally {
        setOverdueLoanAction(null);
      }
    },
    [loadOverdue, t],
  );

  useEffect(() => {
    if (activeTab !== 'overdue') return;
    void loadOverdue();
  }, [activeTab, loadOverdue]);

  const overdueByUser = useMemo(() => {
    if (!overdueData?.loans.length) return [];
    const m = new Map<string, OverdueLoanInfo[]>();
    for (const loan of overdueData.loans) {
      const list = m.get(loan.userId) ?? [];
      list.push(loan);
      m.set(loan.userId, list);
    }
    return Array.from(m.entries()).sort((a, b) => {
      const fa = `${a[1][0]?.lastname ?? ''} ${a[1][0]?.firstname ?? ''}`.trim();
      const fb = `${b[1][0]?.lastname ?? ''} ${b[1][0]?.firstname ?? ''}`.trim();
      return fa.localeCompare(fb, undefined, { sensitivity: 'base' });
    });
  }, [overdueData?.loans]);

  useEffect(() => {
    setOverdueOpenByUser((prev) => {
      const next: Record<string, boolean> = {};
      for (const [uid, loans] of overdueByUser) {
        if (loans.length > 0 && prev[uid]) {
          next[uid] = true;
        }
      }
      return next;
    });
  }, [overdueByUser]);

  const overdueTotalPages = overdueData
    ? Math.max(1, Math.ceil(overdueData.total / overduePerPage))
    : 1;

  const executeSendReminders = async (dryRun: boolean) => {
    setReminderSending(true);
    setReminderReport(null);
    setOverdueError(null);
    try {
      const report = await api.sendOverdueReminders({ dryRun: dryRun });
      setReminderReport(report);
      if (!dryRun) void loadOverdue();
    } catch (e: unknown) {
      setOverdueError(getApiErrorMessage(e, t) || t('loans.sendRemindersError'));
    } finally {
      setReminderSending(false);
    }
  };

  const handleSendReminders = async (dryRun: boolean) => {
    if (!dryRun) {
      setSendRemindersConfirmOpen(true);
      return;
    }
    await executeSendReminders(true);
  };

  const userSearchSeqRef = useRef(0);

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
          const response = await api.getUsers({
            name: query,
            perPage: 10,
          });
          if (seq !== userSearchSeqRef.current) return;
          setUserSearchResults(response.items);
        } catch (error) {
          console.error('Error searching users:', error);
          if (seq !== userSearchSeqRef.current) return;
          setUserSearchResults([]);
        } finally {
          if (seq === userSearchSeqRef.current) {
            setIsSearchingUsers(false);
          }
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [userSearchDraft]);

  useEffect(() => {
    if (!selectedUser) {
      setLoans([]);
      setLoansTotal(0);
      return;
    }

    const loadUserLoans = async () => {
      setIsLoadingLoans(true);
      try {
        const res = await api.getUserLoans(selectedUser.id, {
          page: loansPage,
          perPage: BORROW_LOANS_PAGE_SIZE,
        });
        setLoans(res.items);
        setLoansTotal(res.total);
      } catch (error) {
        console.error('Error loading loans:', error);
      } finally {
        setIsLoadingLoans(false);
      }
    };

    loadUserLoans();
  }, [selectedUser, loansPage]);

  const handleUserSelect = async (user: UserShort) => {
    try {
      const fullUser = await api.getUser(user.id);
      setSelectedUser(fullUser);
      setLoansPage(1);
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
        perPage: 1,
      });

      if (response.items.length > 0) {
        const fullUser = await api.getUser(response.items[0].id);
        setSelectedUser(fullUser);
        setLoansPage(1);
        setUserSearchDraft('');
        setUserSearchResults([]);
        if (userBarcodeInputRef.current) {
          userBarcodeInputRef.current.value = '';
        }
      } else {
        setMessageDialog(t('loans.userNotFound', { barcode }));
      }
    } catch (error) {
      console.error('Error finding user by barcode:', error);
      setMessageDialog(t('loans.errorFindingUser'));
    }
  };

  const handleBorrow = async (specimenBarcode: string, force = false) => {
    if (!selectedUser || !specimenBarcode.trim()) {
      throw new Error(t('loans.noUserSelected'));
    }

    try {
      await api.createLoan({
        userId: selectedUser.id,
        itemIdentification: specimenBarcode.trim(),
        force: force || undefined,
      });
      const res = await api.getUserLoans(selectedUser.id, {
        page: loansPage,
        perPage: BORROW_LOANS_PAGE_SIZE,
      });
      setLoans(res.items);
      setLoansTotal(res.total);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { code?: string; message?: string } } };
      const axiosData = axiosError?.response?.data;
      const errorCode = axiosData?.code ?? '';
      const rawMessage = typeof axiosData?.message === 'string' ? axiosData.message : '';
      const displayMsg = getApiErrorMessage(error, t) || t('loans.errorCreatingLoan');
      const confirmMsg = rawMessage || displayMsg;
      if (errorCode === 'business_rule_violation' && !force) {
        setBarcodeInput('');
        const ok = await new Promise<boolean>((resolve) => {
          setForceBorrowDialog({
            message: `${confirmMsg}\n\n${t('loans.forceBorrowConfirm')}`,
          });
          forceBorrowResolveRef.current = resolve;
        });
        if (ok) return handleBorrow(specimenBarcode, true);
      }
      throw new Error(displayMsg);
    }
  };

  const handleReturn = async (loanId: string) => {
    try {
      await api.returnLoan(loanId);
      if (selectedUser) {
        const res = await api.getUserLoans(selectedUser.id, {
          page: loansPage,
          perPage: BORROW_LOANS_PAGE_SIZE,
        });
        setLoans(res.items);
        setLoansTotal(res.total);
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
    } catch (error: unknown) {
      console.error('Error returning loan:', error);
      setReturnError(getApiErrorMessage(error, t) || t('loans.errorReturningLoan'));
      requestAnimationFrame(() => {
        const el = returnBarcodeInputRef.current;
        el?.focus();
        el?.select();
      });
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const loanColumns = [
    {
      key: 'title',
      header: t('loans.document'),
      render: (loan: Loan) => {
        const specs = loan.biblio?.items;
        const spec = specs?.length
          ? (specs.find((s) => s.borrowed) ?? specs[0])
          : null;
        const specimenBarcode = spec ? (spec.barcode ?? spec.id) : loan.itemIdentification;
        return (
          <div className="flex items-start gap-3 min-w-0">
            <LoanMediaTypeBadge mediaType={loan.biblio.mediaType} size="table" />
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">
                {loan.biblio.title || t('loans.noTitle')}
              </p>
              <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5 mt-0.5">
                {loan.biblio.isbn && (
                  <p>
                    {t('items.isbn')}: <span className="font-mono">{formatIsbnDisplay(loan.biblio.isbn)}</span>
                  </p>
                )}
                <p>{t('items.barcode')}: <span className="font-mono">{specimenBarcode ?? '-'}</span></p>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'date',
      header: t('loans.borrowDate'),
      render: (loan: Loan) =>
        new Date(loan.startDate).toLocaleDateString('fr-FR'),
    },
    {
      key: 'expiryAt',
      header: t('loans.dueDate'),
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <span>{new Date(loan.expiryAt).toLocaleDateString('fr-FR')}</span>
          {loan.isOverdue && <Badge variant="danger">{t('loans.overdue')}</Badge>}
        </div>
      ),
    },
    {
      key: 'renews',
      header: t('loans.renewals'),
      render: (loan: Loan) => loan.nbRenews,
    },
    {
      key: 'actions',
      header: t('common.actions'),
      align: 'right' as const,
      render: (loan: Loan) => (
        <div className="flex items-center justify-end gap-2 flex-wrap">
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
    setRenewError('');
    try {
      await api.renewLoan(loanId);
      if (selectedUser) {
        const res = await api.getUserLoans(selectedUser.id, {
          page: loansPage,
          perPage: BORROW_LOANS_PAGE_SIZE,
        });
        setLoans(res.items);
        setLoansTotal(res.total);
      }
    } catch (error: unknown) {
      console.error('Error renewing loan:', error);
      setRenewError(getApiErrorMessage(error, t) || t('loans.errorRenewingLoan'));
    }
  };

  const loansSortedByStart = useMemo(() => sortLoansByStartDateAsc(loans), [loans]);
  const overdueLoans = loans.filter((l) => l.isOverdue);

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
              {t('loans.tabBorrow')}
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
              {t('loans.tabReturn')}
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
        <div className="space-y-6">
          {/* Step 1 — Find patron */}
          <Card>
            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-base font-bold text-white shadow-md dark:bg-indigo-500"
                  aria-hidden
                >
                  1
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('loans.selectUser')}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t('loans.selectUserHint')}
                  </p>
                </div>
              </div>

              <div className="sm:ml-2 sm:border-l-2 sm:border-indigo-200 sm:pl-6 sm:dark:border-indigo-800">
                {!selectedUser ? (
                  <div className="space-y-5">
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
                        <Input
                          value={userSearchDraft}
                          onChange={(e) => setUserSearchDraft(e.target.value)}
                          placeholder={t('loans.searchUserPlaceholder')}
                          leftIcon={<Search className="h-4 w-4" />}
                          aria-busy={isSearchingUsers}
                        />
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
                                    {user.accountType}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {selectedUser ? (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-shrink-0 h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                            {selectedUser.firstname?.[0] || '?'}{selectedUser.lastname?.[0] || ''}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {selectedUser.firstname} {selectedUser.lastname}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedUser.accountType}
                            {selectedUser.barcode && ` · ${t('profile.barcode')}: ${selectedUser.barcode}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => {
                          setSelectedUser(null);
                          setLoans([]);
                          setLoansTotal(0);
                          setLoansPage(1);
                          setUserSearchDraft('');
                          setBarcodeInput('');
                        }}
                        leftIcon={<X className="h-4 w-4" />}
                      >
                        {t('common.clear')}
                      </Button>
                    </div>
                    {overdueLoans.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span className="text-sm">
                          {t('loans.overdueCount', { count: overdueLoans.length })}
                        </span>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          {selectedUser && (
            <>
              {/* Step 2 — Check out specimen */}
              <Card className="border-amber-200/80 shadow-sm dark:border-amber-900/40">
                <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-base font-bold text-white shadow-md dark:bg-amber-600"
                    aria-hidden
                  >
                    2
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <BookMarked className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                        {t('loans.borrow')}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
                        {t('loans.borrowSectionHint')}
                      </p>
                    </div>
                    <div className="max-w-2xl">
                      <BorrowForm
                        formId="loans-borrow-inline-form"
                        variant="inline"
                        onBorrow={handleBorrow}
                        barcodeInput={barcodeInput}
                        setBarcodeInput={setBarcodeInput}
                        barcodeInputRef={barcodeInputRef}
                        onLoadingChange={setIsBorrowLoading}
                        isLoading={isBorrowLoading}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Step 3 — Active loans list */}
              <Card padding="none" className="flex flex-col min-h-0">
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                  <div className="flex gap-4">
                    <div
                      className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-200 text-base font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                      aria-hidden
                    >
                      3
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {t('loans.activeLoans')}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 sm:hidden">
                        {selectedUser.firstname} {selectedUser.lastname}
                      </p>
                    </div>
                  </div>
                  {renewError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">{renewError}</p>
                    </div>
                  )}
                </div>
                <ScrollableListRegion aria-label={t('loans.activeLoans')}>
                  {isLoadingLoans && !loans.length ? (
                    <ListSkeleton rows={6} />
                  ) : (
                    <ResponsiveRecordList
                      desktop={
                        <Table
                          columns={loanColumns}
                          data={loansSortedByStart}
                          keyExtractor={(loan) => loan.id}
                          isLoading={false}
                          emptyMessage={t('loans.noLoans')}
                        />
                      }
                      mobile={
                        loans.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                            {t('loans.noLoans')}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2">
                            {loansSortedByStart.map((loan) => (
                              <ActiveLoanCard
                                key={loan.id}
                                loan={loan}
                                onRenew={() => void handleRenewLoan(loan.id)}
                                onReturn={() => void handleReturn(loan.id)}
                              />
                            ))}
                          </div>
                        )
                      }
                    />
                  )}
                </ScrollableListRegion>
                {loansTotal > 0 && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <Pagination
                      currentPage={loansPage}
                      totalPages={Math.max(1, Math.ceil(loansTotal / BORROW_LOANS_PAGE_SIZE))}
                      onPageChange={setLoansPage}
                    />
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* Return Tab */}
      {activeTab === 'return' && (
        <div className="space-y-6">
          {/* Step 1 — Scan return */}
          <Card className="border-emerald-200/80 shadow-sm dark:border-emerald-900/40">
            <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-base font-bold text-white shadow-md dark:bg-emerald-500"
                aria-hidden
              >
                1
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {t('loans.returnLoan')}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-2xl">
                    {t('loans.returnSectionHint')}
                  </p>
                </div>
                <div className="sm:ml-2 sm:border-l-2 sm:border-emerald-200 sm:pl-6 sm:dark:border-emerald-800">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (returnBarcodeInput.trim() && !isProcessingReturn) {
                        void handleReturnByBarcode(returnBarcodeInput);
                      }
                    }}
                    className="space-y-3 max-w-2xl"
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
                      aria-busy={isProcessingReturn}
                      rightIcon={
                        <button
                          type="submit"
                          disabled={isProcessingReturn || !returnBarcodeInput.trim()}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none dark:bg-emerald-500 dark:hover:bg-emerald-600"
                          aria-label={t('common.validate')}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      }
                    />
                  </form>
                  {returnError && (
                    <div className="mt-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">{returnError}</p>
                      </div>
                    </div>
                  )}
                  {isProcessingReturn && (
                    <div className="mt-4 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                      <div className="h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>{t('common.loading')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Step 2 — Last return recap */}
          <Card>
            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <div
                  className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-200 text-base font-bold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                  aria-hidden
                >
                  2
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('loans.returnSummaryTitle')}
                  </h3>
                </div>
              </div>

              {!returnResult && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 py-14 text-center dark:border-gray-700 dark:bg-gray-800/30">
                  <BookOpen className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto px-4">
                    {t('loans.returnSummaryEmpty')}
                  </p>
                </div>
              )}

              {returnResult && (
                <ReturnRecapPanel loan={returnResult.loan} locale={i18n.language} t={t} />
              )}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'overdue' && (
        <div className="space-y-4">
          <Card padding="none" className="overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-rose-50/80 via-white to-white dark:from-rose-950/20 dark:via-gray-900 dark:to-gray-900">
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
              {!userIsAdmin && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('loans.remindersAdminOnly')}</p>
              )}
              {overdueError && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {overdueError}
                </div>
              )}
            </div>

            {reminderReport && (
              <div className="mx-4 mt-4 rounded-2xl border border-indigo-200/80 dark:border-indigo-800 bg-indigo-50/90 dark:bg-indigo-950/30 p-4 text-sm space-y-3">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {reminderReport.dryRun ? t('loans.reminderDryRunResult') : t('loans.reminderSendResult')}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  {t('loans.reminderReportEmails', { count: reminderReport.emailsSent })} ·{' '}
                  {t('loans.reminderReportLoans', { count: reminderReport.loansReminded })}
                </p>
                {reminderReport.details.length > 0 && (
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                    {reminderReport.details.map((d) => (
                      <span
                        key={d.userId}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 dark:bg-gray-900/60 border border-indigo-100 dark:border-indigo-900 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300"
                      >
                        <span className="font-medium">
                          {d.firstname} {d.lastname}
                        </span>
                        <span className="text-gray-400">·</span>
                        <span className="truncate max-w-[10rem]">{d.email}</span>
                        <Badge variant="default" size="sm">
                          {d.loanCount}
                        </Badge>
                      </span>
                    ))}
                  </div>
                )}
                {reminderReport.errors.length > 0 && (
                  <ul className="text-red-700 dark:text-red-400 text-xs space-y-1 border-t border-red-200/50 dark:border-red-900/40 pt-2">
                    {reminderReport.errors.map((e) => (
                      <li key={`${e.userId}-${e.email}`}>
                        {e.email}: {e.errorMessage}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="p-4 sm:p-5 space-y-4">
              {overdueLoading ? (
                <div className="flex justify-center py-16">
                  <div className="h-9 w-9 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : overdueByUser.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 mb-4">
                    <Bell className="h-7 w-7 text-emerald-600 dark:text-emerald-400 opacity-80" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('loans.noOverdueLoans')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {overdueByUser.map(([uid, userLoans]) => {
                    const u = userLoans[0];
                    const lastAny = maxReminderSentAt(userLoans);
                    const initials =
                      `${u.firstname?.[0] ?? ''}${u.lastname?.[0] ?? ''}`.trim().toUpperCase() || '?';
                    const locale = i18n.language;
                    return (
                      <details
                        key={uid}
                        className="group rounded-2xl border border-gray-200/90 dark:border-gray-700/90 bg-white dark:bg-gray-900/50 shadow-sm overflow-hidden transition-shadow hover:shadow-md open:shadow-md"
                        open={overdueOpenByUser[uid] ?? false}
                        onToggle={(e) => {
                          const el = e.currentTarget;
                          setOverdueOpenByUser((p) => ({ ...p, [uid]: el.open }));
                        }}
                      >
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-3 px-3 py-3 sm:px-4 sm:py-3.5 hover:bg-rose-50/50 dark:hover:bg-rose-950/15 open:bg-rose-50/60 dark:open:bg-rose-950/20 transition-colors">
                          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180" aria-hidden />
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-sm font-bold text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <Link
                                to={`/users/${uid}`}
                                className="font-semibold text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {u.firstname} {u.lastname}
                              </Link>
                              <span className="shrink-0">
                                <Badge variant="danger" size="sm">
                                  {userLoans.length}
                                </Badge>
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                              {u.userEmail ?? '—'}
                            </p>
                          </div>
                          <div className="hidden sm:flex shrink-0 flex-col items-end gap-0.5 text-right text-[11px] text-gray-400 dark:text-gray-500">
                            <span className="whitespace-nowrap uppercase tracking-wide">
                              {t('loans.lastReminderAny')}
                            </span>
                            <span className="tabular-nums text-gray-600 dark:text-gray-300">
                              {lastAny
                                ? new Date(lastAny).toLocaleString(locale, {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                  })
                                : t('loans.neverReminded')}
                            </span>
                          </div>
                        </summary>
                        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40">
                          {userLoans.map((row) => {
                            const late = daysPastDue(row.expiryAt);
                            const isReturnLoading =
                              overdueLoanAction?.loanId === row.loanId && overdueLoanAction.op === 'return';
                            const isRenewLoading =
                              overdueLoanAction?.loanId === row.loanId && overdueLoanAction.op === 'renew';
                            return (
                              <div
                                key={row.loanId}
                                className="border-b border-gray-100/90 dark:border-gray-800/80 px-3 py-3 sm:px-4 last:border-b-0"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_11rem] gap-x-4 gap-y-2">
                                  <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-white sm:col-start-1 sm:row-start-1 line-clamp-2">
                                    {row.title || t('loans.noTitle')}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-start-1 sm:row-start-2 line-clamp-2 min-h-[1.25rem]">
                                    {row.authors ?? '\u00a0'}
                                  </p>
                                  <div className="flex min-w-0 flex-nowrap items-center justify-start gap-x-2 overflow-x-auto text-xs sm:col-start-2 sm:row-start-1 sm:justify-end sm:text-right">
                                    <code className="shrink-0 rounded bg-white/90 dark:bg-gray-900/80 px-2 py-0.5 font-mono text-[11px] text-gray-700 dark:text-gray-300 border border-gray-200/80 dark:border-gray-700">
                                      {row.itemBarcode ?? '—'}
                                    </code>
                                    <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">
                                      {row.expiryAt
                                        ? new Date(row.expiryAt).toLocaleDateString(locale, {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                          })
                                        : '—'}
                                    </span>
                                    {late > 0 ? (
                                      <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                                        {t('loans.overdueDaysLate', { count: late })}
                                      </span>
                                    ) : null}
                                    <span
                                      className="inline-flex shrink-0 items-center gap-1 text-gray-500 dark:text-gray-400 sm:ml-0.5"
                                      title={
                                        row.lastReminderSentAt
                                          ? new Date(row.lastReminderSentAt).toLocaleString(locale)
                                          : t('loans.neverReminded')
                                      }
                                    >
                                      <Bell className="h-3.5 w-3.5 shrink-0 opacity-70" />
                                      <span className="tabular-nums">{row.reminderCount}</span>
                                    </span>
                                  </div>
                                  <div className="flex flex-row gap-2 sm:col-start-2 sm:row-start-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="min-w-0 flex-1 justify-center"
                                      isLoading={isRenewLoading}
                                      disabled={isReturnLoading || isRenewLoading}
                                      leftIcon={<RotateCcw className="h-4 w-4" />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleOverdueRenew(row.loanId);
                                      }}
                                    >
                                      {t('loans.renew')}
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="primary"
                                      className="min-w-0 flex-1 justify-center"
                                      isLoading={isReturnLoading}
                                      disabled={isReturnLoading || isRenewLoading}
                                      leftIcon={<Check className="h-4 w-4" />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void handleOverdueReturn(row.loanId);
                                      }}
                                    >
                                      {t('loans.return')}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
              {overdueData && overdueData.total > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('loans.overdueTotal', { total: overdueData.total })}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      {t('common.perPage')}
                      <select
                        value={overduePerPage}
                        onChange={(e) => {
                          setOverduePerPage(Number(e.target.value));
                          setOverduePage(1);
                        }}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm"
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

      <MessageModal
        isOpen={messageDialog !== null}
        onClose={() => {
          setMessageDialog(null);
          focusScanInput();
        }}
        message={messageDialog ?? ''}
      />

      <ConfirmDialog
        isOpen={sendRemindersConfirmOpen}
        onClose={() => {
          setSendRemindersConfirmOpen(false);
          focusScanInput();
        }}
        onConfirm={() => {
          setSendRemindersConfirmOpen(false);
          void executeSendReminders(false);
          focusScanInput();
        }}
        message={t('loans.sendRemindersConfirm')}
        confirmVariant="primary"
      />

      <ConfirmDialog
        isOpen={forceBorrowDialog !== null}
        onClose={() => {
          setForceBorrowDialog(null);
          forceBorrowResolveRef.current?.(false);
          forceBorrowResolveRef.current = null;
          focusScanInput();
        }}
        onConfirm={() => {
          setForceBorrowDialog(null);
          forceBorrowResolveRef.current?.(true);
          forceBorrowResolveRef.current = null;
          focusScanInput();
        }}
        message={forceBorrowDialog?.message ?? ''}
        stackOnTop
      />
    </div>
  );
}

function ReturnRecapPanel({
  loan,
  locale,
  t,
}: {
  loan: Loan;
  locale: string;
  t: TFunction;
}) {
  const biblio = loan.biblio;
  const authorLine = biblio.author
    ? [biblio.author.firstname, biblio.author.lastname].filter(Boolean).join(' ').trim()
    : '';
  const borrower =
    loan.user != null
      ? [loan.user.firstname, loan.user.lastname].filter(Boolean).join(' ').trim() || '—'
      : '—';

  const initials =
    loan.user != null
      ? `${loan.user.firstname?.[0] ?? ''}${loan.user.lastname?.[0] ?? ''}`.trim() || '?'
      : '?';

  const df = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const barcode = loan.itemIdentification?.trim() || '—';

  return (
    <div className="sm:ml-2 sm:border-l-2 sm:border-gray-200 sm:pl-6 sm:dark:border-gray-700">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/40">
        <div className="flex items-center gap-2.5 border-b border-emerald-200/80 bg-emerald-50 px-4 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/25">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
            <Check className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
          </div>
          <p className="min-w-0 text-sm font-medium leading-snug text-emerald-900 dark:text-emerald-100">
            <span className="font-semibold">{t('loans.returnSuccess')}</span>
            <span className="font-normal text-emerald-800/85 dark:text-emerald-200/90"> · {t('loans.returnProcessed')}</span>
          </p>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <div className="px-5 py-5">
            <p className="text-lg font-semibold leading-snug text-gray-900 dark:text-white">
              {biblio.title || t('loans.noTitle')}
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{authorLine || '—'}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('loans.specimenBarcode')}
            </p>
            <p className="mt-1 font-mono text-sm tracking-wide text-gray-800 dark:text-gray-200">{barcode}</p>
          </div>

          <div className="grid gap-5 px-5 py-4 sm:grid-cols-3 sm:gap-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('loans.borrowDate')}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{df(loan.startDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('loans.dueDate')}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white tabular-nums">{df(loan.expiryAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {t('loans.renewals')}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900 tabular-nums dark:text-white">{loan.nbRenews}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-gray-50/90 px-5 py-4 dark:bg-gray-800/35">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold uppercase text-indigo-800 dark:bg-indigo-900/55 dark:text-indigo-200"
              aria-hidden
            >
              {initials}
            </div>
            <p className="min-w-0 truncate text-base font-semibold text-gray-900 dark:text-white">{borrower}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface BorrowFormProps {
  formId: string;
  onBorrow: (barcode: string, force?: boolean) => Promise<void>;
  barcodeInput: string;
  setBarcodeInput: (value: string) => void;
  barcodeInputRef: React.RefObject<HTMLInputElement | null>;
  onLoadingChange: (loading: boolean) => void;
  onSuccess?: () => void;
  variant?: 'default' | 'inline';
  isLoading?: boolean;
}

function BorrowForm({
  formId,
  onBorrow,
  barcodeInput,
  setBarcodeInput,
  barcodeInputRef,
  onLoadingChange,
  onSuccess,
  variant = 'default',
  isLoading = false,
}: BorrowFormProps) {
  const { t } = useTranslation();
  const [error, setError] = useState('');

  const runBorrow = async () => {
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
        requestAnimationFrame(() => {
          barcodeInputRef.current?.focus();
        });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runBorrow();
  };

  const isInline = variant === 'inline';

  return (
    <form id={formId} onSubmit={handleSubmit} className={isInline ? 'space-y-2' : 'space-y-4'}>
      <Input
        ref={barcodeInputRef}
        label={isInline ? undefined : t('loans.specimenBarcode')}
        value={barcodeInput}
        onChange={(e) => {
          setBarcodeInput(e.target.value);
          if (error) setError('');
        }}
        placeholder={t('loans.scanOrEnterBarcode')}
        autoFocus={isInline}
        required={!isInline}
        disabled={isLoading}
        leftIcon={<BookOpen className="h-4 w-4" />}
        rightIcon={
          isInline ? (
            <button
              type="submit"
              disabled={isLoading || !barcodeInput.trim()}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:pointer-events-none dark:bg-amber-500 dark:hover:bg-amber-600"
              aria-label={t('common.validate')}
            >
              <Check className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
    </form>
  );
}
