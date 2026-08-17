import { forwardRef, useCallback, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import Input from './Input';
import Button from './Button';
import BarcodeCameraScannerModal from './BarcodeCameraScannerModal';
import { getCameraBlockReason, requestCameraStream, stopMediaStream } from '@/utils/cameraSupport';

export type BarcodeScanFieldProps = Omit<ComponentProps<typeof Input>, 'className'> & {
  onCameraScan: (barcode: string) => void;
  scannerTitle?: string;
  /** Extra controls between the input and the camera button (e.g. submit). */
  suffix?: ReactNode;
  wrapperClassName?: string;
  inputClassName?: string;
};

const BarcodeScanField = forwardRef<HTMLInputElement, BarcodeScanFieldProps>(
  (
    {
      onCameraScan,
      scannerTitle,
      suffix,
      wrapperClassName = '',
      inputClassName = '',
      disabled,
      ...inputProps
    },
    ref,
  ) => {
    const { t } = useTranslation();
    const [scannerOpen, setScannerOpen] = useState(false);
    const [initialStream, setInitialStream] = useState<MediaStream | null>(null);
    const initialStreamRef = useRef<MediaStream | null>(null);

    const closeScanner = useCallback(() => {
      stopMediaStream(initialStreamRef.current);
      initialStreamRef.current = null;
      setInitialStream(null);
      setScannerOpen(false);
    }, []);

    const openScanner = useCallback(async () => {
      if (getCameraBlockReason()) {
        initialStreamRef.current = null;
        setInitialStream(null);
        setScannerOpen(true);
        return;
      }

      try {
        const stream = await requestCameraStream();
        initialStreamRef.current = stream;
        setInitialStream(stream);
        setScannerOpen(true);
      } catch {
        initialStreamRef.current = null;
        setInitialStream(null);
        setScannerOpen(true);
      }
    }, []);

    return (
      <>
        <div className={`flex items-end gap-2 ${wrapperClassName}`}>
          <div className="min-w-0 flex-1">
            <Input ref={ref} disabled={disabled} className={inputClassName} {...inputProps} />
          </div>
          {suffix}
          <Button
            type="button"
            variant="secondary"
            className="h-10 shrink-0 px-3"
            disabled={disabled}
            onClick={() => void openScanner()}
            aria-label={t('common.barcodeScanner.openCamera')}
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>

        <BarcodeCameraScannerModal
          isOpen={scannerOpen}
          onClose={closeScanner}
          onScan={onCameraScan}
          title={scannerTitle ?? t('common.barcodeScanner.title')}
          initialStream={initialStream}
        />
      </>
    );
  },
);

BarcodeScanField.displayName = 'BarcodeScanField';

export default BarcodeScanField;
