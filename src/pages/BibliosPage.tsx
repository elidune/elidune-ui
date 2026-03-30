import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, Filter, Search, Loader2, AlertCircle, Video, Music, Image, FileText, Disc, Newspaper, Trash2, Layers, BookMarked, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button, Table, Badge, SearchInput, Modal, Input, ScrollableListRegion, ResponsiveRecordList, ListSkeleton } from '@/components/common';
import BiblioCatalogItemCard from '@/components/items/BiblioCatalogItemCard';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems, type MediaType, type MediaTypeOption, type Serie, type Collection } from '@/types';
import api from '@/services/api';
import type { BiblioShort, Author, PaginatedResponse } from '@/types';
import { PUBLIC_TYPE_OPTIONS } from '@/utils/codeLabels';
import { getApiErrorCode, getApiErrorMessage } from '@/utils/apiError';
import { LIST_ROW_ICON_BTN, LIST_ROW_ICON_BTN_DANGER } from '@/utils/listRowActionIconClass';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
type CatalogTab = 'catalog' | 'collections' | 'series';

type SavedSearch = {
  searchQuery: string;
  mediaType: MediaType | '';
  audienceType: string;
  showFilters: boolean;
  advancedFilters: { title: string; author: string; isbn: string };
  serieId: string;
  serieName: string;
  collectionId: string;
  collectionName: string;
};

const PAGE_SIZE = 20;

export default function BibliosPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Search state passed back from BiblioDetailPage when the user clicks "back"
  const restoredSearch = (location.state as { restoredSearch?: SavedSearch } | null)?.restoredSearch;

  const activeTab = (searchParams.get('tab') as CatalogTab) || 'catalog';
  const setActiveTab = useCallback(
    (tab: CatalogTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'catalog') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
            next.delete('freesearch');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Active catalog filter from a collection or series click
  const [activeFilterSerieId, setActiveFilterSerieId] = useState(
    () => restoredSearch?.serieId ?? searchParams.get('serie_id') ?? ''
  );
  const [activeFilterSerieName, setActiveFilterSerieName] = useState(
    () => restoredSearch?.serieName ?? searchParams.get('serie_name') ?? ''
  );
  const [activeFilterCollectionId, setActiveFilterCollectionId] = useState(
    () => restoredSearch?.collectionId ?? searchParams.get('collection_id') ?? ''
  );
  const [activeFilterCollectionName, setActiveFilterCollectionName] = useState(
    () => restoredSearch?.collectionName ?? searchParams.get('collection_name') ?? ''
  );

  const goToCatalogWithFilter = useCallback(
    (kind: 'serie' | 'collection', id: string, name: string) => {
      setActiveFilterSerieId(kind === 'serie' ? id : '');
      setActiveFilterSerieName(kind === 'serie' ? name : '');
      setActiveFilterCollectionId(kind === 'collection' ? id : '');
      setActiveFilterCollectionName(kind === 'collection' ? name : '');
      // activeTab is driven by URL `tab=`; must clear it to show the catalog tab
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          next.delete('freesearch');
          next.delete('serie_id');
          next.delete('serie_name');
          next.delete('collection_id');
          next.delete('collection_name');
          if (kind === 'serie') {
            next.set('serie_id', id);
            next.set('serie_name', name);
          } else {
            next.set('collection_id', id);
            next.set('collection_name', name);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const clearCatalogFilter = useCallback(() => {
    setActiveFilterSerieId('');
    setActiveFilterSerieName('');
    setActiveFilterCollectionId('');
    setActiveFilterCollectionName('');
  }, []);

  const MEDIA_TYPES: MediaTypeOption[] = [
    { value: '', label: t('items.allTypes') },
    { value: 'unknown', label: t('items.mediaType.unknown') },
    { value: 'printedText', label: t('items.mediaType.printedText') },
    { value: 'comics', label: t('items.mediaType.comics') },
    { value: 'periodic', label: t('items.mediaType.periodic') },
    { value: 'video', label: t('items.mediaType.video') },
    { value: 'videoTape', label: t('items.mediaType.videoTape') },
    { value: 'videoDvd', label: t('items.mediaType.videoDvd') },
    { value: 'audio', label: t('items.mediaType.audio') },
    { value: 'audioMusic', label: t('items.mediaType.audioMusic') },
    { value: 'audioMusicTape', label: t('items.mediaType.audioMusicTape') },
    { value: 'audioMusicCd', label: t('items.mediaType.audioMusicCd') },
    { value: 'audioNonMusic', label: t('items.mediaType.audioNonMusic') },
    { value: 'cdRom', label: t('items.mediaType.cdRom') },
    { value: 'images', label: t('items.mediaType.images') },
    { value: 'multimedia', label: t('items.mediaType.multimedia') },
  ];

  // Filters – priority: location.state (back from detail) > URL params > default
  const [searchQuery, setSearchQuery] = useState(
    () => restoredSearch?.searchQuery ?? searchParams.get('freesearch') ?? ''
  );
  const [searchQueryDraft, setSearchQueryDraft] = useState(
    () => restoredSearch?.searchQuery ?? searchParams.get('freesearch') ?? ''
  );
  const [mediaType, setMediaType] = useState<MediaType | ''>(
    () => (restoredSearch?.mediaType ?? searchParams.get('media_type') ?? '') as MediaType | ''
  );
  const [audienceType, setAudienceType] = useState<string>(
    () => restoredSearch?.audienceType ?? searchParams.get('audience_type') ?? ''
  );
  const [showFilters, setShowFilters] = useState(
    () =>
      restoredSearch?.showFilters ??
      (searchParams.get('show_filters') === '1' ||
        !!(searchParams.get('title') || searchParams.get('author') || searchParams.get('isbn')))
  );
  const [advancedFilters, setAdvancedFilters] = useState(() => ({
    title: restoredSearch?.advancedFilters?.title ?? searchParams.get('title') ?? '',
    author: restoredSearch?.advancedFilters?.author ?? searchParams.get('author') ?? '',
    isbn: restoredSearch?.advancedFilters?.isbn ?? searchParams.get('isbn') ?? '',
  }));
  const [advancedFiltersDraft, setAdvancedFiltersDraft] = useState(() => ({
    title: restoredSearch?.advancedFilters?.title ?? searchParams.get('title') ?? '',
    author: restoredSearch?.advancedFilters?.author ?? searchParams.get('author') ?? '',
    isbn: restoredSearch?.advancedFilters?.isbn ?? searchParams.get('isbn') ?? '',
  }));

  const {
    data,
    isLoading: isItemsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'biblios',
      {
        searchQuery,
        mediaType,
        audienceType,
        advancedFilters,
        showFilters,
        activeFilterSerieId,
        activeFilterCollectionId,
      },
    ],
    enabled: activeTab === 'catalog',
    queryFn: async ({ pageParam }) => {
      return api.getBiblios({
        freesearch: !showFilters ? (searchQuery || undefined) : undefined,
        mediaType: mediaType || undefined,
        audienceType: audienceType || undefined,
        title: showFilters ? (advancedFilters.title || undefined) : undefined,
        author: showFilters ? (advancedFilters.author || undefined) : undefined,
        isbn: showFilters ? (advancedFilters.isbn || undefined) : undefined,
        serieId: activeFilterSerieId || undefined,
        collectionId: activeFilterCollectionId || undefined,
        page: pageParam,
        perPage: PAGE_SIZE,
      });
    },
    staleTime: 0,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.items?.length) return undefined;
      const loaded = lastPage.page * lastPage.perPage;
      return loaded < lastPage.total ? lastPage.page + 1 : undefined;
    },
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const totalItems = data?.pages[0]?.total ?? 0;

  const canManage = canManageItems(user?.accountType);

  const [catalogBiblioToDelete, setCatalogBiblioToDelete] = useState<BiblioShort | null>(null);
  const [catalogDeleteBorrowedError, setCatalogDeleteBorrowedError] = useState(false);
  const [catalogDeleteLoading, setCatalogDeleteLoading] = useState(false);

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

  // Clear location state after reading so a page refresh doesn't re-apply it
  useEffect(() => {
    if (restoredSearch) {
      navigate('.', { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist search state in URL so it survives navigation
  useEffect(() => {
    if (activeTab !== 'catalog') return;
    const next = new URLSearchParams();
    if (searchQuery) next.set('freesearch', searchQuery);
    if (mediaType) next.set('media_type', mediaType);
    if (audienceType) next.set('audience_type', audienceType);
    if (showFilters) next.set('show_filters', '1');
    if (advancedFilters.title) next.set('title', advancedFilters.title);
    if (advancedFilters.author) next.set('author', advancedFilters.author);
    if (advancedFilters.isbn) next.set('isbn', advancedFilters.isbn);
    // Preserve active collection/series filter set by tab row click
    if (activeFilterSerieId) {
      next.set('serie_id', activeFilterSerieId);
      if (activeFilterSerieName) next.set('serie_name', activeFilterSerieName);
    }
    if (activeFilterCollectionId) {
      next.set('collection_id', activeFilterCollectionId);
      if (activeFilterCollectionName) next.set('collection_name', activeFilterCollectionName);
    }
    setSearchParams(next, { replace: true });
  }, [searchQuery, mediaType, audienceType, showFilters, advancedFilters, activeFilterSerieId, activeFilterSerieName, activeFilterCollectionId, activeFilterCollectionName, setSearchParams, activeTab]);

  const handleApplySearch = () => {
    const nextQuery = searchQueryDraft;
    setSearchQuery(nextQuery);
    if (showFilters) setAdvancedFilters({ ...advancedFiltersDraft });
    queryClient.invalidateQueries({ queryKey: ['biblios'] });
  };

  const getSavedSearch = useCallback((): SavedSearch => ({
    searchQuery,
    mediaType,
    audienceType,
    showFilters,
    advancedFilters,
    serieId: activeFilterSerieId,
    serieName: activeFilterSerieName,
    collectionId: activeFilterCollectionId,
    collectionName: activeFilterCollectionName,
  }), [
    searchQuery,
    mediaType,
    audienceType,
    showFilters,
    advancedFilters,
    activeFilterSerieId,
    activeFilterSerieName,
    activeFilterCollectionId,
    activeFilterCollectionName,
  ]);

  const handleRowClick = (item: BiblioShort) => {
    navigate(`/biblios/${item.id}`, { state: { savedSearch: getSavedSearch() } });
  };

  const handleCatalogBiblioDelete = async (force: boolean) => {
    if (!catalogBiblioToDelete) return;
    setCatalogDeleteLoading(true);
    try {
      await api.deleteBiblio(catalogBiblioToDelete.id, force);
      setCatalogBiblioToDelete(null);
      setCatalogDeleteBorrowedError(false);
      await queryClient.invalidateQueries({ queryKey: ['biblios'] });
    } catch (error: unknown) {
      const code = getApiErrorCode(error);
      const msg =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (
        !force &&
        (code === 'business_rule_violation' ||
          code === 'conflict' ||
          (typeof msg === 'string' && (msg.includes('borrowed') || msg.includes('force=true'))))
      ) {
        setCatalogDeleteBorrowedError(true);
      } else {
        console.error(error);
      }
    } finally {
      setCatalogDeleteLoading(false);
    }
  };

  const formatAuthor = (author?: Author | null) => {
    if (!author) return '-';
    return `${author.firstname || ''} ${author.lastname || ''}`.trim() || '-';
  };

  const getStatusBadge = (status?: number | null) => {
    if (status === 0) return <Badge variant="success">{t('items.available')}</Badge>;
    if (status === 1) return <Badge variant="warning">{t('items.borrowed')}</Badge>;
    return <Badge>{t('items.unavailable')}</Badge>;
  };

  const getCatalogRowStatusBadge = (row: BiblioShort) => {
    const list = row.items ?? [];
    if (list.length > 0) {
      if (list.every((s) => s.borrowed === true)) {
        return <Badge variant="warning">{t('items.borrowed')}</Badge>;
      }
      if (list.some((s) => s.borrowable === true && !s.borrowed)) {
        return <Badge variant="success">{t('items.available')}</Badge>;
      }
      return <Badge>{t('items.unavailable')}</Badge>;
    }
    return getStatusBadge(row.status);
  };

  const getMediaTypeIcon = (mediaType?: MediaType) => {
    const iconClass = "h-5 w-5";
    const colorClass = "text-amber-600 dark:text-amber-400";
    
    switch (mediaType) {
      case 'printedText':
      case 'comics':
        return <BookOpen className={`${iconClass} ${colorClass}`} />;
      case 'periodic':
        return <Newspaper className={`${iconClass} ${colorClass}`} />;
      case 'video':
      case 'videoTape':
      case 'videoDvd':
        return <Video className={`${iconClass} text-red-600 dark:text-red-400`} />;
      case 'audio':
      case 'audioMusic':
      case 'audioMusicTape':
      case 'audioMusicCd':
      case 'audioNonMusic':
      case 'audioNonMusicTape':
      case 'audioNonMusicCd':
        return <Music className={`${iconClass} text-blue-600 dark:text-blue-400`} />;
      case 'cdRom':
        return <Disc className={`${iconClass} text-purple-600 dark:text-purple-400`} />;
      case 'images':
        return <Image className={`${iconClass} text-green-600 dark:text-green-400`} />;
      case 'multimedia':
        return <FileText className={`${iconClass} text-indigo-600 dark:text-indigo-400`} />;
      default:
        return <BookOpen className={`${iconClass} text-gray-600 dark:text-gray-400`} />;
    }
  };

  const getMediaTypeBgColor = (mediaType?: MediaType) => {
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
        return 'bg-gray-50 dark:bg-gray-900/30';
    }
  };

  const columns = [
    {
      key: 'title',
      header: t('items.titleField'),
      render: (item: BiblioShort) => (
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 h-10 w-10 rounded-lg ${getMediaTypeBgColor(item.mediaType as MediaType)} flex items-center justify-center`}>
            {getMediaTypeIcon(item.mediaType as MediaType)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {item.title || t('items.notSpecified')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate font-mono">
              {formatIsbnDisplay(item.isbn)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'author',
      header: t('items.author'),
      render: (item: BiblioShort) => (
        <span className="text-gray-600 dark:text-gray-300">
          {formatAuthor(item.author)}
        </span>
      ),
    },
    {
      key: 'items',
      header: t('items.specimens'),
      render: (item: BiblioShort) => {
        const list = item.items ?? [];
        const total = list.length;
        const available = list.filter((s) => s.borrowable === true && !s.borrowed).length;
        if (total === 0) return <span className="text-gray-500 dark:text-gray-400">-</span>;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {available}/{total}
          </span>
        );
      },
      className: 'hidden md:table-cell',
    },
    {
      key: 'date',
      header: t('common.date'),
      render: (item: BiblioShort) => item.date || '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item: BiblioShort) => getCatalogRowStatusBadge(item),
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            className: 'w-[1%] whitespace-nowrap',
            render: (item: BiblioShort) => (
              <div
                className="flex justify-end gap-1.5"
                onClick={(e) => e.stopPropagation()}
                role="group"
                aria-label={t('common.actions')}
              >
                <button
                  type="button"
                  className={LIST_ROW_ICON_BTN}
                  title={t('common.edit')}
                  onClick={() =>
                    navigate(`/biblios/${item.id}/edit`, { state: { savedSearch: getSavedSearch() } })
                  }
                >
                  <Edit className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className={LIST_ROW_ICON_BTN_DANGER}
                  title={t('common.delete')}
                  onClick={() => {
                    setCatalogDeleteBorrowedError(false);
                    setCatalogBiblioToDelete(item);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('catalog.pageTitle')}</h1>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          {([
            { key: 'catalog', label: t('catalog.tabCatalog'), icon: BookOpen },
            { key: 'collections', label: t('catalog.tabCollections'), icon: Layers },
            { key: 'series', label: t('catalog.tabSeries'), icon: BookMarked },
          ] as { key: CatalogTab; label: string; icon: React.ComponentType<{ className?: string }> }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Collections tab */}
      {activeTab === 'collections' && (
        <CollectionsTab
          canManage={canManage}
          onSelect={(id, name) => goToCatalogWithFilter('collection', id, name)}
        />
      )}

      {/* Series tab */}
      {activeTab === 'series' && (
        <SeriesTab
          canManage={canManage}
          onSelect={(id, name) => goToCatalogWithFilter('serie', id, name)}
        />
      )}

      {/* Catalog tab content */}
      {activeTab === 'catalog' && (<>

      {/* Active filter chip */}
      {(activeFilterSerieId || activeFilterCollectionId) && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('catalog.filteredBy')}</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {activeFilterSerieId ? (
              <BookMarked className="h-3.5 w-3.5" />
            ) : (
              <Layers className="h-3.5 w-3.5" />
            )}
            {activeFilterSerieName || activeFilterCollectionName}
            <button
              onClick={clearCatalogFilter}
              className="ml-1 hover:text-amber-600 dark:hover:text-amber-200"
              title={t('common.clear')}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-gray-500 dark:text-gray-400">
            {t('items.count', { count: totalItems })}
          </p>
        </div>
        {canManageItems(user?.accountType) && (
          <Button onClick={() => navigate('/biblios/new')} leftIcon={<Plus className="h-4 w-4" />}>
            {t('items.add')}
          </Button>
        )}
      </div>

      {/* Search and filters — hidden while a serie/collection filter is active */}
      {!(activeFilterSerieId || activeFilterCollectionId) && (
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            {!showFilters && (
              <SearchInput
                value={searchQueryDraft}
                onChange={setSearchQueryDraft}
                placeholder={t('items.searchPlaceholder')}
                submitMode
                onSubmit={() => handleApplySearch()}
                showSubmitButton
                submitLabel={t('common.search')}
              />
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as MediaType | '')}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              {MEDIA_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">{t('items.allPublicTypes')}</option>
              {PUBLIC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              onClick={() => setShowFilters(!showFilters)}
              leftIcon={<Filter className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">
                {showFilters ? t('common.hide') : t('items.advancedSearch')}
              </span>
            </Button>
          </div>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleApplySearch();
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label={t('items.titleField')}
                value={advancedFiltersDraft.title}
                onChange={(e) =>
                  setAdvancedFiltersDraft({ ...advancedFiltersDraft, title: e.target.value })
                }
                placeholder={t('z3950.titlePlaceholder')}
              />
              <Input
                label={t('items.author')}
                value={advancedFiltersDraft.author}
                onChange={(e) =>
                  setAdvancedFiltersDraft({ ...advancedFiltersDraft, author: e.target.value })
                }
                placeholder={t('z3950.authorPlaceholder')}
              />
              <Input
                label={t('items.isbn')}
                value={advancedFiltersDraft.isbn}
                onChange={(e) =>
                  setAdvancedFiltersDraft({ ...advancedFiltersDraft, isbn: e.target.value })
                }
                placeholder={t('z3950.isbnPlaceholder')}
              />
              </div>
              <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setAdvancedFiltersDraft({ title: '', author: '', isbn: '' });
                  setAdvancedFilters({ title: '', author: '', isbn: '' });
                  queryClient.invalidateQueries({ queryKey: ['biblios'] });
                }}
              >
                {t('common.reset')}
              </Button>
              <Button type="submit" leftIcon={<Search className="h-4 w-4" />}>
                {t('common.search')}
              </Button>
              </div>
            </form>
          </div>
        )}
      </Card>
      )}

      {/* Items list: fixed-height scroll area so header/filters stay static */}
      <Card padding="none" className="flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-300 flex justify-end">
          <span>{t('items.count', { count: totalItems })}</span>
        </div>
        <ScrollableListRegion aria-label={t('items.title')}>
          {isItemsLoading && !items.length ? (
            <ListSkeleton rows={10} />
          ) : (
            <>
              <ResponsiveRecordList
                desktop={
                  <Table
                    columns={columns}
                    data={items}
                    keyExtractor={(item) => item.id}
                    onRowClick={handleRowClick}
                    isLoading={false}
                    emptyMessage={t('items.noItems')}
                  />
                }
                mobile={
                  items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                      {t('items.noItems')}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2">
                      {items.map((item) => (
                        <BiblioCatalogItemCard
                          key={item.id}
                          item={item}
                          mediaIcon={getMediaTypeIcon(item.mediaType as MediaType)}
                          mediaBgClassName={getMediaTypeBgColor(item.mediaType as MediaType)}
                          formatAuthor={formatAuthor}
                          notSpecified={t('items.notSpecified')}
                          statusBadge={getCatalogRowStatusBadge(item)}
                          onOpen={() => handleRowClick(item)}
                          canManage={canManage}
                          editLabel={t('common.edit')}
                          deleteLabel={t('common.delete')}
                          actionsAriaLabel={t('common.actions')}
                          onEdit={
                            canManage
                              ? () =>
                                  navigate(`/biblios/${item.id}/edit`, {
                                    state: { savedSearch: getSavedSearch() },
                                  })
                              : undefined
                          }
                          onDelete={
                            canManage
                              ? () => {
                                  setCatalogDeleteBorrowedError(false);
                                  setCatalogBiblioToDelete(item);
                                }
                              : undefined
                          }
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

      <Modal
        isOpen={catalogBiblioToDelete !== null}
        onClose={() => {
          if (catalogDeleteLoading) return;
          setCatalogBiblioToDelete(null);
          setCatalogDeleteBorrowedError(false);
        }}
        title={t('common.confirm')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (catalogDeleteLoading) return;
                setCatalogBiblioToDelete(null);
                setCatalogDeleteBorrowedError(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            {catalogDeleteBorrowedError ? (
              <Button
                variant="danger"
                disabled={catalogDeleteLoading}
                isLoading={catalogDeleteLoading}
                onClick={() => void handleCatalogBiblioDelete(true)}
              >
                {t('items.forceDeleteItem')}
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={catalogDeleteLoading}
                isLoading={catalogDeleteLoading}
                onClick={() => void handleCatalogBiblioDelete(false)}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          {catalogDeleteBorrowedError
            ? t('items.itemBorrowedForceDelete')
            : t('items.deleteConfirm', {
                title: catalogBiblioToDelete?.title || t('items.notSpecified'),
              })}
        </p>
      </Modal>

      </>)}
    </div>
  );
}

// ─── Collections Tab ─────────────────────────────────────────────────────────

const ENTITY_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function looksLikeEntityUuid(s: string): boolean {
  return ENTITY_UUID_RE.test(s.trim());
}

const COLL_PAGE_SIZE = 25;

interface CollectionsTabProps {
  canManage: boolean;
  onSelect?: (id: string, name: string) => void;
}

function CollectionsTab({ canManage, onSelect }: CollectionsTabProps) {
  const { t } = useTranslation();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<Collection> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editItem, setEditItem] = useState<Collection | null>(null);
  const [deleteItem, setDeleteItem] = useState<Collection | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setIsLoading(true);
    try {
      const trimmed = q.trim();
      if (looksLikeEntityUuid(trimmed)) {
        const one = await api.getCollection(trimmed).catch(() => null);
        if (one) {
          setData({
            items: [one],
            total: 1,
            page: 1,
            perPage: COLL_PAGE_SIZE,
            pageCount: 1,
          });
          return;
        }
      }
      const res = await api.getCollections({ name: q || undefined, page: p, perPage: COLL_PAGE_SIZE });
      setData(res);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(search, page); }, [search, page, load]);

  const handleSearch = () => { setPage(1); setSearch(searchDraft); };

  const handleDelete = async () => {
    if (!deleteItem?.id) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.deleteCollection(deleteItem.id);
      setDeleteItem(null);
      load(search, page);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, t));
    } finally {
      setDeleteLoading(false);
    }
  };

  const collName = (c: Collection) =>
    c.name ?? c.secondaryTitle ?? '—';

  const columns = [
    {
      key: 'name',
      header: t('catalog.collectionName'),
      render: (c: Collection) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{collName(c)}</p>
          {c.secondaryTitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {c.secondaryTitle}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'issn',
      header: 'ISSN',
      render: (c: Collection) => <span className="text-gray-600 dark:text-gray-300">{c.issn ?? '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'key',
      header: t('catalog.key'),
      render: (c: Collection) => <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{c.key ?? '—'}</span>,
      className: 'hidden lg:table-cell',
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: '',
          align: 'right' as const,
          render: (c: Collection) => (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditItem(c);
                }}
                className={LIST_ROW_ICON_BTN}
                title={t('common.edit')}
              >
                <Edit className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteError(null);
                  setDeleteItem(c);
                }}
                className={LIST_ROW_ICON_BTN_DANGER}
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {data ? t('catalog.collectionCount', { count: data.total }) : ''}
        </p>
        {canManage && (
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            {t('catalog.addCollection')}
          </Button>
        )}
      </div>

      <Card>
        <div className="flex gap-2">
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder={t('catalog.searchCollections')}
            submitMode
            onSubmit={handleSearch}
            showSubmitButton
            submitLabel={t('common.search')}
          />
        </div>
      </Card>

      <Card padding="none" className="flex flex-col min-h-0">
        <ScrollableListRegion aria-label={t('catalog.tabCollections')}>
          {isLoading && !(data?.items?.length) ? (
            <ListSkeleton rows={8} />
          ) : (
            <ResponsiveRecordList
              desktop={
                <Table
                  columns={columns}
                  data={data?.items ?? []}
                  keyExtractor={(c) => c.id ?? String(Math.random())}
                  isLoading={false}
                  emptyMessage={t('catalog.noCollections')}
                  onRowClick={onSelect ? (c) => c.id && onSelect(c.id, collName(c)) : undefined}
                />
              }
              mobile={
                (data?.items ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                    {t('catalog.noCollections')}
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2 divide-y divide-gray-100 dark:divide-gray-800">
                    {(data?.items ?? []).map((c) => (
                      <div
                        key={c.id ?? String(Math.random())}
                        className="flex items-stretch gap-2 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left flex items-center gap-2"
                          onClick={() => c.id && onSelect?.(c.id, collName(c))}
                        >
                          <Layers className="h-5 w-5 text-amber-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{collName(c)}</p>
                            {c.secondaryTitle && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.secondaryTitle}</p>
                            )}
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{c.issn ?? '—'}</p>
                          </div>
                        </button>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className={`${LIST_ROW_ICON_BTN} min-h-[2.75rem] min-w-[2.75rem]`}
                              title={t('common.edit')}
                              onClick={() => setEditItem(c)}
                            >
                              <Edit className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${LIST_ROW_ICON_BTN_DANGER} min-h-[2.75rem] min-w-[2.75rem]`}
                              title={t('common.delete')}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteItem(c);
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="self-center p-2 text-gray-400"
                          onClick={() => c.id && onSelect?.(c.id, collName(c))}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }
            />
          )}
        </ScrollableListRegion>
        {data && data.pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.page')} {page} / {data.pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(data.pageCount, p + 1))} disabled={page >= data.pageCount}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('catalog.addCollection')} size="md">
        <CollectionForm
          onSuccess={() => { setShowCreateModal(false); load(search, page); }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title={t('catalog.editCollection')} size="md">
        {editItem && (
          <CollectionForm
            initial={editItem}
            onSuccess={() => { setEditItem(null); load(search, page); }}
            onCancel={() => setEditItem(null)}
          />
        )}
      </Modal>

      {/* Delete modal */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => { if (!deleteLoading) { setDeleteItem(null); setDeleteError(null); } }}
        title={t('common.confirm')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDeleteItem(null); setDeleteError(null); }} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteLoading}>
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          {t('catalog.deleteCollectionConfirm', { name: deleteItem ? collName(deleteItem) : '' })}
        </p>
        {deleteError && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {deleteError}
          </div>
        )}
      </Modal>
    </div>
  );
}

interface CollectionFormProps {
  initial?: Collection;
  onSuccess: () => void;
  onCancel: () => void;
}

function CollectionForm({ initial, onSuccess, onCancel }: CollectionFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: initial?.name ?? '',
    secondaryTitle: initial?.secondaryTitle ?? '',
    tertiaryTitle: initial?.tertiaryTitle ?? '',
    issn: initial?.issn ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        secondaryTitle: formData.secondaryTitle.trim() || undefined,
        tertiaryTitle: formData.tertiaryTitle.trim() || undefined,
        issn: formData.issn.trim() || undefined,
      };
      if (initial?.id) {
        await api.updateCollection(initial.id, payload);
      } else {
        await api.createCollection(payload);
      }
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('catalog.collectionName')}
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Input
        label={t('catalog.collectionSecondaryTitle')}
        value={formData.secondaryTitle}
        onChange={(e) => setFormData({ ...formData, secondaryTitle: e.target.value })}
      />
      <Input
        label={t('catalog.collectionTertiaryTitle')}
        value={formData.tertiaryTitle}
        onChange={(e) => setFormData({ ...formData, tertiaryTitle: e.target.value })}
      />
      <Input
        label="ISSN"
        value={formData.issn}
        onChange={(e) => setFormData({ ...formData, issn: e.target.value })}
        placeholder="0000-0000"
      />
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" isLoading={isLoading}>{initial ? t('common.save') : t('common.create')}</Button>
      </div>
    </form>
  );
}

// ─── Series Tab ───────────────────────────────────────────────────────────────

const SERIES_PAGE_SIZE = 25;

interface SeriesTabProps {
  canManage: boolean;
  onSelect?: (id: string, name: string) => void;
}

function SeriesTab({ canManage, onSelect }: SeriesTabProps) {
  const { t } = useTranslation();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResponse<Serie> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editItem, setEditItem] = useState<Serie | null>(null);
  const [deleteItem, setDeleteItem] = useState<Serie | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (q: string, p: number) => {
    setIsLoading(true);
    try {
      const trimmed = q.trim();
      if (looksLikeEntityUuid(trimmed)) {
        const one = await api.getSerie(trimmed).catch(() => null);
        if (one) {
          setData({
            items: [one],
            total: 1,
            page: 1,
            perPage: SERIES_PAGE_SIZE,
            pageCount: 1,
          });
          return;
        }
      }
      const res = await api.getSeries({ name: q || undefined, page: p, perPage: SERIES_PAGE_SIZE });
      setData(res);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(search, page); }, [search, page, load]);

  const handleSearch = () => { setPage(1); setSearch(searchDraft); };

  const handleDelete = async () => {
    if (!deleteItem?.id) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.deleteSerie(deleteItem.id);
      setDeleteItem(null);
      load(search, page);
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, t));
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: t('catalog.serieName'),
      render: (s: Serie) => (
        <p className="font-medium text-gray-900 dark:text-white">{s.name ?? '—'}</p>
      ),
    },
    {
      key: 'issn',
      header: 'ISSN',
      render: (s: Serie) => <span className="text-gray-600 dark:text-gray-300">{s.issn ?? '—'}</span>,
      className: 'hidden md:table-cell',
    },
    {
      key: 'key',
      header: t('catalog.key'),
      render: (s: Serie) => <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{s.key ?? '—'}</span>,
      className: 'hidden lg:table-cell',
    },
    ...(canManage
      ? [{
          key: 'actions',
          header: '',
          align: 'right' as const,
          render: (s: Serie) => (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditItem(s);
                }}
                className={LIST_ROW_ICON_BTN}
                title={t('common.edit')}
              >
                <Edit className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteError(null);
                  setDeleteItem(s);
                }}
                className={LIST_ROW_ICON_BTN_DANGER}
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ),
        }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {data ? t('catalog.serieCount', { count: data.total }) : ''}
        </p>
        {canManage && (
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            {t('catalog.addSerie')}
          </Button>
        )}
      </div>

      <Card>
        <div className="flex gap-2">
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            placeholder={t('catalog.searchSeries')}
            submitMode
            onSubmit={handleSearch}
            showSubmitButton
            submitLabel={t('common.search')}
          />
        </div>
      </Card>

      <Card padding="none" className="flex flex-col min-h-0">
        <ScrollableListRegion aria-label={t('catalog.tabSeries')}>
          {isLoading && !(data?.items?.length) ? (
            <ListSkeleton rows={8} />
          ) : (
            <ResponsiveRecordList
              desktop={
                <Table
                  columns={columns}
                  data={data?.items ?? []}
                  keyExtractor={(s) => s.id ?? String(Math.random())}
                  isLoading={false}
                  emptyMessage={t('catalog.noSeries')}
                  onRowClick={onSelect ? (s) => s.id && onSelect(s.id, s.name ?? '') : undefined}
                />
              }
              mobile={
                (data?.items ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400 px-4">
                    {t('catalog.noSeries')}
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 mx-2 sm:mx-4 mb-2 divide-y divide-gray-100 dark:divide-gray-800">
                    {(data?.items ?? []).map((s) => (
                      <div
                        key={s.id ?? String(Math.random())}
                        className="flex items-stretch gap-2 p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left flex items-center gap-2"
                          onClick={() => s.id && onSelect?.(s.id, s.name ?? '')}
                        >
                          <BookMarked className="h-5 w-5 text-amber-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">{s.name ?? '—'}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-300">{s.issn ?? '—'}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{s.key ?? '—'}</p>
                          </div>
                        </button>
                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              className={`${LIST_ROW_ICON_BTN} min-h-[2.75rem] min-w-[2.75rem]`}
                              title={t('common.edit')}
                              onClick={() => setEditItem(s)}
                            >
                              <Edit className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`${LIST_ROW_ICON_BTN_DANGER} min-h-[2.75rem] min-w-[2.75rem]`}
                              title={t('common.delete')}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteItem(s);
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          className="self-center p-2 text-gray-400"
                          onClick={() => s.id && onSelect?.(s.id, s.name ?? '')}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }
            />
          )}
        </ScrollableListRegion>
        {data && data.pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t('common.page')} {page} / {data.pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(data.pageCount, p + 1))} disabled={page >= data.pageCount}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Create modal */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title={t('catalog.addSerie')} size="md">
        <SerieForm
          onSuccess={() => { setShowCreateModal(false); load(search, page); }}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title={t('catalog.editSerie')} size="md">
        {editItem && (
          <SerieForm
            initial={editItem}
            onSuccess={() => { setEditItem(null); load(search, page); }}
            onCancel={() => setEditItem(null)}
          />
        )}
      </Modal>

      {/* Delete modal */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => { if (!deleteLoading) { setDeleteItem(null); setDeleteError(null); } }}
        title={t('common.confirm')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setDeleteItem(null); setDeleteError(null); }} disabled={deleteLoading}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleteLoading}>
              {t('common.delete')}
            </Button>
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-300 text-sm">
          {t('catalog.deleteSerieConfirm', { name: deleteItem?.name ?? '' })}
        </p>
        {deleteError && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {deleteError}
          </div>
        )}
      </Modal>
    </div>
  );
}

interface SerieFormProps {
  initial?: Serie;
  onSuccess: () => void;
  onCancel: () => void;
}

function SerieForm({ initial, onSuccess, onCancel }: SerieFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: initial?.name ?? '',
    issn: initial?.issn ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        name: formData.name.trim(),
        issn: formData.issn.trim() || undefined,
      };
      if (initial?.id) {
        await api.updateSerie(initial.id, payload);
      } else {
        await api.createSerie(payload);
      }
      onSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('catalog.serieName')}
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Input
        label="ISSN"
        value={formData.issn}
        onChange={(e) => setFormData({ ...formData, issn: e.target.value })}
        placeholder="0000-0000"
      />
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" isLoading={isLoading}>{initial ? t('common.save') : t('common.create')}</Button>
      </div>
    </form>
  );
}
