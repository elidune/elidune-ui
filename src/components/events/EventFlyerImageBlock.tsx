import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { base64ToDataUrl } from '@/utils/eventAttachment';

interface EventFlyerImageBlockProps {
  dataBase64: string;
  mimeType: string;
  modalTitle: string;
  /** Small list leading image, full-height strip, square card poster, or panel */
  variant: 'thumb' | 'listLead' | 'cardPoster' | 'panel';
  className?: string;
  /** When variant is `panel`, size image from viewport (does not fill parent height). */
  fillAvailable?: boolean;
  /** When set, bypasses the built-in image lightbox. */
  onImageClick?: () => void;
  /** When false, renders a non-interactive preview (e.g. card opens detail on row click). */
  interactive?: boolean;
}

interface EventImageLightboxProps {
  src: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

function EventImageLightbox({ src, title, isOpen, onClose }: EventImageLightboxProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('common.close')}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label={t('common.close')}
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt=""
        className="relative z-10 max-h-[min(90vh,900px)] w-auto max-w-[min(92vw,1200px)] object-contain rounded-lg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

export default function EventFlyerImageBlock({
  dataBase64,
  mimeType,
  modalTitle,
  variant,
  className,
  fillAvailable = false,
  onImageClick,
  interactive = true,
}: EventFlyerImageBlockProps) {
  const { t } = useTranslation();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const src = base64ToDataUrl(dataBase64, mimeType);
  const useExternalLightbox = Boolean(onImageClick);

  const imgClass =
    variant === 'thumb'
      ? 'h-11 w-8 rounded object-cover border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
      : variant === 'listLead'
        ? 'h-full w-full object-cover bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700'
        : variant === 'cardPoster'
          ? 'h-full w-full object-cover bg-white dark:bg-gray-900'
          : fillAvailable
          ? 'h-auto w-full max-w-full max-h-[min(32svh,13rem)] object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 sm:max-h-[min(38svh,16rem)] lg:max-h-[min(44svh,20rem)]'
          : 'w-full max-h-52 rounded-lg object-contain border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950';

  const triggerClass =
    variant === 'listLead' || variant === 'cardPoster'
      ? `h-full w-full min-h-0 rounded-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-inset ${className ?? ''}`
      : variant === 'panel' && fillAvailable
        ? `flex w-full max-w-full items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${className ?? ''}`
        : `rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${className ?? ''}`;

  if (!interactive) {
    return <img src={src} alt="" className={imgClass} aria-hidden />;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onImageClick) {
            onImageClick();
            return;
          }
          setLightboxOpen(true);
        }}
        className={triggerClass}
        aria-label={t('events.viewAttachmentLarge')}
      >
        <img src={src} alt="" className={imgClass} />
      </button>
      {!useExternalLightbox && (
        <EventImageLightbox
          src={src}
          title={modalTitle}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
