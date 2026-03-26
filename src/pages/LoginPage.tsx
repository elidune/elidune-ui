import { useState, useRef, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, LogIn, Shield, ArrowLeft, KeyRound, X, ChevronRight, BookOpen, Newspaper, Video, Music, Disc, Image, FileText, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLibrary } from '@/contexts/LibraryContext';
import { Card, Badge, Input, Button, LibraryInfoSection } from '@/components/common';
import { useLibrarySchedule } from '@/hooks/common/useLibrarySchedule';
import api from '@/services/api';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import type { MediaType } from '@/types';

const MEDIA_FILTERS: Array<{ key: MediaType | ''; labelKey: string }> = [
  { key: '', labelKey: 'opac.filterAll' },
  { key: 'printedText', labelKey: 'opac.filterBooks' },
  { key: 'videoDvd', labelKey: 'opac.filterDvd' },
  { key: 'periodic', labelKey: 'opac.filterMagazines' },
  { key: 'comics', labelKey: 'opac.filterComics' },
];

function getMediaTypeIcon(mediaType?: string | null): React.ReactNode {
  const cls = 'h-4 w-4';
  switch (mediaType) {
    case 'printedText':
    case 'comics':
      return <BookOpen className={`${cls} text-amber-600 dark:text-amber-400`} />;
    case 'periodic':
      return <Newspaper className={`${cls} text-orange-600 dark:text-orange-400`} />;
    case 'video':
    case 'videoTape':
    case 'videoDvd':
      return <Video className={`${cls} text-red-600 dark:text-red-400`} />;
    case 'audio':
    case 'audioMusic':
    case 'audioMusicTape':
    case 'audioMusicCd':
    case 'audioNonMusic':
    case 'audioNonMusicTape':
    case 'audioNonMusicCd':
      return <Music className={`${cls} text-blue-600 dark:text-blue-400`} />;
    case 'cdRom':
      return <Disc className={`${cls} text-purple-600 dark:text-purple-400`} />;
    case 'images':
      return <Image className={`${cls} text-green-600 dark:text-green-400`} />;
    case 'multimedia':
      return <Layers className={`${cls} text-indigo-600 dark:text-indigo-400`} />;
    default:
      return <FileText className={`${cls} text-gray-400 dark:text-gray-500`} />;
  }
}

function getMediaTypeBgColor(mediaType?: string | null): string {
  switch (mediaType) {
    case 'printedText':
    case 'comics':
      return 'bg-amber-50 dark:bg-amber-900/30';
    case 'periodic':
      return 'bg-orange-50 dark:bg-orange-900/30';
    case 'video':
    case 'videoTape':
    case 'videoDvd':
      return 'bg-red-50 dark:bg-red-900/30';
    case 'audio':
    case 'audioMusic':
    case 'audioMusicTape':
    case 'audioMusicCd':
    case 'audioNonMusic':
    case 'audioNonMusicTape':
    case 'audioNonMusicCd':
      return 'bg-blue-50 dark:bg-blue-900/30';
    case 'cdRom':
      return 'bg-purple-50 dark:bg-purple-900/30';
    case 'images':
      return 'bg-green-50 dark:bg-green-900/30';
    case 'multimedia':
      return 'bg-indigo-50 dark:bg-indigo-900/30';
    default:
      return 'bg-gray-50 dark:bg-gray-800';
  }
}

// ── Two-factor verification ──────────────────────────────────────────────────

function TwoFactorVerification() {
  const { t } = useTranslation();
  const { pending2FA, verify2FA, verifyRecovery, cancel2FA } = useAuth();
  const navigate = useNavigate();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pasted.length; i++) newCode[i] = pasted[i];
    setCode(newCode);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      let needPwdChange = false;
      if (useRecoveryCode) {
        needPwdChange = (await verifyRecovery(recoveryCode.trim())).mustChangePassword ?? false;
      } else {
        const fullCode = code.join('');
        if (fullCode.length !== 6) { setError(t('auth.2fa.invalidCode')); setIsLoading(false); return; }
        needPwdChange = (await verify2FA(fullCode, trustDevice)).mustChangePassword ?? false;
      }
      navigate(needPwdChange ? '/change-password' : '/');
    } catch {
      setError(t('auth.2fa.invalidCode'));
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const methodLabel = pending2FA?.method === 'email'
    ? t('auth.2fa.emailMethod')
    : t('auth.2fa.totpMethod');

  return (
    <Card className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/50 mb-4">
          <Shield className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('auth.2fa.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {useRecoveryCode ? t('auth.2fa.recoverySubtitle') : methodLabel}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {useRecoveryCode ? (
          <Input
            label={t('auth.2fa.recoveryCode')}
            type="text"
            value={recoveryCode}
            onChange={(e) => setRecoveryCode(e.target.value)}
            placeholder={t('auth.2fa.recoveryPlaceholder')}
            leftIcon={<KeyRound className="h-4 w-4" />}
            autoFocus
          />
        ) : (
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-mono font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-colors"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!useRecoveryCode && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trustDevice} onChange={(e) => setTrustDevice(e.target.checked)}
              className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('auth.2fa.trustDevice')}</span>
          </label>
        )}

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}
          disabled={useRecoveryCode ? !recoveryCode.trim() : code.some((d) => !d)}>
          {t('auth.2fa.verify')}
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        <button type="button"
          onClick={() => { setUseRecoveryCode(!useRecoveryCode); setError(''); setCode(['','','','','','']); setRecoveryCode(''); setTrustDevice(false); }}
          className="w-full text-sm text-amber-600 dark:text-amber-400 hover:underline">
          {useRecoveryCode ? t('auth.2fa.useCode') : t('auth.2fa.useRecovery')}
        </button>
        <button type="button" onClick={cancel2FA}
          className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="h-4 w-4" />
          {t('auth.2fa.backToLogin')}
        </button>
      </div>
    </Card>
  );
}

// ── Biblio detail — inline pane (no Card wrapper, lives inside the results card) ─

function BiblioDetailPane({
  biblioId,
  onClose,
}: {
  biblioId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['opac-biblio', biblioId],
    queryFn: () => api.getOPACBiblio(biblioId),
    staleTime: 5 * 60 * 1000,
  });

  const authorLine = detail?.authors
    ?.map((a) => [a.firstname, a.lastname].filter(Boolean).join(' '))
    .join(', ');

  const metaRows: Array<{ label: string; value: string | null | undefined }> = detail
    ? [
        { label: t('items.mediaTypeLabel'), value: detail.mediaType ? t(`items.mediaType.${detail.mediaType}`, { defaultValue: detail.mediaType as string }) : null },
        { label: t('items.isbn'), value: detail.isbn ? formatIsbnDisplay(detail.isbn) : null },
        { label: t('items.publisher'), value: detail.edition?.publisherName },
        { label: t('items.publicationDate'), value: detail.publicationDate ?? detail.edition?.date },
        { label: t('items.publicationPlace'), value: detail.edition?.placeOfPublication },
        { label: t('items.language'), value: detail.lang ? t(`languages.${detail.lang}`, { defaultValue: detail.lang }) : null },
      ].filter((r) => r.value)
    : [];

  return (
    <>
      {/* Pane header — same height as the list header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-start gap-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
            {isLoading
              ? <span className="inline-block h-4 w-2/3 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              : (detail?.title ?? '—')}
          </h3>
          {authorLine && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{authorLine}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0 transition-colors"
          aria-label={t('common.close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pane body — scrolls independently */}
      <div className="px-4 py-4 overflow-y-auto flex-1 space-y-4 text-sm">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : !detail ? null : (
          <>
            {metaRows.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                {metaRows.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-gray-400 dark:text-gray-500 whitespace-nowrap">{row.label}</dt>
                    <dd className="text-gray-900 dark:text-white font-medium truncate">{row.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {detail.series && detail.series.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('items.series')}</p>
                <p className="text-gray-700 dark:text-gray-300">
                  {detail.series.map((s, i) => (
                    <span key={s.id ?? i}>
                      {s.name}
                      {s.volumeNumber != null && ` (${t('items.volume')} ${s.volumeNumber})`}
                      {i < detail.series!.length - 1 && ', '}
                    </span>
                  ))}
                </p>
              </div>
            )}

            {detail.subject && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('items.subject')}</p>
                <p className="text-gray-700 dark:text-gray-300">{detail.subject}</p>
              </div>
            )}

            {detail.abstract && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('items.abstract')}</p>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-5">{detail.abstract}</p>
              </div>
            )}

            {detail.notes && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{t('profile.notes', { defaultValue: 'Notes' })}</p>
                <p className="text-gray-600 dark:text-gray-400">{detail.notes}</p>
              </div>
            )}

            {detail.items && detail.items.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">{t('items.specimens')}</p>
                <div className="space-y-1.5">
                  {detail.items.map((item) => {
                    const available = item.borrowable === true && !item.borrowed;

                    return (
                      <div key={item.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
                        <Badge variant={available ? 'success' : 'danger'} size="sm">
                          {available ? t('opac.available') : t('opac.borrowed')}
                        </Badge>
                        {item.callNumber && (
                          <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">{item.callNumber}</span>
                        )}
                        {item.sourceName && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-auto">{item.sourceName}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── OPAC / Login page ────────────────────────────────────────────────────────

export default function LoginPage() {
  const { t } = useTranslation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeMediaType, setActiveMediaType] = useState<MediaType | ''>('');
  const [selectedBiblioId, setSelectedBiblioId] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  const { login, isAuthenticated, pending2FA, mustChangePassword } = useAuth();
  const { libraryName, libraryInfo } = useLibrary();
  const { scheduleSlots } = useLibrarySchedule();
  const navigate = useNavigate();

  // Ctrl/Cmd+K focuses the search bar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && selectedBiblioId) {
        setSelectedBiblioId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedBiblioId]);

  const hasQuery = activeSearch.length > 0 || activeMediaType !== '';

  const { data: opacData, isLoading: opacLoading } = useQuery({
    queryKey: ['opac-biblios', activeSearch, activeMediaType],
    queryFn: () =>
      api.getOPACBiblios({
        freesearch: activeSearch || undefined,
        mediaType: (activeMediaType as MediaType) || undefined,
        perPage: 8,
      }),
    enabled: hasQuery,
    staleTime: 2 * 60 * 1000,
  });

  const biblios = opacData?.items ?? [];

  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
    setSelectedBiblioId(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const { requires2FA, mustChangePassword: needPwd } = await login({ username, password });
      if (!requires2FA) navigate(needPwd ? '/change-password' : '/');
    } catch {
      setLoginError(t('auth.invalidCredentials'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* 2FA modal overlay */}
      {pending2FA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <TwoFactorVerification />
        </div>
      )}

      <div className="w-[80%] mx-auto py-6 sm:py-8 space-y-4 sm:space-y-6">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-sm">
          <img
            src="/elidune_logo.png"
            alt=""
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-48 w-48 sm:h-56 sm:w-56 object-contain opacity-[0.07] dark:opacity-[0.05] select-none pointer-events-none"
          />
          <div className="relative">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-1">
              {libraryName ?? t('auth.loginTitle')}
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 mb-5">
              {t('opac.heroTitle')} — {t('opac.heroSub')}
            </p>

            <form onSubmit={handleSearch} className="flex max-w-3xl gap-2 mb-4">
              <Input
                ref={searchRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('opac.searchPlaceholder')}
                leftIcon={<Search className="h-4 w-4" />}
                className="text-sm"
              />
              <Button type="submit" variant="primary" size="md" className="shrink-0">
                {t('common.search')}
              </Button>
            </form>

            <div className="flex gap-1.5 flex-wrap">
              {MEDIA_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => { setActiveMediaType(f.key); setSelectedBiblioId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeMediaType === f.key
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results + Login ───────────────────────────────────────────── */}
        <div className="flex gap-4 sm:gap-6 items-start">

          {/* Results card — flex-1, contains list pane + optional detail pane */}
          <Card padding="none" className="flex-1 flex overflow-hidden min-h-[800px] max-h-[800px]">

            {/* List pane — shrinks to fixed width when detail is open */}
            <div className={`flex flex-col overflow-hidden flex-shrink-0 ${selectedBiblioId ? 'w-72 border-r border-gray-100 dark:border-gray-800' : 'flex-1'}`}>
              <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {opacData
                    ? t('opac.resultsCount', { count: opacData.total })
                    : t('opac.searchResults')}
                </h3>
              </div>

              <div className="overflow-y-auto flex-1 px-4 py-2">
                {!hasQuery ? (
                  <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    {t('opac.searchPrompt')}
                  </p>
                ) : opacLoading ? (
                  <div className="py-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-3 py-3 border-b border-gray-50 dark:border-gray-800/50 last:border-0 animate-pulse">
                        <div className="w-8 h-11 bg-gray-100 dark:bg-gray-800 rounded flex-shrink-0" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                          <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !opacLoading && biblios.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                    {t('common.noResults')}
                  </p>
                ) : (
                  <div>
                    {biblios.map((biblio) => {
                      const hasAvailable = biblio.items?.some((i) => i.borrowable === true && !i.borrowed) ?? false;
                      const totalItems = biblio.items?.length ?? 0;
                      const authorName = biblio.author
                        ? [biblio.author.firstname, biblio.author.lastname].filter(Boolean).join(' ')
                        : null;
                      const isSelected = selectedBiblioId === biblio.id;

                      return (
                        <button
                          key={biblio.id}
                          type="button"
                          onClick={() => setSelectedBiblioId(isSelected ? null : biblio.id)}
                          className={`w-full text-left flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-800/50 last:border-0 rounded-lg px-2 -mx-2 transition-colors ${
                            isSelected
                              ? 'bg-amber-50 dark:bg-amber-900/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          <div className={`w-8 h-11 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800'
                              : `${getMediaTypeBgColor(biblio.mediaType)} border-transparent`
                          }`}>
                            {getMediaTypeIcon(biblio.mediaType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isSelected ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-white'}`}>
                              {biblio.title ?? '—'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {authorName ?? '—'}
                            </p>
                            {totalItems > 0 && (
                              <Badge variant={hasAvailable ? 'success' : 'danger'} size="sm">
                                {hasAvailable ? t('opac.available') : t('opac.borrowed')}
                              </Badge>
                            )}
                          </div>
                          <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'text-amber-500 dark:text-amber-400'
                              : 'text-gray-300 dark:text-gray-600'
                          }`} />
                        </button>
                      );
                    })}

                    {activeSearch && opacData && opacData.total > biblios.length && (
                      <p className="py-2 text-xs text-gray-400 dark:text-gray-500">
                        {t('opac.moreResults', { count: opacData.total - biblios.length })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Detail pane — appears inside the card to the right of the list */}
            {selectedBiblioId && (
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                <BiblioDetailPane
                  biblioId={selectedBiblioId}
                  onClose={() => setSelectedBiblioId(null)}
                />
              </div>
            )}
          </Card>

          {/* Login — fixed width, does not grow */}
          <div className="w-80 flex-shrink-0">
            <Card padding="none">
              <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 dark:border-gray-800">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t('opac.readerSpace')}
                </h3>
              </div>
              <div className="px-4 py-3 space-y-3">
                <form onSubmit={handleLogin} className="space-y-2">
                  <Input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('auth.yourIdentifier')}
                    required
                    autoComplete="username"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.yourPassword')}
                    required
                    autoComplete="current-password"
                  />
                  {loginError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{loginError}</p>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    isLoading={isLoggingIn}
                    leftIcon={<LogIn className="h-4 w-4" />}
                  >
                    {t('auth.loginButton')}
                  </Button>
                </form>

                <div className="space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2.5">
                  {[
                    'opac.featureReserve',
                    'opac.featureRenew',
                    'opac.featureHistory',
                    'opac.featureDigital',
                    'opac.featureSuggestions',
                  ].map((key) => (
                    <div key={key} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-amber-400 dark:bg-amber-600 flex-shrink-0" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">{t(key)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

        </div>

        {/* ── Library info ─────────────────────────────────────────────── */}
        <LibraryInfoSection
          info={libraryInfo}
          slots={scheduleSlots}
        />

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="pt-1 pb-2 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex-1" />
            <Link to="/about" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {t('nav.about')}
            </Link>
            <Link to="/privacy" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              {t('nav.privacy')}
            </Link>
          </div>
          <div className="text-center mt-1">
            {t('common.poweredBy')}{' '}
            <Link
              to="/about"
              className="font-semibold text-amber-600 dark:text-amber-400 hover:underline transition-colors"
            >
              Elidune
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
