import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, BookOpen, Filter, Search, Globe, Loader2, AlertCircle, CheckCircle, Video, Music, Image, FileText, Disc, Newspaper, Trash2 } from 'lucide-react';
import { Card, Button, Table, Badge, SearchInput, Modal, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems, type MediaType, type MediaTypeOption } from '@/types';
import api from '@/services/api';
import type { ItemShort, Author, Z3950Server, ImportReport, DuplicateConfirmationRequired, Source } from '@/types';
import CallNumberField from '@/components/specimen/CallNumberField';
import { buildSuggestedCallNumber, validateCallNumber } from '@/utils/callNumber';
import { LANG_OPTIONS, FUNCTION_OPTIONS, PUBLIC_TYPE_OPTIONS } from '@/utils/codeLabels';
import { getApiErrorMessage } from '@/utils/apiError';
import type { AxiosError } from 'axios';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';

const PAGE_SIZE = 20;

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<any>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existing_id !== 'string') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
}

export default function ItemsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

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

  // Filters – init from URL so returning from item detail restores search
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('freesearch') ?? '');
  const [searchQueryDraft, setSearchQueryDraft] = useState(() => searchParams.get('freesearch') ?? '');
  const [mediaType, setMediaType] = useState<MediaType | ''>(
    () => (searchParams.get('media_type') || '') as MediaType | ''
  );
  const [audienceType, setAudienceType] = useState<string>(() => searchParams.get('audience_type') ?? '');
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState(() => ({
    title: searchParams.get('title') ?? '',
    author: searchParams.get('author') ?? '',
    isbn: searchParams.get('isbn') ?? '',
  }));
  const [advancedFiltersDraft, setAdvancedFiltersDraft] = useState(() => ({
    title: searchParams.get('title') ?? '',
    author: searchParams.get('author') ?? '',
    isbn: searchParams.get('isbn') ?? '',
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
      'items',
      {
        searchQuery,
        mediaType,
        audienceType,
        advancedFilters,
        showFilters,
      },
    ],
    queryFn: async ({ pageParam }) => {
      return api.getItems({
        freesearch: !showFilters ? (searchQuery || undefined) : undefined,
        media_type: mediaType || undefined,
        audience_type: audienceType || undefined,
        title: showFilters ? (advancedFilters.title || undefined) : undefined,
        author: showFilters ? (advancedFilters.author || undefined) : undefined,
        isbn: showFilters ? (advancedFilters.isbn || undefined) : undefined,
        page: pageParam,
        per_page: PAGE_SIZE,
      });
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.items?.length) return undefined;
      const loaded = lastPage.page * lastPage.per_page;
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

  // Restore last search from sessionStorage when (re)entering the page
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('itemsPageState');
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        searchQuery?: string;
        mediaType?: MediaType | '';
        audienceType?: string;
        advancedFilters?: { title?: string; author?: string; isbn?: string };
      };
      if (typeof saved.searchQuery === 'string') {
        setSearchQuery(saved.searchQuery);
        setSearchQueryDraft(saved.searchQuery);
      }
      if (typeof saved.mediaType === 'string') setMediaType(saved.mediaType as MediaType | '');
      if (typeof saved.audienceType === 'string') setAudienceType(saved.audienceType);
      if (saved.advancedFilters && typeof saved.advancedFilters === 'object') {
        const merged = (prev: { title: string; author: string; isbn: string }) => ({
          ...prev,
          ...saved.advancedFilters,
        });
        setAdvancedFilters(merged);
        setAdvancedFiltersDraft(merged);
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Persist search state in URL + sessionStorage so it survives navigation
  useEffect(() => {
    const next = new URLSearchParams();
    if (searchQuery) next.set('freesearch', searchQuery);
    if (mediaType) next.set('media_type', mediaType);
    if (audienceType) next.set('audience_type', audienceType);
    if (advancedFilters.title) next.set('title', advancedFilters.title);
    if (advancedFilters.author) next.set('author', advancedFilters.author);
    if (advancedFilters.isbn) next.set('isbn', advancedFilters.isbn);
    setSearchParams(next, { replace: true });

    try {
      sessionStorage.setItem(
        'itemsPageState',
        JSON.stringify({
          searchQuery,
          mediaType,
          audienceType,
          advancedFilters,
        })
      );
    } catch {
      // ignore quota / storage errors
    }
  }, [searchQuery, mediaType, audienceType, advancedFilters, setSearchParams]);

  const handleApplySearch = () => {
    const nextQuery = searchQueryDraft;
    setSearchQuery(nextQuery);
    if (showFilters) setAdvancedFilters({ ...advancedFiltersDraft });
    queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const handleRowClick = (item: ItemShort) => {
    navigate(`/items/${item.id}`);
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
      render: (item: ItemShort) => (
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
      render: (item: ItemShort) => (
        <span className="text-gray-600 dark:text-gray-300">
          {formatAuthor(item.author)}
        </span>
      ),
    },
    {
      key: 'specimens',
      header: t('items.specimens'),
      render: (item: ItemShort) => {
        const list = item.specimens ?? [];
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
      render: (item: ItemShort) => item.date || '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (item: ItemShort) => getStatusBadge(item.status),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('items.title')}</h1>
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
                  queryClient.invalidateQueries({ queryKey: ['items'] });
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
            queryClient.invalidateQueries({ queryKey: ['items'] });
          }}
          onClose={() => setShowCreateModal(false)}
        />
      </Modal>
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
  const [formData, setFormData] = useState<{
    title: string;
    isbn: string;
    media_type: MediaType;
    publication_date: string;
    abstract_: string;
    keywords: string;
    subject: string;
    audience_type: string;
    lang: string;
    edition_publisher: string;
    edition_place: string;
    edition_date: string;
    authors: AuthorForm[];
    collection_id: string;
    collection_primary_title: string;
    seriesList: { id: string; name: string; volume: string }[];
  }>({
    title: '',
    isbn: '',
    media_type: 'printedText',
    publication_date: '',
    abstract_: '',
    keywords: '',
    subject: '',
    audience_type: '',
    lang: '',
    edition_publisher: '',
    edition_place: '',
    edition_date: '',
    authors: [],
    collection_id: '',
    collection_primary_title: '',
    seriesList: [],
  });

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
        const existing = await api.getItem(existingId);
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

      if (response.items && response.items.length > 0) {
        const item = response.items[0];
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
          seriesList: item.series && item.series.length > 0
            ? item.series.map((s) => ({ id: s.id ?? '', name: s.name ?? '', volume: s.volumeNumber?.toString() ?? '' }))
            : prev.seriesList,
          collection_id: item.collection?.id || prev.collection_id,
          collection_primary_title: item.collection?.primary_title || prev.collection_primary_title,
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
        collection: formData.collection_id
          ? { id: formData.collection_id, primary_title: formData.collection_primary_title || undefined }
          : undefined,
        series: formData.seriesList
          .filter((s) => s.name || s.id)
          .map((s) => ({ id: s.id || null, name: s.name || undefined, volumeNumber: s.volume ? parseInt(s.volume, 10) : undefined })),
        ...(specimenPayload?.length ? { specimens: specimenPayload } : {}),
      };
      const created = await api.createItem(payload);
      setCreatedItemId(created.item.id ?? null);
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
        collection: formData.collection_id
          ? { id: formData.collection_id, primary_title: formData.collection_primary_title || undefined }
          : undefined,
        series: formData.seriesList
          .filter((s) => s.name || s.id)
          .map((s) => ({ id: s.id || null, name: s.name || undefined, volumeNumber: s.volume ? parseInt(s.volume, 10) : undefined })),
        ...(specimenPayload?.length ? { specimens: specimenPayload } : {}),
      };
      const created = await api.createItem(payload, { confirmReplaceExistingId: confirmReplaceModal.existingId });
      setConfirmReplaceModal(null);
      setCreatedItemId(created.item.id ?? null);
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
        collection: formData.collection_id
          ? { id: formData.collection_id, primary_title: formData.collection_primary_title || undefined }
          : undefined,
        series: formData.seriesList
          .filter((s) => s.name || s.id)
          .map((s) => ({ id: s.id || null, name: s.name || undefined, volumeNumber: s.volume ? parseInt(s.volume, 10) : undefined })),
        ...(specimenPayload?.length ? { specimens: specimenPayload } : {}),
      };
      const created = await api.createItem(payload, { allowDuplicateIsbn: true });
      setConfirmReplaceModal(null);
      setCreatedItemId(created.item.id ?? null);
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('items.collectionId')}
              value={formData.collection_id}
              onChange={(e) => setFormData({ ...formData, collection_id: e.target.value })}
              placeholder="ID"
            />
            <Input
              label={t('items.collectionPrimaryTitle')}
              value={formData.collection_primary_title}
              onChange={(e) => setFormData({ ...formData, collection_primary_title: e.target.value })}
              placeholder={t('items.seriesName')}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('items.series')}</span>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, seriesList: [...formData.seriesList, { id: '', name: '', volume: '' }] })}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                + {t('items.addSeries')}
              </button>
            </div>
            {formData.seriesList.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={s.name}
                  onChange={(e) => {
                    const next = [...formData.seriesList];
                    next[i] = { ...next[i], name: e.target.value };
                    setFormData({ ...formData, seriesList: next });
                  }}
                  placeholder={t('items.seriesName')}
                  className="flex-1"
                />
                <Input
                  value={s.volume}
                  onChange={(e) => {
                    const next = [...formData.seriesList];
                    next[i] = { ...next[i], volume: e.target.value };
                    setFormData({ ...formData, seriesList: next });
                  }}
                  placeholder="n°"
                  className="w-20"
                />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, seriesList: formData.seriesList.filter((_, j) => j !== i) })}
                  className="text-gray-400 hover:text-red-500"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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
