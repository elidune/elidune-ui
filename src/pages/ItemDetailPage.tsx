import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Minus,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Modal, Input } from '@/components/common';
import CallNumberField from '@/components/specimen/CallNumberField';
import { buildSuggestedCallNumber, validateCallNumber } from '@/utils/callNumber';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems, type MediaType } from '@/types';
import api from '@/services/api';
import type { Item, Specimen, Author } from '@/types';
import { useTranslation } from 'react-i18next';
import { LANG_OPTIONS, FUNCTION_OPTIONS, PUBLIC_TYPE_OPTIONS, STATUS_OPTIONS, getCodeLabel } from '@/utils/codeLabels';
import type { MediaTypeOption } from '@/types';

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType): string {
  const keyMap: Record<MediaType, string> = {
    'u': 'unknown',
    'b': 'printedText',
    'bc': 'comics',
    'p': 'periodic',
    'v': 'video',
    'vt': 'videoTape',
    'vd': 'videoDvd',
    'a': 'audio',
    'am': 'audioMusic',
    'amt': 'audioMusicTape',
    'amc': 'audioMusicCd',
    'an': 'audioNonMusic',
    'c': 'cdRom',
    'i': 'images',
    'm': 'multimedia',
  };
  return keyMap[mediaType] || 'unknown';
}

/** Derive suggested call number from item: [CATEGORY]-[YEAR]-[AUTHOR]. */
function getSuggestedCallNumberFromItem(item: Item): string {
  const categoryCode = item.media_type
    ? String(item.media_type).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'GEN'
    : 'GEN';
  const year =
    item.publication_date?.trim().slice(0, 4) ||
    item.edition?.date?.trim().slice(0, 4) ||
    undefined;
  const authorName = item.authors?.[0]?.lastname?.trim();
  return buildSuggestedCallNumber({
    categoryCode: categoryCode || 'GEN',
    year: year ? parseInt(year, 10) : undefined,
    authorOrCollectorName: authorName,
  });
}

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddSpecimenModal, setShowAddSpecimenModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditSpecimenModal, setShowEditSpecimenModal] = useState(false);
  const [showDeleteSpecimenModal, setShowDeleteSpecimenModal] = useState(false);
  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen | null>(null);
  const [deleteSpecimenBorrowedError, setDeleteSpecimenBorrowedError] = useState(false);
  const [deleteSpecimenLoading, setDeleteSpecimenLoading] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      try {
        const data = await api.getItem(parseInt(id));
        setItem(data);
      } catch (error) {
        console.error('Error fetching item:', error);
        navigate('/items');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItem();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!item || item.id == null) return;
    try {
      await api.deleteItem(item.id);
      navigate('/items');
    } catch (error) {
      console.error('Error deleting item:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/items')}
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
                {item.media_type 
                  ? t(`items.mediaType.${getMediaTypeTranslationKey(item.media_type as MediaType)}`)
                  : t('items.document')
                }
              </Badge>
              {item.audience_type != null && (
                <Badge variant="secondary">
                  {getCodeLabel(t, PUBLIC_TYPE_OPTIONS, item.audience_type)}
                </Badge>
              )}
              {item.is_valid === 0 && <Badge variant="warning">Non validé</Badge>}
            </div>
          </div>
        </div>

        {canManageItems(user?.account_type) && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowEditModal(true)} leftIcon={<Edit className="h-4 w-4" />}>
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
          <Card>
            <CardHeader title={t('items.generalInfo')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={Hash} label={t('items.isbn')} value={item.isbn} />
              <InfoRow icon={User} label={t('items.mainAuthor')} value={item.authors?.length ? formatAuthors([item.authors[0]]) : undefined} />
              <InfoRow icon={User} label={t('items.secondaryAuthor')} value={item.authors && item.authors.length > 1 ? formatAuthors(item.authors.slice(1)) : undefined} />
              <InfoRow icon={Calendar} label={t('items.publicationDate')} value={item.publication_date} />
              <InfoRow icon={Building} label={t('items.publisher')} value={item.edition?.publisher_name} />
              <InfoRow icon={MapPin} label={t('items.publicationPlace')} value={item.edition?.place_of_publication} />
              {item.lang !== undefined && item.lang !== null && (
                <InfoRow icon={BookOpen} label={t('items.language')} value={getCodeLabel(t, LANG_OPTIONS, item.lang)} />
              )}
              {item.audience_type != null && (
                <InfoRow icon={Tag} label={t('items.publicType')} value={getCodeLabel(t, PUBLIC_TYPE_OPTIONS, item.audience_type)} />
              )}
              {item.specimens != null && (
                <InfoRow 
                  icon={Plus} 
                  label={t('items.specimens')} 
                  value={item.specimens.length > 0
                    ? `${item.specimens.filter(s => s.availability === 0).length}/${item.specimens.length}`
                    : '0'
                  } 
                />
              )}
            </div>
          </Card>

          {item.abstract_ && (
            <Card>
              <CardHeader title={t('items.abstract')} />
              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {item.abstract_}
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
                    <p className="text-gray-600 dark:text-gray-300">{item.keywords}</p>
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
              subtitle={t('items.specimenCount', { count: item.specimens?.length ?? 0 })}
              action={
                canManageItems(user?.account_type) && (
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
            {item.specimens && item.specimens.length > 0 ? (
              <div className="space-y-3">
                {item.specimens.map((specimen) => (
                  <SpecimenCard
                    key={specimen.id}
                    specimen={specimen}
                    canManage={canManageItems(user?.account_type)}
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

          {item.collection && (
            <Card>
              <CardHeader title={t('items.collection')} />
              <p className="font-medium text-gray-900 dark:text-white">
                {item.collection.primary_title || item.collection.secondary_title || item.collection.tertiary_title || '—'}
              </p>
              {item.collection.issn && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ISSN: {item.collection.issn}
                </p>
              )}
            </Card>
          )}

          {(item.series || item.series_volume_number != null) && (
            <Card>
              <CardHeader title={t('items.series')} />
              <p className="font-medium text-gray-900 dark:text-white">
                {item.series?.name ?? '—'}
              </p>
              {(item.series_volume_number != null || item.series?.name) && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {item.series_volume_number != null ? `Volume ${item.series_volume_number}` : null}
                </p>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirmer la suppression"
        size="sm"
      >
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Êtes-vous sûr de vouloir supprimer "{item.title}" ? Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Supprimer
          </Button>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Modifier le document"
        size="lg"
      >
        <EditItemForm
          item={item}
          onSuccess={(updatedItem) => {
            setItem(updatedItem);
            setShowEditModal(false);
          }}
        />
      </Modal>

      {/* Add specimen modal */}
      <Modal
        isOpen={showAddSpecimenModal}
        onClose={() => setShowAddSpecimenModal(false)}
        title={t('items.addSpecimen')}
      >
        <AddSpecimenForm
          item={item}
          onSuccess={() => {
            setShowAddSpecimenModal(false);
            // Refresh item data
            api.getItem(item.id).then(setItem);
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
      >
        {selectedSpecimen && (
          <EditSpecimenForm
            item={item}
            specimen={selectedSpecimen}
            onSuccess={() => {
              setShowEditSpecimenModal(false);
              setSelectedSpecimen(null);
              // Refresh item data
              api.getItem(item.id).then(setItem);
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
      >
        {selectedSpecimen && (
          <>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {deleteSpecimenBorrowedError
                ? t('items.specimenBorrowedForceDelete')
                : t('items.confirmDeleteSpecimen', { identification: selectedSpecimen.barcode || 'Sans code' })}
            </p>
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
              {deleteSpecimenBorrowedError ? (
                <Button
                  variant="danger"
                  disabled={deleteSpecimenLoading}
                  onClick={async () => {
                    if (!selectedSpecimen || item.id == null) return;
                    setDeleteSpecimenLoading(true);
                    try {
                      await api.deleteSpecimen(item.id, selectedSpecimen.id, true);
                      setShowDeleteSpecimenModal(false);
                      setSelectedSpecimen(null);
                      setDeleteSpecimenBorrowedError(false);
                      api.getItem(item.id).then(setItem);
                    } catch (error) {
                      console.error('Error force-deleting specimen:', error);
                    } finally {
                      setDeleteSpecimenLoading(false);
                    }
                  }}
                >
                  {t('items.forceDeleteSpecimen')}
                </Button>
              ) : (
                <Button
                  variant="danger"
                  disabled={deleteSpecimenLoading}
                  onClick={async () => {
                    if (!selectedSpecimen || item.id == null) return;
                    setDeleteSpecimenLoading(true);
                    try {
                      await api.deleteSpecimen(item.id, selectedSpecimen.id);
                      setShowDeleteSpecimenModal(false);
                      setSelectedSpecimen(null);
                      api.getItem(item.id).then(setItem);
                    } catch (error: unknown) {
                      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
                      if (typeof msg === 'string' && (msg.includes('borrowed') || msg.includes('force=true'))) {
                        setDeleteSpecimenBorrowedError(true);
                      } else {
                        console.error('Error deleting specimen:', error);
                      }
                    } finally {
                      setDeleteSpecimenLoading(false);
                    }
                  }}
                >
                  {t('common.delete')}
                </Button>
              )}
            </div>
          </>
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
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-gray-400 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-gray-900 dark:text-white">{value || 'Non renseigné'}</p>
      </div>
    </div>
  );
}

interface SpecimenCardProps {
  specimen: Specimen;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SpecimenCard({ specimen, canManage, onEdit, onDelete }: SpecimenCardProps) {
  const { t } = useTranslation();

  const borrowStatusLabel =
    specimen.borrow_status != null
      ? STATUS_OPTIONS.find((o) => o.value === String(specimen.borrow_status))?.labelKey
      : null;

  const getAvailabilityBadge = (availability?: number) => {
    if (availability === 0) return <Badge variant="success">{t('items.available')}</Badge>;
    if (availability === 1) return <Badge variant="warning">{t('items.borrowed')}</Badge>;
    return <Badge>{t('items.unavailable')}</Badge>;
  };

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-gray-900 dark:text-white">
          {specimen.barcode || t('items.noSpecimens')}
        </p>
        <div className="flex items-center gap-2">
          {getAvailabilityBadge(specimen.availability)}
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
      {specimen.call_number && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.callNumber')}: {specimen.call_number}</p>
      )}
      {specimen.volume_designation && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.volumeDesignation')}: {specimen.volume_designation}</p>
      )}
      {borrowStatusLabel != null && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.borrowStatus')}: {t(borrowStatusLabel)}</p>
      )}
      {specimen.source_name && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.source')}: {specimen.source_name}</p>
      )}
    </div>
  );
}

interface EditItemFormProps {
  item: Item;
  onSuccess: (item: Item) => void;
}

type AuthorForm = { id: number; lastname: string; firstname: string; function: string };

function EditItemForm({ item, onSuccess }: EditItemFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const toAuthorForm = (a: Author): AuthorForm => ({
    id: a.id,
    lastname: a.lastname ?? '',
    firstname: a.firstname ?? '',
    function: a.function ?? '',
  });
  const allAuthors = item.authors ?? [];
  const [formData, setFormData] = useState({
    title: item.title || '',
    isbn: item.isbn || '',
    publication_date: item.publication_date || '',
    abstract_: item.abstract_ || '',
    keywords: item.keywords || '',
    subject: item.subject || '',
    media_type: (item.media_type || 'b') as MediaType,
    audience_type: item.audience_type?.toString() ?? '',
    lang: item.lang?.toString() ?? '',
    edition_publisher: item.edition?.publisher_name ?? '',
    edition_place: item.edition?.place_of_publication ?? '',
    edition_date: item.edition?.date ?? '',
    authors: allAuthors.map(toAuthorForm),
    collection_id: item.collection?.id?.toString() ?? '',
    collection_primary_title: item.collection?.primary_title ?? '',
    series_id: item.series?.id?.toString() ?? '',
    series_name: item.series?.name ?? '',
    series_volume: item.series_volume_number?.toString() ?? '',
  });

  const MEDIA_TYPES: MediaTypeOption[] = [
    { value: 'u', label: t('items.mediaType.unknown') },
    { value: 'b', label: t('items.mediaType.printedText') },
    { value: 'bc', label: t('items.mediaType.comics') },
    { value: 'p', label: t('items.mediaType.periodic') },
    { value: 'v', label: t('items.mediaType.video') },
    { value: 'vt', label: t('items.mediaType.videoTape') },
    { value: 'vd', label: t('items.mediaType.videoDvd') },
    { value: 'a', label: t('items.mediaType.audio') },
    { value: 'am', label: t('items.mediaType.audioMusic') },
    { value: 'amt', label: t('items.mediaType.audioMusicTape') },
    { value: 'amc', label: t('items.mediaType.audioMusicCd') },
    { value: 'an', label: t('items.mediaType.audioNonMusic') },
    { value: 'c', label: t('items.mediaType.cdRom') },
    { value: 'i', label: t('items.mediaType.images') },
    { value: 'm', label: t('items.mediaType.multimedia') },
  ];

  const updateAuthor = (index: number, field: keyof AuthorForm, value: string) => {
    const arr = [...formData.authors];
    arr[index] = { ...arr[index], [field]: value };
    setFormData({ ...formData, authors: arr });
  };
  const addAuthor = () => {
    setFormData({
      ...formData,
      authors: [...formData.authors, { id: 0, lastname: '', firstname: '', function: '' }],
    });
  };
  const removeAuthor = (index: number) => {
    setFormData({ ...formData, authors: formData.authors.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (item.id == null) return;
    setIsLoading(true);
    try {
      const authorsPayload: Author[] = formData.authors.map((a) => ({
        id: a.id,
        lastname: a.lastname || undefined,
        firstname: a.firstname || undefined,
        function: a.function || undefined,
      }));
      const updateData: Partial<Item> = {
        title: formData.title || undefined,
        isbn: formData.isbn || undefined,
        publication_date: formData.publication_date || undefined,
        abstract_: formData.abstract_ || undefined,
        keywords: formData.keywords || undefined,
        subject: formData.subject || undefined,
        media_type: formData.media_type,
        audience_type: formData.audience_type ? parseInt(formData.audience_type, 10) : undefined,
        lang: formData.lang ? parseInt(formData.lang, 10) : undefined,
        edition: {
          id: item.edition?.id ?? null,
          publisher_name: formData.edition_publisher || undefined,
          place_of_publication: formData.edition_place || undefined,
          date: formData.edition_date || undefined,
        },
        authors: authorsPayload,
        collection: formData.collection_id
          ? { id: parseInt(formData.collection_id, 10), primary_title: formData.collection_primary_title || undefined }
          : undefined,
        series: formData.series_name || formData.series_volume
          ? { id: formData.series_id ? parseInt(formData.series_id, 10) : null, name: formData.series_name || undefined }
          : undefined,
        series_volume_number: formData.series_volume ? parseInt(formData.series_volume, 10) : undefined,
      };
      const updated = await api.updateItem(item.id, updateData);
      onSuccess(updated);
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAuthorRows = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('items.authors')}</span>
        <Button type="button" size="sm" variant="ghost" onClick={addAuthor} leftIcon={<Plus className="h-3 w-3" />}>
          {t('common.add')}
        </Button>
      </div>
      {formData.authors.map((author, index) => (
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
            <Minus className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('items.titleField')}
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t('items.isbn')}
          value={formData.isbn}
          onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
        />
        <Input
          label={t('items.publicationDate')}
          value={formData.publication_date}
          onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
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
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.abstract')}
        </label>
        <textarea
          value={formData.abstract_}
          onChange={(e) => setFormData({ ...formData, abstract_: e.target.value })}
          rows={4}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
      </div>
      <Input
        label={t('items.keywords')}
        value={formData.keywords}
        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
        placeholder={t('items.keywordsHint')}
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

          {renderAuthorRows()}

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
            <Input
              label={t('items.series')}
              value={formData.series_name}
              onChange={(e) => setFormData({ ...formData, series_name: e.target.value })}
              placeholder={t('items.seriesName')}
            />
            <Input
              label={t('items.serieVolume')}
              value={formData.series_volume}
              onChange={(e) => setFormData({ ...formData, series_volume: e.target.value })}
              placeholder="n°"
            />
          </div>
          <Input
            label={t('items.subject')}
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          />
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
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

interface AddSpecimenFormProps {
  item: Item;
  onSuccess: () => void;
}

function AddSpecimenForm({ item, onSuccess }: AddSpecimenFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const suggestedCallNumber = getSuggestedCallNumberFromItem(item);
  const [formData, setFormData] = useState({
    barcode: '',
    call_number: '',
    volume_designation: '',
    borrow_status: '' as string,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (item.id == null) return;
    if (!validateCallNumber(formData.call_number)) return;
    setIsLoading(true);
    try {
      await api.createSpecimen(item.id, {
        barcode: formData.barcode || undefined,
        call_number: formData.call_number || undefined,
        volume_designation: formData.volume_designation || undefined,
        borrow_status: formData.borrow_status ? parseInt(formData.borrow_status, 10) : undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding specimen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('items.specimenBarcode')}
        value={formData.barcode}
        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
      />
      <CallNumberField
        label={t('items.callNumber')}
        value={formData.call_number}
        onChange={(v) => setFormData({ ...formData, call_number: v })}
        suggestedValue={suggestedCallNumber}
        placeholder={suggestedCallNumber}
      />
      <Input
        label={t('items.volumeDesignation')}
        value={formData.volume_designation}
        onChange={(e) => setFormData({ ...formData, volume_designation: e.target.value })}
        placeholder="e.g. t. 2"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.borrowStatus')}
        </label>
        <select
          value={formData.borrow_status}
          onChange={(e) => setFormData({ ...formData, borrow_status: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="">{t('items.notSpecified')}</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('common.add')}
        </Button>
      </div>
    </form>
  );
}

interface EditSpecimenFormProps {
  item: Item;
  specimen: Specimen;
  onSuccess: () => void;
}

function EditSpecimenForm({ item, specimen, onSuccess }: EditSpecimenFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const suggestedCallNumber = getSuggestedCallNumberFromItem(item);
  const [formData, setFormData] = useState({
    barcode: specimen.barcode || '',
    call_number: specimen.call_number || '',
    volume_designation: specimen.volume_designation || '',
    borrow_status: specimen.borrow_status != null ? String(specimen.borrow_status) : '',
    place: specimen.place != null ? String(specimen.place) : '',
    notes: specimen.notes || '',
    price: specimen.price || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (item.id == null) return;
    if (!validateCallNumber(formData.call_number)) return;
    setIsLoading(true);
    try {
      await api.updateSpecimen(item.id, specimen.id, {
        barcode: formData.barcode || undefined,
        call_number: formData.call_number || undefined,
        volume_designation: formData.volume_designation || undefined,
        borrow_status: formData.borrow_status ? parseInt(formData.borrow_status, 10) : undefined,
        place: formData.place ? parseInt(formData.place, 10) : undefined,
        notes: formData.notes || undefined,
        price: formData.price || undefined,
      });
      onSuccess();
    } catch (error) {
      console.error('Error updating specimen:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('items.specimenBarcode')}
        value={formData.barcode}
        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
      />
      <CallNumberField
        label={t('items.callNumber')}
        value={formData.call_number}
        onChange={(v) => setFormData({ ...formData, call_number: v })}
        suggestedValue={suggestedCallNumber}
        excludeSpecimenId={specimen.id}
        placeholder={suggestedCallNumber}
      />
      <Input
        label={t('items.volumeDesignation')}
        value={formData.volume_designation}
        onChange={(e) => setFormData({ ...formData, volume_designation: e.target.value })}
        placeholder="e.g. t. 2"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('items.borrowStatus')}
        </label>
        <select
          value={formData.borrow_status}
          onChange={(e) => setFormData({ ...formData, borrow_status: e.target.value })}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          <option value="">{t('items.notSpecified')}</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(opt.labelKey)}
            </option>
          ))}
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
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

