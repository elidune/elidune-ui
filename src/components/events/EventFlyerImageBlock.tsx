import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/common';
import { base64ToDataUrl } from '@/utils/eventAttachment';

interface EventFlyerImageBlockProps {
  dataBase64: string;
  mimeType: string;
  modalTitle: string;
  /** Small list leading image, or full-height strip in event list rows */
  variant: 'thumb' | 'listLead' | 'panel';
  className?: string;
}

export default function EventFlyerImageBlock({
  dataBase64,
  mimeType,
  modalTitle,
  variant,
  className,
}: EventFlyerImageBlockProps) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const src = base64ToDataUrl(dataBase64, mimeType);

  const imgClass =
    variant === 'thumb'
      ? 'h-11 w-8 rounded object-cover border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
      : variant === 'listLead'
        ? 'h-full w-full object-cover bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700'
        : 'w-full max-h-52 rounded-lg object-contain border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950';

  const triggerClass =
    variant === 'listLead'
      ? `h-full w-full min-h-0 rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset ${className ?? ''}`
      : `rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${className ?? ''}`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setLightboxOpen(true);
        }}
        className={triggerClass}
        aria-label={t('events.viewAttachmentLarge')}
      >
        <img src={src} alt="" className={imgClass} />
      </button>
      <Modal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={modalTitle}
        size="xl"
      >
        <div className="flex justify-center p-1">
          <img
            src={src}
            alt=""
            className="max-h-[min(70vh,720px)] w-auto max-w-full object-contain rounded-lg"
          />
        </div>
      </Modal>
    </>
  );
}
