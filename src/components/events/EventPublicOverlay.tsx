import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import type { Event, PublicType } from '@/types';
import api from '@/services/api';
import { base64ToDataUrl, isImageMime } from '@/utils/eventAttachment';
import PublicEventDetailsContent from './PublicEventDetailsContent';

interface EventPublicOverlayProps {
  event: Event;
  publicTypes: PublicType[];
  isOpen: boolean;
  onClose: () => void;
}

function viewportHalfLimits() {
  return {
    maxWidth: window.innerWidth * 0.5,
    maxHeight: window.innerHeight * 0.5,
  };
}

function fitsWithinViewportHalf(naturalWidth: number, naturalHeight: number) {
  const { maxWidth, maxHeight } = viewportHalfLimits();
  return naturalWidth <= maxWidth && naturalHeight <= maxHeight;
}

function EventOverlayFlyerImage({ src }: { src: string }) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [useNaturalSize, setUseNaturalSize] = useState(false);

  const updateDisplayMode = useCallback((width: number, height: number) => {
    setNaturalSize({ width, height });
    setUseNaturalSize(fitsWithinViewportHalf(width, height));
  }, []);

  useEffect(() => {
    if (!naturalSize) return;

    const onResize = () => {
      setUseNaturalSize(fitsWithinViewportHalf(naturalSize.width, naturalSize.height));
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [naturalSize]);

  return (
    <img
      src={src}
      alt=""
      onLoad={(event) => {
        const img = event.currentTarget;
        updateDisplayMode(img.naturalWidth, img.naturalHeight);
      }}
      className={`mx-auto rounded-xl object-contain shadow-md ${
        useNaturalSize ? 'h-auto w-auto max-h-none max-w-none' : 'h-auto w-auto max-h-[50vh] max-w-[50vw]'
      }`}
      style={
        useNaturalSize && naturalSize
          ? { width: naturalSize.width, height: naturalSize.height }
          : undefined
      }
    />
  );
}

export default function EventPublicOverlay({
  event,
  publicTypes,
  isOpen,
  onClose,
}: EventPublicOverlayProps) {
  const { t } = useTranslation();
  const imageMime = isImageMime(event.attachmentMimeType);

  const { data: detail, isLoading: isImageLoading } = useQuery({
    queryKey: ['public-event', event.id],
    queryFn: () => api.getEvent(event.id),
    enabled: isOpen && imageMime,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === 'Escape') onClose();
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

  const titleId = `event-overlay-title-${event.id}`;

  const b64 = detail?.attachmentDataBase64;
  const mime = detail?.attachmentMimeType ?? event.attachmentMimeType;
  const hasImage = imageMime && b64 && mime && isImageMime(mime);
  const imageSrc = hasImage ? base64ToDataUrl(b64, mime) : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('common.close')}
      />
      <div className="relative z-10 flex max-h-[min(96vh,980px)] w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <header className="relative shrink-0 border-b border-gray-200 px-5 py-4 pr-14 dark:border-gray-800 sm:px-7">
          <h2
            id={titleId}
            className="text-xl font-bold leading-snug tracking-tight text-gray-900 dark:text-white sm:text-2xl"
          >
            {event.name}
          </h2>
        </header>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          aria-label={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row lg:items-start">
            {imageMime && (
              <div className="flex shrink-0 justify-center border-b border-gray-200 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-gray-950/40 sm:p-6 lg:sticky lg:top-0 lg:w-auto lg:max-w-[50vw] lg:self-start lg:border-r lg:border-b-0">
                {isImageLoading ? (
                  <div className="aspect-[3/4] w-full max-w-[50vw] animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
                ) : imageSrc ? (
                  <EventOverlayFlyerImage src={imageSrc} />
                ) : null}
              </div>
            )}

            <div className="min-w-0 flex-1 p-5 sm:p-7 lg:p-8">
              <PublicEventDetailsContent
                event={event}
                publicTypes={publicTypes}
                variant="overlay"
                hideTitle
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
