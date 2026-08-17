import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Camera, Loader2 } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import {
  getCameraBlockReason,
  requestCameraStream,
  stopMediaStream,
  type CameraBlockReason,
} from '@/utils/cameraSupport';

interface BarcodeCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  /** Stream obtained during the user click (keeps mobile permission prompts working). */
  initialStream?: MediaStream | null;
}

function isCameraError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError';
}

export default function BarcodeCameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title,
  initialStream = null,
}: BarcodeCameraScannerModalProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannedRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [decodingPhoto, setDecodingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<CameraBlockReason | null>(null);
  const [liveUnavailable, setLiveUnavailable] = useState(false);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    readerRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
  }, []);

  const handleResult = useCallback(
    (text: string) => {
      if (scannedRef.current) return;
      const value = text.trim();
      if (!value) return;
      scannedRef.current = true;
      stopScanner();
      onScan(value);
      onClose();
    },
    [onClose, onScan, stopScanner],
  );

  const startLiveScan = useCallback(
    async (stream: MediaStream) => {
      if (!videoRef.current) return;

      stopScanner();
      scannedRef.current = false;
      streamRef.current = stream;

      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 150,
      });
      readerRef.current = reader;

      controlsRef.current = await reader.decodeFromStream(stream, videoRef.current, (result) => {
        if (result) {
          handleResult(result.getText());
        }
      });
    },
    [handleResult, stopScanner],
  );

  const tryStartLiveCamera = useCallback(async () => {
    const reason = getCameraBlockReason();
    if (reason) {
      setBlockReason(reason);
      setLiveUnavailable(true);
      return;
    }

    setStarting(true);
    setError(null);
    setLiveUnavailable(false);

    try {
      const stream = initialStream ?? (await requestCameraStream());
      await startLiveScan(stream);
    } catch (err) {
      console.error('Camera start failed:', err);
      if (err instanceof Error && (err.message === 'insecure' || err.message === 'no-api')) {
        setBlockReason(err.message as CameraBlockReason);
      } else if (isCameraError(err)) {
        setError(t('common.barcodeScanner.permissionDenied'));
      } else {
        setError(t('common.barcodeScanner.noCamera'));
      }
      setLiveUnavailable(true);
    } finally {
      setStarting(false);
    }
  }, [initialStream, startLiveScan, t]);

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setError(null);
      setStarting(false);
      setDecodingPhoto(false);
      setBlockReason(null);
      setLiveUnavailable(false);
      return;
    }

    scannedRef.current = false;
    setError(null);
    setBlockReason(getCameraBlockReason());
    void tryStartLiveCamera();

    return () => {
      stopScanner();
    };
  }, [isOpen, tryStartLiveCamera, stopScanner]);

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setDecodingPhoto(true);
    setError(null);

    const reader = new BrowserMultiFormatReader();
    const objectUrl = URL.createObjectURL(file);

    try {
      const result = await reader.decodeFromImageUrl(objectUrl);
      handleResult(result.getText());
    } catch (err) {
      console.error('Photo decode failed:', err);
      setError(t('common.barcodeScanner.photoDecodeFailed'));
    } finally {
      URL.revokeObjectURL(objectUrl);
      setDecodingPhoto(false);
    }
  };

  const showPhotoFallback = liveUnavailable || blockReason !== null;
  const blockMessage =
    blockReason === 'insecure'
      ? t('common.barcodeScanner.insecureContext')
      : blockReason === 'no-api'
        ? t('common.barcodeScanner.unsupported')
        : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title ?? t('common.barcodeScanner.title')}
      size="md"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {showPhotoFallback ? t('common.barcodeScanner.photoHint') : t('common.barcodeScanner.hint')}
        </p>

        {!showPhotoFallback && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <div className="h-24 w-4/5 max-w-sm rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">{t('common.barcodeScanner.starting')}</p>
              </div>
            )}
          </div>
        )}

        {showPhotoFallback && (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
            {blockMessage && (
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">{blockMessage}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handlePhotoSelected}
            />
            <Button
              type="button"
              variant="primary"
              leftIcon={decodingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              disabled={decodingPhoto}
              onClick={() => fileInputRef.current?.click()}
            >
              {decodingPhoto ? t('common.barcodeScanner.decodingPhoto') : t('common.barcodeScanner.takePhoto')}
            </Button>
            {!blockReason && (
              <Button type="button" variant="ghost" size="sm" onClick={() => void tryStartLiveCamera()}>
                {t('common.barcodeScanner.retryLiveCamera')}
              </Button>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
