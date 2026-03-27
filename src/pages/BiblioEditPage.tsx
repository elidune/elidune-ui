import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/common';
import { useAuth } from '@/contexts/AuthContext';
import { canManageItems } from '@/types';
import api from '@/services/api';
import type { Biblio } from '@/types';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import BiblioEditorForm from '@/components/items/BiblioEditorForm';

export default function BiblioEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const savedSearch = (location.state as { savedSearch?: unknown } | null)?.savedSearch;

  const [item, setItem] = useState<Biblio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      try {
        const data = await api.getBiblio(id);
        setItem(data);
      } catch {
        navigate('/biblios');
      } finally {
        setIsLoading(false);
      }
    };
    fetchItem();
  }, [id, navigate]);

  if (!canManageItems(user?.accountType)) {
    return id ? <Navigate to={`/biblios/${id}`} replace /> : <Navigate to="/biblios" replace />;
  }

  if (isLoading || !id) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        {t('errors.notFound')}
      </div>
    );
  }

  const backToDetail = () => {
    navigate(`/biblios/${id}`, { state: savedSearch !== undefined ? { savedSearch } : undefined });
  };

  return (
    <div className="max-w-[min(100%,96rem)] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
      <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 mb-6 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200/80 dark:border-gray-800/80">
        <div className="max-w-[min(100%,96rem)] mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={backToDetail}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800 shrink-0"
              aria-label={t('common.back')}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
                {t('items.editDocument')}
              </h1>
              {item.title && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{item.title}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            <Button variant="secondary" type="button" onClick={backToDetail}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="biblio-edit-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-8 lg:p-10 shadow-sm">
        <BiblioEditorForm
          key={item.id ?? id}
          mode="edit"
          formId="biblio-edit-form"
          initialBiblio={item}
          onLoadingChange={setIsSaving}
          onSubmitEdit={async (update) => {
            if (item.id == null) return;
            await api.updateBiblio(item.id, update);
            queryClient.invalidateQueries({ queryKey: ['biblios'] });
            navigate(`/biblios/${id}`, {
              state: savedSearch !== undefined ? { savedSearch } : undefined,
            });
          }}
        />
      </div>
    </div>
  );
}
