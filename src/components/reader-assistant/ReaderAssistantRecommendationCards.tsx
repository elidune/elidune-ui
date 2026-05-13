import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReaderRecommendation } from '@/types';

export interface ReaderAssistantRecommendationCardsProps {
  recommendations: ReaderRecommendation[];
}

function ScoreBar({ score }: { score: number }) {
  const asRatio =
    Number.isFinite(score) && score > 1 ? Math.min(Math.max(score / 100, 0), 1) : Math.min(Math.max(score, 0), 1);
  return (
    <div
      className="h-1.5 w-full max-w-[120px] rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-2"
      role="progressbar"
      aria-valuenow={Math.round(asRatio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-[width]"
        style={{ width: `${asRatio * 100}%` }}
      />
    </div>
  );
}

export default function ReaderAssistantRecommendationCards({ recommendations }: ReaderAssistantRecommendationCardsProps) {
  const { t } = useTranslation();

  if (recommendations.length === 0) return null;

  return (
    <ul className="mt-3 space-y-3" role="list" aria-label={t('readerAssistant.recommendationsTitle')}>
      {recommendations.map((rec) => {
        const title =
          rec.kind === 'in_catalog'
            ? rec.biblio?.title ?? rec.biblioId ?? t('readerAssistant.untitledWork')
            : rec.externalRef ?? t('readerAssistant.externalWork');

        const noticeId = rec.kind === 'in_catalog' ? rec.biblioId ?? rec.biblio?.id : null;

        return (
          <li
            key={rec.id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900/80"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    rec.kind === 'in_catalog'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                      : 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
                  }`}
                >
                  {rec.kind === 'in_catalog'
                    ? t('readerAssistant.kindInCatalog')
                    : t('readerAssistant.kindExternal')}
                </span>
                <h4 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white break-words">{title}</h4>
                {rec.kind === 'in_catalog' && rec.biblio?.author && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {[rec.biblio.author.firstname, rec.biblio.author.lastname].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
              {noticeId ? (
                <Link
                  to={`/biblios/${noticeId}`}
                  className="shrink-0 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-2 py-1"
                >
                  {t('readerAssistant.viewRecord')}
                </Link>
              ) : rec.kind === 'external' && rec.externalRef && /^https?:\/\//i.test(rec.externalRef) ? (
                <a
                  href={rec.externalRef}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-md px-2 py-1"
                >
                  {t('readerAssistant.openLink')}
                </a>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="font-medium text-gray-800 dark:text-gray-200">
                {t('readerAssistant.rationaleLabel')}
              </span>{' '}
              {rec.rationale}
            </p>
            <ScoreBar score={rec.score} />
          </li>
        );
      })}
    </ul>
  );
}
