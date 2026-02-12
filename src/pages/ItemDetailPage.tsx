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
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Modal, Input } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems, type MediaType } from '@/types';
import api from '@/services/api';
import type { Item, Specimen, Author } from '@/types';
import { useTranslation } from 'react-i18next';
import { LANG_OPTIONS, FUNCTION_OPTIONS, PUBLIC_TYPE_OPTIONS, getCodeLabel } from '@/utils/codeLabels';
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
    if (!item) return;
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
              {item.title1 || 'Sans titre'}
            </h1>
            {item.title2 && (
              <p className="text-gray-600 dark:text-gray-400">{item.title2}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge>
                {item.media_type 
                  ? t(`items.mediaType.${getMediaTypeTranslationKey(item.media_type)}`)
                  : t('items.document')
                }
              </Badge>
              {item.public_type && (
                <Badge variant="secondary">
                  {getCodeLabel(t, PUBLIC_TYPE_OPTIONS, item.public_type)}
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
              <InfoRow icon={Hash} label={t('items.identification')} value={item.identification} />
              <InfoRow icon={User} label={t('items.mainAuthor')} value={formatAuthors(item.authors1)} />
              <InfoRow icon={User} label={t('items.secondaryAuthor')} value={formatAuthors(item.authors2)} />
              <InfoRow icon={Calendar} label={t('items.publicationDate')} value={item.publication_date} />
              <InfoRow icon={Building} label={t('items.publisher')} value={item.edition?.name} />
              <InfoRow icon={MapPin} label={t('items.publicationPlace')} value={item.edition?.place} />
              {item.title3 && (
                <InfoRow icon={FileText} label={t('items.title3')} value={item.title3} />
              )}
              {item.lang !== undefined && item.lang !== null && (
                <InfoRow icon={BookOpen} label={t('items.language')} value={getCodeLabel(t, LANG_OPTIONS, item.lang)} />
              )}
              {item.public_type && (
                <InfoRow icon={Tag} label={t('items.publicType')} value={getCodeLabel(t, PUBLIC_TYPE_OPTIONS, item.public_type)} />
              )}
              {item.nb_specimens !== undefined && (
                <InfoRow 
                  icon={Plus} 
                  label={t('items.specimens')} 
                  value={item.nb_borrowed_specimens !== undefined && item.nb_specimens !== undefined
                    ? `${item.nb_borrowed_specimens}/${item.nb_specimens}`
                    : item.nb_specimens?.toString()
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
              subtitle={t('items.specimenCount', { count: item.specimens?.length || 0 })}
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
              <CardHeader title="Collection" />
              <p className="font-medium text-gray-900 dark:text-white">
                {item.collection.title1}
              </p>
              {item.collection.issn && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ISSN: {item.collection.issn}
                </p>
              )}
            </Card>
          )}

          {item.serie && (
            <Card>
              <CardHeader title="Série" />
              <p className="font-medium text-gray-900 dark:text-white">
                {item.serie.name}
              </p>
              {item.serie.volume_number && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Volume {item.serie.volume_number}
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
          Êtes-vous sûr de vouloir supprimer "{item.title1}" ? Cette action est irréversible.
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
          itemId={item.id}
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
            itemId={item.id}
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
        }}
        title={t('common.confirm')}
        size="sm"
      >
        {selectedSpecimen && (
          <>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {t('items.confirmDeleteSpecimen', { identification: selectedSpecimen.identification || 'Sans code' })}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowDeleteSpecimenModal(false);
                  setSelectedSpecimen(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!selectedSpecimen) return;
                  try {
                    await api.deleteSpecimen(item.id, selectedSpecimen.id);
                    setShowDeleteSpecimenModal(false);
                    setSelectedSpecimen(null);
                    // Refresh item data
                    api.getItem(item.id).then(setItem);
                  } catch (error) {
                    console.error('Error deleting specimen:', error);
                  }
                }}
              >
                {t('common.delete')}
              </Button>
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
  
  const getAvailabilityBadge = (availability?: number) => {
    if (availability === 0) return <Badge variant="success">{t('items.available')}</Badge>;
    if (availability === 1) return <Badge variant="warning">{t('items.borrowed')}</Badge>;
    return <Badge>{t('items.unavailable')}</Badge>;
  };

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-gray-900 dark:text-white">
          {specimen.identification || t('items.noSpecimens')}
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
      {specimen.cote && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('items.callNumber')}: {specimen.cote}</p>
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

function EditItemForm({ item, onSuccess }: EditItemFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    title1: item.title1 || '',
    title2: item.title2 || '',
    title3: item.title3 || '',
    identification: item.identification || '',
    publication_date: item.publication_date || '',
    abstract_: item.abstract_ || '',
    keywords: item.keywords || '',
    subject: item.subject || '',
    media_type: item.media_type || 'b' as MediaType,
    public_type: item.public_type?.toString() || '',
    lang: item.lang?.toString() || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const updateData: Partial<Item> = {
        title1: formData.title1,
        title2: formData.title2,
        title3: formData.title3,
        identification: formData.identification,
        publication_date: formData.publication_date,
        abstract_: formData.abstract_,
        keywords: formData.keywords,
        subject: formData.subject,
        media_type: formData.media_type as MediaType,
        public_type: formData.public_type ? parseInt(formData.public_type) : undefined,
        lang: formData.lang ? parseInt(formData.lang) : undefined,
      };
      const updated = await api.updateItem(item.id, updateData);
      onSuccess(updated);
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={t('items.titleField')}
        value={formData.title1}
        onChange={(e) => setFormData({ ...formData, title1: e.target.value })}
        required
      />
      <Input
        label={t('items.subtitle')}
        value={formData.title2}
        onChange={(e) => setFormData({ ...formData, title2: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t('items.isbn')}
          value={formData.identification}
          onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
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
            value={formData.public_type}
            onChange={(e) => setFormData({ ...formData, public_type: e.target.value })}
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
      
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Input
            label={t('items.title3')}
            value={formData.title3}
            onChange={(e) => setFormData({ ...formData, title3: e.target.value })}
          />
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

      <div className="flex justify-between items-center pt-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? t('common.hide') : t('common.advanced')}
        </Button>
        <div className="flex gap-2">
          <Button type="submit" isLoading={isLoading}>
            {t('common.save')}
          </Button>
        </div>
      </div>
    </form>
  );
}

interface AddSpecimenFormProps {
  itemId: number;
  onSuccess: () => void;
}

function AddSpecimenForm({ itemId, onSuccess }: AddSpecimenFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    identification: '',
    cote: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Note: This would need a dedicated endpoint in the API
      await api.updateItem(itemId, {
        specimens: [{ ...formData, id: 0, status: 0, availability: 0 }],
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
        value={formData.identification}
        onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
        required
      />
      <Input
        label={t('items.callNumber')}
        value={formData.cote}
        onChange={(e) => setFormData({ ...formData, cote: e.target.value })}
      />
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('common.add')}
        </Button>
      </div>
    </form>
  );
}

interface EditSpecimenFormProps {
  itemId: number;
  specimen: Specimen;
  onSuccess: () => void;
}

function EditSpecimenForm({ itemId, specimen, onSuccess }: EditSpecimenFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    identification: specimen.identification || '',
    cote: specimen.cote || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.updateSpecimen(itemId, specimen.id, {
        identification: formData.identification,
        cote: formData.cote,
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
        value={formData.identification}
        onChange={(e) => setFormData({ ...formData, identification: e.target.value })}
        required
      />
      <Input
        label={t('items.callNumber')}
        value={formData.cote}
        onChange={(e) => setFormData({ ...formData, cote: e.target.value })}
      />
      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" isLoading={isLoading}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}

