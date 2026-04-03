/**
 * Build event attachment payload for POST/PUT (API: camelCase Base64, no data: prefix).
 */
export async function fileToAttachmentInput(file: File): Promise<{
  fileName: string;
  mimeType: string;
  dataBase64: string;
}> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const dataBase64 = btoa(binary);
  return {
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    dataBase64,
  };
}

export function base64ToDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

export function isImageMime(mime?: string | null): boolean {
  return !!mime && mime.startsWith('image/');
}
