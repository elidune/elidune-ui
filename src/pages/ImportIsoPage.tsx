import { useState, useRef, useCallback, Fragment, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Upload,
  FileText,
  BookOpen,
  AlertCircle,
  Loader2,
  ScanLine,
  Download,
  X,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Card, Button, Badge, Input, Modal } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import type {
  Author,
  MediaType,
  Source,
  ImportReport,
  DuplicateConfirmationRequired,
  ItemShort,
} from '@/types';
import type { AxiosError } from 'axios';

// Helper function to get translation key for media type
function getMediaTypeTranslationKey(mediaType: MediaType | string | null | undefined): string {
  if (!mediaType) return 'unknown';
  const legacyMap: Record<string, string> = {
    u: 'unknown',
    b: 'printedText',
    bc: 'comics',
    p: 'periodic',
    v: 'video',
    vt: 'videoTape',
    vd: 'videoDvd',
    a: 'audio',
    am: 'audioMusic',
    amt: 'audioMusicTape',
    amc: 'audioMusicCd',
    an: 'audioNonMusic',
    ant: 'audioNonMusicTape',
    anc: 'audioNonMusicCd',
    c: 'cdRom',
    i: 'images',
    m: 'multimedia',
  };
  return legacyMap[String(mediaType)] ?? String(mediaType);
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
  /** Index of the record inside the uploaded batch (0-based) when using server-side UNIMARC upload */
  recordIndex?: number;
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
  importedId?: string;
  importReport?: ImportReport;
  /** When record comes from UNIMARC upload (server), full item for display (e.g. specimens) */
  itemShort?: ItemShort;
}

type MarcFormat = 'UNIMARC' | 'MARC21';

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<any>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existing_id !== 'string') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
}

function parseDuplicateFromErrorMessage(message: string): { existingId: string; isbn?: string } | null {
  const existingId =
    message.match(/confirm_replace_existing_id\s*=\s*([0-9]+)/i)?.[1] ??
    message.match(/existing[_\s-]?id\s*[=:]\s*([0-9]+)/i)?.[1] ??
    message.match(/\bid\s*=\s*([0-9]+)\b/i)?.[1] ??
    null;
  if (!existingId) return null;
  const rawIsbn = message.match(/\bISBN\s+([0-9Xx-]+)\b/)?.[1];
  const isbn = rawIsbn ? normalizeIsbn(rawIsbn) : undefined;
  return { existingId, isbn };
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

// (rawFieldsToDisplayRows and recordToApiMapping removed – expanded rows now show item/specimen details only)

// Parse author from MARC field
function parseAuthor(fieldData: string, delimiter = '\x1F'): Author {
  const lastname = getSubfield(fieldData, 'a', delimiter);
  const firstname = getSubfield(fieldData, 'b', delimiter);
  const func = getSubfield(fieldData, '4', delimiter) || getSubfield(fieldData, 'e', delimiter);
  return {
    id: '',
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
        record.media_type = 'printedText';
        break;
      case 'g': // Projected medium
        record.media_type = 'video';
        break;
      case 'j': // Musical sound recording
      case 'i': // Nonmusical sound recording
        record.media_type = 'audio';
        break;
      case 's': // Serial/Periodical
        record.media_type = 'periodic';
        break;
      case 'm': // Computer file
        record.media_type = 'cdRom';
        break;
      case 'k': // Two-dimensional nonprojectable graphic
      case 'r': // Three-dimensional artifact
        record.media_type = 'images';
        break;
      default:
        record.media_type = 'unknown';
    }
  } else {
    record.media_type = 'unknown';
  }

  return record;
}

// (client-side marcRecordToRawFields removed – server now parses UNIMARC)

// (client-side MARC format detection removed – server now parses UNIMARC)

/** Encoding detected per record for UNIMARC (Guide + field 100 + heuristic) */
type RecordEncoding = 'utf-8' | 'iso-8859-1' | 'iso-5426' | 'iso-6937';

// SUBFIELD_MARKER no longer needed now that UNIMARC parsing is server-side


// (client-side ISO 2709 record parser removed – server now parses UNIMARC)

// (client-side ISO 2709 parser removed in favor of server-side UNIMARC upload)

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

  // Sources (for specimen creation) — no default selection
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [addSourceLoading, setAddSourceLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState('');

  // File state
  const [fileName, setFileName] = useState<string>('');
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
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

  // UNIMARC batch duplicate handling (apply to all duplicates for current file)
  const [batchDuplicateApplyToAll, setBatchDuplicateApplyToAll] = useState(false);
  const [batchDuplicateAction, setBatchDuplicateAction] = useState<'replace' | 'new' | null>(null);

  const [replaceConfirmModal, setReplaceConfirmModal] = useState<{
    record: ParsedRecord;
    existingId: string;
    existingTitle?: string | null;
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
      // Do not preselect any source; user must choose for import
    } catch (e) {
      setSourcesError(t('importMarc.sourcesError'));
    }
  }, [t]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    if (!replaceConfirmModal) return;
    if (replaceConfirmModal.existingTitle !== undefined) return; // already resolved (or attempted)

    const existingId = replaceConfirmModal.existingId;
    let cancelled = false;

    (async () => {
      try {
        const existing = await api.getItem(existingId);
        if (cancelled) return;
        setReplaceConfirmModal((prev) => {
          if (!prev || prev.existingId !== existingId) return prev;
          return { ...prev, existingTitle: existing.title ?? null };
        });
      } catch {
        if (cancelled) return;
        setReplaceConfirmModal((prev) => {
          if (!prev || prev.existingId !== existingId) return prev;
          return { ...prev, existingTitle: null };
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [replaceConfirmModal]);

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

  const parseFile = useCallback(
    async (
      file: File,
      sourceId: string | null
    ): Promise<{ records: ParsedRecord[]; detectedFormat: MarcFormat | null; batchId?: string | null }> => {
      // Detect MARCXML by content sniffing (preserve existing behavior)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      let i = 0;
      // Skip UTF-8 BOM if present
      if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        i = 3;
      }
      while (
        i < bytes.length &&
        (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)
      ) {
        i += 1;
      }
      const first = i < bytes.length ? bytes[i] : 0;
      const isXml = first === 0x3c; // '<'

      // For MARCXML we keep client-side parsing as before
      if (isXml) {
        const content = new TextDecoder('utf-8').decode(arrayBuffer);
        return { records: parseMARCXML(content), detectedFormat: null };
      }

      // For UNIMARC ISO 2709 we delegate parsing to the backend (source_id optional for load)
      const enqueueResult = await api.uploadUnimarc(file, sourceId ?? undefined);
      const uploadedItems: ItemShort[] = enqueueResult.items;

      const recordsFromItems: ParsedRecord[] = uploadedItems.map((item, index) => ({
        id: `record-${index}-${Date.now()}`,
        recordIndex: index,
        title1: item.title ?? undefined,
        title2: undefined,
        identification: normalizeIsbn(item.isbn ?? undefined),
        authors1: item.author ? [item.author] : undefined,
        authors2: undefined,
        publication_date: item.date ?? undefined,
        edition_name: undefined,
        edition_place: undefined,
        abstract_: undefined,
        keywords: undefined,
        subject: undefined,
        media_type: (item.media_type ?? undefined) as MediaType | undefined,
        raw_fields: new Map<string, string[]>(),
        detectedEncoding: undefined,
        status: 'pending',
        error: undefined,
        importedId: undefined,
        importReport: undefined,
        itemShort: item,
      }));

      return { records: recordsFromItems, detectedFormat: 'UNIMARC', batchId: enqueueResult.batch_id };
    },
    []
  );

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setParseError('');
    setBatchId(null);
    setFileName(file.name);
    setBatchDuplicateApplyToAll(false);
    setBatchDuplicateAction(null);

    try {
      const { records: parsed, detectedFormat, batchId: newBatchId } = await parseFile(
        file,
        selectedSourceId
      );

      if (parsed.length === 0) {
        setParseError(t('importMarc.noRecordsFound'));
      } else {
        setRecords(parsed);
        setDetectedMarcFormat(detectedFormat);
        if (newBatchId) {
          setBatchId(newBatchId);
        }
      }
    } catch (error: any) {
      console.error('Error parsing file:', error);
      setParseError(t('importMarc.readError'));
    } finally {
      setIsLoading(false);
    }
  }, [parseFile, selectedSourceId, t]);

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
    if (!selectedSourceId) {
      setParseError(t('importMarc.sourceRequired'));
      return;
    }
    // For server-side UNIMARC batches, import one by one to handle duplicates (confirmation/allow duplicates)
    if (batchId) {
      let pendingRecords = records.filter((r) => r.status === 'pending' && r.recordIndex != null);
      if (pendingRecords.length === 0) return;

      setIsImporting(true);
      setImportProgress({ current: 0, total: pendingRecords.length });
      setShowImportErrorList(false);

      try {
        for (let i = 0; i < pendingRecords.length; i++) {
          const record = pendingRecords[i];
          await importRecord(record, { showErrorModal: false });
          setImportProgress({ current: i + 1, total: pendingRecords.length });
        }
        const stillErrors = records.some((r) => r.status === 'error');
        if (stillErrors) setShowImportErrorList(true);
      } catch (error) {
        console.error('Error importing UNIMARC batch:', error);
        setParseError(getApiErrorMessage(error, t));
      } finally {
        setIsImporting(false);
      }

      return;
    }

    // Legacy path (MARCXML client-side parsing): import one by one via /items
    let pendingRecords = records.filter((r) => r.status === 'pending');
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

  const completeImportWithItemId = async (record: ParsedRecord, itemId: string, importReport: ImportReport) => {
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
    if (!selectedSourceId) {
      setParseError(t('importMarc.sourceRequired'));
      return;
    }
    const showErrorModal = options?.showErrorModal !== false;
    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, status: 'importing' as const } : r
    ));

    try {
      // If we are in UNIMARC batch mode, import this single record by index
      if (batchId && record.recordIndex != null) {
        const report = await api.importMarcBatch(batchId, record.recordIndex, selectedSourceId);
        if (report.imported > 0 && report.failed.length === 0) {
          setRecords(prev =>
            prev.map(r =>
              r.id === record.id ? { ...r, status: 'imported' as const } : r
            )
          );
          return;
        }

        const combinedError =
          report.failed.map((f) => f.error).join(' ; ') || t('importMarc.importErrorGeneric');
        const duplicate = parseDuplicateFromErrorMessage(combinedError);
        if (duplicate) {
          // If user opted to apply a choice to all duplicates for this file, auto-apply
          if (batchDuplicateAction === 'replace') {
            const retry = await api.importMarcBatch(batchId, record.recordIndex, selectedSourceId, {
              confirmReplaceExistingId: duplicate.existingId,
            });
            if (retry.imported > 0 && retry.failed.length === 0) {
              setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'imported' as const } : r)));
              return;
            }
            const retryError =
              retry.failed.map((f) => f.error).join(' ; ') || t('importMarc.importErrorGeneric');
            setRecords((prev) =>
              prev.map((r) => (r.id === record.id ? { ...r, status: 'error' as const, error: retryError } : r))
            );
            return;
          }
          if (batchDuplicateAction === 'new') {
            const retry = await api.importMarcBatch(batchId, record.recordIndex, selectedSourceId, {
              allowDuplicateIsbn: true,
            });
            if (retry.imported > 0 && retry.failed.length === 0) {
              setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'imported' as const } : r)));
              return;
            }
            const retryError =
              retry.failed.map((f) => f.error).join(' ; ') || t('importMarc.importErrorGeneric');
            setRecords((prev) =>
              prev.map((r) => (r.id === record.id ? { ...r, status: 'error' as const, error: retryError } : r))
            );
            return;
          }

          // Otherwise prompt the user (same dialog), and keep record pending
          setReplaceConfirmError(null);
          setReplaceConfirmModal({ record, existingId: duplicate.existingId, existingTitle: undefined });
          setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'pending' as const } : r)));
          return;
        }

        setRecords(prev =>
          prev.map(r =>
            r.id === record.id ? { ...r, status: 'error' as const, error: combinedError } : r
          )
        );
        if (showErrorModal) {
          setSingleErrorModal({
            title: record.title1 || record.identification || t('items.notSpecified'),
            message: combinedError,
          });
        }
        return;
      }

      // Legacy path (MARCXML → /items)
      const { item, import_report } = await api.createItem(buildItemPayload(record));
      if (item.id != null) await completeImportWithItemId(record, item.id, import_report);
    } catch (error) {
      const confirm = getDuplicateConfirmationRequired(error);
      if (confirm) {
        setReplaceConfirmError(null);
        setReplaceConfirmModal({ record, existingId: confirm.existing_id, existingTitle: undefined });
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
      if (batchId && record.recordIndex != null) {
        const report = await api.importMarcBatch(batchId, record.recordIndex, selectedSourceId, {
          confirmReplaceExistingId: existingId,
        });
        if (report.imported > 0 && report.failed.length === 0) {
          setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'imported' as const } : r)));
          if (batchDuplicateApplyToAll) setBatchDuplicateAction('replace');
          setReplaceConfirmModal(null);
          return;
        }
        const msg = report.failed.map((f) => f.error).join(' ; ') || t('importMarc.importErrorGeneric');
        setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'error' as const, error: msg } : r)));
        setReplaceConfirmModal(null);
        return;
      }

      const { item, import_report } = await api.createItem(buildItemPayload(record), {
        confirmReplaceExistingId: existingId,
      });
      if (item.id != null) await completeImportWithItemId(record, item.id, import_report);
      if (batchDuplicateApplyToAll) setBatchDuplicateAction('replace');
      setReplaceConfirmModal(null);
    } catch (err) {
      console.error('Error confirming replace existing item:', err);
      setReplaceConfirmError(getApiErrorMessage(err, t));
    } finally {
      setReplaceConfirmLoading(false);
    }
  };

  const handleCreateNewDuplicateIsbn = async () => {
    if (!replaceConfirmModal) return;
    setReplaceConfirmLoading(true);
    setReplaceConfirmError(null);
    try {
      const { record } = replaceConfirmModal;
      if (batchId && record.recordIndex != null) {
        const report = await api.importMarcBatch(batchId, record.recordIndex, selectedSourceId, {
          allowDuplicateIsbn: true,
        });
        if (report.imported > 0 && report.failed.length === 0) {
          setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'imported' as const } : r)));
          if (batchDuplicateApplyToAll) setBatchDuplicateAction('new');
          setReplaceConfirmModal(null);
          return;
        }
        const msg = report.failed.map((f) => f.error).join(' ; ') || t('importMarc.importErrorGeneric');
        setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, status: 'error' as const, error: msg } : r)));
        setReplaceConfirmModal(null);
        return;
      }

      const { item, import_report } = await api.createItem(buildItemPayload(record), {
        allowDuplicateIsbn: true,
      });
      if (item.id != null) await completeImportWithItemId(record, item.id, import_report);
      if (batchDuplicateApplyToAll) setBatchDuplicateAction('new');
      setReplaceConfirmModal(null);
    } catch (err) {
      console.error('Error creating item with duplicate ISBN:', err);
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

  const handleCancel = () => {
    setRecords([]);
    setFileName('');
    setParseError('');
    setBatchId(null);
    setBatchDuplicateApplyToAll(false);
    setBatchDuplicateAction(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const showSourceSelect = records.length > 0;

  const duplicateExistingCount = records.filter(
    (r) => r.status === 'error' && typeof r.error === 'string' && parseDuplicateFromErrorMessage(r.error) != null
  ).length;

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
            <Button
              size="sm"
              variant="primary"
              onClick={() => importRecord(record)}
              title={t('importMarc.importOne')}
              leftIcon={<Download className="h-4 w-4" />}
              disabled={!selectedSourceId}
            >
              {t('importMarc.import')}
            </Button>
          )}
          {record.status === 'importing' && (
            <span className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('importMarc.importProgress')}
            </span>
          )}
          {record.status === 'error' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => importRecord(record)}
              leftIcon={<Download className="h-4 w-4" />}
              disabled={!selectedSourceId}
            >
              {t('importMarc.import')}
            </Button>
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

      {/* Drop zone: only when no file loaded */}
      {records.length === 0 && (
        <Card>
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
      )}

      {/* Records list */}
      {records.length > 0 && (
        <>
          {/* Stats and actions */}
          <Card>
            {showSourceSelect && (
              <div className="mb-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('importMarc.source')}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedSourceId ?? ''}
                    onChange={(e) => setSelectedSourceId(e.target.value || null)}
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
            )}
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
                  {duplicateExistingCount > 0 && (
                    <Badge variant="warning">
                      {t('importMarc.duplicateExistingCount', { count: duplicateExistingCount })}
                    </Badge>
                  )}
                </div>
              </div>

              {parseError && (
                <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  {parseError}
                </div>
              )}

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
                  <Button variant="ghost" onClick={handleCancel}>
                    {t('common.cancel')}
                  </Button>
                  {pendingCount > 0 && !scanMode && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={handleStartScanMode}
                        leftIcon={<ScanLine className="h-4 w-4" />}
                        disabled={!selectedSourceId}
                      >
                        {t('importMarc.importWithScan')}
                      </Button>
                      <Button
                        onClick={handleImportAll}
                        isLoading={isImporting}
                        leftIcon={<Download className="h-4 w-4" />}
                        disabled={!selectedSourceId}
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
                            {(() => {
                              const itemPayload = buildItemPayload(record);
                              const specimenPreview = has9xxFields(record) ? buildSpecimenFrom9xx(record) : null;
                              const selectedSource =
                                specimenPreview && selectedSourceId
                                  ? sources.find((s) => s.id === selectedSourceId)
                                  : null;

                              return (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                        {t('importMarc.itemDetails')}
                                      </h4>
                                      <dl className="space-y-1 text-sm">
                                        {record.itemShort?.specimens && record.itemShort.specimens.length > 0 && (
                                          <div className="flex flex-col gap-1">
                                            <dt className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                                              {t('items.specimens')} ({record.itemShort.specimens.length})
                                            </dt>
                                            <dd className="flex-1">
                                              <ul className="space-y-1.5 text-sm">
                                                {record.itemShort.specimens.map((spec) => {
                                                  const isAvailable = spec.availability === 0;
                                                  const isBorrowed = spec.availability === 1;
                                                  const statusLabel = isAvailable
                                                    ? t('items.available')
                                                    : isBorrowed
                                                      ? t('items.borrowed')
                                                      : null;
                                                  return (
                                                    <li
                                                      key={spec.id}
                                                      className="flex flex-wrap items-center gap-2 text-gray-900 dark:text-gray-100"
                                                    >
                                                      <span className="font-mono text-xs">{spec.barcode || spec.id}</span>
                                                      {spec.call_number && (
                                                        <span className="text-gray-500 dark:text-gray-400">
                                                          {spec.call_number}
                                                        </span>
                                                      )}
                                                      {spec.source_name && (
                                                        <span className="text-gray-500 dark:text-gray-400">
                                                          {spec.source_name}
                                                        </span>
                                                      )}
                                                      {statusLabel != null && (
                                                        <Badge variant={isAvailable ? 'success' : 'warning'}>
                                                          {statusLabel}
                                                        </Badge>
                                                      )}
                                                    </li>
                                                  );
                                                })}
                                              </ul>
                                            </dd>
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          <dt className="w-32 text-gray-500 dark:text-gray-400">{t('items.titleField')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                            {itemPayload.title || t('items.notSpecified')}
                                          </dd>
                                        </div>
                                        <div className="flex gap-2">
                                          <dt className="w-32 text-gray-500 dark:text-gray-400">{t('items.isbn')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100 font-mono">
                                            {itemPayload.isbn || '-'}
                                          </dd>
                                        </div>
                                        <div className="flex gap-2">
                                          <dt className="w-32 text-gray-500 dark:text-gray-400">{t('items.authors')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                            {formatAuthors(itemPayload.authors)}
                                          </dd>
                                        </div>
                                        <div className="flex gap-2">
                                          <dt className="w-32 text-gray-500 dark:text-gray-400">{t('items.publicationDate')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                            {itemPayload.publication_date || '-'}
                                          </dd>
                                        </div>
                                        {itemPayload.media_type && (
                                          <div className="flex gap-2">
                                            <dt className="w-32 text-gray-500 dark:text-gray-400">{t('common.type')} :</dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {t(
                                                `items.mediaType.${getMediaTypeTranslationKey(
                                                  itemPayload.media_type as MediaType
                                                )}`
                                              )}
                                            </dd>
                                          </div>
                                        )}
                                        {itemPayload.edition && (
                                          <>
                                            <div className="flex gap-2">
                                              <dt className="w-32 text-gray-500 dark:text-gray-400">
                                                {t('items.publisher')}
                                              </dt>
                                              <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                                {itemPayload.edition.publisher_name || '-'}
                                              </dd>
                                            </div>
                                            <div className="flex gap-2">
                                              <dt className="w-32 text-gray-500 dark:text-gray-400">
                                                {t('items.placeOfPublication')}
                                              </dt>
                                              <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                                {itemPayload.edition.place_of_publication || '-'}
                                              </dd>
                                            </div>
                                          </>
                                        )}
                                        {itemPayload.abstract_ && (
                                          <div className="flex gap-2">
                                            <dt className="w-32 text-gray-500 dark:text-gray-400">
                                              {t('items.abstract')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {itemPayload.abstract_}
                                            </dd>
                                          </div>
                                        )}
                                        {itemPayload.keywords && (
                                          <div className="flex gap-2">
                                            <dt className="w-32 text-gray-500 dark:text-gray-400">
                                              {t('items.keywords')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {itemPayload.keywords}
                                            </dd>
                                          </div>
                                        )}
                                      </dl>
                                    </div>

                                    {specimenPreview && (
                                      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                          {t('importMarc.specimenDetails')}
                                        </h4>
                                        <dl className="space-y-1 text-sm">
                                          <div className="flex gap-2">
                                            <dt className="w-32 text-gray-500 dark:text-gray-400">
                                              {t('specimens.barcode')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100 font-mono">
                                              {specimenPreview.barcode}
                                            </dd>
                                          </div>
                                          <div className="flex gap-2">
                                            <dt className="w-32 text-gray-500 dark:text-gray-400">
                                              {t('specimens.callNumber')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {specimenPreview.call_number || '-'}
                                            </dd>
                                          </div>
                                          <div className="flex gap-2">
                                            <dt className="w-32 text-gray-500 dark:text-gray-400">
                                              {t('importMarc.source')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {selectedSource
                                                ? selectedSource.name || selectedSource.key || selectedSource.id
                                                : t('importMarc.noSource')}
                                            </dd>
                                          </div>
                                        </dl>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
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
        footer={
          singleErrorModal ? (
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setSingleErrorModal(null)}>
                {t('common.close')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {singleErrorModal && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={singleErrorModal.title}>
              {singleErrorModal.title}
            </p>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {singleErrorModal.message}
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
        title={t('importMarc.duplicateIsbnTitle')}
        size="lg"
        footer={
          replaceConfirmModal ? (
            <div className="flex justify-end gap-2">
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
              <Button variant="secondary" onClick={handleCreateNewDuplicateIsbn} isLoading={replaceConfirmLoading}>
                {t('importMarc.duplicateIsbnCreateNew')}
              </Button>
              <Button onClick={handleConfirmReplaceExisting} isLoading={replaceConfirmLoading}>
                {t('importMarc.duplicateIsbnReplace')}
              </Button>
            </div>
          ) : undefined
        }
      >
        {replaceConfirmModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t('importMarc.duplicateIsbnPrompt', {
                isbn: replaceConfirmModal.record.identification || '-',
                title: replaceConfirmModal.existingTitle || t('items.notSpecified'),
              })}
            </p>
            {batchId && replaceConfirmModal.record.recordIndex != null && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={batchDuplicateApplyToAll}
                  onChange={(e) => setBatchDuplicateApplyToAll(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-amber-600 focus:ring-amber-500"
                  disabled={replaceConfirmLoading}
                />
                {t('importMarc.duplicateIsbnApplyToAll')}
              </label>
            )}
            {replaceConfirmError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {replaceConfirmError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
