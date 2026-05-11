/** Single pick: one city name + postal code pair (API may return many CPs per commune). */
export type FrenchCommunePick = {
  city: string;
  zip: string;
  /** List row label */
  label: string;
};

const GEO_API = 'https://geo.api.gouv.fr/communes';
const MAX_RESULTS = 28;

/**
 * Search French communes by name or exact 5-digit postal code (geo.api.gouv.fr).
 */
export async function searchFrenchCommunePicks(
  query: string,
  signal?: AbortSignal
): Promise<FrenchCommunePick[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const fields = 'nom,codesPostaux';
  const isFullPostal = /^\d{5}$/.test(q);
  const url = isFullPostal
    ? `${GEO_API}?codePostal=${encodeURIComponent(q)}&fields=${fields}&limit=30`
    : `${GEO_API}?nom=${encodeURIComponent(q)}&boost=population&fields=${fields}&limit=20`;

  const res = await fetch(url, { signal });
  if (!res.ok) return [];

  const rows = (await res.json()) as { nom: string; codesPostaux?: string[] }[];
  const picks: FrenchCommunePick[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const nom = row.nom?.trim();
    if (!nom) continue;
    const cps = [...new Set(row.codesPostaux ?? [])].sort();
    if (cps.length === 0) {
      const key = `${nom}|`;
      if (!seen.has(key)) {
        seen.add(key);
        picks.push({ city: nom, zip: '', label: nom });
      }
      continue;
    }
    for (const zip of cps) {
      const key = `${nom}|${zip}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picks.push({ city: nom, zip, label: `${nom} (${zip})` });
      if (picks.length >= MAX_RESULTS) return picks;
    }
  }

  return picks;
}
