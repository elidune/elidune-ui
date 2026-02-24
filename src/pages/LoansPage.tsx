import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  Clock,
  BookOpen,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Table, Input, Modal } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { User as UserType, Loan, UserShort } from '@/types';

type TabType = 'borrow' | 'return';

export default function LoansPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('borrow');
  
  // Borrow section state
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserShort[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const userBarcodeInputRef = useRef<HTMLInputElement>(null);

  // Return section state
  const [returnBarcodeInput, setReturnBarcodeInput] = useState('');
  const returnBarcodeInputRef = useRef<HTMLInputElement>(null);
  const [returnResult, setReturnResult] = useState<{ status: string; loan: Loan } | null>(null);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [returnError, setReturnError] = useState('');

  // Search users by name or barcode
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearchingUsers(true);
      try {
        const response = await api.getUsers({
          name: userSearchQuery.trim(),
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

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [userSearchQuery]);

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
      setUserSearchQuery('');
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
        setUserSearchQuery('');
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

  const handleBorrow = async (specimenBarcode: string) => {
    if (!selectedUser || !specimenBarcode.trim()) {
      throw new Error(t('loans.noUserSelected'));
    }

    try {
      await api.createLoan({
        user_id: selectedUser.id,
        specimen_identification: specimenBarcode.trim(),
      });
      // Refresh loans
      const loansData = await api.getUserLoans(selectedUser.id);
      setLoans(loansData);
    } catch (error: unknown) {
      console.error('Error creating loan:', error);
      throw new Error(getApiErrorMessage(error, t) || t('loans.errorCreatingLoan'));
    }
  };

  const handleReturn = async (loanId: number) => {
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
      render: (loan: Loan) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {loan.item.title || t('loans.noTitle')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loan.specimen_identification}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: t('loans.borrowDate'),
      render: (loan: Loan) =>
        new Date(loan.start_date).toLocaleDateString('fr-FR'),
    },
    {
      key: 'issue_date',
      header: t('loans.dueDate'),
      render: (loan: Loan) => (
        <div className="flex items-center gap-2">
          <span>{new Date(loan.issue_date).toLocaleDateString('fr-FR')}</span>
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

  const handleRenewLoan = async (loanId: number) => {
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
                  <Input
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder={t('loans.searchUserPlaceholder')}
                    leftIcon={<Search className="h-4 w-4" />}
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
                        setUserSearchQuery('');
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
                    subtitle={`${loans.length} ${t('loans.count', { count: loans.length })}`}
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
          >
            <BorrowForm
              onBorrow={handleBorrow}
              barcodeInput={barcodeInput}
              setBarcodeInput={setBarcodeInput}
              barcodeInputRef={barcodeInputRef}
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
                          {new Date(returnResult.loan.issue_date).toLocaleDateString('fr-FR', {
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
    </div>
  );
}

interface BorrowFormProps {
  onBorrow: (barcode: string) => Promise<void>;
  barcodeInput: string;
  setBarcodeInput: (value: string) => void;
  barcodeInputRef: React.RefObject<HTMLInputElement>;
  onSuccess?: () => void;
}

function BorrowForm({ onBorrow, barcodeInput, setBarcodeInput, barcodeInputRef, onSuccess }: BorrowFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    setError('');
    setIsLoading(true);
    try {
      await onBorrow(barcodeInput);
      setBarcodeInput('');
      setError('');
      if (onSuccess) {
        onSuccess();
      } else {
        barcodeInputRef.current?.focus();
      }
    } catch (err: any) {
      const errorMessage = err?.message || 
                          err?.response?.data?.message || 
                          err?.response?.data?.error || 
                          t('loans.errorCreatingLoan');
      setError(errorMessage);
      setTimeout(() => {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('loans.borrow')}
        </Button>
      </div>
    </form>
  );
}
