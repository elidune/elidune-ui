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
import type { Author, MediaType, Source, ImportReport, DuplicateConfirmationRequired } from '@/types';
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
/** Parsed field for preview table: tag, indicators, subfields, value */
export interface MarcFieldDisplay {
  tag: string;
  indicators: string;
  subfieldsFormatted: string;
  value: string;
}

/** MARC field mapping for API payload (e.g. { tag: "200", subfields: { a: "Title" } }) */
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
  /** Encoding detected for this notice (ISO 2709 only; MARCXML is UTF-8) */
  detectedEncoding?: RecordEncoding;
  status: 'pending' | 'importing' | 'imported' | 'error';
  error?: string;
  importedId?: number;
  importReport?: ImportReport;
}

type MarcFormat = 'UNIMARC' | 'MARC21';

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<any>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existing_id !== 'number') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
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

/** Parse raw_fields into rows for preview table (tag, indicators, subfields, value) */
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
  index: number,
  detectedEncoding?: RecordEncoding
): ParsedRecord {
  const record: ParsedRecord = {
    id: `record-${index}-${Date.now()}`,
    raw_fields: rawFields,
    status: 'pending',
  };
  if (detectedEncoding !== undefined) record.detectedEncoding = detectedEncoding;

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

/** Encoding detected per record for UNIMARC (Guide + field 100 + heuristic) */
type RecordEncoding = 'utf-8' | 'iso-8859-1' | 'iso-5426' | 'iso-6937';

const SUBFIELD_MARKER = '\x1F';

/** Extract subfield $a from first field 100 (raw format: ind1+ind2 + \x1F + code + value ...) */
function getField100SubfieldA(rawFields: Map<string, string[]>): string | null {
  const raw100 = rawFields.get('100')?.[0];
  if (!raw100) return null;
  const idx = raw100.indexOf(SUBFIELD_MARKER + 'a');
  if (idx === -1) return null;
  const after = raw100.slice(idx + 2);
  const end = after.indexOf(SUBFIELD_MARKER);
  return end === -1 ? after : after.slice(0, end);
}

/**
 * Detect encoding for one UNIMARC/MARC record (priority: Guide byte 9 → field 100 $a pos 26–28 → heuristic).
 * A: Byte at index 9 === 0x61 ('a') → UTF-8.
 * B: Field 100 $a positions 26–28: "50 " → UTF-8, "01" → ISO 5426, "02" → ISO 6937.
 * C: Try UTF-8; on invalid sequence use ISO-8859-1.
 */
function detectRecordEncoding(rawRecord: Uint8Array): RecordEncoding {
  if (rawRecord.length <= 9) return 'utf-8';

  // A. Guide (position 9): 0x61 = explicit UTF-8
  if (rawRecord[9] === 0x61) return 'utf-8';

  // B. Field 100 $a positions 26–28: need to parse record with a tentative decode (directory is ASCII-safe)
  let decodedForParse: string;
  try {
    decodedForParse = new TextDecoder('utf-8', { fatal: true }).decode(rawRecord);
  } catch {
    decodedForParse = iconv.decode(Buffer.from(rawRecord), 'iso-8859-1');
  }
  try {
    const recordBuf = Buffer.from(decodedForParse, 'utf8');
    const marcRecord = parseISO2709Record(recordBuf);
    const rawFields = marcRecordToRawFields(marcRecord.fields);
    const field100a = getField100SubfieldA(rawFields);
    if (field100a && field100a.length >= 28) {
      const pos26_28 = field100a.slice(26, 28);
      console.log("pos26_28 => ", pos26_28);
      if (pos26_28 === '50 ') return 'utf-8';
      if (pos26_28 === '01') return 'iso-5426';
      if (pos26_28 === '02') return 'iso-6937';
    }
  } catch {
    // ignore parse errors, fall through to heuristic
  }
  // C. Heuristic: try UTF-8; on invalid sequence use ISO-8859-1
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(rawRecord);
    return 'utf-8';
  } catch {
    return 'iso-8859-1';
  }
}

/**
 * Complete ISO 5426 table (G1 set).
 * Mapping based on NF Z 44-000 and BnF specifications.
 */
const ISO5426_CORRECT: Record<number, number> = {
  // --- Special characters (0xA1 to 0xBF) ---
  0xa1: 0x0141, // Ł (capital L with stroke)
  0xa2: 0x00d8, // Ø
  0xa3: 0x0110, // Đ (capital D with stroke)
  0xa4: 0x00de, // Þ (capital thorn)
  0xa5: 0x00c6, // Æ
  0xa6: 0x0152, // Œ
  0xa7: 0x02b9, // Prime (modifier letter)
  0xa8: 0x00b7, // Middle dot
  0xa9: 0x266d, // Flat sign
  0xaa: 0x00ae, // ®
  0xab: 0x00b1, // ±
  0xac: 0x01a0, // Ơ (capital O with horn)
  0xad: 0x01af, // Ư (capital U with horn)
  0xae: 0x02bc, // Apostrophe (modifier letter)
  0xb1: 0x0142, // ł (small l with stroke)
  0xb2: 0x00f8, // ø
  0xb3: 0x0111, // đ
  0xb4: 0x00fe, // þ
  0xb5: 0x00e6, // æ (small ae ligature)
  0xb6: 0x0153, // œ
  0xb7: 0x02ba, // Double prime
  0xb8: 0x0131, // ı (dotless i)
  0xb9: 0x00a3, // £
  0xba: 0x00f0, // ð (eth)
  0xbc: 0x01a1, // ơ
  0xbd: 0x01b0, // ư

  // --- Simple combining diacritics (0xC1 to 0xCF) ---
  // Reminder: in the byte stream, they appear *before* the base letter.
  0xc1: 0x0300, // Grave accent `
  0xc2: 0x0301, // Acute accent ´
  0xc3: 0x0302, // Circumflex accent ^
  0xc4: 0x0303, // Tilde ~
  0xc5: 0x0304, // Macron (overline)
  0xc6: 0x0306, // Breve ̆
  0xc7: 0x0307, // Dot above ̇
  0xc8: 0x0308, // Diaeresis / umlaut ̈
  0xc9: 0x030c, // Caron / háček ̌
  0xca: 0x030a, // Ring above ̊
  0xcb: 0x0327, // Cedilla ̧
  0xcc: 0x0328, // Ogonek ̨
  0xcd: 0x0323, // Dot below ̣
  0xce: 0x0324, // Diaeresis below ̤
  0xcf: 0x0313, // Smooth breathing (comma above)

  // --- Additional combining diacritics (0xD0 to 0xDF) ---
  0xd0: 0x030b, // Double acute accent above
  0xd1: 0x0332, // Low line (macron below)
  0xd2: 0x0325, // Ring below
  0xd3: 0x032e, // Breve below
  0xd4: 0x030d, // Vertical line above
  0xd5: 0x031c, // Half ring below (left)
  0xd6: 0x0326, // Comma below
  0xd7: 0x0310, // Candrabindu
  0xd8: 0x0317, // Acute accent below
  0xd9: 0x0316, // Grave accent below

  // --- “Double” diacritics (0xE1 to 0xE4) ---
  // These accents normally span two characters.
  0xe1: 0x0361, // Double ligature mark above (e.g. t͡s)
  0xe2: 0x0360, // Double tilde above
  0xe8: 0x0333, // Double low line
};

/**
 * Optimized decoding function.
 * Handles the critical case of input order accent + letter → output letter + accent.
 */
function decodeIso5426ToUnicode(raw: Uint8Array): string {
  const out: number[] = [];

  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];

    // Check if this byte is a diacritic (range 0xC1–0xDF and 0xE1+)
    if ((b >= 0xc1 && b <= 0xcf) || (b >= 0xd0 && b <= 0xdf) || (b >= 0xe1 && b <= 0xe8)) {
      const combiningMark = ISO5426_CORRECT[b];
      
      if (i + 1 < raw.length) {
        const nextByte = raw[i + 1];
        
        // Decode the base character (either ASCII or a special G1 character)
        let baseChar = nextByte;
        if (nextByte > 0x7f && ISO5426_CORRECT[nextByte]) {
            baseChar = ISO5426_CORRECT[nextByte];
        }

        out.push(baseChar); // Base letter first
        if (combiningMark) out.push(combiningMark); // Accent after
        
        i++; // Skip the base character we just consumed
      }
    } 
    // Standard characters (ASCII)
    else if (b <= 0x7f) {
      out.push(b);
    } 
    // G1 special characters (non-combining, such as Æ, Œ, ł)
    else {
      const cp = ISO5426_CORRECT[b];
      out.push(cp !== undefined ? cp : b);
    }
  }

  // Convert to string and normalize to NFC to merge accents with their base letters.
  // Example: 'e' + '\u0301' becomes 'é' (single code point).
  return String.fromCodePoint(...out).normalize('NFC');
}

/** Decode raw record bytes with the given encoding; output is always valid Unicode (UTF-8 when serialized). */
function decodeRecord(rawRecord: Uint8Array, encoding: RecordEncoding): string {
  let decoded: string;
  if (encoding === 'utf-8') {
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(rawRecord);
    } catch {
      decoded = iconv.decode(Buffer.from(rawRecord), 'iso-8859-1');
    }
  } else if (encoding === 'iso-5426') {
    decoded = decodeIso5426ToUnicode(rawRecord);
  } else if (encoding === 'iso-6937') {
    const buf = Buffer.from(rawRecord);
    try {
      decoded = iconv.decode(buf, 'iso6937');
    } catch {
      decoded = iconv.decode(buf, 'iso-8859-1');
    }
  } else {
    decoded = iconv.decode(Buffer.from(rawRecord), 'iso-8859-1');
  }
  return decoded.normalize('NFC');
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
// Per-record encoding detection for UNIMARC: Guide (byte 9) → field 100 $a (26–28) → heuristic.
function parseISO2709(arrayBuffer: ArrayBuffer): { records: ParsedRecord[]; detectedFormat: MarcFormat | null } {
  const records: ParsedRecord[] = [];
  let detectedFormat: MarcFormat | null = null;

  const buf = new Uint8Array(arrayBuffer);
  const RT = 0x1D;
  let start = 0;
  let index = 0;

  while (start < buf.length) {
    const pos = buf.indexOf(RT, start);
    if (pos === -1) break;
    const rawChunk = buf.subarray(start, pos);
    start = pos + 1;
    if (rawChunk.length < 24) {
      index += 1;
      continue;
    }

    try {
      const recordEncoding = detectRecordEncoding(rawChunk);
      const decoded = decodeRecord(rawChunk, recordEncoding);
      const recordBuf = Buffer.from(decoded, 'utf8');

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
      const record = buildRecordFromFields(rawFields, marcRecord.leader, index, recordEncoding);
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

  // Options state (always visible)
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

  const [replaceConfirmModal, setReplaceConfirmModal] = useState<{
    record: ParsedRecord;
    existingId: number;
    message: string;
  } | null>(null);
  const [replaceConfirmLoading, setReplaceConfirmLoading] = useState(false);
  const [replaceConfirmError, setReplaceConfirmError] = useState<string | null>(null);

  const [singleErrorModal, setSingleErrorModal] = useState<{ title: string; message: string } | null>(null);
  const [showImportErrorList, setShowImportErrorList] = useState(false);

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

  const parseFile = useCallback(async (file: File): Promise<{ records: ParsedRecord[]; detectedFormat: MarcFormat | null }> => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Sniff format: if first non-whitespace char is '<' → MARCXML, otherwise assume ISO 2709.
    let i = 0;
    // Skip UTF-8 BOM if present
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      i = 3;
    }
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) {
      i += 1;
    }
    const first = i < bytes.length ? bytes[i] : 0;
    const isXml = first === 0x3c; // '<'

    if (isXml) {
      const content = new TextDecoder('utf-8').decode(arrayBuffer);
      return { records: parseMARCXML(content), detectedFormat: null };
    }
    return parseISO2709(arrayBuffer);
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setParseError('');
    setFileName(file.name);

    try {
      const { records: parsed, detectedFormat } = await parseFile(file);

      if (parsed.length === 0) {
        setParseError(t('importMarc.noRecordsFound'));
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
  }, [parseFile, t]);

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
    setShowImportErrorList(false);

    for (let i = 0; i < pendingRecords.length; i++) {
      const record = pendingRecords[i];
      await importRecord(record, { showErrorModal: false });
      setImportProgress({ current: i + 1, total: pendingRecords.length });
    }

    setIsImporting(false);
  };

  const buildItemPayload = (record: ParsedRecord) => ({
    title: record.title1 ?? undefined,
    isbn: record.identification ?? undefined,
    authors: [...(record.authors1 ?? []), ...(record.authors2 ?? [])],
    publication_date: record.publication_date ?? undefined,
    abstract_: record.abstract_ ?? undefined,
    keywords: record.keywords ?? undefined,
    subject: record.subject ?? undefined,
    media_type: record.media_type ?? undefined,
    edition: record.edition_name || record.edition_place
      ? {
          id: null,
          publisher_name: record.edition_name ?? undefined,
          place_of_publication: record.edition_place ?? undefined,
          date: record.publication_date ?? undefined,
        }
      : undefined,
  });

  const completeImportWithItemId = async (record: ParsedRecord, itemId: number, importReport: ImportReport) => {
    if (has9xxFields(record)) {
      const specimenData = buildSpecimenFrom9xx(record);
      await api.createSpecimen(itemId, {
        ...specimenData,
        ...(selectedSourceId != null && { source_id: selectedSourceId }),
      });
    }
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, status: 'imported' as const, importedId: itemId, importReport } : r
    ));
  };

  const importRecord = async (record: ParsedRecord, options?: { showErrorModal?: boolean }) => {
    const showErrorModal = options?.showErrorModal !== false;
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, status: 'importing' as const } : r
    ));

    try {
      const { item, import_report } = await api.createItem(buildItemPayload(record));
      if (item.id != null) await completeImportWithItemId(record, item.id, import_report);
    } catch (error) {
      const confirm = getDuplicateConfirmationRequired(error);
      if (confirm) {
        setReplaceConfirmError(null);
        setReplaceConfirmModal({ record, existingId: confirm.existing_id, message: confirm.message });
        setRecords(prev => prev.map(r =>
          r.id === record.id ? { ...r, status: 'pending' as const } : r
        ));
        return;
      }
      const errorMessage = getApiErrorMessage(error, t);
      console.error('Error importing record:', error);
      setRecords(prev => prev.map(r =>
        r.id === record.id ? { ...r, status: 'error' as const, error: errorMessage } : r
      ));
      if (showErrorModal) {
        setSingleErrorModal({
          title: record.title1 || record.identification || t('items.notSpecified'),
          message: errorMessage,
        });
      }
    }
  };

  const handleConfirmReplaceExisting = async () => {
    if (!replaceConfirmModal) return;
    setReplaceConfirmLoading(true);
    setReplaceConfirmError(null);
    try {
      const { record, existingId } = replaceConfirmModal;
      const { item, import_report } = await api.createItem(buildItemPayload(record), {
        confirmReplaceExistingId: existingId,
      });
      if (item.id != null) await completeImportWithItemId(record, item.id, import_report);
      setReplaceConfirmModal(null);
    } catch (err) {
      console.error('Error confirming replace existing item:', err);
      setReplaceConfirmError(getApiErrorMessage(err, t));
    } finally {
      setReplaceConfirmLoading(false);
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

  const getAcceptedExtensions = (): string => '.mrc,.not,.dat,.xml,.marcxml';

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
          {formatAuthors([...(record.authors1 ?? []), ...(record.authors2 ?? [])])}
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
      className: 'hidden md:table-cell sticky right-40 z-10 bg-white dark:bg-gray-900 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_rgba(0,0,0,0.3)]',
    },
    {
      key: 'actions',
      header: '',
      render: (record: ParsedRecord) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {record.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => importRecord(record)}
                title={t('importMarc.importOne')}
                leftIcon={<Download className="h-4 w-4" />}
              >
                {t('importMarc.import')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemoveRecord(record.id)}
                className="text-gray-400 hover:text-red-500"
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {record.status === 'importing' && (
            <span className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('importMarc.importProgress')}
            </span>
          )}
          {record.status === 'error' && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => importRecord(record)}
                leftIcon={<Download className="h-4 w-4" />}
              >
                {t('importMarc.import')}
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
      className: 'w-40 sticky right-0 z-10 bg-white dark:bg-gray-900 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_rgba(0,0,0,0.3)] whitespace-nowrap',
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
              <div className="flex flex-wrap justify-center gap-2 text-sm" />
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

              {errorCount > 0 && (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowImportErrorList((v) => !v)}
                    leftIcon={<AlertCircle className="h-4 w-4" />}
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    {showImportErrorList ? t('importMarc.hideErrorList') : t('importMarc.showErrorList')}
                  </Button>
                  {showImportErrorList && (
                    <ul className="mt-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 max-h-48 overflow-y-auto space-y-2">
                      {records
                        .filter((r) => r.status === 'error' && r.error)
                        .map((r) => (
                          <li key={r.id} className="text-sm flex flex-col gap-0.5">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {r.title1 || r.identification || t('items.notSpecified')}
                            </span>
                            {r.identification && r.title1 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{r.identification}</span>
                            )}
                            <span className="text-red-700 dark:text-red-300">{r.error}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

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
            <div className="overflow-x-auto -mx-px">
              <table className="w-full min-w-[800px]">
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
                            {record.importReport && (
                              <div className="mb-4 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                                  {t('importMarc.importReportTitle')}
                                </div>
                                <div className="text-sm text-amber-900 dark:text-amber-200">
                                  {record.importReport.message || record.importReport.action}
                                  {record.importReport.existing_id != null ? ` (ID: ${record.importReport.existing_id})` : ''}
                                </div>
                                {record.importReport.warnings?.length > 0 && (
                                  <ul className="mt-2 list-disc pl-5 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                                    {record.importReport.warnings.map((w, idx) => (
                                      <li key={idx}>{w}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                              {t('importMarc.detectedEncoding', { encoding: record.detectedEncoding ?? 'utf-8' })}
                            </div>
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

      {/* Single import error popup */}
      <Modal
        isOpen={!!singleErrorModal}
        onClose={() => setSingleErrorModal(null)}
        title={t('importMarc.importErrorTitle')}
        size="md"
      >
        {singleErrorModal && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={singleErrorModal.title}>
              {singleErrorModal.title}
            </p>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {singleErrorModal.message}
            </div>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setSingleErrorModal(null)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Duplicate ISBN: explicit confirmation required (409) */}
      <Modal
        isOpen={!!replaceConfirmModal}
        onClose={() => {
          if (replaceConfirmLoading) return;
          setReplaceConfirmModal(null);
          setReplaceConfirmError(null);
        }}
        title={t('importMarc.confirmReplaceTitle')}
        size="lg"
      >
        {replaceConfirmModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {replaceConfirmModal.message}
            </p>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="font-medium mb-1">
                {t('importMarc.confirmReplaceExistingId', { id: replaceConfirmModal.existingId })}
              </div>
              <div className="text-gray-600 dark:text-gray-400">
                {t('importMarc.confirmReplaceExplanation')}
              </div>
            </div>
            {replaceConfirmError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {replaceConfirmError}
              </div>
            )}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (replaceConfirmLoading) return;
                  setReplaceConfirmModal(null);
                  setReplaceConfirmError(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={handleConfirmReplaceExisting} isLoading={replaceConfirmLoading}>
                {t('importMarc.confirmReplaceConfirm')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
