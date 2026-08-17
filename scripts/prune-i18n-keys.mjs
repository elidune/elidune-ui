/**
 * Collects translation keys referenced from source and prunes locale JSON files.
 * Run: node scripts/prune-i18n-keys.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const localesDir = path.join(projectRoot, 'src/locales');

function walkTsFiles(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walkTsFiles(p, acc);
    } else if (/\.(tsx|ts)$/.test(name) && !name.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

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

/** Extract t('key') / t("key") from file contents */
function extractStaticTKeys(content) {
  const keys = new Set();
  const re = /\bt\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

/** Keys referenced in utils/codeLabels.ts (labelKey + MEDIA_TYPE map targets) */
function extractCodeLabelKeys(filePath) {
  const keys = new Set();
  const content = fs.readFileSync(filePath, 'utf8');
  const labelRe = /labelKey:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = labelRe.exec(content)) !== null) keys.add(m[1]);
  const mapValRe = /:\s*['"]((?:items|codes)\.[^'"]+)['"]/g;
  while ((m = mapValRe.exec(content)) !== null) keys.add(m[1]);
  return keys;
}

function addPluralVariants(flatAll, keySet) {
  const extra = [];
  for (const k of keySet) {
    const pl = `${k}_plural`;
    if (pl in flatAll && !keySet.has(pl)) extra.push(pl);
  }
  for (const k of extra) keySet.add(k);
}

function addPrefixKeys(flatAll, prefix, keySet) {
  const pre = prefix.endsWith('.') ? prefix : `${prefix}.`;
  for (const k of Object.keys(flatAll)) {
    if (k === prefix || k.startsWith(pre)) keySet.add(k);
  }
}

const frPath = path.join(localesDir, 'fr/translation.json');
const frObj = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const flatFr = flatten(frObj);

const used = new Set();

for (const f of walkTsFiles(srcDir)) {
  const c = fs.readFileSync(f, 'utf8');
  for (const k of extractStaticTKeys(c)) used.add(k);
}

const codeLabelsPath = path.join(srcDir, 'utils/codeLabels.ts');
if (fs.existsSync(codeLabelsPath)) {
  for (const k of extractCodeLabelKeys(codeLabelsPath)) used.add(k);
}

// Dynamic / runtime key families — keep every leaf under these prefixes in FR JSON
const PREFIXES = [
  'errors.apiCode',
  'languages',
  'items.mediaType',
  'codes',
  'holds.statuses',
  'backgroundTask.status',
  'settings.maintenance.actions',
];

for (const pre of PREFIXES) addPrefixKeys(flatFr, pre, used);

// library.hours.days.0 .. 6
for (let d = 0; d <= 6; d++) {
  const k = `library.hours.days.${d}`;
  if (k in flatFr) used.add(k);
}

// Inventory session statuses & scan results (API enums)
for (const s of ['open', 'closed']) {
  const k = `inventory.statuses.${s}`;
  if (k in flatFr) used.add(k);
}
for (const r of ['found', 'found_archived', 'unknown_barcode']) {
  const k = `inventory.scanResults.${r}`;
  if (k in flatFr) used.add(k);
}

// First setup wizard steps 0–3
for (let i = 0; i < 4; i++) {
  for (const part of ['title', 'description']) {
    const k = `firstSetup.steps.${i}.${part}`;
    if (k in flatFr) used.add(k);
  }
}

addPluralVariants(flatFr, used);

const keysToKeep = [...used].filter((k) => k in flatFr);

// Report keys used in source but absent from fr/translation.json
const files = walkTsFiles(srcDir);
const staticKeys = new Set();
for (const f of files) {
  for (const k of extractStaticTKeys(fs.readFileSync(f, 'utf8'))) staticKeys.add(k);
}

const missing = [...staticKeys].filter((k) => !flatFr[k] && !k.includes('_plural')).filter((k) => {
  for (const pre of PREFIXES) {
    const p = pre.endsWith('.') ? pre.slice(0, -1) : pre;
    if (k === p || k.startsWith(`${p}.`)) return false;
  }
  if (/^library\.hours\.days\.\d+$/.test(k)) return false;
  if (/^inventory\.statuses\./.test(k)) return false;
  if (/^inventory\.scanResults\./.test(k)) return false;
  if (/^firstSetup\.steps\.\d+\.(title|description)$/.test(k)) return false;
  return true;
});

if (missing.length > 0) {
  console.warn('Keys referenced in code but missing from fr/translation.json:');
  for (const k of missing.sort()) console.warn('  ', k);
}

const frCount = Object.keys(flatFr).length;
const kept = keysToKeep.length;
console.log(`FR: ${kept} / ${frCount} keys kept (${frCount - kept} removed)`);

for (const loc of ['fr', 'en', 'de', 'es']) {
  const p = path.join(localesDir, loc, 'translation.json');
  const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
  const flat = flatten(obj);
  const nextFlat = {};
  for (const k of keysToKeep) {
    if (k in flat) nextFlat[k] = flat[k];
    else nextFlat[k] = flatFr[k];
  }
  fs.writeFileSync(p, JSON.stringify(unflatten(nextFlat), null, 2) + '\n');
}

console.log('Updated src/locales/{fr,en,de,es}/translation.json');
