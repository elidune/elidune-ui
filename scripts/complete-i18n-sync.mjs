/**
 * Applies i18n overrides: missing keys, DE/ES translations.
 * Run: node scripts/complete-i18n-sync.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.join(__dirname, '../src/locales');
const overridesPath = path.join(__dirname, 'i18n-overrides.json');

function flatten(obj, prefix = '') {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, p));
    else out[p] = v;
  }
  return out;
}

function unflatten(flat) {
  const root = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.');
    let o = root;
    for (let i = 0; i < parts.length - 1; i++) {
      o[parts[i]] = o[parts[i]] || {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = v;
  }
  return root;
}

function setNested(root, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur[p] === undefined || typeof cur[p] !== 'object' || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
const { enMissing = {}, de: deOverrides = {}, es: esOverrides = {} } = overrides;

const stats = { enAdded: 0, deUpdated: 0, esUpdated: 0 };

for (const locale of ['en', 'de', 'es']) {
  const filePath = path.join(localesDir, locale, 'translation.json');
  const obj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const flat = flatten(obj);

  for (const [key, translations] of Object.entries(enMissing)) {
    const value = translations[locale];
    if (value !== undefined && flat[key] === undefined) {
      flat[key] = value;
      if (locale === 'en') stats.enAdded++;
    }
  }

  const localeOverrides = locale === 'de' ? deOverrides : locale === 'es' ? esOverrides : null;
  if (localeOverrides) {
    for (const [key, value] of Object.entries(localeOverrides)) {
      if (key in flat) {
        flat[key] = value;
        if (locale === 'de') stats.deUpdated++;
        else stats.esUpdated++;
      } else {
        flat[key] = value;
        if (locale === 'de') stats.deUpdated++;
        else stats.esUpdated++;
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(unflatten(flat), null, 2) + '\n');
}

// Also ensure FR has the new keys
const frPath = path.join(localesDir, 'fr/translation.json');
const frObj = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const frNew = {
  'common.validate': 'Valider',
  'common.confirmDeletion': 'Confirmer la suppression',
  'common.firstPage': 'Première page',
  'common.lastPage': 'Dernière page',
  'items.biblioNotFound': 'Document non trouvé',
  'items.notValidated': 'Non validé',
  'settings.server.logFilePathRequired': 'Le chemin du fichier est requis lorsque la sortie est « fichier ».',
  'z3950.port': 'Port',
  'z3950.database': 'Base de données',
};
for (const [k, v] of Object.entries(frNew)) setNested(frObj, k, v);
fs.writeFileSync(frPath, JSON.stringify(frObj, null, 2) + '\n');

console.log(`Applied i18n sync: EN +${stats.enAdded}, DE ${stats.deUpdated}, ES ${stats.esUpdated}`);
