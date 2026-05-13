import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';

export interface ReaderAssistantChatInputProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  disabled?: boolean;
}

export default function ReaderAssistantChatInput({
  draft,
  onDraftChange,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}: ReaderAssistantChatInputProps) {
  const { t } = useTranslation();

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <textarea
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        aria-label={t('readerAssistant.messageInput')}
        placeholder={t('readerAssistant.placeholder')}
        className="w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm outline-none ring-amber-500/30 focus-visible:ring-2 dark:border-gray-600 dark:bg-gray-950"
        disabled={disabled || isSubmitting}
      />
      <div className="flex justify-between gap-2 text-[11px] text-gray-400">
        <span>{t('readerAssistant.keyboardHint')}</span>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          isLoading={isSubmitting}
          disabled={!draft.trim() || disabled}
          onClick={() => onSubmit()}
        >
          {t('readerAssistant.send')}
        </Button>
      </div>
    </div>
  );
}
