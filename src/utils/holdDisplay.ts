import type { Hold, ItemShort } from '@/types';

/** The held specimen: server sends exactly one entry in `biblio.items`. */
export function holdSpecimenItem(h: Hold): ItemShort | undefined {
  return h.biblio?.items?.[0];
}

export function holdPrimaryDocumentLabel(h: Hold): string {
  const title = h.biblio?.title?.trim();
  if (title) return title;
  const spec = holdSpecimenItem(h);
  return spec?.barcode?.trim() || spec?.callNumber?.trim() || h.itemId;
}

/** Shown under the title when the API sends a document title. */
export function holdSecondaryDocumentLabel(h: Hold): string | null {
  const title = h.biblio?.title?.trim();
  if (!title) return null;
  const spec = holdSpecimenItem(h);
  const sub = spec?.barcode?.trim() || spec?.callNumber?.trim() || h.itemId;
  return sub || null;
}
