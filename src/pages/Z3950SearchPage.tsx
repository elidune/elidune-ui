import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Globe,
  BookOpen,
  Download,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Loader2,
  Server,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Table, Modal, Input } from '@/components/common';
import CallNumberField from '@/components/specimen/CallNumberField';
import api from '@/services/api';
import type { Biblio, Author, Z3950Server, MediaType, Source, ImportReport, DuplicateConfirmationRequired } from '@/types';
import { buildSuggestedCallNumber, validateCallNumber } from '@/utils/callNumber';
import type { AxiosError } from 'axios';

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType | string | null | undefined): string {
  if (!mediaType) return 'unknown';
  const legacyMap: Record<string, string> = {
    u: 'unknown',
    b: 'printedText',
    bc: 'comics',
    p: 'periodic',
    v: 'video',
    vt: 'videoTape',
    vd: 'videoDvd',
    a: 'audio',
    am: 'audioMusic',
    amt: 'audioMusicTape',
    amc: 'audioMusicCd',
    an: 'audioNonMusic',
    ant: 'audioNonMusicTape',
    anc: 'audioNonMusicCd',
    c: 'cdRom',
    i: 'images',
    m: 'multimedia',
  };
  return legacyMap[String(mediaType)] ?? String(mediaType);
}

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<any>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existingId !== 'string') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
}

/** Z39.50 search returns full Biblio objects. */
type Z3950Result = Biblio;

interface Z3950SearchResponse {
  total: number;
  biblios: Z3950Result[];
  source: string;
}

interface SpecimenToAdd {
  barcode: string;
  callNumber: string;
}

export default function Z3950SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Servers state
  const [servers, setServers] = useState<Z3950Server[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [isLoadingServers, setIsLoadingServers] = useState(true);

  // Search state
  const [searchParams, setSearchParams] = useState({
    isbn: '',
    title: '',
    author: '',
  });
  const [maxResults, setMaxResults] = useState<number>(50);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Results state
  const [results, setResults] = useState<Z3950Result[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [source, setSource] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Z3950Result | null>(null);
  /** Id of the item to import (kept as string to preserve i64/u64 precision). */
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [specimens, setSpecimens] = useState<SpecimenToAdd[]>([{ barcode: '', callNumber: '' }]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [confirmReplaceModal, setConfirmReplaceModal] = useState<{ existingId: string; message: string } | null>(null);
  const [confirmReplaceLoading, setConfirmReplaceLoading] = useState(false);
  const [confirmReplaceError, setConfirmReplaceError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  
  // Sources state
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);

  // Load servers and sources from settings on mount
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const settings = await api.getSettings();
        const activeServers = (settings.z3950Servers || []).filter(s => s.isActive);
        setServers(activeServers);
        // Select first server by default if available
        if (activeServers.length > 0) {
          setSelectedServerId(activeServers[0].id);
        }
      } catch (error) {
        console.error('Error fetching Z39.50 servers:', error);
        setSearchError(t('z3950.serverUnavailable'));
      } finally {
        setIsLoadingServers(false);
      }
    };
    
    const fetchSources = async () => {
      try {
        setSourcesError(null);
        const sourcesData = await api.getSources(false);
        setSources(sourcesData);
        const defaultSource = sourcesData.find(s => s.default);
        if (defaultSource) {
          setSelectedSourceId(defaultSource.id);
        } else if (sourcesData.length > 0) {
          setSelectedSourceId(sourcesData[0].id);
        }
      } catch (error) {
        console.error('Error fetching sources:', error);
        setSourcesError(t('z3950.sourcesError'));
      }
    };
    
    fetchServers();
    fetchSources();
  }, [t]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Au moins un critère de recherche requis
    if (!searchParams.isbn && !searchParams.title && !searchParams.author) {
      setSearchError(t('z3950.atLeastOneCriteria'));
      return;
    }

    // Vérifier qu'un serveur est sélectionné
    if (!selectedServerId) {
      setSearchError(t('z3950.selectServer'));
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setHasSearched(true);

    try {
      const response: Z3950SearchResponse = await api.searchZ3950({
        isbn: searchParams.isbn || undefined,
        title: searchParams.title || undefined,
        author: searchParams.author || undefined,
        serverId: selectedServerId,
        maxResults: maxResults,
      });
      setResults(response.biblios);
      setTotalResults(response.total);
      setSource(response.source);
    } catch (error) {
      console.error('Error searching Z39.50:', error);
      setSearchError(t('z3950.serverUnavailable'));
      setResults([]);
      setTotalResults(0);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchParams({ isbn: '', title: '', author: '' });
    setResults([]);
    setTotalResults(0);
    setHasSearched(false);
    setSearchError('');
  };

  const handleOpenImport = (item: Z3950Result) => {
    setSelectedItem(item);
    setSelectedItemId(item.id ?? null);
    setSpecimens([{ barcode: '', callNumber: '' }]);
    setImportSuccess(null);
    setImportReport(null);
    setConfirmReplaceModal(null);
    setConfirmReplaceError(null);
    setImportError(null);
    // Reset to default source when opening import modal
    const defaultSource = sources.find(s => s.default);
    if (defaultSource) {
      setSelectedSourceId(defaultSource.id);
    } else if (sources.length > 0) {
      setSelectedSourceId(sources[0].id);
    }
    setShowImportModal(true);
  };

  const handleAddSpecimen = () => {
    setSpecimens([...specimens, { barcode: '', callNumber: '' }]);
  };

  const handleRemoveSpecimen = (index: number) => {
    if (specimens.length > 1) {
      setSpecimens(specimens.filter((_, i) => i !== index));
    }
  };

  const handleSpecimenChange = (index: number, field: keyof SpecimenToAdd, value: string) => {
    const updated = [...specimens];
    updated[index] = { ...updated[index], [field]: value };
    setSpecimens(updated);
  };

  const handleImport = async () => {
    if (selectedItemId == null) return;
    if (!selectedSourceId) {
      setImportError(t('z3950.sourceRequired'));
      return;
    }
    const invalidCallNumber = specimens.find(s => s.callNumber.trim() !== '' && !validateCallNumber(s.callNumber));
    if (invalidCallNumber) {
      setImportError(t('items.callNumberInvalid'));
      return;
    }
    setImportError(null);
    setIsImporting(true);
    try {
      const validSpecimens = specimens.filter(s => s.barcode.trim() !== '');
      
      const imported = await api.importZ3950(
        selectedItemId,
        validSpecimens.length > 0 ? validSpecimens : undefined,
        selectedSourceId || undefined
      );
      
      setImportSuccess(imported.biblio.id ?? null);
      setImportReport(imported.importReport);
    } catch (error) {
      const confirm = getDuplicateConfirmationRequired(error);
      if (confirm) {
        setConfirmReplaceError(null);
        setConfirmReplaceModal({ existingId: confirm.existingId, message: confirm.message });
      } else {
        console.error('Error importing biblio:', error);
        setImportError(t('z3950.importError'));
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleConfirmReplaceExisting = async () => {
    if (selectedItemId == null || !confirmReplaceModal) return;
    setConfirmReplaceLoading(true);
    setConfirmReplaceError(null);
    try {
      const validSpecimens = specimens.filter(s => s.barcode.trim() !== '');
      const imported = await api.importZ3950(
        selectedItemId,
        validSpecimens.length > 0 ? validSpecimens : undefined,
        selectedSourceId || undefined,
        { confirmReplaceExistingId: confirmReplaceModal.existingId }
      );
      setConfirmReplaceModal(null);
      setImportSuccess(imported.biblio.id ?? null);
      setImportReport(imported.importReport);
    } catch (err) {
      console.error('Error confirming replace existing item:', err);
      setConfirmReplaceError(t('z3950.importError'));
    } finally {
      setConfirmReplaceLoading(false);
    }
  };

  const handleGoToImported = () => {
    if (importSuccess) {
      navigate(`/biblios/${importSuccess}`);
    }
  };

  const formatAuthors = (authors?: Author[]) => {
    if (!authors || authors.length === 0) return '-';
    return authors
      .map((a) => `${a.firstname || ''} ${a.lastname || ''}`.trim())
      .filter(Boolean)
      .join(', ');
  };

  const columns = [
    {
      key: 'title',
      header: t('items.titleField'),
      render: (item: Z3950Result) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
      key: 'authors',
      header: t('items.authors'),
      render: (item: Z3950Result) => (
        <span className="text-gray-600 dark:text-gray-300">
          {formatAuthors(item.authors && item.authors.length > 0 ? item.authors : [])}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('common.date'),
      render: (item: Z3950Result) => item.publicationDate || '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'mediaType',
      header: t('common.type'),
      render: (item: Z3950Result) => (
        <Badge>
          {item.mediaType
            ? t(`items.mediaType.${getMediaTypeTranslationKey(item.mediaType as MediaType)}`)
            : t('items.document')
          }
        </Badge>
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: t('common.actions'),
      render: (item: Z3950Result) => (
        <Button
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenImport(item);
          }}
          leftIcon={<Download className="h-4 w-4" />}
        >
          {t('z3950.import')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Globe className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          {t('z3950.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('z3950.subtitle')}
        </p>
      </div>

      {/* Search form */}
      <Card>
        <CardHeader title={t('z3950.searchCriteria')} />
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Server selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                {t('z3950.server')}
              </div>
            </label>
            {isLoadingServers ? (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('z3950.loadingServers')}
              </div>
            ) : servers.length === 0 ? (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm py-2">
                <AlertCircle className="h-4 w-4" />
                {t('z3950.noServers')}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {servers.map((server) => (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => setSelectedServerId(server.id)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedServerId === server.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      {server.name}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search criteria */}
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-4">
            <Input
              label={t('items.titleField')}
              value={searchParams.title}
              onChange={(e) => setSearchParams({ ...searchParams, title: e.target.value })}
              placeholder={t('z3950.titlePlaceholder')}
            />
            <Input
              label={t('z3950.isbn')}
              value={searchParams.isbn}
              onChange={(e) => setSearchParams({ ...searchParams, isbn: e.target.value })}
              placeholder={t('z3950.isbnPlaceholder')}
            />
            <Input
              label={t('items.author')}
              value={searchParams.author}
              onChange={(e) => setSearchParams({ ...searchParams, author: e.target.value })}
              placeholder={t('z3950.authorPlaceholder')}
            />
            {/* Max results selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('z3950.maxResults')}
              </label>
              <select
                value={maxResults}
                onChange={(e) => setMaxResults(Number(e.target.value))}
                className="w-auto min-w-20 rounded-lg border bg-white dark:bg-gray-900 px-3 py-2.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {searchError && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4" />
              {searchError}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleClearSearch}>
              {t('common.reset')}
            </Button>
            <Button
              type="submit"
              isLoading={isSearching}
              disabled={servers.length === 0 || !selectedServerId}
              leftIcon={<Search className="h-4 w-4" />}
            >
              {t('common.search')}
            </Button>
          </div>
        </form>
      </Card>

      {/* Results */}
      {hasSearched && (
        <Card padding="none">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('z3950.results')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('z3950.documentsFound', { count: totalResults })}
                  {source && ` • ${t('z3950.source', { source })}`}
                </p>
              </div>
            </div>
          </div>

          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t('z3950.searching')}
                </p>
              </div>
            </div>
          ) : (
            <Table
              columns={columns}
              data={results}
              keyExtractor={(item) => item.id || `${item.isbn ?? ''}-${item.title ?? ''}`}
              emptyMessage={t('z3950.noResults')}
            />
          )}
        </Card>
      )}

      {/* Import modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title={t('z3950.importTitle')}
        size="lg"
        footer={
          !importSuccess ? (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowImportModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleImport}
                isLoading={isImporting}
                disabled={!selectedSourceId || sources.length === 0}
                leftIcon={<Download className="h-4 w-4" />}
              >
                {t('z3950.import')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {importSuccess ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {t('z3950.importSuccess')}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {t('z3950.importSuccessMessage')}
            </p>
            {importReport && (
              <div className="mx-auto max-w-xl text-left mb-6 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
                <div className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  {importReport.message || importReport.action}
                  {importReport.existingId != null ? ` (ID: ${importReport.existingId})` : ''}
                </div>
                {importReport.warnings?.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-emerald-800 dark:text-emerald-300 space-y-1">
                    {importReport.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setShowImportModal(false)}>
                {t('common.close')}
              </Button>
              <Button onClick={handleGoToImported}>
                {t('z3950.viewDocument')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Document info */}
            {selectedItem && (
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                {selectedItemId != null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    ID: {selectedItemId}
                  </p>
                )}
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                  {selectedItem.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatAuthors(selectedItem.authors && selectedItem.authors.length > 0 ? selectedItem.authors : [])}
                  {selectedItem.publicationDate && ` • ${selectedItem.publicationDate}`}
                </p>
                {selectedItem.isbn && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ISBN: {selectedItem.isbn}
                  </p>
                )}
              </div>
            )}

            {/* Source selector (required for /z3950/import) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('items.source')} <span className="text-red-500">*</span>
              </label>
              {sourcesError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{sourcesError}</p>
              ) : sources.length === 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">{t('z3950.noSources')}</p>
              ) : (
                <select
                  value={selectedSourceId || ''}
                  onChange={(e) => setSelectedSourceId(e.target.value || null)}
                  className="w-full rounded-lg border bg-white dark:bg-gray-900 px-3 py-2.5 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:focus:ring-amber-500/40"
                >
                  <option value="">{t('z3950.selectSource')}</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name || `Source ${source.id}`}
                      {source.default ? ` (${t('importMarc.default')})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Specimens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('z3950.specimensToCreate')}
                </label>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddSpecimen}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  {t('items.addSpecimen')}
                </Button>
              </div>

              <div className="space-y-3">
                {specimens.map((specimen, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <Input
                        placeholder={t('items.specimenBarcode')}
                        value={specimen.barcode}
                        onChange={(e) => handleSpecimenChange(index, 'barcode', e.target.value)}
                      />
                      <CallNumberField
                        value={specimen.callNumber}
                        onChange={(v) => handleSpecimenChange(index, 'callNumber', v)}
                        suggestedValue={
                          selectedItem
                            ? buildSuggestedCallNumber({
                                categoryCode: 'IMP',
                                year: selectedItem.publicationDate,
                                authorOrCollectorName: selectedItem.authors?.[0]?.lastname,
                              })
                            : undefined
                        }
                        placeholder={t('items.callNumber')}
                        inputId={`z3950-call-${index}`}
                      />
                    </div>
                    {specimens.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSpecimen(index)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {t('z3950.specimensHint')}
              </p>
            </div>

            {importError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {importError}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!confirmReplaceModal}
        onClose={() => {
          if (confirmReplaceLoading) return;
          setConfirmReplaceModal(null);
          setConfirmReplaceError(null);
        }}
        title={t('z3950.confirmReplaceTitle')}
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
              <Button onClick={handleConfirmReplaceExisting} isLoading={confirmReplaceLoading}>
                {t('z3950.confirmReplaceConfirm')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {confirmReplaceModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {confirmReplaceModal.message}
            </p>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium mb-1">
                {t('z3950.confirmReplaceExistingId', { id: confirmReplaceModal.existingId })}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {t('z3950.confirmReplaceExplanation')}
              </div>
            </div>
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
