import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReaderAssistantChatTurn } from '@/types';
import Badge from '@/components/common/Badge';
import ReaderAssistantRecommendationCards from './ReaderAssistantRecommendationCards';

export interface ReaderAssistantChatThreadProps {
  messages: ReaderAssistantChatTurn[];
  isLoadingHistory?: boolean;
}

/**
 * Renders the chat transcript with auto-scroll when new content appears
 * (only if the user was already near the bottom).
 */
export default function ReaderAssistantChatThread({ messages, isLoadingHistory }: ReaderAssistantChatThreadProps) {
  const { t } = useTranslation();
  const scrollElRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollElRef.current;
    if (!el || !stickBottomRef.current) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const onScroll = () => {
    const el = scrollElRef.current;
    if (!el) return;
    const threshold = 80;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  return (
    <div
      ref={scrollElRef}
      onScroll={onScroll}
      className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-900/40"
      role="log"
      aria-relevant="additions"
      aria-live="polite"
      aria-busy={isLoadingHistory ?? false}
    >
      {isLoadingHistory ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-16 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-12 w-4/5 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      ) : messages.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">{t('readerAssistant.emptyThread')}</p>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <article
              key={m.id}
              className={`flex flex-col gap-1 rounded-xl px-4 py-3 ${
                m.role === 'user'
                  ? 'ml-6 bg-amber-50 text-gray-900 dark:bg-amber-900/20 dark:text-gray-100'
                  : 'mr-6 bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
              }`}
            >
              <header className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {m.role === 'user' ? t('readerAssistant.roleUser') : t('readerAssistant.roleAssistant')}
              </header>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              {m.role === 'assistant' && m.fallbackUsed ? (
                <div className="mt-2">
                  <Badge variant="warning" size="sm">
                    {t('readerAssistant.degradedMode')}
                  </Badge>
                </div>
              ) : null}
              {m.role === 'assistant' && m.recommendations && m.recommendations.length > 0 ? (
                <ReaderAssistantRecommendationCards recommendations={m.recommendations} />
              ) : null}
            </article>
          ))}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
