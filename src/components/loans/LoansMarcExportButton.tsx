import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';

type MarcFormat = 'json' | 'marc21' | 'unimarc' | 'marcxml';
type MarcEncoding = 'utf8' | 'marc8';

interface ExportChoice {
  archived: boolean;
  format: MarcFormat;
  encoding?: MarcEncoding;
  label: string;
}

function buildChoices(t: (k: string) => string): { active: ExportChoice[]; archived: ExportChoice[] } {
  const active: ExportChoice[] = [
    { archived: false, format: 'json', label: t('loans.export.formatJson') },
    { archived: false, format: 'marc21', encoding: 'utf8', label: t('loans.export.marc21Utf8') },
    { archived: false, format: 'marc21', encoding: 'marc8', label: t('loans.export.marc21Marc8') },
    { archived: false, format: 'unimarc', encoding: 'utf8', label: t('loans.export.unimarcUtf8') },
    { archived: false, format: 'unimarc', encoding: 'marc8', label: t('loans.export.unimarcMarc8') },
    { archived: false, format: 'marcxml', label: t('loans.export.formatMarcxml') },
  ];
  const archived: ExportChoice[] = [
    { archived: true, format: 'json', label: t('loans.export.formatJson') },
    { archived: true, format: 'marc21', encoding: 'utf8', label: t('loans.export.marc21Utf8') },
    { archived: true, format: 'marc21', encoding: 'marc8', label: t('loans.export.marc21Marc8') },
    { archived: true, format: 'unimarc', encoding: 'utf8', label: t('loans.export.unimarcUtf8') },
    { archived: true, format: 'unimarc', encoding: 'marc8', label: t('loans.export.unimarcMarc8') },
    { archived: true, format: 'marcxml', label: t('loans.export.formatMarcxml') },
  ];
  return { active, archived };
}

interface LoansMarcExportButtonProps {
  userId: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoansMarcExportButton({
  userId,
  variant = 'secondary',
  size = 'sm',
  className = '',
}: LoansMarcExportButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { active: activeChoices, archived: archivedChoices } = buildChoices(t);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const runExport = useCallback(
    async (choice: ExportChoice) => {
      setError(null);
      setLoading(true);
      setOpen(false);
      try {
        const params: Parameters<typeof api.exportUserLoansMarc>[1] = {
          archived: choice.archived,
          format: choice.format,
        };
        if (choice.format === 'marc21' || choice.format === 'unimarc') {
          params.encoding = choice.encoding ?? 'utf8';
        }
        const { blob, filename } = await api.exportUserLoansMarc(userId, params);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e: unknown) {
        setError(getApiErrorMessage(e, t) || t('loans.export.error'));
      } finally {
        setLoading(false);
      }
    },
    [userId, t]
  );

  return (
    <div className={`relative inline-flex ${className}`} ref={wrapRef}>
      <div className="inline-flex rounded-lg shadow-sm">
        <Button
          type="button"
          variant={variant}
          size={size}
          isLoading={loading}
          disabled={loading}
          onClick={() => setOpen((o) => !o)}
          className="rounded-r-none border-r border-gray-300/50 dark:border-gray-600/50"
          leftIcon={<Download className="h-4 w-4" />}
        >
          {t('loans.export.download')}
        </Button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center justify-center px-2 py-1.5 min-h-[2.25rem] rounded-r-lg border border-l-0 border-gray-200 dark:border-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 ${
            variant === 'secondary'
              ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              : 'bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700'
          }`}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t('loans.export.chooseFormat')}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[16rem] max-h-[min(70vh,24rem)] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          role="menu"
        >
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('loans.export.sectionActive')}
          </div>
          {activeChoices.map((c, i) => (
            <button
              key={`a-${i}`}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
              onClick={() => void runExport(c)}
            >
              {c.label}
            </button>
          ))}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('loans.export.sectionArchived')}
          </div>
          {archivedChoices.map((c, i) => (
            <button
              key={`h-${i}`}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
              onClick={() => void runExport(c)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="absolute left-0 top-full mt-1 max-w-xs text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
