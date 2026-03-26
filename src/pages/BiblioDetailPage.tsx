import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Trash2,
  BookOpen,
  Calendar,
  User,
  Hash,
  Building,
  MapPin,
  FileText,
  Tag,
  Plus,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Modal, Input } from '@/components/common';
import CallNumberField from '@/components/specimen/CallNumberField';
import { buildSuggestedCallNumber, validateCallNumber } from '@/utils/callNumber';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems, type MediaType } from '@/types';
import api from '@/services/api';
import type { Biblio, Item, Author, Source } from '@/types';
import { useTranslation } from 'react-i18next';
import { LANG_OPTIONS, FUNCTION_OPTIONS, PUBLIC_TYPE_OPTIONS, getCodeLabel } from '@/utils/codeLabels';
import { getApiErrorCode } from '@/utils/apiError';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import { useQueryClient } from '@tanstack/react-query';
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

/** Derive suggested call number from biblio: [CATEGORY]-[YEAR]-[AUTHOR]. */
function getSuggestedCallNumberFromItem(item: Biblio): string {
  const categoryCode = item.mediaType
    ? String(item.mediaType).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN'
    : 'GEN';
  const year =
    item.publicationDate?.trim().slice(0, 4) ||
    item.edition?.date?.trim().slice(0, 4) ||
    undefined;
  const authorName = item.authors?.[0]?.lastname?.trim();
  return buildSuggestedCallNumber({
    categoryCode: categoryCode || 'GEN',
    year: year ? parseInt(year, 10) : undefined,
    authorOrCollectorName: authorName,
  });
}

function volumeBadgeVisible(vol: number | null | undefined): vol is number {
  return vol != null && vol !== 0;
}

function hasNonEmptyText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export default function BiblioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Search state saved by BibliosPage when navigating here; used to restore on back
  const savedSearch = (location.state as { savedSearch?: unknown } | null)?.savedSearch;

  const [item, setItem] = useState<Biblio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSpecimenModal, setShowAddSpecimenModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditSpecimenModal, setShowEditSpecimenModal] = useState(false);
  const [showDeleteSpecimenModal, setShowDeleteSpecimenModal] = useState(false);
  const [isAddSpecimenLoading, setIsAddSpecimenLoading] = useState(false);
  const [isEditSpecimenLoading, setIsEditSpecimenLoading] = useState(false);
  const [selectedSpecimen, setSelectedSpecimen] = useState<Item | null>(null);
  const [deleteSpecimenBorrowedError, setDeleteSpecimenBorrowedError] = useState(false);
  const [deleteSpecimenLoading, setDeleteSpecimenLoading] = useState(false);
  const [deleteItemBorrowedError, setDeleteItemBorrowedError] = useState(false);
  const [deleteItemLoading, setDeleteItemLoading] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      try {
        const data = await api.getBiblio(id);
        setItem(data);
      } catch (error) {
        console.error('Error fetching biblio:', error);
        navigate('/biblios');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [id, navigate]);

  const handleDelete = async (force = false) => {
    if (!item || item.id == null) return;
    if (deleteItemLoading) return;
    setDeleteItemLoading(true);
    try {
      await api.deleteBiblio(item.id, force);
      // Ensure deleted biblio disappears from cached catalog searches immediately.
      queryClient.setQueriesData({ queryKey: ['biblios'] }, (old: any) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((p: any) => {
            if (!p?.items?.length) return p;
            const nextItems = p.items.filter((it: any) => it?.id !== item.id);
            const nextTotal = typeof p.total === 'number' ? Math.max(0, p.total - (p.items.length - nextItems.length)) : p.total;
            return { ...p, items: nextItems, total: nextTotal };
          }),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['biblios'] });
      navigate('/biblios');
    } catch (error: unknown) {
      const code = getApiErrorCode(error);
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (
        !force &&
        (
          code === 'business_rule_violation' ||
          (
            typeof msg === 'string' &&
            (msg.includes('borrowed') || msg.includes('force=true'))
          )
        )
      ) {
        setDeleteItemBorrowedError(true);
      } else {
        console.error('Error deleting item:', error);
      }
    } finally {
      setDeleteItemLoading(false);
    }
  };

  const formatAuthors = (authors?: Author[]) => {
    if (!authors || authors.length === 0) return t('items.notSpecified');
    return authors
      .map((a) => {
        const name = `${a.firstname || ''} ${a.lastname || ''}`.trim();
        const func = a.function ? getCodeLabel(t, FUNCTION_OPTIONS, a.function) : '';
        return func ? `${name} (${func})` : name;
      })
      .join(', ');
  };

  const handleDeleteSpecimen = async (force: boolean) => {
    if (!selectedSpecimen || !item || item.id == null) return;
    setDeleteSpecimenLoading(true);
    try {
      await api.deleteItem(item.id, selectedSpecimen.id, force);
      setShowDeleteSpecimenModal(false);
      setSelectedSpecimen(null);
      setDeleteSpecimenBorrowedError(false);
      api.getBiblio(item.id).then(setItem);
    } catch (error: unknown) {
      if (!force) {
        const code = getApiErrorCode(error);
        const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
        if (
          code === 'business_rule_violation' ||
          (typeof msg === 'string' && (msg.includes('borrowed') || msg.includes('force=true')))
        ) {
          setDeleteSpecimenBorrowedError(true);
        } else {
          console.error('Error deleting specimen:', error);
        }
      } else {
        console.error('Error force-deleting specimen:', error);
      }
    } finally {
      setDeleteSpecimenLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Document non trouvé</p>
      </div>
    );
  }

  const hasGeneralInfoFields =
    hasNonEmptyText(item.isbn) ||
    (item.authors?.length ?? 0) > 0 ||
    hasNonEmptyText(item.publicationDate) ||
    hasNonEmptyText(item.edition?.publisherName) ||
    hasNonEmptyText(item.edition?.placeOfPublication) ||
    (item.lang != null && item.lang !== '') ||
    item.audienceType != null;
  const hasGeneralInfoMeta = Boolean(item.createdAt) || Boolean(item.updatedAt);
  const showGeneralInfoCard = hasGeneralInfoFields || hasGeneralInfoMeta;
  const createdAt = item.createdAt;
  const updatedAt = item.updatedAt;
  const metaDatesAreSameInstant =
    createdAt != null &&
    updatedAt != null &&
    new Date(createdAt).getTime() === new Date(updatedAt).getTime();
  const formatBiblioMetaDate = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => {
              if (savedSearch === undefined) {
                navigate('/biblios');
                return;
              }
              const s = savedSearch as { serieId?: string; serieName?: string; collectionId?: string; collectionName?: string };
              const params = new URLSearchParams();
              if (s.serieId) {
                params.set('serie_id', s.serieId);
                if (s.serieName) params.set('serie_name', s.serieName);
              } else if (s.collectionId) {
                params.set('collection_id', s.collectionId);
                if (s.collectionName) params.set('collection_name', s.collectionName);
              }
              const search = params.toString() ? `?${params.toString()}` : '';
              navigate(`/biblios${search}`, { state: { restoredSearch: savedSearch } });
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-shrink-0 h-16 w-16 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {item.title || 'Sans titre'}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge>
                {item.mediaType 
                  ? t(`items.mediaType.${getMediaTypeTranslationKey(item.mediaType)}`)
                  : t('items.document')
                }
              </Badge>
              {item.audienceType != null && (
                <Badge variant="default">
                  {getCodeLabel(t, PUBLIC_TYPE_OPTIONS, item.audienceType)}
                </Badge>
              )}
              {item.isValid === 0 && <Badge variant="warning">Non validé</Badge>}
            </div>
          </div>
        </div>

        {canManageItems(user?.accountType) && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                navigate(`/biblios/${item.id}/edit`, {
                  state: savedSearch !== undefined ? { savedSearch } : undefined,
                })
              }
              leftIcon={<Edit className="h-4 w-4" />}
            >
              Modifier
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} leftIcon={<Trash2 className="h-4 w-4" />}>
              Supprimer
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {showGeneralInfoCard && (
            <Card>
              <CardHeader title={t('items.generalInfo')} />
              {hasGeneralInfoFields && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow icon={Hash} label={t('items.isbn')} value={formatIsbnDisplay(item.isbn)} />
                  <InfoRow icon={User} label={t('items.mainAuthor')} value={item.authors?.length ? formatAuthors([item.authors[0]]) : undefined} />
                  <InfoRow icon={User} label={t('items.secondaryAuthor')} value={item.authors && item.authors.length > 1 ? formatAuthors(item.authors.slice(1)) : undefined} />
                  <InfoRow icon={Calendar} label={t('items.publicationDate')} value={item.publicationDate} />
                  <InfoRow icon={Building} label={t('items.publisher')} value={item.edition?.publisherName} />
                  <InfoRow icon={MapPin} label={t('items.publicationPlace')} value={item.edition?.placeOfPublication} />
                  <InfoRow
                    icon={BookOpen}
                    label={t('items.language')}
                    value={item.lang != null && item.lang !== '' ? getCodeLabel(t, LANG_OPTIONS, item.lang) : undefined}
                  />
                  <InfoRow
                    icon={Tag}
                    label={t('items.publicType')}
                    value={item.audienceType != null ? getCodeLabel(t, PUBLIC_TYPE_OPTIONS, item.audienceType) : undefined}
                  />
                </div>
              )}
              {hasGeneralInfoMeta && (
                <div
                  className={
                    hasGeneralInfoFields
                      ? 'mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400'
                      : 'flex flex-wrap items-baseline gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400'
                  }
                >
                  {metaDatesAreSameInstant && createdAt ? (
                    <span>
                      {t('items.createdAt')}: {formatBiblioMetaDate(createdAt)}
                    </span>
                  ) : (
                    <>
                      {createdAt && (
                        <span>
                          {t('items.createdAt')}: {formatBiblioMetaDate(createdAt)}
                        </span>
                      )}
                      {updatedAt && (
                        <span>
                          {t('items.updatedAt')}: {formatBiblioMetaDate(updatedAt)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          )}

          {item.abstract && (
            <Card>
              <CardHeader title={t('items.abstract')} />
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {item.abstract}
              </p>
            </Card>
          )}

          {(item.keywords || item.subject) && (
            <Card>
              <CardHeader title={t('items.keywordsAndSubject')} />
              <div className="space-y-3">
                {item.keywords && (
                  <div className="flex items-start gap-2">
                    <Tag className="h-4 w-4 mt-1 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-300">{Array.isArray(item.keywords) ? item.keywords.join(', ') : item.keywords}</p>
                  </div>
                )}
                {item.subject && (
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-1 text-gray-400" />
                    <p className="text-gray-600 dark:text-gray-300">{item.subject}</p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Specimens */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={t('items.specimens')}
              subtitle={t('items.specimenCount', { count: item.items?.length ?? 0 })}
              action={
                canManageItems(user?.accountType) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setShowAddSpecimenModal(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    {t('items.addSpecimen')}
                  </Button>
                )
              }
            />
            {item.items && item.items.length > 0 ? (
              <div className="space-y-3">
                {item.items.map((specimen) => (
                  <SpecimenCard
                    key={specimen.id}
                    specimen={specimen}
                    canManage={canManageItems(user?.accountType)}
                    onEdit={() => {
                      setSelectedSpecimen(specimen);
                      setShowEditSpecimenModal(true);
                    }}
                    onDelete={() => {
                      setSelectedSpecimen(specimen);
                      setShowDeleteSpecimenModal(true);
                    }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">
                {t('items.noSpecimens')}
              </p>
            )}
          </Card>

          {/* Collections — prefer new array, fall back to legacy single */}
          {(() => {
            const cols = item.collections?.length
              ? item.collections
              : item.collection
                ? [item.collection]
                : [];
            if (cols.length === 0) return null;
            return (
              <Card>
                <CardHeader title={t('items.collection')} />
                <div className="space-y-3">
                  {cols.map((c, i) => {
                    const volNum =
                      c.volumeNumber ??
                      c.volumeNumber ??
                      item.collectionVolumeNumbers?.[i] ??
                      item.collectionVolumeNumbers?.[i] ??
                      item.collectionVolumeNumber ??
                      null;
                    const title = c.name ?? c.secondaryTitle ?? '—';
                    const openCollectionCatalog = () => {
                      if (!c.id) return;
                      const params = new URLSearchParams();
                      params.set('collection_id', c.id);
                      params.set('collection_name', title);
                      navigate(`/biblios?${params.toString()}`);
                    };
                    return (
                      <div key={c.id ?? i} className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          {c.id ? (
                            <button
                              type="button"
                              onClick={openCollectionCatalog}
                              title={t('catalog.openInCatalog')}
                              className="group w-full text-left rounded-lg -m-1 p-1.5 border border-transparent hover:border-amber-200/90 dark:hover:border-amber-800/60 hover:bg-amber-50/90 dark:hover:bg-amber-950/35 transition-colors"
                            >
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-amber-800 dark:text-amber-200 group-hover:underline underline-offset-2 decoration-amber-600/50">
                                    {title}
                                  </p>
                                  {c.secondaryTitle && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                      {c.secondaryTitle}
                                    </p>
                                  )}
                                  {c.issn && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">ISSN: {c.issn}</p>
                                  )}
                                </div>
                                <ExternalLink
                                  className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 opacity-80 group-hover:opacity-100"
                                  aria-hidden
                                />
                              </div>
                            </button>
                          ) : (
                            <>
                              <p className="font-medium text-gray-900 dark:text-white">{title}</p>
                              {c.secondaryTitle && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {c.secondaryTitle}
                                </p>
                              )}
                              {c.issn && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">ISSN: {c.issn}</p>
                              )}
                            </>
                          )}
                        </div>
                        {volumeBadgeVisible(volNum) && (
                          <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {t('catalog.volumeNumber')} {volNum}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })()}

          {item.series && item.series.length > 0 && (
            <Card>
              <CardHeader title={t('items.series')} />
              <div className="space-y-3">
                {item.series.map((s, i) => {
                  const volNum =
                    s.volumeNumber ??
                    s.volumeNumber ??
                    item.seriesVolumeNumbers?.[i] ??
                    item.seriesVolumeNumbers?.[i] ??
                    null;
                  const serieTitle = s.name ?? '—';
                  const openSerieCatalog = () => {
                    if (!s.id) return;
                    const params = new URLSearchParams();
                    params.set('serie_id', s.id);
                    params.set('serie_name', serieTitle);
                    navigate(`/biblios?${params.toString()}`);
                  };
                  return (
                    <div key={s.id ?? i} className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {s.id ? (
                          <button
                            type="button"
                            onClick={openSerieCatalog}
                            title={t('catalog.openInCatalog')}
                            className="group w-full text-left rounded-lg -m-1 p-1.5 border border-transparent hover:border-amber-200/90 dark:hover:border-amber-800/60 hover:bg-amber-50/90 dark:hover:bg-amber-950/35 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-amber-800 dark:text-amber-200 group-hover:underline underline-offset-2 decoration-amber-600/50">
                                  {serieTitle}
                                </p>
                                {s.issn && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ISSN: {s.issn}</p>
                                )}
                              </div>
                              <ExternalLink
                                className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 opacity-80 group-hover:opacity-100"
                                aria-hidden
                              />
                            </div>
                          </button>
                        ) : (
                          <>
                            <p className="font-medium text-gray-900 dark:text-white">{serieTitle}</p>
                            {s.issn && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">ISSN: {s.issn}</p>
                            )}
                          </>
                        )}
                      </div>
                      {volumeBadgeVisible(volNum) && (
                        <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          {t('catalog.volumeNumber')} {volNum}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          if (deleteItemLoading) return;
          setShowDeleteModal(false);
          setDeleteItemBorrowedError(false);
        }}
        title="Confirmer la suppression"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (deleteItemLoading) return;
                setShowDeleteModal(false);
                setDeleteItemBorrowedError(false);
              }}
            >
              Annuler
            </Button>
            {deleteItemBorrowedError ? (
              <Button variant="danger" disabled={deleteItemLoading} onClick={() => handleDelete(true)}>
                {t('items.forceDeleteItem')}
              </Button>
            ) : (
              <Button variant="danger" disabled={deleteItemLoading} onClick={() => handleDelete(false)}>
                Supprimer
              </Button>
            )}
          </div>
        }
      >
        <p className="text-gray-600 dark:text-gray-300">
          {deleteItemBorrowedError
            ? t('items.itemBorrowedForceDelete')
            : t('items.deleteConfirm', { title: item.title || 'Sans titre' })}
        </p>
      </Modal>

      {/* Add specimen modal */}
      <Modal
        isOpen={showAddSpecimenModal}
        onClose={() => setShowAddSpecimenModal(false)}
        title={t('items.addSpecimen')}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="submit" form="add-specimen-form" isLoading={isAddSpecimenLoading}>
              {t('common.add')}
            </Button>
          </div>
        }
      >
        <AddSpecimenForm
          formId="add-specimen-form"
          item={item}
          onLoadingChange={setIsAddSpecimenLoading}
          onSuccess={() => {
            setShowAddSpecimenModal(false);
            if (item.id) api.getBiblio(item.id).then(setItem);
          }}
        />
      </Modal>

      {/* Edit specimen modal */}
      <Modal
        isOpen={showEditSpecimenModal}
        onClose={() => {
          setShowEditSpecimenModal(false);
          setSelectedSpecimen(null);
        }}
        title={t('items.editSpecimen')}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="submit" form="edit-specimen-form" isLoading={isEditSpecimenLoading}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        {selectedSpecimen && (
          <EditSpecimenForm
            formId="edit-specimen-form"
            item={item}
            specimen={selectedSpecimen}
            onLoadingChange={setIsEditSpecimenLoading}
            onSuccess={() => {
              setShowEditSpecimenModal(false);
              setSelectedSpecimen(null);
              if (item.id) api.getBiblio(item.id).then(setItem);
            }}
          />
        )}
      </Modal>

      {/* Delete specimen confirmation modal */}
      <Modal
        isOpen={showDeleteSpecimenModal}
        onClose={() => {
          setShowDeleteSpecimenModal(false);
          setSelectedSpecimen(null);
          setDeleteSpecimenBorrowedError(false);
        }}
        title={t('common.confirm')}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteSpecimenModal(false);
                setSelectedSpecimen(null);
                setDeleteSpecimenBorrowedError(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={deleteSpecimenLoading}
              onClick={() => handleDeleteSpecimen(deleteSpecimenBorrowedError)}
            >
              {deleteSpecimenBorrowedError ? t('items.forceDeleteSpecimen') : t('common.delete')}
            </Button>
          </div>
        }
      >
        {selectedSpecimen && (
          <p className="text-gray-600 dark:text-gray-300">
            {deleteSpecimenBorrowedError
              ? t('items.specimenBorrowedForceDelete')
              : t('items.confirmDeleteSpecimen', { identification: selectedSpecimen.barcode || 'Sans code' })}
          </p>
        )}
      </Modal>
    </div>
  );
}

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-gray-400 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-gray-900 dark:text-white">{text}</p>
      </div>
    </div>
  );
}

interface SpecimenCardProps {
  specimen: Item;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SpecimenCard({ specimen, canManage, onEdit, onDelete }: SpecimenCardProps) { // specimen is physical Item
  const { t } = useTranslation();

  const getAvailabilityBadge = (borrowed?: boolean) => {
    if (borrowed === true) return <Badge variant="warning">{t('items.borrowed')}</Badge>;
    return <Badge variant="success">{t('items.available')}</Badge>;
  };

  const borrowableBadge =
    specimen.borrowable == null
      ? null
      : specimen.borrowable
        ? <Badge variant="success">{t('items.borrowableYes')}</Badge>
        : <Badge variant="danger">{t('items.borrowableNo')}</Badge>;

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-gray-900 dark:text-white">
          {specimen.barcode || t('items.noSpecimens')}
        </p>
        <div className="flex items-center gap-2">
          {getAvailabilityBadge(specimen.borrowed)}
          {borrowableBadge}
          {canManage && (
            <div className="flex gap-1">
              <button
                onClick={onEdit}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title={t('common.edit')}
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      {specimen.callNumber && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.callNumber')}: {specimen.callNumber}</p>
      )}
      {specimen.volumeDesignation && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.volumeDesignation')}: {specimen.volumeDesignation}</p>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('items.source')}: {specimen.sourceName ?? '—'}
      </p>
    </div>
  );
}

interface AddSpecimenFormProps {
  formId: string;
  item: Biblio;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
}

function AddSpecimenForm({ formId, item, onLoadingChange, onSuccess }: AddSpecimenFormProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const suggestedCallNumber = getSuggestedCallNumberFromItem(item);
  const [formData, setFormData] = useState({
    barcode: '',
    callNumber: '',
    volumeDesignation: '',
    borrowable: '' as '' | 'true' | 'false',
    sourceId: '',
  });

  useEffect(() => {
    api.getSources(false).then(setSources).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (item.id == null) return;
    if (formData.barcode.trim() === '') {
      setError(t('items.specimenBarcodeRequired'));
      return;
    }
    if (!validateCallNumber(formData.callNumber)) return;
    onLoadingChange(true);
    setError(null);
    try {
      await api.createItem(item.id, {
        barcode: formData.barcode.trim(),
        callNumber: formData.callNumber || undefined,
        volumeDesignation: formData.volumeDesignation || undefined,
        borrowable:
          formData.borrowable === ''
            ? undefined
            : formData.borrowable === 'true',
        sourceId: formData.sourceId || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding specimen:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('items.specimenBarcode')}
        value={formData.barcode}
        onChange={(e) => {
          setError(null);
          setFormData({ ...formData, barcode: e.target.value });
        }}
      />
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <CallNumberField
        label={t('items.callNumber')}
        value={formData.callNumber}
        onChange={(v) => setFormData({ ...formData, callNumber: v })}
        suggestedValue={suggestedCallNumber}
        placeholder={suggestedCallNumber}
      />
      <Input
        label={t('items.volumeDesignation')}
        value={formData.volumeDesignation}
        onChange={(e) => setFormData({ ...formData, volumeDesignation: e.target.value })}
        placeholder="e.g. t. 2"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.source')}
        </label>
        <select
          value={formData.sourceId}
          onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.borrowable')}
        </label>
        <select
          value={formData.borrowable}
          onChange={(e) => setFormData({ ...formData, borrowable: e.target.value as '' | 'true' | 'false' })}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="">{t('items.notSpecified')}</option>
          <option value="true">{t('items.borrowableYes')}</option>
          <option value="false">{t('items.borrowableNo')}</option>
        </select>
      </div>
    </form>
  );
}

interface EditSpecimenFormProps {
  formId: string;
  item: Biblio;
  specimen: Item;
  onLoadingChange: (loading: boolean) => void;
  onSuccess: () => void;
}

function EditSpecimenForm({ formId, item, specimen, onLoadingChange, onSuccess }: EditSpecimenFormProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const suggestedCallNumber = getSuggestedCallNumberFromItem(item);
  const [formData, setFormData] = useState({
    barcode: specimen.barcode || '',
    callNumber: specimen.callNumber || '',
    volumeDesignation: specimen.volumeDesignation || '',
    borrowable: specimen.borrowable == null ? '' : specimen.borrowable ? 'true' : 'false',
    place: specimen.place != null ? String(specimen.place) : '',
    notes: specimen.notes || '',
    price: specimen.price || '',
    sourceId: specimen.sourceId || '',
  });

  useEffect(() => {
    api.getSources(false).then(setSources).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (item.id == null) return;
    if (formData.barcode.trim() === '') {
      setError(t('items.specimenBarcodeRequired'));
      return;
    }
    if (!validateCallNumber(formData.callNumber)) return;
    onLoadingChange(true);
    setError(null);
    try {
      await api.updateItem(item.id, specimen.id, {
        barcode: formData.barcode.trim(),
        callNumber: formData.callNumber || undefined,
        volumeDesignation: formData.volumeDesignation || undefined,
        borrowable:
          formData.borrowable === ''
            ? undefined
            : formData.borrowable === 'true',
        place: formData.place ? parseInt(formData.place, 10) : undefined,
        notes: formData.notes || undefined,
        price: formData.price || undefined,
        sourceId: formData.sourceId || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Error updating specimen:', error);
    } finally {
      onLoadingChange(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('items.specimenBarcode')}
        value={formData.barcode}
        onChange={(e) => {
          setError(null);
          setFormData({ ...formData, barcode: e.target.value });
        }}
      />
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <CallNumberField
        label={t('items.callNumber')}
        value={formData.callNumber}
        onChange={(v) => setFormData({ ...formData, callNumber: v })}
        suggestedValue={suggestedCallNumber}
        excludeSpecimenId={specimen.id}
        placeholder={suggestedCallNumber}
      />
      <Input
        label={t('items.volumeDesignation')}
        value={formData.volumeDesignation}
        onChange={(e) => setFormData({ ...formData, volumeDesignation: e.target.value })}
        placeholder="e.g. t. 2"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.source')}
        </label>
        <select
          value={formData.sourceId}
          onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.borrowable')}
        </label>
        <select
          value={formData.borrowable}
          onChange={(e) => setFormData({ ...formData, borrowable: e.target.value as '' | 'true' | 'false' })}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="">{t('items.notSpecified')}</option>
          <option value="true">{t('items.borrowableYes')}</option>
          <option value="false">{t('items.borrowableNo')}</option>
        </select>
      </div>
      <Input
        label={t('items.specimenNotes')}
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
      />
      <Input
        label={t('items.specimenPrice')}
        value={formData.price}
        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
      />
    </form>
  );
}

