import { useState, useRef, useCallback, Fragment, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Buffer } from 'buffer';
import iconv from 'iconv-lite';
import {
  Upload,
  FileText,
  BookOpen,
  AlertCircle,
  Loader2,
  ScanLine,
  CheckCircle,
  Trash2,
  Download,
  X,
  Settings2,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Card, Button, Badge, Input, Modal } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type { Author, MediaType, Source, ItemShort } from '@/types';
import type { AxiosError } from 'axios';

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType): string {
  const keyMap: Record<MediaType, string> = {
    'u': 'unknown',
    'b': 'printedText',
    'bc': 'comics',
    'p': 'periodic',
    'v': 'video',
    'vt': 'videoTape',
    'vd': 'videoDvd',
    'a': 'audio',
    'am': 'audioMusic',
    'amt': 'audioMusicTape',
    'amc': 'audioMusicCd',
    'an': 'audioNonMusic',
    'c': 'cdRom',
    'i': 'images',
    'm': 'multimedia',
  };
  return keyMap[mediaType] || 'unknown';
}

// Types
type FileFormat = 'iso2709' | 'marcxml';
type Encoding = 'utf-8' | 'iso-8859-1' | 'windows-1252' | 'iso-8859-15' | 'iso-8859-4';

/** Parsed field for preview table: Tag, Indicateurs, Sous-champs, Valeur */
export interface MarcFieldDisplay {
  tag: string;
  indicators: string;
  subfieldsFormatted: string;
  value: string;
}

/** MARC field mapping for API payload (e.g. { tag: "200", subfields: { a: "Titre" } }) */
export interface MarcFieldMapping {
  tag: string;
  indicators?: string;
  subfields?: Record<string, string>;
  value?: string;
}

interface ParsedRecord {
  id: string;
  title1?: string;
  title2?: string;
  identification?: string;
  authors1?: Author[];
  authors2?: Author[];
  publication_date?: string;
  edition_name?: string;
  edition_place?: string;
  abstract_?: string;
  keywords?: string;
  subject?: string;
  media_type?: MediaType;
  raw_fields: Map<string, string[]>;
  status: 'pending' | 'importing' | 'imported' | 'error';
  error?: string;
  importedId?: number;
}

type MarcFormat = 'UNIMARC' | 'MARC21';

/** Detect duplicate ISBN error from API (code 8 or message) */
function isDuplicateIsbnError(error: unknown): boolean {
  const data = (error as AxiosError<{ code?: number; error?: string; message?: string }>)?.response?.data;
  if (!data) return false;
  if (data.code === 8) return true;
  const msg = (data.message || data.error || '').toLowerCase();
  return msg.includes('duplicate') || msg.includes('isbn already exists');
}

const SUBFIELD_DELIMITER = '\x1F'; // Hex 1F

/** Strip all characters except digits and X (for ISBN-10 check digit) */
function normalizeIsbn(value: string | undefined): string {
  if (value == null || value === '') return '';
  return value.replace(/[^0-9Xx]/g, '').toUpperCase();
}

// Helper to get subfield from MARC field
function getSubfield(fieldData: string, code: string, delimiter = SUBFIELD_DELIMITER): string | undefined {
  const parts = fieldData.split(delimiter);
  for (const part of parts) {
    if (part.length > 0 && part[0] === code) {
      return part.substring(1).trim();
    }
  }
  return undefined;
}

/** Filter raw_fields to only 9xx (local) tags */
function get9xxRawFields(rawFields: Map<string, string[]>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [tag, values] of rawFields.entries()) {
    const n = parseInt(tag, 10);
    if (n >= 900 && n <= 999) out.set(tag, values);
  }
  return out;
}

/** Whether the record has at least one 9xx field */
function has9xxFields(record: ParsedRecord): boolean {
  return get9xxRawFields(record.raw_fields).size > 0;
}

/** Build specimen data from 9xx fields (e.g. 952 $a = barcode, $c = call number) */
function buildSpecimenFrom9xx(record: ParsedRecord): { barcode: string; call_number?: string } {
  const fields9xx = get9xxRawFields(record.raw_fields);
  let barcode = '';
  let call_number: string | undefined;
  // Prefer 952: $a = barcode, $c = call number (common local holdings)
  for (const [tag, values] of fields9xx.entries()) {
    for (const v of values) {
      if (parseInt(tag, 10) >= 10 && v.length > 2) {
        const a = getSubfield(v.substring(2), 'a');
        const c = getSubfield(v.substring(2), 'c');
        if (a) barcode = barcode || a.trim();
        if (c) call_number = call_number || c.trim();
      }
    }
  }
  if (!barcode) {
    const firstVal = fields9xx.values().next().value?.[0];
    if (firstVal && firstVal.length > 2) {
      const parts = firstVal.substring(2).split(SUBFIELD_DELIMITER);
      for (let i = 1; i < parts.length; i++) {
        if (parts[i].length >= 1) {
          barcode = parts[i].substring(1).trim();
          break;
        }
      }
    }
  }
  if (!barcode) barcode = record.identification?.trim() || '';
  return { barcode: barcode || `IMPORT-${Date.now()}`, call_number: call_number || undefined };
}

/** Parse raw_fields into rows for preview table (Tag, Indicateurs, Sous-champs, Valeur) */
function rawFieldsToDisplayRows(rawFields: Map<string, string[]>): MarcFieldDisplay[] {
  const rows: MarcFieldDisplay[] = [];
  const tags = Array.from(rawFields.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  for (const tag of tags) {
    const values = rawFields.get(tag) ?? [];
    const isControl = parseInt(tag, 10) < 10;
    for (const v of values) {
      if (isControl) {
        rows.push({ tag, indicators: '-', subfieldsFormatted: '-', value: v.trim() });
      } else {
        const ind1 = v.length > 0 ? (v[0] === ' ' ? '#' : v[0]) : '#';
        const ind2 = v.length > 1 ? (v[1] === ' ' ? '#' : v[1]) : '#';
        const indicators = `${ind1}${ind2}`;
        const rest = v.length > 2 ? v.substring(2) : '';
        const subfieldParts: string[] = [];
        const valueParts: string[] = [];
        const parts = rest.split(SUBFIELD_DELIMITER);
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          if (p.length >= 1) {
            const code = p[0];
            const val = p.substring(1).trim();
            subfieldParts.push(`$${code}`);
            valueParts.push(val);
          }
        }
        rows.push({
          tag,
          indicators,
          subfieldsFormatted: subfieldParts.join(' ') || '-',
          value: valueParts.join(' | ') || rest.trim(),
        });
      }
    }
  }
  return rows;
}

/** Build MARC mapping structure for API (tag + subfields object) */
function recordToApiMapping(record: ParsedRecord): MarcFieldMapping[] {
  const out: MarcFieldMapping[] = [];
  for (const [tag, values] of Array.from(record.raw_fields.entries()).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    const isControl = parseInt(tag, 10) < 10;
    for (const v of values) {
      if (isControl) {
        out.push({ tag, value: v.trim() });
      } else {
        const subfields: Record<string, string> = {};
        const rest = v.length > 2 ? v.substring(2) : '';
        const parts = rest.split(SUBFIELD_DELIMITER);
        for (let i = 1; i < parts.length; i++) {
          const p = parts[i];
          if (p.length >= 1) subfields[p[0]] = p.substring(1).trim();
        }
        out.push({ tag, indicators: v.length >= 2 ? v.substring(0, 2) : undefined, subfields: Object.keys(subfields).length ? subfields : undefined, value: rest.trim() });
      }
    }
  }
  return out;
}

// Parse author from MARC field
function parseAuthor(fieldData: string, delimiter = '\x1F'): Author {
  const lastname = getSubfield(fieldData, 'a', delimiter);
  const firstname = getSubfield(fieldData, 'b', delimiter);
  const func = getSubfield(fieldData, '4', delimiter) || getSubfield(fieldData, 'e', delimiter);
  return {
    id: 0,
    lastname: lastname?.replace(/,\s*$/, ''),
    firstname,
    function: func,
  };
}

// Build record from raw MARC fields
function buildRecordFromFields(
  rawFields: Map<string, string[]>,
  leader: string,
  index: number
): ParsedRecord {
  const record: ParsedRecord = {
    id: `record-${index}-${Date.now()}`,
    raw_fields: rawFields,
    status: 'pending',
  };

  // Title (200$a, 200$e for UNIMARC, 245$a, 245$b for MARC21)
  const field200 = rawFields.get('200')?.[0];
  const field245 = rawFields.get('245')?.[0];
  if (field200) {
    record.title1 = getSubfield(field200, 'a');
    record.title2 = getSubfield(field200, 'e');
  } else if (field245) {
    record.title1 = getSubfield(field245, 'a')?.replace(/\s*[/:;]\s*$/, '');
    record.title2 = getSubfield(field245, 'b')?.replace(/\s*[/:;]\s*$/, '');
  }

  // ISBN (010$a for UNIMARC, 020$a for MARC21) – strip special characters
  const field010 = rawFields.get('010')?.[0];
  const field020 = rawFields.get('020')?.[0];
  if (field010) {
    record.identification = normalizeIsbn(getSubfield(field010, 'a'));
  } else if (field020) {
    record.identification = normalizeIsbn(getSubfield(field020, 'a')?.split(' ')[0]);
  }

  // Authors
  const authors1: Author[] = [];
  const authors2: Author[] = [];

  // Main author (700 for UNIMARC, 100 for MARC21)
  const field700 = rawFields.get('700')?.[0];
  const field100 = rawFields.get('100')?.[0];
  if (field700) {
    authors1.push(parseAuthor(field700));
  } else if (field100) {
    authors1.push(parseAuthor(field100));
  }

  // Secondary authors (701, 702 for UNIMARC)
  for (const f of rawFields.get('701') || []) {
    authors2.push(parseAuthor(f));
  }
  for (const f of rawFields.get('702') || []) {
    authors2.push(parseAuthor(f));
  }

  if (authors1.length > 0) record.authors1 = authors1;
  if (authors2.length > 0) record.authors2 = authors2;

  // Publication info (210 for UNIMARC, 260/264 for MARC21)
  const field210 = rawFields.get('210')?.[0];
  const field260 = rawFields.get('260')?.[0];
  const field264 = rawFields.get('264')?.[0];
  if (field210) {
    record.publication_date = getSubfield(field210, 'd')?.replace(/[^\d]/g, '').substring(0, 4);
    record.edition_name = getSubfield(field210, 'c');
    record.edition_place = getSubfield(field210, 'a');
  } else if (field260) {
    record.publication_date = getSubfield(field260, 'c')?.replace(/[^\d]/g, '').substring(0, 4);
    record.edition_name = getSubfield(field260, 'b')?.replace(/[,.:]\s*$/, '');
    record.edition_place = getSubfield(field260, 'a')?.replace(/\s*:\s*$/, '');
  } else if (field264) {
    record.publication_date = getSubfield(field264, 'c')?.replace(/[^\d]/g, '').substring(0, 4);
    record.edition_name = getSubfield(field264, 'b')?.replace(/[,.:]\s*$/, '');
    record.edition_place = getSubfield(field264, 'a')?.replace(/\s*:\s*$/, '');
  }

  // Abstract (330 for UNIMARC, 520 for MARC21)
  const field330 = rawFields.get('330')?.[0];
  const field520 = rawFields.get('520')?.[0];
  if (field330) {
    record.abstract_ = getSubfield(field330, 'a');
  } else if (field520) {
    record.abstract_ = getSubfield(field520, 'a');
  }

  // Keywords (606, 610 for UNIMARC, 650 for MARC21)
  const keywords: string[] = [];
  for (const f of rawFields.get('606') || []) {
    const kw = getSubfield(f, 'a');
    if (kw) keywords.push(kw);
  }
  for (const f of rawFields.get('610') || []) {
    const kw = getSubfield(f, 'a');
    if (kw) keywords.push(kw);
  }
  for (const f of rawFields.get('650') || []) {
    const kw = getSubfield(f, 'a');
    if (kw) keywords.push(kw);
  }
  if (keywords.length > 0) record.keywords = keywords.join(', ');

  // Media type from leader position 6
  // Map MARC leader types to server media types
  if (leader && leader.length > 6) {
    const leaderType = leader[6];
    switch (leaderType) {
      case 'a': // Text (monographic)
      case 't': // Text (manuscript)
        record.media_type = 'b'; // PrintedText
        break;
      case 'g': // Projected medium
        record.media_type = 'v'; // Video
        break;
      case 'j': // Musical sound recording
      case 'i': // Nonmusical sound recording
        record.media_type = 'a'; // Audio
        break;
      case 's': // Serial/Periodical
        record.media_type = 'p'; // Periodic
        break;
      case 'm': // Computer file
        record.media_type = 'c'; // CdRom
        break;
      case 'k': // Two-dimensional nonprojectable graphic
      case 'r': // Three-dimensional artifact
        record.media_type = 'i'; // Images
        break;
      default:
        record.media_type = 'u'; // Unknown
    }
  } else {
    record.media_type = 'u'; // Unknown
  }

  return record;
}

/** Convert marcjs Record to our raw_fields Map (control: tag->[value]; data: tag->[ind1+ind2+$c+val...]) */
function marcRecordToRawFields(fields: (string | string[])[]): Map<string, string[]> {
  const rawFields = new Map<string, string[]>();
  for (const field of fields) {
    const tag = String(field[0]);
    const isControl = parseInt(tag, 10) < 10;
    if (isControl) {
      const value = field[1] as string;
      const arr = rawFields.get(tag) ?? [];
      arr.push(value ?? '');
      rawFields.set(tag, arr);
    } else {
      const ind = (field[1] as string) ?? '  ';
      const ind1 = ind[0] ?? ' ';
      const ind2 = ind[1] ?? ' ';
      let str = ind1 + ind2;
      for (let i = 2; i < field.length - 1; i += 2) {
        const code = String(field[i]);
        const val = String(field[i + 1] ?? '');
        str += SUBFIELD_DELIMITER + code + val;
      }
      const arr = rawFields.get(tag) ?? [];
      arr.push(str);
      rawFields.set(tag, arr);
    }
  }
  return rawFields;
}

/** Detect MARC format from fields (UNIMARC often has 200, MARC21 has 245) */
function detectMarcFormat(_leader: string, rawFields: Map<string, string[]>): MarcFormat {
  if (rawFields.has('200') && !rawFields.has('245')) return 'UNIMARC';
  if (rawFields.has('245')) return 'MARC21';
  if (rawFields.has('100') && rawFields.get('100')?.[0]?.length === 40) return 'UNIMARC';
  return 'MARC21';
}

/** ISO 2709 single-record parser (same logic as marcjs, browser-safe, no Node stream). Returns { leader, fields }. */
function parseISO2709Record(recordBuf: Buffer): { leader: string; fields: (string | string[])[] } {
  const leader = recordBuf.toString('utf8', 0, 24);
  const directoryLen = parseInt(recordBuf.toString('utf8', 12, 17), 10) - 25;
  const numberOfTag = directoryLen / 12;
  const fields: (string | string[])[] = [];
  for (let i = 0; i < numberOfTag; i += 1) {
    const off = 24 + i * 12;
    const tag = recordBuf.toString('utf8', off, off + 3);
    const len = parseInt(recordBuf.toString('utf8', off + 3, off + 7), 10) - 1;
    const pos = parseInt(recordBuf.toString('utf8', off + 7, off + 12), 10) + 25 + directoryLen;
    const value = recordBuf.toString('utf8', pos, pos + len);
    const parts: string[] = [tag];
    if (parseInt(tag, 10) < 10) {
      parts.push(value);
    } else {
      parts.push(value.length >= 2 ? value.substring(0, 2) : '  ');
      const rest = value.length > 2 ? value.substring(2) : '';
      if (rest.indexOf('\x1F') !== -1) {
        const values = rest.split('\x1F');
        for (let j = 1; j < values.length; j += 1) {
          const v = values[j];
          if (v.length >= 1) {
            parts.push(v.substring(0, 1));
            parts.push(v.substring(1));
          }
        }
      }
    }
    fields.push(parts);
  }
  return { leader, fields };
}

// ISO 2709 Parser. Structure: Label (24), Directory (12-char entries), Data (FT=0x1E, RT=0x1D).
function parseISO2709(arrayBuffer: ArrayBuffer, encoding: Encoding): { records: ParsedRecord[]; detectedFormat: MarcFormat | null } {
  const records: ParsedRecord[] = [];
  let detectedFormat: MarcFormat | null = null;

  const buf = Buffer.from(arrayBuffer);
  const decoded = encoding === 'utf-8'
    ? buf.toString('utf8')
    : iconv.decode(buf, encoding);
  const utf8Buffer = Buffer.from(decoded, 'utf8');

  const RT = 0x1D;
  let start = 0;
  let index = 0;
  while (start < utf8Buffer.length) {
    const pos = utf8Buffer.indexOf(RT, start);
    if (pos === -1) break;
    const chunk = utf8Buffer.subarray(start, pos);
    start = pos + 1;
    if (chunk.length < 24) continue;

    try {
      const recordBuf = Buffer.from(chunk);
      const leader = recordBuf.toString('utf8', 0, 24);
      const baseAddress = parseInt(leader.substring(12, 17), 10);
      if (baseAddress < 24 || baseAddress > recordBuf.length) {
        console.warn('Invalid base address in record', index);
        index += 1;
        continue;
      }
      const marcRecord = parseISO2709Record(recordBuf);
      const rawFields = marcRecordToRawFields(marcRecord.fields);
      if (detectedFormat === null) detectedFormat = detectMarcFormat(marcRecord.leader, rawFields);
      const record = buildRecordFromFields(rawFields, marcRecord.leader, index);
      if (record.title1) records.push(record);
    } catch (e) {
      console.error('Error parsing ISO 2709 record', index, e);
    }
    index += 1;
  }

  return { records, detectedFormat };
}

// MARCXML Parser
function parseMARCXML(content: string): ParsedRecord[] {
  const records: ParsedRecord[] = [];
  
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/xml');
    
    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parse error:', parseError.textContent);
      return [];
    }

    // Find all record elements (handle different namespaces)
    const recordElements = doc.querySelectorAll('record');
    
    for (let i = 0; i < recordElements.length; i++) {
      const recordEl = recordElements[i];
      
      try {
        // Get leader
        const leaderEl = recordEl.querySelector('leader');
        const leader = leaderEl?.textContent || '';

        // Parse control fields and data fields
        const rawFields = new Map<string, string[]>();

        // Control fields (001-009)
        const controlFields = recordEl.querySelectorAll('controlfield');
        controlFields.forEach(cf => {
          const tag = cf.getAttribute('tag');
          if (tag) {
            const existing = rawFields.get(tag) || [];
            existing.push(cf.textContent || '');
            rawFields.set(tag, existing);
          }
        });

        // Data fields (010+)
        const dataFields = recordEl.querySelectorAll('datafield');
        dataFields.forEach(df => {
          const tag = df.getAttribute('tag');
          if (tag) {
            // Build field content with subfield delimiter
            let fieldContent = df.getAttribute('ind1') || ' ';
            fieldContent += df.getAttribute('ind2') || ' ';
            
            const subfields = df.querySelectorAll('subfield');
            subfields.forEach(sf => {
              const code = sf.getAttribute('code');
              if (code) {
                fieldContent += '\x1F' + code + (sf.textContent || '');
              }
            });

            const existing = rawFields.get(tag) || [];
            existing.push(fieldContent);
            rawFields.set(tag, existing);
          }
        });

        const record = buildRecordFromFields(rawFields, leader, i);
        if (record.title1) {
          records.push(record);
        }
      } catch (e) {
        console.error('Error parsing MARCXML record', e);
      }
    }
  } catch (e) {
    console.error('Error parsing MARCXML file', e);
  }

  return records;
}

export default function ImportIsoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  const ENCODING_OPTIONS: { value: Encoding; label: string }[] = [
    { value: 'utf-8', label: t('importMarc.encodings.utf8') },
    { value: 'iso-8859-1', label: t('importMarc.encodings.iso88591') },
    { value: 'iso-8859-4', label: t('importMarc.encodings.iso88594') },
    { value: 'iso-8859-15', label: t('importMarc.encodings.iso885915') },
    { value: 'windows-1252', label: t('importMarc.encodings.windows1252') },
  ];

  const FORMAT_OPTIONS: { value: FileFormat; label: string; extensions: string }[] = [
    { value: 'iso2709', label: t('importMarc.formats.iso2709'), extensions: '.mrc, .not, .dat' },
    { value: 'marcxml', label: t('importMarc.formats.marcxml'), extensions: '.xml, .marcxml' },
  ];

  // Options state (always visible)
  const [fileFormat, setFileFormat] = useState<FileFormat>('iso2709');
  const [encoding, setEncoding] = useState<Encoding>('utf-8');
  const [showOptions, setShowOptions] = useState(true);

  // Sources (for specimen creation)
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [addSourceLoading, setAddSourceLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState('');

  // File state
  const [fileName, setFileName] = useState<string>('');
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState('');

  // Import state
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // Scan mode state
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState('');

  // Expanded row to show raw MARC fields; detected MARC format (UNIMARC / MARC21)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [detectedMarcFormat, setDetectedMarcFormat] = useState<MarcFormat | null>(null);

  // Only import notices that have local fields (9xx) → will create a specimen
  const [onlyImportWithSpecimen, setOnlyImportWithSpecimen] = useState(false);

  // Duplicate ISBN resolution: show modal to pick existing item or create new
  const [duplicateModal, setDuplicateModal] = useState<{ record: ParsedRecord; matches: ItemShort[] } | null>(null);
  const [duplicateActionLoading, setDuplicateActionLoading] = useState(false);
  const [duplicateModalError, setDuplicateModalError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    try {
      setSourcesError('');
      const data = await api.getSources(false);
      setSources(data);
      const defaultSource = data.find(s => s.default);
      setSelectedSourceId((prev) => {
        if (defaultSource) return defaultSource.id;
        if (data.length > 0 && prev === null) return data[0].id;
        return prev;
      });
    } catch (e) {
      setSourcesError(t('importMarc.sourcesError'));
    }
  }, [t]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSourceName.trim();
    if (!name) return;
    setAddSourceLoading(true);
    try {
      const created = await api.createSource({ name });
      setSources((prev) => [...prev, created]);
      setSelectedSourceId(created.id);
      setNewSourceName('');
      setShowAddSource(false);
    } catch (err) {
      setSourcesError(t('importMarc.sourceCreateError'));
    } finally {
      setAddSourceLoading(false);
    }
  };

  const parseFile = useCallback(async (file: File, format: FileFormat, enc: Encoding): Promise<{ records: ParsedRecord[]; detectedFormat: MarcFormat | null }> => {
    const arrayBuffer = await file.arrayBuffer();
    if (format === 'marcxml') {
      const decoder = new TextDecoder(enc);
      const content = decoder.decode(arrayBuffer);
      return { records: parseMARCXML(content), detectedFormat: null };
    }
    return parseISO2709(arrayBuffer, enc);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setParseError('');
    setFileName(file.name);

    try {
      const { records: parsed, detectedFormat } = await parseFile(file, fileFormat, encoding);

      if (parsed.length === 0) {
        setParseError(t('importMarc.noRecordsFound', { 
          format: FORMAT_OPTIONS.find(f => f.value === fileFormat)?.label,
          encoding 
        }));
      } else {
        setRecords(parsed);
        setDetectedMarcFormat(detectedFormat);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseError(t('importMarc.readError'));
    } finally {
      setIsLoading(false);
    }
  }, [fileFormat, encoding, parseFile, t, FORMAT_OPTIONS]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInputRef.current.files = dataTransfer.files;
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, []);

  const handleImportAll = async () => {
    let pendingRecords = records.filter(r => r.status === 'pending');
    if (onlyImportWithSpecimen) {
      pendingRecords = pendingRecords.filter(has9xxFields);
    }
    if (pendingRecords.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: pendingRecords.length });

    for (let i = 0; i < pendingRecords.length; i++) {
      const record = pendingRecords[i];
      await importRecord(record);
      setImportProgress({ current: i + 1, total: pendingRecords.length });
    }

    setIsImporting(false);
  };

  const buildItemPayload = (record: ParsedRecord) => ({
    title1: record.title1,
    title2: record.title2,
    isbn: record.identification,
    authors1: record.authors1,
    authors2: record.authors2,
    publication_date: record.publication_date,
    abstract_: record.abstract_,
    keywords: record.keywords,
    media_type: record.media_type,
    edition: record.edition_name ? {
      id: 0,
      name: record.edition_name,
      place: record.edition_place,
    } : undefined,
  });

  const completeImportWithItemId = async (record: ParsedRecord, itemId: number) => {
    if (has9xxFields(record)) {
      const specimenData = buildSpecimenFrom9xx(record);
      await api.createSpecimen(itemId, {
        ...specimenData,
        ...(selectedSourceId != null && { source_id: selectedSourceId }),
      });
    }
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, status: 'imported' as const, importedId: itemId } : r
    ));
  };

  const importRecord = async (record: ParsedRecord) => {
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, status: 'importing' as const } : r
    ));

    try {
      const item = await api.createItem(buildItemPayload(record));
      await completeImportWithItemId(record, item.id);
    } catch (error) {
      if (isDuplicateIsbnError(error) && record.identification) {
        try {
          const response = await api.getItems({ isbn: record.identification, per_page: 50 });
          setDuplicateModalError(null);
          setDuplicateModal({ record, matches: response.items || [] });
        } catch (fetchErr) {
          console.error('Error fetching items by ISBN:', fetchErr);
          setRecords(prev => prev.map(r =>
            r.id === record.id ? { ...r, status: 'error' as const, error: getApiErrorMessage(fetchErr, t) } : r
          ));
        }
      } else {
        console.error('Error importing record:', error);
        setRecords(prev => prev.map(r =>
          r.id === record.id ? { ...r, status: 'error' as const, error: getApiErrorMessage(error, t) } : r
        ));
      }
    }
  };

  const handleDuplicateChooseExisting = async (itemId: number) => {
    if (!duplicateModal) return;
    setDuplicateActionLoading(true);
    setDuplicateModalError(null);
    try {
      await completeImportWithItemId(duplicateModal.record, itemId);
      setDuplicateModal(null);
    } catch (err) {
      console.error('Error adding specimen to existing item:', err);
      setDuplicateModalError(getApiErrorMessage(err, t));
    } finally {
      setDuplicateActionLoading(false);
    }
  };

  const handleDuplicateCreateNew = async () => {
    if (!duplicateModal) return;
    setDuplicateActionLoading(true);
    setDuplicateModalError(null);
    try {
      const item = await api.createItem(buildItemPayload(duplicateModal.record), { allowDuplicateIsbn: true });
      await completeImportWithItemId(duplicateModal.record, item.id);
      setDuplicateModal(null);
    } catch (err) {
      console.error('Error creating item with duplicate ISBN:', err);
      setDuplicateModalError(getApiErrorMessage(err, t));
    } finally {
      setDuplicateActionLoading(false);
    }
  };

  const handleStartScanMode = () => {
    setScanMode(true);
    setScanInput('');
    setScanError('');
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const isbn = scanInput.trim();
    setScanError('');

    const matchingRecord = records.find(r =>
      r.status === 'pending' && r.identification === isbn
    );

    if (!matchingRecord) {
      setScanError(t('importMarc.isbnNotFound', { isbn }));
      setScanInput('');
      scanInputRef.current?.focus();
      return;
    }

    await importRecord(matchingRecord);
    setScanInput('');
    scanInputRef.current?.focus();

    const remaining = records.filter(r => r.status === 'pending').length - 1;
    if (remaining === 0) {
      setScanMode(false);
    }
  };

  const handleRemoveRecord = (id: string) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const handleClear = () => {
    setRecords([]);
    setFileName('');
    setParseError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatAuthors = (authors?: Author[]) => {
    if (!authors || authors.length === 0) return '-';
    return authors
      .map((a) => `${a.firstname || ''} ${a.lastname || ''}`.trim())
      .filter(Boolean)
      .join(', ');
  };

  const pendingCount = records.filter(r => r.status === 'pending').length;
  const importedCount = records.filter(r => r.status === 'imported').length;
  const errorCount = records.filter(r => r.status === 'error').length;

  const getAcceptedExtensions = (): string => {
    const format = FORMAT_OPTIONS.find(f => f.value === fileFormat);
    return format?.extensions.split(', ').join(',') || '*';
  };

  const columns = [
    {
      key: 'expand',
      header: '',
      render: (record: ParsedRecord) => {
        const isExpanded = expandedRecordId === record.id;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedRecordId(isExpanded ? null : record.id);
            }}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        );
      },
      className: 'w-10',
    },
    {
      key: 'status',
      header: '',
      render: (record: ParsedRecord) => {
        switch (record.status) {
          case 'imported':
            return <CheckCircle className="h-5 w-5 text-green-500" />;
          case 'importing':
            return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
          case 'error':
            return (
              <span title={record.error}>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </span>
            );
          default:
            return <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
        }
      },
      className: 'w-12',
    },
    {
      key: 'title',
      header: t('items.titleField'),
      render: (record: ParsedRecord) => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {record.title1 || t('items.notSpecified')}
            </p>
            {record.title2 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {record.title2}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'isbn',
      header: t('items.isbn'),
      render: (record: ParsedRecord) => (
        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
          {record.identification || '-'}
        </span>
      ),
    },
    {
      key: 'authors',
      header: t('items.authors'),
      render: (record: ParsedRecord) => (
        <span className="text-gray-600 dark:text-gray-300 truncate">
          {formatAuthors(record.authors1)}
        </span>
      ),
      className: 'hidden lg:table-cell',
    },
    {
      key: 'date',
      header: t('common.date'),
      render: (record: ParsedRecord) => record.publication_date || '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'type',
      header: t('common.type'),
      render: (record: ParsedRecord) => (
        <Badge>
          {record.media_type 
            ? t(`items.mediaType.${getMediaTypeTranslationKey(record.media_type)}`)
            : t('items.mediaType.unknown')
          }
        </Badge>
      ),
      className: 'hidden md:table-cell',
    },
    {
      key: 'actions',
      header: '',
      render: (record: ParsedRecord) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {record.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => importRecord(record)}
                title={t('importMarc.importOne')}
                className="text-gray-500 hover:text-amber-600 dark:hover:text-amber-400"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveRecord(record.id)}
                className="text-gray-400 hover:text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {record.status === 'imported' && record.importedId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigate(`/items/${record.importedId}`)}
            >
              {t('common.view')}
            </Button>
          )}
        </div>
      ),
      className: 'w-24',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Upload className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          {t('importMarc.title')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('importMarc.subtitle')}
        </p>
      </div>

      {/* Import options + file upload (always visible) */}
      <Card>
        {/* Options panel */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
            {t('importMarc.importOptions')}
            <span className={`transition-transform ${showOptions ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {showOptions && (
            <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Format selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('importMarc.fileFormat')}
                  </label>
                  <select
                    value={fileFormat}
                    onChange={(e) => setFileFormat(e.target.value as FileFormat)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {FORMAT_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label} ({option.extensions})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Encoding selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('importMarc.encoding')}
                  </label>
                  <select
                    value={encoding}
                    onChange={(e) => setEncoding(e.target.value as Encoding)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {ENCODING_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source selector (for specimen creation) */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('importMarc.source')}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedSourceId ?? ''}
                      onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : null)}
                      className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">{t('importMarc.noSource')}</option>
                      {sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name || source.key || `Source ${source.id}`}
                          {source.default ? ` (${t('importMarc.default')})` : ''}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddSource((v) => !v)}
                      leftIcon={<Plus className="h-4 w-4" />}
                    >
                      {t('importMarc.addSource')}
                    </Button>
                  </div>
                  {showAddSource && (
                    <form onSubmit={handleAddSource} className="mt-3 flex flex-wrap items-end gap-2">
                      <Input
                        value={newSourceName}
                        onChange={(e) => setNewSourceName(e.target.value)}
                        placeholder={t('importMarc.newSourceName')}
                        className="flex-1 min-w-[180px]"
                        autoFocus
                      />
                      <Button type="submit" size="sm" isLoading={addSourceLoading} disabled={!newSourceName.trim()}>
                        {t('common.add')}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setShowAddSource(false); setNewSourceName(''); }}>
                        {t('common.cancel')}
                      </Button>
                    </form>
                  )}
                  {sourcesError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{sourcesError}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('importMarc.sourceHint')}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                💡 {t('importMarc.encodingHint')}
              </p>
            </div>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getAcceptedExtensions()}
            onChange={handleFileSelect}
            className="hidden"
          />

          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 text-amber-500 animate-spin" />
              <p className="text-gray-600 dark:text-gray-300">{t('importMarc.analyzing')}</p>
            </div>
          ) : (
            <>
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 mb-4">
                <FileText className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {t('importMarc.dropFile')}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {t('importMarc.orClickToBrowse')}
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-sm">
                <Badge variant="default">
                  {FORMAT_OPTIONS.find(f => f.value === fileFormat)?.label}
                </Badge>
                <Badge variant="default">
                  {ENCODING_OPTIONS.find(e => e.value === encoding)?.label}
                </Badge>
              </div>
            </>
          )}
        </div>

        {parseError && (
          <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            {parseError}
          </div>
        )}
      </Card>

      {/* Records list */}
      {records.length > 0 && (
        <>
          {/* Stats and actions */}
          <Card>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{fileName}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t('importMarc.documentsCount', { count: records.length })}
                  </span>
                  {detectedMarcFormat && (
                    <Badge variant="info">{detectedMarcFormat}</Badge>
                  )}
                  {importedCount > 0 && (
                    <Badge variant="success">{t('importMarc.imported', { count: importedCount })}</Badge>
                  )}
                  {errorCount > 0 && (
                    <Badge variant="danger">{t('importMarc.errors', { count: errorCount })}</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {pendingCount > 0 && !scanMode && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={onlyImportWithSpecimen}
                      onChange={(e) => setOnlyImportWithSpecimen(e.target.checked)}
                      className="rounded border-gray-300 dark:border-gray-600 text-amber-600 focus:ring-amber-500"
                    />
                    {t('importMarc.onlyWithSpecimen')}
                  </label>
                )}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={handleClear}>
                    {t('common.clear')}
                  </Button>
                  {pendingCount > 0 && !scanMode && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={handleStartScanMode}
                        leftIcon={<ScanLine className="h-4 w-4" />}
                      >
                        {t('importMarc.importWithScan')}
                      </Button>
                      <Button
                        onClick={handleImportAll}
                        isLoading={isImporting}
                        leftIcon={<Download className="h-4 w-4" />}
                      >
                        {t('importMarc.importAll', { count: onlyImportWithSpecimen ? records.filter(r => r.status === 'pending' && has9xxFields(r)).length : pendingCount })}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Import progress */}
            {isImporting && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">{t('importMarc.importProgress')}</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Scan mode */}
          {scanMode && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <ScanLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{t('importMarc.scanMode')}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('importMarc.scanModeHint')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setScanMode(false)}
                  className="ml-auto"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <form onSubmit={handleScanSubmit} className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder={t('importMarc.scanPlaceholder')}
                    autoFocus
                  />
                </div>
                <Button type="submit">
                  {t('importMarc.validate')}
                </Button>
              </form>

              {scanError && (
                <div className="mt-3 flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {scanError}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('importMarc.remainingToScan', { count: pendingCount })}
                </p>
              </div>
            </Card>
          )}

          {/* Table with expandable rows for raw MARC fields */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${column.className || ''}`}
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {records.map((record) => (
                    <Fragment key={record.id}>
                      <tr
                        key={record.id}
                        onClick={() => setExpandedRecordId((id) => (id === record.id ? null : record.id))}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${column.className || ''}`}
                          >
                            {column.render
                              ? column.render(record)
                              : (record as unknown as Record<string, unknown>)[column.key]?.toString() || '-'}
                          </td>
                        ))}
                      </tr>
                      {expandedRecordId === record.id && (
                        <tr key={`${record.id}-detail`} className="bg-gray-50 dark:bg-gray-800/50">
                          <td colSpan={columns.length} className="px-4 py-3">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              {t('importMarc.rawFields')}
                            </div>
                            <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
                              <thead>
                                <tr className="bg-gray-100 dark:bg-gray-800">
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.tag')}</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.indicators')}</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.subfields')}</th>
                                  <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.value')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {rawFieldsToDisplayRows(record.raw_fields).map((row, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2 font-mono text-amber-600 dark:text-amber-400">{row.tag}</td>
                                    <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{row.indicators}</td>
                                    <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{row.subfieldsFormatted}</td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-md truncate" title={row.value}>{row.value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {(() => {
                              const fields9xx = get9xxRawFields(record.raw_fields);
                              if (fields9xx.size === 0) return null;
                              const rows9xx = rawFieldsToDisplayRows(fields9xx);
                              return (
                                <>
                                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 mt-4">
                                    {t('importMarc.fields9xx')}
                                  </div>
                                  <table className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
                                    <thead>
                                      <tr className="bg-gray-100 dark:bg-gray-800">
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.tag')}</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.indicators')}</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.subfields')}</th>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300">{t('importMarc.preview.value')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                      {rows9xx.map((row, i) => (
                                        <tr key={i}>
                                          <td className="px-3 py-2 font-mono text-amber-600 dark:text-amber-400">{row.tag}</td>
                                          <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{row.indicators}</td>
                                          <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-400">{row.subfieldsFormatted}</td>
                                          <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-md truncate" title={row.value}>{row.value}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </>
                              );
                            })()}
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {t('importMarc.mappingApi')}
                            </div>
                            <pre className="text-xs font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto">
                              {JSON.stringify(recordToApiMapping(record), null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Duplicate ISBN: choose existing item or create new */}
      <Modal
        isOpen={!!duplicateModal}
        onClose={() => {
          if (!duplicateActionLoading && duplicateModal) {
            const recordId = duplicateModal.record.id;
            setRecords(prev => prev.map(r => (r.id === recordId ? { ...r, status: 'pending' as const } : r)));
            setDuplicateModal(null);
            setDuplicateModalError(null);
          }
        }}
        title={t('importMarc.duplicateIsbnTitle')}
        size="lg"
      >
        {duplicateModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('importMarc.duplicateIsbnMessage', { isbn: duplicateModal.record.identification })}
            </p>
            {duplicateModal.matches.length > 0 ? (
              <>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('importMarc.duplicateIsbnChoose')}
                </p>
                <ul className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-60 overflow-y-auto">
                  {duplicateModal.matches.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        onClick={() => handleDuplicateChooseExisting(match.id)}
                        disabled={duplicateActionLoading}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center gap-3 disabled:opacity-50"
                      >
                        <BookOpen className="h-5 w-5 text-amber-500 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {match.title || t('items.notSpecified')}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {match.isbn && `${t('items.isbn')}: ${match.isbn}`}
                            {match.authors?.length ? ` • ${formatAuthors(match.authors)}` : ''}
                          </p>
                        </div>
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                          {t('importMarc.duplicateUseThis')}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('importMarc.duplicateIsbnNoMatches')}
              </p>
            )}
            {duplicateModalError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {duplicateModalError}
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={handleDuplicateCreateNew}
                isLoading={duplicateActionLoading}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                {t('importMarc.duplicateCreateNew')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
