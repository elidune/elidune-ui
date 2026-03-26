import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Globe, Loader2, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input, Button } from '@/components/common';
import CallNumberField from '@/components/specimen/CallNumberField';
import { buildSuggestedCallNumber, validateCallNumber } from '@/utils/callNumber';
import api from '@/services/api';
import type { Author, Biblio, CreateBiblioItemInput, MediaType, MediaTypeOption, Source, Z3950Server, Serie, Collection } from '@/types';
import { LANG_OPTIONS, FUNCTION_OPTIONS, PUBLIC_TYPE_OPTIONS } from '@/utils/codeLabels';
import { formatIsbnDisplay, stripIsbnForZ3950Query } from '@/utils/isbnDisplay';
import { EntityLinker, type LinkedEntry } from './EntityLinker';

export type CreateBiblioPayload = Omit<Partial<Biblio>, 'items'> & { items?: CreateBiblioItemInput[] };

export type AuthorFormRow = { id: string; lastname: string; firstname: string; function: string };

export type SpecimenFormRow = { barcode: string; callNumber: string; sourceId: string };

const Z3950_PICK_PAGE_SIZE = 8;

function primaryAuthorLine(b: Biblio): string {
  const a = b.authors?.[0];
  if (!a) return '—';
  const line = [a.firstname, a.lastname].filter(Boolean).join(' ').trim();
  return line || '—';
}

function applyZ3950BiblioToForm(
  item: Biblio,
  prev: {
    title: string;
    isbn: string;
    mediaType: MediaType;
    publicationDate: string;
    subject: string;
    abstract: string;
    keywords: string;
    audienceType: string;
    lang: string;
    editionPublisher: string;
    editionPlace: string;
    editionDate: string;
    authors: AuthorFormRow[];
  }
) {
  return {
    ...prev,
    isbn: formatIsbnDisplay(item.isbn || '') || item.isbn || prev.isbn,
    title: item.title || prev.title,
    mediaType: (item.mediaType || prev.mediaType) as MediaType,
    publicationDate: item.publicationDate || prev.publicationDate,
    subject: item.subject || prev.subject,
    abstract: item.abstract || prev.abstract,
    keywords: Array.isArray(item.keywords) ? item.keywords.join(', ') : (item.keywords || prev.keywords),
    audienceType: item.audienceType || prev.audienceType,
    lang: item.lang || prev.lang,
    editionPublisher: item.edition?.publisherName || prev.editionPublisher,
    editionPlace: item.edition?.placeOfPublication || prev.editionPlace,
    editionDate: item.edition?.date || prev.editionDate,
    authors:
      item.authors && item.authors.length > 0
        ? item.authors.map((a) => ({
            id: a.id || '',
            lastname: a.lastname || '',
            firstname: a.firstname || '',
            function: a.function || '',
          }))
        : prev.authors,
  };
}

export interface BiblioEditorFormProps {
  mode: 'create' | 'edit';
  formId: string;
  /** Required when mode is edit */
  initialBiblio?: Biblio | null;
  defaultShowAdvanced?: boolean;
  /** Edit mode: wired to modal save button loading state */
  onLoadingChange?: (loading: boolean) => void;
  onSubmitCreate?: (payload: CreateBiblioPayload) => void | Promise<void>;
  onSubmitEdit?: (update: Partial<Biblio>) => void | Promise<void>;
}

export default function BiblioEditorForm({
  mode,
  formId,
  initialBiblio,
  defaultShowAdvanced,
  onLoadingChange,
  onSubmitCreate,
  onSubmitEdit,
}: BiblioEditorFormProps) {
  const { t } = useTranslation();
  const showSpecimens = mode === 'create';

  const toAuthorForm = (a: Author): AuthorFormRow => ({
    id: a.id,
    lastname: a.lastname ?? '',
    firstname: a.firstname ?? '',
    function: a.function ?? '',
  });

  const initialCollections = (b: Biblio): LinkedEntry[] => {
    const arr = b.collections ?? [];
    if (arr.length > 0) {
      return arr.map((c) => ({
        id: c.id ?? undefined,
        name: c.name ?? '',
        volumeNumber: c.volumeNumber?.toString() ?? '',
      }));
    }
    if (b.collection?.id || b.collection?.name) {
      return [{
        id: b.collection.id ?? undefined,
        name: b.collection.name ?? '',
        volumeNumber: '',
      }];
    }
    return [];
  };

  const initialSeries = (b: Biblio): LinkedEntry[] =>
    (b.series ?? []).map((s) => ({
      id: s.id ?? undefined,
      name: s.name ?? '',
      volumeNumber: s.volumeNumber?.toString() ?? '',
    }));

  const [formData, setFormData] = useState(() => {
    if (mode === 'edit' && initialBiblio) {
      const b = initialBiblio;
      return {
        title: b.title || '',
        isbn: formatIsbnDisplay(b.isbn || '') || (b.isbn || ''),
        publicationDate: b.publicationDate || '',
        abstract: b.abstract || '',
        keywords: Array.isArray(b.keywords) ? b.keywords.join(', ') : (b.keywords || ''),
        subject: b.subject || '',
        mediaType: (b.mediaType || 'printedText') as MediaType,
        audienceType: b.audienceType ?? '',
        lang: b.lang ?? '',
        editionPublisher: b.edition?.publisherName ?? '',
        editionPlace: b.edition?.placeOfPublication ?? '',
        editionDate: b.edition?.date ?? '',
        authors: (b.authors ?? []).map(toAuthorForm),
      };
    }
    return {
      title: '',
      isbn: '',
      publicationDate: '',
      abstract: '',
      keywords: '',
      subject: '',
      mediaType: 'printedText' as MediaType,
      audienceType: '',
      lang: '',
      editionPublisher: '',
      editionPlace: '',
      editionDate: '',
      authors: [] as AuthorFormRow[],
    };
  });

  const [linkedCollections, setLinkedCollections] = useState<LinkedEntry[]>(() =>
    mode === 'edit' && initialBiblio ? initialCollections(initialBiblio) : []
  );
  const [linkedSeries, setLinkedSeries] = useState<LinkedEntry[]>(() =>
    mode === 'edit' && initialBiblio ? initialSeries(initialBiblio) : []
  );

  const [showAdvanced, setShowAdvanced] = useState(defaultShowAdvanced ?? mode === 'create');

  const [z3950Servers, setZ3950Servers] = useState<Z3950Server[]>([]);
  const [isSearchingZ3950, setIsSearchingZ3950] = useState(false);
  const [z3950Message, setZ3950Message] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [z3950PickList, setZ3950PickList] = useState<Biblio[] | null>(null);
  const [z3950PickPage, setZ3950PickPage] = useState(0);

  const [sources, setSources] = useState<Source[]>([]);
  const [specimens, setSpecimens] = useState<SpecimenFormRow[]>([
    { barcode: '', callNumber: '', sourceId: '' },
  ]);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        const settings = await api.getSettings();
        setZ3950Servers((settings.z3950Servers || []).filter((s) => s.isActive));
      } catch {
        /* ignore */
      }
    };
    fetchServers();
  }, []);

  useEffect(() => {
    if (!showSpecimens) return;
    const load = async () => {
      try {
        const list = await api.getSources(false);
        setSources(list);
        const defaultId = list.find((s) => s.default)?.id ?? list[0]?.id ?? '';
        setSpecimens((prev) =>
          prev.length === 1 && prev[0].sourceId === '' && defaultId
            ? [{ ...prev[0], sourceId: defaultId }]
            : prev
        );
      } catch {
        /* ignore */
      }
    };
    load();
  }, [showSpecimens]);

  const searchCollections = useCallback(async (q: string) => {
    const res = await api.getCollections({ name: q, perPage: 10 });
    return res.items.map((c) => ({ id: c.id ?? '', name: c.name ?? '' }));
  }, []);

  const searchSeries = useCallback(async (q: string) => {
    const res = await api.getSeries({ name: q, perPage: 10 });
    return res.items.map((s) => ({ id: s.id ?? '', name: s.name ?? '' }));
  }, []);

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

  const updateAuthor = (index: number, field: keyof AuthorFormRow, value: string) => {
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

  const buildLinkedPayload = () => {
    const series = linkedSeries
      .filter((s) => s.name.trim())
      .map((s) => ({
        id: s.id || null,
        name: s.name.trim() || undefined,
        volumeNumber: s.volumeNumber ? parseInt(s.volumeNumber, 10) : undefined,
      }));
    const collections = linkedCollections
      .filter((c) => c.name.trim())
      .map((c) => ({
        id: c.id || null,
        name: c.name.trim() || undefined,
        volumeNumber: c.volumeNumber ? parseInt(c.volumeNumber, 10) : undefined,
      }));
    return { series, collections };
  };

  const buildSpecimensPayload = (): CreateBiblioItemInput[] | undefined => {
    if (!showSpecimens) return undefined;
    const filled = specimens.filter((s) => s.sourceId.trim() !== '' && s.barcode.trim() !== '');
    if (filled.length === 0) return undefined;
    return filled.map((s) => ({
      barcode: s.barcode.trim(),
      callNumber: s.callNumber.trim() || undefined,
      sourceId: s.sourceId,
    }));
  };

  const handleAddSpecimen = () => {
    const defaultId = sources.find((s) => s.default)?.id ?? sources[0]?.id ?? '';
    setSpecimens([...specimens, { barcode: '', callNumber: '', sourceId: defaultId }]);
  };

  const handleRemoveSpecimen = (index: number) => {
    if (specimens.length <= 1) return;
    setSpecimens(specimens.filter((_, i) => i !== index));
  };

  const handleSpecimenChange = (index: number, field: keyof SpecimenFormRow, value: string) => {
    const next = [...specimens];
    next[index] = { ...next[index], [field]: value };
    setSpecimens(next);
  };

  const applyZ3950Record = useCallback((item: Biblio) => {
    setFormData((prev) => applyZ3950BiblioToForm(item, prev));
    if (item.series && item.series.length > 0) {
      setLinkedSeries(
        item.series.map((s) => ({
          id: s.id ?? undefined,
          name: s.name ?? '',
          volumeNumber: s.volumeNumber?.toString() ?? '',
        }))
      );
    }
    const firstColl = item.collections?.[0] ?? item.collection;
    if (firstColl) {
      setLinkedCollections([
        {
          id: firstColl.id ?? undefined,
          name: firstColl.name ?? '',
          volumeNumber: firstColl.volumeNumber?.toString() ?? '',
        },
      ]);
    }
    setZ3950PickList(null);
    setZ3950PickPage(0);
    setZ3950Message({ type: 'success', text: t('z3950.dataFound') });
  }, [t]);

  const handleZ3950Search = async () => {
    const isbnTrim = formData.isbn.trim();
    const titleTrim = formData.title.trim();
    const isbnQuery = stripIsbnForZ3950Query(isbnTrim);

    if (isbnTrim !== '') {
      if (!isbnQuery) {
        setZ3950Message({ type: 'error', text: t('items.z3950InvalidIsbn') });
        return;
      }
    } else if (!titleTrim) {
      setZ3950Message({ type: 'error', text: t('items.z3950NeedIsbnOrTitle') });
      return;
    }

    if (z3950Servers.length === 0) {
      setZ3950Message({ type: 'error', text: t('z3950.noServers') });
      return;
    }
    setIsSearchingZ3950(true);
    setZ3950Message(null);
    setZ3950PickList(null);
    setZ3950PickPage(0);
    try {
      const response = await api.searchZ3950(
        isbnTrim !== ''
          ? { isbn: isbnQuery, serverId: z3950Servers[0].id }
          : { title: titleTrim, serverId: z3950Servers[0].id }
      );
      const list = response.biblios ?? [];
      if (list.length === 0) {
        setZ3950Message({ type: 'error', text: t('z3950.noResults') });
        return;
      }
      if (list.length === 1) {
        applyZ3950Record(list[0]);
      } else {
        setZ3950PickList(list);
        setZ3950PickPage(0);
      }
    } catch {
      setZ3950Message({ type: 'error', text: t('z3950.searchError') });
    } finally {
      setIsSearchingZ3950(false);
    }
  };

  const z3950CanSearch =
    formData.isbn.trim() !== '' || formData.title.trim() !== '';

  const z3950PickTotalPages =
    z3950PickList && z3950PickList.length > 1
      ? Math.max(1, Math.ceil(z3950PickList.length / Z3950_PICK_PAGE_SIZE))
      : 0;
  const z3950PickPageSlice = useMemo(() => {
    if (!z3950PickList || z3950PickList.length <= 1) return [];
    const tp = Math.max(1, Math.ceil(z3950PickList.length / Z3950_PICK_PAGE_SIZE));
    const safe = Math.min(z3950PickPage, tp - 1);
    const start = safe * Z3950_PICK_PAGE_SIZE;
    return z3950PickList.slice(start, start + Z3950_PICK_PAGE_SIZE);
  }, [z3950PickList, z3950PickPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() === '') return;

    if (mode === 'create') {
      const invalidCallNumber = specimens.find(
        (s) => s.barcode.trim() !== '' && s.callNumber.trim() !== '' && !validateCallNumber(s.callNumber)
      );
      if (invalidCallNumber) return;
      const specimenPayload = buildSpecimensPayload();
      if (specimenPayload?.some((s) => !s.sourceId)) return;

      const authorsPayload: Author[] = formData.authors.map((a) => ({
        id: a.id,
        lastname: a.lastname || undefined,
        firstname: a.firstname || undefined,
        function: a.function || undefined,
      }));
      const { series, collections } = buildLinkedPayload();
      const payload: CreateBiblioPayload = {
        title: formData.title,
        isbn: formData.isbn || undefined,
        mediaType: formData.mediaType,
        publicationDate: formData.publicationDate || undefined,
        abstract: formData.abstract || undefined,
        keywords: formData.keywords || undefined,
        subject: formData.subject || undefined,
        audienceType: formData.audienceType || undefined,
        lang: formData.lang || undefined,
        edition:
          formData.editionPublisher || formData.editionPlace || formData.editionDate
            ? {
                id: null,
                publisherName: formData.editionPublisher || undefined,
                placeOfPublication: formData.editionPlace || undefined,
                date: formData.editionDate || undefined,
              }
            : undefined,
        authors: authorsPayload,
        series: series as Serie[],
        collections: collections as Collection[],
        ...(specimenPayload?.length ? { items: specimenPayload } : {}),
      };
      await onSubmitCreate?.(payload);
      return;
    }

    if (mode === 'edit' && initialBiblio?.id != null && onSubmitEdit) {
      const authorsPayload: Author[] = formData.authors.map((a) => ({
        id: a.id,
        lastname: a.lastname || undefined,
        firstname: a.firstname || undefined,
        function: a.function || undefined,
      }));
      const { series, collections } = buildLinkedPayload();
      const updateData: Partial<Biblio> = {
        title: formData.title || undefined,
        isbn: formData.isbn || undefined,
        publicationDate: formData.publicationDate || undefined,
        abstract: formData.abstract || undefined,
        keywords: formData.keywords || undefined,
        subject: formData.subject || undefined,
        mediaType: formData.mediaType,
        audienceType: formData.audienceType || undefined,
        lang: formData.lang || undefined,
        edition: {
          id: initialBiblio.edition?.id ?? null,
          publisherName: formData.editionPublisher || undefined,
          placeOfPublication: formData.editionPlace || undefined,
          date: formData.editionDate || undefined,
        },
        authors: authorsPayload,
        series,
        collections,
      };
      onLoadingChange?.(true);
      try {
        await onSubmitEdit(updateData);
      } finally {
        onLoadingChange?.(false);
      }
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('items.isbn')}
          value={formData.isbn}
          onChange={(e) => {
            setFormData({ ...formData, isbn: e.target.value });
            setZ3950Message(null);
            setZ3950PickList(null);
          }}
          onBlur={() => {
            const raw = formData.isbn.trim();
            if (!raw) return;
            const f = formatIsbnDisplay(raw);
            if (f) setFormData((prev) => (prev.isbn === f ? prev : { ...prev, isbn: f }));
          }}
          className="font-mono"
          placeholder={t('z3950.isbnPlaceholder')}
        />
        <Input
          label={t('items.titleField')}
          value={formData.title}
          onChange={(e) => {
            setFormData({ ...formData, title: e.target.value });
            setZ3950Message(null);
            setZ3950PickList(null);
          }}
          required
        />
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/30">
        <p className="text-xs text-gray-600 dark:text-gray-400">{t('items.z3950CatalogHint')}</p>
        {z3950Servers.length > 0 ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleZ3950Search}
              disabled={isSearchingZ3950 || !z3950CanSearch}
              leftIcon={isSearchingZ3950 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              title={t('z3950.searchButton')}
            >
              {t('z3950.searchButton')}
            </Button>
            {z3950PickList && z3950PickList.length > 1 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 space-y-2">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {t('items.z3950PickFromList', { count: z3950PickList.length })}
                </p>
                <ul className="space-y-2">
                  {z3950PickPageSlice.map((b, idx) => (
                    <li
                      key={`${z3950PickPage * Z3950_PICK_PAGE_SIZE + idx}-${b.title ?? ''}-${b.isbn ?? ''}`}
                      className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                    >
                      <p className="min-w-0 flex-1 text-sm text-gray-800 dark:text-gray-100 truncate">
                        <span className="font-medium">{b.title?.trim() || '—'}</span>
                        <span className="text-gray-400 dark:text-gray-500"> · </span>
                        <span className="font-mono text-xs">{formatIsbnDisplay(b.isbn || '') || '—'}</span>
                        <span className="text-gray-400 dark:text-gray-500"> · </span>
                        <span>{primaryAuthorLine(b)}</span>
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-shrink-0"
                        onClick={() => applyZ3950Record(b)}
                      >
                        {t('items.z3950Choose')}
                      </Button>
                    </li>
                  ))}
                </ul>
                {z3950PickTotalPages > 1 && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setZ3950PickPage((p) => Math.max(0, p - 1))}
                      disabled={z3950PickPage <= 0}
                      leftIcon={<ChevronLeft className="h-4 w-4" />}
                    >
                      {t('common.previous')}
                    </Button>
                    <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                      {t('items.z3950PageOf', {
                        current: Math.min(z3950PickPage + 1, z3950PickTotalPages),
                        total: z3950PickTotalPages,
                      })}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setZ3950PickPage((p) => Math.min(z3950PickTotalPages - 1, p + 1))
                      }
                      disabled={z3950PickPage >= z3950PickTotalPages - 1}
                      rightIcon={<ChevronRight className="h-4 w-4" />}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-300">{t('z3950.noServers')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('items.mediaTypeLabel')}
          </label>
          <select
            value={formData.mediaType}
            onChange={(e) => setFormData({ ...formData, mediaType: e.target.value as MediaType })}
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
          value={formData.publicationDate}
          onChange={(e) => setFormData({ ...formData, publicationDate: e.target.value })}
          placeholder="YYYY"
        />
      </div>

      {z3950Message && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
            z3950Message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
          }`}
        >
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
          value={formData.abstract}
          onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
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
                value={formData.audienceType}
                onChange={(e) => setFormData({ ...formData, audienceType: e.target.value })}
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
                value={formData.editionPublisher}
                onChange={(e) => setFormData({ ...formData, editionPublisher: e.target.value })}
              />
              <Input
                label={t('items.publicationPlace')}
                value={formData.editionPlace}
                onChange={(e) => setFormData({ ...formData, editionPlace: e.target.value })}
              />
              <Input
                label={t('items.editionDate')}
                value={formData.editionDate}
                onChange={(e) => setFormData({ ...formData, editionDate: e.target.value })}
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
                <div
                  key={index}
                  className="flex flex-nowrap items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-w-0 overflow-x-auto"
                >
                  <Input
                    placeholder={t('items.authorLastname')}
                    value={author.lastname}
                    onChange={(e) => updateAuthor(index, 'lastname', e.target.value)}
                    className="min-w-[6rem] flex-1 shrink"
                  />
                  <Input
                    placeholder={t('items.authorFirstname')}
                    value={author.firstname}
                    onChange={(e) => updateAuthor(index, 'firstname', e.target.value)}
                    className="min-w-[6rem] flex-1 shrink"
                  />
                  <select
                    value={author.function}
                    onChange={(e) => updateAuthor(index, 'function', e.target.value)}
                    className="shrink-0 w-[min(100%,11rem)] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
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
                    className="shrink-0 p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
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
            onSearch={searchCollections}
            volumeLabel={t('catalog.volumeNumber')}
          />

          <EntityLinker
            label={t('items.series')}
            addLabel={t('catalog.searchOrCreateSerie')}
            entries={linkedSeries}
            onChange={setLinkedSeries}
            onSearch={searchSeries}
            volumeLabel={t('catalog.volumeNumber')}
          />
        </div>
      )}

      {showSpecimens && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('items.specimensOptional')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('items.specimensOptionalHint')}</p>
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
                    value={specimen.callNumber}
                    onChange={(v) => handleSpecimenChange(index, 'callNumber', v)}
                    suggestedValue={buildSuggestedCallNumber({
                      categoryCode: 'GEN',
                      year: formData.publicationDate,
                    })}
                    placeholder={t('items.callNumber')}
                    inputId={`biblio-editor-specimen-call-${index}`}
                  />
                  <div>
                    <select
                      value={specimen.sourceId}
                      onChange={(e) => handleSpecimenChange(index, 'sourceId', e.target.value)}
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
          <Button type="button" variant="secondary" size="sm" onClick={handleAddSpecimen} leftIcon={<Plus className="h-4 w-4" />}>
            {t('items.addSpecimen')}
          </Button>
        </div>
      )}
    </form>
  );
}
