export type CameraBlockReason = 'insecure' | 'no-api';

/** Why live camera (getUserMedia) may be unavailable. */
export function getCameraBlockReason(): CameraBlockReason | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'no-api';
  }
  if (!window.isSecureContext) {
    return 'insecure';
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
    return 'no-api';
  }
  return null;
}

export function stopMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Request camera within a user-gesture handler (required on mobile browsers). */
export async function requestCameraStream(): Promise<MediaStream> {
  const blockReason = getCameraBlockReason();
  if (blockReason) {
    throw new Error(blockReason);
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ video: true });
  }
}
