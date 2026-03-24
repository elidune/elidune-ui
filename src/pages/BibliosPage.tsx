import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, Filter, Search, Globe, Loader2, AlertCircle, CheckCircle, Video, Music, Image, FileText, Disc, Newspaper, Trash2, Layers, BookMarked, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, Button, Table, Badge, SearchInput, Modal, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems, type MediaType, type MediaTypeOption, type Serie, type Collection } from '@/types';
import api from '@/services/api';
import type { BiblioShort, Author, Z3950Server, ImportReport, DuplicateConfirmationRequired, Source, PaginatedResponse } from '@/types';
import CallNumberField from '@/components/specimen/CallNumberField';
import { buildSuggestedCallNumber, validateCallNumber } from '@/utils/callNumber';
import { LANG_OPTIONS, FUNCTION_OPTIONS, PUBLIC_TYPE_OPTIONS } from '@/utils/codeLabels';
import { getApiErrorMessage } from '@/utils/apiError';
import type { AxiosError } from 'axios';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { EntityLinker } from '@/components/items/EntityLinker';

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

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<Record<string, unknown>>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existing_id !== 'string') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
}

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

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);

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
    queryFn: async ({ pageParam }) => {
      return api.getBiblios({
        freesearch: !showFilters ? (searchQuery || undefined) : undefined,
        media_type: mediaType || undefined,
        audience_type: audienceType || undefined,
        title: showFilters ? (advancedFilters.title || undefined) : undefined,
        author: showFilters ? (advancedFilters.author || undefined) : undefined,
        isbn: showFilters ? (advancedFilters.isbn || undefined) : undefined,
        serie_id: activeFilterSerieId || undefined,
        collection_id: activeFilterCollectionId || undefined,
        page: pageParam,
        per_page: PAGE_SIZE,
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

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = loadMoreRef.current;
    const scrollRoot = el?.closest('.items-list-scroll') ?? null;
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

  const handleRowClick = (item: BiblioShort) => {
    const savedSearch: SavedSearch = {
      searchQuery, mediaType, audienceType, showFilters, advancedFilters,
      serieId: activeFilterSerieId, serieName: activeFilterSerieName,
      collectionId: activeFilterCollectionId, collectionName: activeFilterCollectionName,
    };
    navigate(`/biblios/${item.id}`, { state: { savedSearch } });
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
          <div className={`flex-shrink-0 h-10 w-10 rounded-lg ${getMediaTypeBgColor(item.media_type as MediaType)} flex items-center justify-center`}>
            {getMediaTypeIcon(item.media_type as MediaType)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {item.title || t('items.notSpecified')}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
              {item.isbn}
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
        const available = list.filter((s) => s.availability === 0).length;
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
      render: (item: BiblioShort) => getStatusBadge(item.status),
    },
  ];

  const canManage = canManageItems(user?.account_type);

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
        {canManageItems(user?.account_type) && (
          <Button onClick={() => setShowCreateModal(true)} leftIcon={<Plus className="h-4 w-4" />}>
            {t('items.add')}
          </Button>
        )}
      </div>

      {/* Search and filters */}
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

      {/* Items list: fixed-height scroll area so header/filters stay static */}
      <Card padding="none" className="flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-300 flex justify-end">
          <span>{t('items.count', { count: totalItems })}</span>
        </div>
        <div
          className="items-list-scroll overflow-auto max-h-[calc(100vh-18rem)]"
          aria-label={t('items.title')}
        >
          <Table
            columns={columns}
            data={items}
            keyExtractor={(item) => item.id}
            onRowClick={handleRowClick}
            isLoading={isItemsLoading}
            emptyMessage={t('items.noItems')}
          />
          <div ref={loadMoreRef} className="h-4 flex-shrink-0" aria-hidden />
          {isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('common.loading')}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Create modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('items.add')}
        size="lg"
      >
        <CreateItemForm
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['biblios'] });
          }}
          onClose={() => setShowCreateModal(false)}
        />
      </Modal>

      </>)}
    </div>
  );
}

interface CreateItemFormProps {
  onCreated: () => void;
  onClose: () => void;
}

function CreateItemForm({ onCreated, onClose }: CreateItemFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [confirmReplaceModal, setConfirmReplaceModal] = useState<{
    existingId: string;
    isbn?: string;
    existingTitle?: string | null;
  } | null>(null);
  const [confirmReplaceLoading, setConfirmReplaceLoading] = useState(false);
  const [confirmReplaceError, setConfirmReplaceError] = useState<string | null>(null);
  type AuthorForm = { id: string; lastname: string; firstname: string; function: string };
  const [formData, setFormData] = useState({
    title: '',
    isbn: '',
    media_type: 'printedText' as MediaType,
    publication_date: '',
    abstract_: '',
    keywords: '',
    subject: '',
    audience_type: '',
    lang: '',
    edition_publisher: '',
    edition_place: '',
    edition_date: '',
    authors: [] as AuthorForm[],
  });
  const [linkedCollections, setLinkedCollections] = useState<{ id?: string; name: string; volumeNumber?: string }[]>([]);
  const [linkedSeries, setLinkedSeries] = useState<{ id?: string; name: string; volumeNumber?: string }[]>([]);

  const updateAuthor = (index: number, field: keyof AuthorForm, value: string) => {
    const arr = [...formData.authors];
    arr[index] = { ...arr[index], [field]: value };
    setFormData({ ...formData, authors: arr });
  };
  const addAuthor = () => {
    setFormData({
      ...formData,
      authors: [...formData.authors, { id: '', lastname: '', firstname: '', function: '' }],
    });
  };
  const removeAuthor = (index: number) => {
    setFormData({ ...formData, authors: formData.authors.filter((_, i) => i !== index) });
  };

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

  // Z3950 search states
  const [z3950Servers, setZ3950Servers] = useState<Z3950Server[]>([]);
  const [isSearchingZ3950, setIsSearchingZ3950] = useState(false);
  const [z3950Message, setZ3950Message] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sources and specimens (optional when creating item)
  const [sources, setSources] = useState<Source[]>([]);
  const [specimens, setSpecimens] = useState<{ barcode: string; call_number: string; source_id: string }[]>([
    { barcode: '', call_number: '', source_id: '' },
  ]);

  const MEDIA_TYPES: MediaTypeOption[] = [
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

  // Load Z39.50 servers and sources on mount
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const settings = await api.getSettings();
        const activeServers = (settings.z3950_servers || []).filter(s => s.is_active);
        setZ3950Servers(activeServers);
      } catch (error) {
        console.error('Error fetching Z39.50 servers:', error);
      }
    };
    const fetchSources = async () => {
      try {
        const list = await api.getSources(false);
        setSources(list);
        const defaultId = list.find((s) => s.default)?.id ?? list[0]?.id ?? '';
        setSpecimens((prev) =>
          prev.length === 1 && prev[0].source_id === '' && defaultId
            ? [{ ...prev[0], source_id: defaultId }]
            : prev
        );
      } catch (error) {
        console.error('Error fetching sources:', error);
      }
    };
    fetchServers();
    fetchSources();
  }, []);

  const handleZ3950Search = async () => {
    if (!formData.isbn.trim()) {
      setZ3950Message({ type: 'error', text: t('z3950.isbnRequired') });
      return;
    }

    if (z3950Servers.length === 0) {
      setZ3950Message({ type: 'error', text: t('z3950.noServers') });
      return;
    }

    setIsSearchingZ3950(true);
    setZ3950Message(null);

    try {
      // Use first active server
      const response = await api.searchZ3950({
        isbn: formData.isbn,
        server_id: z3950Servers[0].id,
        max_results: 1,
      });

      if (response.biblios && response.biblios.length > 0) {
        const item = response.biblios[0];
        setFormData((prev) => ({
          ...prev,
          isbn: item.isbn || prev.isbn,
          title: item.title || prev.title,
          media_type: (item.media_type || prev.media_type) as MediaType,
          publication_date: item.publication_date || prev.publication_date,
          subject: item.subject || prev.subject,
          abstract_: item.abstract_ || prev.abstract_,
          keywords: item.keywords || prev.keywords,
          audience_type: item.audience_type || prev.audience_type,
          lang: item.lang || prev.lang,
          edition_publisher: item.edition?.publisher_name || prev.edition_publisher,
          edition_place: item.edition?.place_of_publication || prev.edition_place,
          edition_date: item.edition?.date || prev.edition_date,
          authors:
            item.authors && item.authors.length > 0
              ? item.authors.map((a) => ({
                  id: a.id || '',
                  lastname: a.lastname || '',
                  firstname: a.firstname || '',
                  function: a.function || '',
                }))
              : prev.authors,
        }));
        // Populate linked series from Z3950 result
        if (item.series && item.series.length > 0) {
          setLinkedSeries(item.series.map((s) => ({
            id: s.id ?? undefined,
            name: s.name ?? '',
            volumeNumber: (s.volume_number ?? s.volumeNumber)?.toString() ?? '',
          })));
        }
        // Populate linked collections from Z3950 result
        const firstColl = item.collections?.[0] ?? item.collection;
        if (firstColl) {
          setLinkedCollections([{
            id: firstColl.id ?? undefined,
            name: firstColl.name ?? firstColl.primary_title ?? '',
            volumeNumber: (firstColl.volume_number ?? firstColl.volumeNumber)?.toString() ?? '',
          }]);
        }
        setZ3950Message({ type: 'success', text: t('z3950.dataFound') });
      } else {
        setZ3950Message({ type: 'error', text: t('z3950.noResults') });
      }
    } catch (error) {
      console.error('Error searching Z39.50:', error);
      setZ3950Message({ type: 'error', text: t('z3950.searchError') });
    } finally {
      setIsSearchingZ3950(false);
    }
  };

  const buildLinkedPayload = () => {
    const series = linkedSeries
      .filter((s) => s.name.trim())
      .map((s) => ({
        id: s.id || null,
        name: s.name.trim() || undefined,
        volume_number: s.volumeNumber ? parseInt(s.volumeNumber, 10) : undefined,
      }));
    const collections = linkedCollections
      .filter((c) => c.name.trim())
      .map((c) => ({
        id: c.id || null,
        name: c.name.trim() || undefined,
        volume_number: c.volumeNumber ? parseInt(c.volumeNumber, 10) : undefined,
      }));
    return { series, collections };
  };

  const buildSpecimensPayload = (): { barcode: string; call_number?: string; source_id: string }[] | undefined => {
    const filled = specimens.filter((s) => s.source_id.trim() !== '' && s.barcode.trim() !== '');
    if (filled.length === 0) return undefined;
    return filled.map((s) => ({
      barcode: s.barcode.trim(),
      call_number: s.call_number.trim() || undefined,
      source_id: s.source_id,
    }));
  };

  const handleAddSpecimen = () => {
    setSpecimens([...specimens, { barcode: '', call_number: '', source_id: sources.find((s) => s.default)?.id ?? sources[0]?.id ?? '' }]);
  };

  const handleRemoveSpecimen = (index: number) => {
    if (specimens.length <= 1) return;
    setSpecimens(specimens.filter((_, i) => i !== index));
  };

  const handleSpecimenChange = (index: number, field: 'barcode' | 'call_number' | 'source_id', value: string) => {
    const next = [...specimens];
    next[index] = { ...next[index], [field]: value };
    setSpecimens(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() === '') return;
    const invalidCallNumber = specimens.find((s) => s.call_number.trim() !== '' && !validateCallNumber(s.call_number));
    if (invalidCallNumber) return;
    const specimenPayload = buildSpecimensPayload();
    if (specimenPayload?.some((s) => !s.source_id)) return;
    setIsLoading(true);
    try {
      const authorsPayload: Author[] = formData.authors.map((a) => ({
        id: a.id,
        lastname: a.lastname || undefined,
        firstname: a.firstname || undefined,
        function: a.function || undefined,
      }));
      const payload = {
        title: formData.title,
        isbn: formData.isbn || undefined,
        media_type: formData.media_type,
        publication_date: formData.publication_date || undefined,
        abstract_: formData.abstract_ || undefined,
        keywords: formData.keywords || undefined,
        subject: formData.subject || undefined,
        audience_type: formData.audience_type || undefined,
        lang: formData.lang || undefined,
        edition:
          formData.edition_publisher || formData.edition_place || formData.edition_date
            ? {
                id: null,
                publisher_name: formData.edition_publisher || undefined,
                place_of_publication: formData.edition_place || undefined,
                date: formData.edition_date || undefined,
              }
            : undefined,
        authors: authorsPayload,
        ...buildLinkedPayload(),
        ...(specimenPayload?.length ? { items: specimenPayload } : {}),
      };
      const created = await api.createBiblio(payload);
      setCreatedItemId(created.biblio.id ?? null);
      setImportReport(created.import_report);
      onCreated();
    } catch (error) {
      const confirm = getDuplicateConfirmationRequired(error);
      if (confirm) {
        setConfirmReplaceError(null);
        setConfirmReplaceModal({
          existingId: confirm.existing_id,
          isbn: formData.isbn || undefined,
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
    if (!confirmReplaceModal) return;
    const specimenPayload = buildSpecimensPayload();
    setConfirmReplaceLoading(true);
    setConfirmReplaceError(null);
    try {
      const authorsPayload: Author[] = formData.authors.map((a) => ({
        id: a.id,
        lastname: a.lastname || undefined,
        firstname: a.firstname || undefined,
        function: a.function || undefined,
      }));
      const payload = {
        title: formData.title,
        isbn: formData.isbn || undefined,
        media_type: formData.media_type,
        publication_date: formData.publication_date || undefined,
        abstract_: formData.abstract_ || undefined,
        keywords: formData.keywords || undefined,
        subject: formData.subject || undefined,
        audience_type: formData.audience_type || undefined,
        lang: formData.lang || undefined,
        edition:
          formData.edition_publisher || formData.edition_place || formData.edition_date
            ? {
                id: null,
                publisher_name: formData.edition_publisher || undefined,
                place_of_publication: formData.edition_place || undefined,
                date: formData.edition_date || undefined,
              }
            : undefined,
        authors: authorsPayload,
        ...buildLinkedPayload(),
        ...(specimenPayload?.length ? { items: specimenPayload } : {}),
      };
      const created = await api.createBiblio(payload, { confirmReplaceExistingId: confirmReplaceModal.existingId });
      setConfirmReplaceModal(null);
      setCreatedItemId(created.biblio.id ?? null);
      setImportReport(created.import_report);
      onCreated();
    } catch (err) {
      console.error('Error confirming replace existing item:', err);
      setConfirmReplaceError(getApiErrorMessage(err, t));
    } finally {
      setConfirmReplaceLoading(false);
    }
  };

  const handleCreateNewDuplicateIsbn = async () => {
    if (!confirmReplaceModal) return;
    const specimenPayload = buildSpecimensPayload();
    setConfirmReplaceLoading(true);
    setConfirmReplaceError(null);
    try {
      const authorsPayload: Author[] = formData.authors.map((a) => ({
        id: a.id,
        lastname: a.lastname || undefined,
        firstname: a.firstname || undefined,
        function: a.function || undefined,
      }));
      const payload = {
        title: formData.title,
        isbn: formData.isbn || undefined,
        media_type: formData.media_type,
        publication_date: formData.publication_date || undefined,
        abstract_: formData.abstract_ || undefined,
        keywords: formData.keywords || undefined,
        subject: formData.subject || undefined,
        audience_type: formData.audience_type || undefined,
        lang: formData.lang || undefined,
        edition:
          formData.edition_publisher || formData.edition_place || formData.edition_date
            ? {
                id: null,
                publisher_name: formData.edition_publisher || undefined,
                place_of_publication: formData.edition_place || undefined,
                date: formData.edition_date || undefined,
              }
            : undefined,
        authors: authorsPayload,
        ...buildLinkedPayload(),
        ...(specimenPayload?.length ? { items: specimenPayload } : {}),
      };
      const created = await api.createBiblio(payload, { allowDuplicateIsbn: true });
      setConfirmReplaceModal(null);
      setCreatedItemId(created.biblio.id ?? null);
      setImportReport(created.import_report);
      onCreated();
    } catch (err) {
      console.error('Error creating item with duplicate ISBN:', err);
      setConfirmReplaceError(getApiErrorMessage(err, t));
    } finally {
      setConfirmReplaceLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {createdItemId ? (
        <div className="text-center py-4">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('common.success')}
          </h3>
          {importReport && (
            <div className="mx-auto max-w-xl text-left mb-4 p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <div className="text-sm font-medium text-green-900 dark:text-green-200">
                {importReport.message || importReport.action}
                {importReport.existing_id != null ? ` (ID: ${importReport.existing_id})` : ''}
              </div>
              {importReport.warnings?.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-green-800 dark:text-green-300 space-y-1">
                  {importReport.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('items.isbn')}
        </label>
        <div className="flex gap-2">
          <Input
            value={formData.isbn}
            onChange={(e) => {
              setFormData({ ...formData, isbn: e.target.value });
              setZ3950Message(null);
            }}
            placeholder={t('z3950.isbnPlaceholder')}
            className="flex-1"
          />
          {z3950Servers.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleZ3950Search}
              disabled={isSearchingZ3950 || !formData.isbn.trim()}
              leftIcon={isSearchingZ3950 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              title={t('z3950.searchButton')}
              className="flex-shrink-0"
            >
              {t('z3950.searchButton')}
            </Button>
          )}
        </div>
      </div>

      <Input
        label={t('items.titleField')}
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        required
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('items.mediaTypeLabel')}
          </label>
          <select
            value={formData.media_type}
            onChange={(e) => setFormData({ ...formData, media_type: e.target.value as MediaType })}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            {MEDIA_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={t('items.publicationDate')}
          value={formData.publication_date}
          onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
          placeholder="YYYY"
        />
      </div>
      
      {/* Z39.50 search message */}
      {z3950Message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          z3950Message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
        }`}>
          {z3950Message.type === 'success' ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{z3950Message.text}</span>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.abstract')}
        </label>
        <textarea
          value={formData.abstract_}
          onChange={(e) => setFormData({ ...formData, abstract_: e.target.value })}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
      </div>
      <Input
        label={t('items.keywords')}
        value={formData.keywords}
        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
        placeholder={t('items.keywordsHint')}
      />
      <Input
        label={t('items.subject')}
        value={formData.subject}
        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
      />

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {showAdvanced ? t('common.hide') : t('items.advancedBibliographic')}
        </button>
      </div>

      {showAdvanced && (
        <div className="space-y-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('items.publicType')}
              </label>
              <select
                value={formData.audience_type}
                onChange={(e) => setFormData({ ...formData, audience_type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">{t('items.notSpecified')}</option>
                {PUBLIC_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('items.language')}
              </label>
              <select
                value={formData.lang}
                onChange={(e) => setFormData({ ...formData, lang: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              >
                <option value="">{t('items.notSpecified')}</option>
                {LANG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/30">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('items.editionInfo')}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label={t('items.publisher')}
                value={formData.edition_publisher}
                onChange={(e) => setFormData({ ...formData, edition_publisher: e.target.value })}
              />
              <Input
                label={t('items.publicationPlace')}
                value={formData.edition_place}
                onChange={(e) => setFormData({ ...formData, edition_place: e.target.value })}
              />
              <Input
                label={t('items.editionDate')}
                value={formData.edition_date}
                onChange={(e) => setFormData({ ...formData, edition_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('items.authors')}</span>
              <Button type="button" size="sm" variant="secondary" onClick={addAuthor} leftIcon={<Plus className="h-3 w-3" />}>
                {t('common.add')}
              </Button>
            </div>
            {formData.authors.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('items.notSpecified')}</p>
            ) : (
              formData.authors.map((author, index) => (
                <div key={index} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                  <Input
                    placeholder={t('items.authorLastname')}
                    value={author.lastname}
                    onChange={(e) => updateAuthor(index, 'lastname', e.target.value)}
                    className="flex-1 min-w-[100px]"
                  />
                  <Input
                    placeholder={t('items.authorFirstname')}
                    value={author.firstname}
                    onChange={(e) => updateAuthor(index, 'firstname', e.target.value)}
                    className="flex-1 min-w-[100px]"
                  />
                  <select
                    value={author.function}
                    onChange={(e) => updateAuthor(index, 'function', e.target.value)}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm min-w-[120px]"
                  >
                    <option value="">{t('items.notSpecified')}</option>
                    {FUNCTION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeAuthor(index)}
                    className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <EntityLinker
            label={t('items.collection')}
            addLabel={t('catalog.searchOrCreateCollection')}
            entries={linkedCollections}
            onChange={setLinkedCollections}
            onSearch={async (q) => {
              const res = await api.getCollections({ name: q, perPage: 10 });
              return res.items.map((c) => ({ id: c.id ?? '', name: c.name ?? c.primary_title ?? '' }));
            }}
            volumeLabel={t('catalog.volumeNumber')}
          />

          <EntityLinker
            label={t('items.series')}
            addLabel={t('catalog.searchOrCreateSerie')}
            entries={linkedSeries}
            onChange={setLinkedSeries}
            onSearch={async (q) => {
              const res = await api.getSeries({ name: q, perPage: 10 });
              return res.items.map((s) => ({ id: s.id ?? '', name: s.name ?? '' }));
            }}
            volumeLabel={t('catalog.volumeNumber')}
          />
        </div>
      )}

      {/* Optional specimens: add one or more with source per specimen */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('items.specimensOptional')}
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={handleAddSpecimen} leftIcon={<Plus className="h-4 w-4" />}>
            {t('items.addSpecimen')}
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t('items.specimensOptionalHint')}</p>
        <div className="space-y-3">
          {specimens.map((specimen, index) => (
            <div key={index} className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder={t('items.specimenBarcode')}
                  value={specimen.barcode}
                  onChange={(e) => handleSpecimenChange(index, 'barcode', e.target.value)}
                />
                <CallNumberField
                  value={specimen.call_number}
                  onChange={(v) => handleSpecimenChange(index, 'call_number', v)}
                  suggestedValue={buildSuggestedCallNumber({
                    categoryCode: 'GEN',
                    year: formData.publication_date,
                  })}
                  placeholder={t('items.callNumber')}
                  inputId={`create-specimen-call-${index}`}
                />
                <div>
                  <select
                    value={specimen.source_id}
                    onChange={(e) => handleSpecimenChange(index, 'source_id', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  >
                    <option value="">{t('items.selectSource')}</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name || src.id}
                        {src.default ? ` (${t('importMarc.default')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {specimens.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveSpecimen(index)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" isLoading={isLoading}>
          {t('common.create')}
        </Button>
      </div>
        </form>
      )}

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
                isbn: confirmReplaceModal.isbn || '-',
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

// ─── Collections Tab ─────────────────────────────────────────────────────────

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
    c.name ?? c.primary_title ?? c.secondary_title ?? '—';

  const columns = [
    {
      key: 'name',
      header: t('catalog.collectionName'),
      render: (c: Collection) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{collName(c)}</p>
          {(c.secondary_title ?? c.secondaryTitle) && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {c.secondary_title ?? c.secondaryTitle}
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
          render: (c: Collection) => (
            <div className="flex justify-end gap-1">
              <button onClick={(e) => { e.stopPropagation(); setEditItem(c); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <Edit className="h-4 w-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteItem(c); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-500">
                <Trash2 className="h-4 w-4" />
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

      <Card padding="none">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(c) => c.id ?? String(Math.random())}
          isLoading={isLoading}
          emptyMessage={t('catalog.noCollections')}
          onRowClick={onSelect ? (c) => c.id && onSelect(c.id, collName(c)) : undefined}
        />
        {data && data.pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
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
    name: initial?.name ?? initial?.primary_title ?? '',
    secondaryTitle: initial?.secondaryTitle ?? initial?.secondary_title ?? '',
    tertiaryTitle: initial?.tertiaryTitle ?? initial?.tertiary_title ?? '',
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
          render: (s: Serie) => (
            <div className="flex justify-end gap-1">
              <button onClick={(e) => { e.stopPropagation(); setEditItem(s); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
                <Edit className="h-4 w-4" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteItem(s); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-500">
                <Trash2 className="h-4 w-4" />
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

      <Card padding="none">
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(s) => s.id ?? String(Math.random())}
          isLoading={isLoading}
          emptyMessage={t('catalog.noSeries')}
          onRowClick={onSelect ? (s) => s.id && onSelect(s.id, s.name ?? '') : undefined}
        />
        {data && data.pageCount > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
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
