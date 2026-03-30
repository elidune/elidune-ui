import { useState, useRef, useCallback, Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
  ChevronLeft,
  Plus,
  Server,
  RefreshCw,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Card, Button, Badge, Input, Modal } from '@/components/common';
import api from '@/services/api';
import { getApiErrorMessage } from '@/utils/apiError';
import { formatIsbnDisplay } from '@/utils/isbnDisplay';
import { useBackgroundTask, restoreTaskId } from '@/hooks/common/useBackgroundTask';
import type {
  Author,
  MediaType,
  Source,
  ImportReport,
  DuplicateConfirmationRequired,
  BiblioShort,
  MarcImportPreview,
  RecordValidationIssue,
  MarcBatchInfo,
  BackgroundTask,
  MarcBatchImportError,
} from '@/types';
import type { AxiosError } from 'axios';

const MARC_IMPORT_TASK_KEY = 'elidune.marcImportTask';

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

function formatTtlSeconds(seconds: number): string {
  if (seconds < 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
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
  publicationDate?: string;
  edition_name?: string;
  edition_place?: string;
  abstract?: string;
  keywords?: string;
  subject?: string;
  mediaType?: MediaType;
  raw_fields: Map<string, string[]>;
  /** Encoding detected for this notice (ISO 2709 only; MARCXML is UTF-8) */
  detectedEncoding?: RecordEncoding;
  status: 'pending' | 'importing' | 'imported' | 'error';
  error?: string;
  /** Set when the record was imported via a duplicate-resolution confirmation */
  importedWithWarning?: 'replaced' | 'duplicated';
  importedId?: string;
  importReport?: ImportReport;
  /** When record comes from UNIMARC upload (server), biblio short for display */
  biblioShort?: BiblioShort;
  /** MARC parse diagnostics (server UNIMARC preview only) */
  validationIssues?: RecordValidationIssue[];
}

function hasMarcValidationErrors(record: ParsedRecord): boolean {
  return (record.validationIssues?.length ?? 0) > 0;
}

function marcPreviewToParsedRecord(item: MarcImportPreview, index: number): ParsedRecord {
  return {
    id: `record-${index}-${Date.now()}`,
    recordIndex: index,
    title1: item.title ?? undefined,
    title2: undefined,
    identification: normalizeIsbn(item.isbn ?? undefined),
    authors1: item.author ? [item.author] : undefined,
    authors2: undefined,
    publicationDate: item.date ?? undefined,
    edition_name: undefined,
    edition_place: undefined,
    abstract: undefined,
    keywords: undefined,
    subject: undefined,
    mediaType: (item.mediaType ?? undefined) as MediaType | undefined,
    raw_fields: new Map<string, string[]>(),
    detectedEncoding: undefined,
    status: 'pending',
    error: undefined,
    importedId: undefined,
    importReport: undefined,
    biblioShort: item,
    validationIssues: item.validationIssues,
  };
}

type MarcFormat = 'UNIMARC' | 'MARC21';

function getDuplicateConfirmationRequired(error: unknown): DuplicateConfirmationRequired | null {
  const ax = error as AxiosError<any>;
  if (ax?.response?.status !== 409) return null;
  const data = ax.response?.data as Partial<DuplicateConfirmationRequired> | undefined;
  if (!data) return null;
  if (data.code !== 'duplicate_isbn_needs_confirmation') return null;
  if (typeof data.existingId !== 'string') return null;
  if (typeof data.message !== 'string') return null;
  return data as DuplicateConfirmationRequired;
}

function parseDuplicateFromErrorMessage(message: string): { existingId: string | null; isbn?: string } | null {
  const isDuplicateConfirmation = /duplicate isbn requires confirmation/i.test(message);
  const existingId =
    message.match(/confirm_replace_existing_id\s*=\s*([0-9]+)/i)?.[1] ??
    message.match(/existing[_\s-]?id\s*[=:]\s*([0-9]+)/i)?.[1] ??
    message.match(/\bid\s*=\s*([0-9]+)\b/i)?.[1] ??
    null;
  if (!existingId && !isDuplicateConfirmation) return null;
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

/** Server may return counts or arrays for `imported` / `failed` depending on task serialization. */
function getMarcBatchImportedCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0;
  const r = result as Record<string, unknown>;
  const imported = r.imported;
  if (Array.isArray(imported)) return imported.length;
  if (typeof imported === 'number' && Number.isFinite(imported)) return imported;
  return 0;
}

function getMarcBatchFailedCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0;
  const r = result as Record<string, unknown>;
  const failed = r.failed;
  if (Array.isArray(failed)) return failed.length;
  if (typeof failed === 'number' && Number.isFinite(failed)) return failed;
  return 0;
}

function getMarcBatchFailureEntries(result: unknown): MarcBatchImportError[] {
  if (!result || typeof result !== 'object') return [];
  const failed = (result as Record<string, unknown>).failed;
  if (!Array.isArray(failed)) return [];
  return failed as MarcBatchImportError[];
}

/** Task progress.message may be a string or structured counts from the API. */
function formatMarcTaskProgressMessage(message: unknown, t: TFunction): string | null {
  if (message == null) return null;
  if (typeof message === 'string') return message;
  if (typeof message === 'object' && message !== null && 'failed' in message && 'imported' in message) {
    const o = message as { failed: unknown; imported: unknown };
    return t('backgroundTask.marcImport.completedSummary', {
      imported: getMarcBatchImportedCount(o),
      failed: getMarcBatchFailedCount(o),
    });
  }
  return null;
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
function buildSpecimenFrom9xx(record: ParsedRecord): { barcode: string; callNumber?: string } {
  const fields9xx = get9xxRawFields(record.raw_fields);
  let barcode = '';
  let callNumber: string | undefined;
  // Prefer 952: $a = barcode, $c = call number (common local holdings)
  for (const [tag, values] of fields9xx.entries()) {
    for (const v of values) {
      if (parseInt(tag, 10) >= 10 && v.length > 2) {
        const a = getSubfield(v.substring(2), 'a');
        const c = getSubfield(v.substring(2), 'c');
        if (a) barcode = barcode || a.trim();
        if (c) callNumber = callNumber || c.trim();
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
  return { barcode: barcode || `IMPORT-${Date.now()}`, callNumber: callNumber || undefined };
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
    record.publicationDate = getSubfield(field210, 'd')?.replace(/[^\d]/g, '').substring(0, 4);
    record.edition_name = getSubfield(field210, 'c');
    record.edition_place = getSubfield(field210, 'a');
  } else if (field260) {
    record.publicationDate = getSubfield(field260, 'c')?.replace(/[^\d]/g, '').substring(0, 4);
    record.edition_name = getSubfield(field260, 'b')?.replace(/[,.:]\s*$/, '');
    record.edition_place = getSubfield(field260, 'a')?.replace(/\s*:\s*$/, '');
  } else if (field264) {
    record.publicationDate = getSubfield(field264, 'c')?.replace(/[^\d]/g, '').substring(0, 4);
    record.edition_name = getSubfield(field264, 'b')?.replace(/[,.:]\s*$/, '');
    record.edition_place = getSubfield(field264, 'a')?.replace(/\s*:\s*$/, '');
  }

  // Abstract (330 for UNIMARC, 520 for MARC21)
  const field330 = rawFields.get('330')?.[0];
  const field520 = rawFields.get('520')?.[0];
  if (field330) {
    record.abstract = getSubfield(field330, 'a');
  } else if (field520) {
    record.abstract = getSubfield(field520, 'a');
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
        record.mediaType = 'printedText';
        break;
      case 'g': // Projected medium
        record.mediaType = 'video';
        break;
      case 'j': // Musical sound recording
      case 'i': // Nonmusical sound recording
        record.mediaType = 'audio';
        break;
      case 's': // Serial/Periodical
        record.mediaType = 'periodic';
        break;
      case 'm': // Computer file
        record.mediaType = 'cdRom';
        break;
      case 'k': // Two-dimensional nonprojectable graphic
      case 'r': // Three-dimensional artifact
        record.mediaType = 'images';
        break;
      default:
        record.mediaType = 'unknown';
    }
  } else {
    record.mediaType = 'unknown';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const seenImportedIdsRef = useRef<Set<string>>(new Set());

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
  const [successCount, setSuccessCount] = useState(0);

  // Scan mode state
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState('');

  // Expanded row to show raw MARC fields; detected MARC format (UNIMARC / MARC21)
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [detectedMarcFormat, setDetectedMarcFormat] = useState<MarcFormat | null>(null);

  // Pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);


  const [replaceConfirmModal, setReplaceConfirmModal] = useState<{
    record: ParsedRecord;
    existingId: string | null;
    existingTitle?: string | null;
  } | null>(null);
  const [replaceConfirmLoading, setReplaceConfirmLoading] = useState(false);
  const [replaceConfirmError, setReplaceConfirmError] = useState<string | null>(null);

  const [singleErrorModal, setSingleErrorModal] = useState<{ title: string; message: string } | null>(null);

  // Import source: file upload or cached server batch
  const [importMode, setImportMode] = useState<'file' | 'batch'>('file');
  const [marcBatches, setMarcBatches] = useState<MarcBatchInfo[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState('');
  const [loadingBatchId, setLoadingBatchId] = useState<string | null>(null);

  // Recovered background task (from localStorage on page reload)
  const [recoveredTask, setRecoveredTask] = useState<BackgroundTask | null>(null);

  // Background task polling for batch import
  const importTask = useBackgroundTask('marcBatchImport', {
    storageKey: MARC_IMPORT_TASK_KEY,
    onProgress: (task) => {
      // Keep recovery banner in sync when we resumed without local record state
      setRecoveredTask((prev) => (prev && prev.id === task.id ? task : prev));

      const msg = task.progress?.message;
      if (!msg || typeof msg !== 'object') return;

      const importedRaw = (msg as Record<string, unknown>).imported;
      const failedRaw = (msg as Record<string, unknown>).failed;

      // 1) Remove successfully imported rows as we learn their new IDs
      if (Array.isArray(importedRaw)) {
        const importedIds = importedRaw.filter((v): v is string => typeof v === 'string' && v.length > 0);
        const newIds: string[] = [];
        for (const id of importedIds) {
          if (!seenImportedIdsRef.current.has(id)) {
            seenImportedIdsRef.current.add(id);
            newIds.push(id);
          }
        }
        if (newIds.length > 0) {
          const newIdSet = new Set(newIds);
          let removedCount = 0;
          setRecords((prev) => {
            const next = prev.filter((r) => {
              const rowId = r.importedId ?? r.biblioShort?.id;
              const shouldRemove = rowId ? newIdSet.has(rowId) : false;
              if (shouldRemove) removedCount += 1;
              return !shouldRemove;
            });
            return next;
          });
          if (removedCount > 0) setSuccessCount((prev) => prev + removedCount);
        }
      }

      // 2) Display failures on the go (map by recordIndex)
      if (Array.isArray(failedRaw)) {
        const failures = failedRaw as MarcBatchImportError[];
        if (failures.length > 0) {
          const failedByKey = new Map(
            failures.map((f) => {
              const idx = parseInt(f.key.split(':').pop() ?? '', 10);
              return [idx, f] as const;
            })
          );
          setRecords((prev) =>
            prev.map((r) => {
              if (r.status !== 'importing') return r;
              const failure = r.recordIndex != null ? failedByKey.get(r.recordIndex) : undefined;
              if (!failure) return r;
              const isDuplicate = failure.existingId != null;
              return {
                ...r,
                status: 'error' as const,
                error: isDuplicate ? t('importMarc.duplicateSkippedInBatch') : failure.error,
              };
            })
          );
        }
      }
    },
    onSettled: (task) => {
      // Update recovery banner with final state
      setRecoveredTask((prev) => (prev && prev.id === task.id ? task : prev));
      if (task.status === 'completed' && task.result) {
        const report = task.result;
        const failedByKey = new Map(
          getMarcBatchFailureEntries(report).map((f) => {
            const idx = parseInt(f.key.split(':').pop() ?? '', 10);
            return [idx, f] as const;
          })
        );
        setRecords((prev) => {
          const next: ParsedRecord[] = [];
          for (const r of prev) {
            if (r.status !== 'importing') {
              next.push(r);
              continue;
            }
            const failure = r.recordIndex != null ? failedByKey.get(r.recordIndex) : undefined;
            if (failure) {
              const isDuplicate = failure.existingId != null;
              next.push({
                ...r,
                status: 'error',
                error: isDuplicate ? t('importMarc.duplicateSkippedInBatch') : failure.error,
              });
            }
            // no failure → imported successfully → drop from list
          }
          return next;
        });
        const failedCount = getMarcBatchFailedCount(report);
        setSuccessCount((prev) => {
          const importingCount = records.filter((r) => r.status === 'importing').length;
          return prev + Math.max(0, importingCount - failedCount);
        });
      } else if (task.status === 'failed') {
        setRecords((prev) =>
          prev.map((r) => (r.status === 'importing' ? { ...r, status: 'pending' as const } : r))
        );
        setParseError(task.error ?? t('importMarc.importErrorGeneric'));
      }
      setIsImporting(false);
    },
  });

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

  // Restore any in-progress batch import task from localStorage
  useEffect(() => {
    restoreTaskId(MARC_IMPORT_TASK_KEY).then((task) => {
      if (!task) return;
      setRecoveredTask(task);
      if (task.status === 'pending' || task.status === 'running') {
        importTask.resumeTask(task.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMarcBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError('');
    try {
      const data = await api.listMarcBatches();
      setMarcBatches(data);
    } catch {
      setBatchesError(t('importMarc.batchesLoadError'));
    } finally {
      setBatchesLoading(false);
    }
  }, [t]);

  const handleLoadBatch = useCallback(async (batchId: string) => {
    setLoadingBatchId(batchId);
    setParseError('');
    try {
      const result = await api.loadMarcBatch(batchId);
      const recordsFromBatch: ParsedRecord[] = result.previews.map((item, index) =>
        marcPreviewToParsedRecord(item, index),
      );
      if (recordsFromBatch.length === 0) {
        setParseError(t('importMarc.noRecordsFound'));
      } else {
        setRecords(recordsFromBatch);
        setDetectedMarcFormat('UNIMARC');
        setBatchId(result.batchId);
        setFileName(`Batch #${result.batchId}`);
      }
    } catch {
      setParseError(t('importMarc.batchLoadError'));
    } finally {
      setLoadingBatchId(null);
    }
  }, [t]);

  useEffect(() => {
    if (importMode === 'batch' && records.length === 0) {
      fetchMarcBatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importMode]);

  // Reset pagination and counters whenever a new batch is loaded
  useEffect(() => {
    setCurrentPage(1);
    setExpandedRecordId(null);
    setSuccessCount(0);
    setImportProgress({ current: 0, total: 0 });
  }, [fileName]);

  useEffect(() => {
    if (!replaceConfirmModal) return;
    if (!replaceConfirmModal.existingId) return; // no ID known, skip lookup
    if (replaceConfirmModal.existingTitle !== undefined) return; // already resolved (or attempted)

    const existingId = replaceConfirmModal.existingId;
    let cancelled = false;

    (async () => {
      try {
        const existing = await api.getBiblio(existingId);
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

      // For UNIMARC ISO 2709 we delegate parsing to the backend (sourceId optional for load)
      const enqueueResult = await api.uploadUnimarc(file, sourceId ?? undefined);

      const recordsFromItems: ParsedRecord[] = enqueueResult.previews.map((item, index) =>
        marcPreviewToParsedRecord(item, index),
      );

      return { records: recordsFromItems, detectedFormat: 'UNIMARC', batchId: enqueueResult.batchId };
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
    if (records.some((r) => r.status === 'pending' && hasMarcValidationErrors(r))) {
      setParseError(t('importMarc.cannotImportWithValidationErrors'));
      return;
    }
    // For server-side UNIMARC batches: start an async task
    if (batchId) {
      const pendingIds = new Set(
        records.filter((r) => r.status === 'pending' && r.recordIndex != null).map((r) => r.id)
      );
      if (pendingIds.size === 0) return;

      setIsImporting(true);
      setRecords((prev) =>
        prev.map((r) => (pendingIds.has(r.id) ? { ...r, status: 'importing' as const } : r))
      );

      try {
        const { taskId } = await api.importMarcBatch(batchId, selectedSourceId);
        importTask.startTask(taskId);
      } catch (error) {
        setRecords((prev) =>
          prev.map((r) => (pendingIds.has(r.id) ? { ...r, status: 'pending' as const } : r))
        );
        setParseError(getApiErrorMessage(error, t));
        setIsImporting(false);
      }

      return;
    }

    // Legacy path (MARCXML client-side parsing): import one by one via /items
    const pendingRecords = records.filter((r) => r.status === 'pending');
    if (pendingRecords.length === 0) return;

    setIsImporting(true);
    setImportProgress({ current: 0, total: pendingRecords.length });

    for (let i = 0; i < pendingRecords.length; i++) {
      const record = pendingRecords[i];
      await importRecord(record, { showErrorModal: false, showDuplicateModal: false });
      setImportProgress({ current: i + 1, total: pendingRecords.length });
    }

    setIsImporting(false);
  };

  const buildItemPayload = (record: ParsedRecord) => ({
    title: record.title1 ?? undefined,
    isbn: record.identification ?? undefined,
    authors: [...(record.authors1 ?? []), ...(record.authors2 ?? [])],
    publicationDate: record.publicationDate ?? undefined,
    abstract: record.abstract ?? undefined,
    keywords: record.keywords ?? undefined,
    subject: record.subject ?? undefined,
    mediaType: record.mediaType ?? undefined,
    edition: record.edition_name || record.edition_place
      ? {
          id: null,
          publisherName: record.edition_name ?? undefined,
          placeOfPublication: record.edition_place ?? undefined,
          date: record.publicationDate ?? undefined,
        }
      : undefined,
  });

  const completeImportWithItemId = async (
    record: ParsedRecord,
    itemId: string,
    _importReport: ImportReport
  ) => {
    if (has9xxFields(record)) {
      const specimenData = buildSpecimenFrom9xx(record);
      await api.createItem(itemId, {
        ...specimenData,
        ...(selectedSourceId != null && { sourceId: selectedSourceId }),
      });
    }
    setRecords(prev => prev.filter(r => r.id !== record.id));
    setSuccessCount(prev => prev + 1);
  };

  const importRecord = async (
    record: ParsedRecord,
    options?: { showErrorModal?: boolean; showDuplicateModal?: boolean }
  ) => {
    if (!selectedSourceId) {
      setParseError(t('importMarc.sourceRequired'));
      return;
    }
    if (hasMarcValidationErrors(record)) {
      setParseError(t('importMarc.cannotImportWithValidationErrors'));
      return;
    }
    const showErrorModal = options?.showErrorModal !== false;
    const showDuplicateModal = options?.showDuplicateModal !== false;

    setRecords(prev => prev.map(r =>
      r.id === record.id ? { ...r, status: 'importing' as const } : r
    ));

    try {
      // Legacy path (MARCXML → /items)
      const { biblio, importReport } = await api.createBiblio(buildItemPayload(record));
      if (biblio.id != null) await completeImportWithItemId(record, biblio.id, importReport);
    } catch (error) {
      const confirm = getDuplicateConfirmationRequired(error);
      if (confirm) {
        if (!showDuplicateModal) {
          setRecords(prev =>
            prev.map(r =>
              r.id === record.id
                ? { ...r, status: 'error' as const, error: t('importMarc.duplicateSkippedInBatch') }
                : r
            )
          );
          return;
        }
        setReplaceConfirmError(null);
        setReplaceConfirmModal({ record, existingId: confirm.existingId, existingTitle: undefined });
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
    if (hasMarcValidationErrors(replaceConfirmModal.record)) {
      setReplaceConfirmError(t('importMarc.cannotImportWithValidationErrors'));
      return;
    }
    if (!replaceConfirmModal.existingId) {
      setReplaceConfirmError(t('importMarc.cannotReplaceNoId'));
      return;
    }
    setReplaceConfirmLoading(true);
    setReplaceConfirmError(null);
    try {
      const { record, existingId } = replaceConfirmModal as { record: ParsedRecord; existingId: string; existingTitle?: string | null };
      const { biblio, importReport } = await api.createBiblio(buildItemPayload(record), {
        confirmReplaceExistingId: existingId,
      });
      if (biblio.id != null) await completeImportWithItemId(record, biblio.id, importReport);
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
    if (hasMarcValidationErrors(replaceConfirmModal.record)) {
      setReplaceConfirmError(t('importMarc.cannotImportWithValidationErrors'));
      return;
    }
    setReplaceConfirmLoading(true);
    setReplaceConfirmError(null);
    try {
      const { record } = replaceConfirmModal;
      const { biblio, importReport } = await api.createBiblio(buildItemPayload(record), {
        allowDuplicateIsbn: true,
      });
      if (biblio.id != null) await completeImportWithItemId(record, biblio.id, importReport);
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

    const barcode = scanInput.trim();
    setScanError('');

    const matchingRecord = records.find((r) => {
      if (r.status !== 'pending') return false;
      return (r.biblioShort?.items ?? []).some((item) => (item.barcode ?? '').trim() === barcode);
    });

    if (!matchingRecord) {
      setScanError(t('importMarc.specimenBarcodeNotFound', { barcode }));
      setScanInput('');
      scanInputRef.current?.focus();
      return;
    }

    if (hasMarcValidationErrors(matchingRecord)) {
      setScanError(t('importMarc.cannotImportWithValidationErrors'));
      setScanInput('');
      scanInputRef.current?.focus();
      return;
    }

    await importRecord(matchingRecord);

    setScanInput('');
    scanInputRef.current?.focus();

    const remaining = records.filter((r) => r.status === 'pending').length - 1;
    if (remaining === 0) {
      setScanMode(false);
    }
  };

  const handleCancel = () => {
    setRecords([]);
    setFileName('');
    setParseError('');
    setBatchId(null);
    setSuccessCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
  const pendingHasValidationErrors = records.some(
    (r) => r.status === 'pending' && hasMarcValidationErrors(r),
  );
  const errorCount = records.filter(r => r.status === 'error').length;

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRecords = records.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
            {(record.validationIssues?.length ?? 0) > 0 && (
              <div className="mt-1">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {t('importMarc.validationErrorCount', { count: record.validationIssues!.length })}
                </span>
              </div>
            )}
            {record.status === 'error' && (
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="danger">{t('importMarc.errorTag')}</Badge>
                {record.error && (
                  <span className="text-xs text-red-700 dark:text-red-300 truncate" title={record.error}>
                    {record.error}
                  </span>
                )}
              </div>
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
          {record.identification ? formatIsbnDisplay(record.identification) : '-'}
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
      render: (record: ParsedRecord) => record.publicationDate || '-',
      className: 'hidden md:table-cell',
    },
    {
      key: 'type',
      header: t('common.type'),
      render: (record: ParsedRecord) => (
        <Badge>
          {record.mediaType 
            ? t(`items.mediaType.${getMediaTypeTranslationKey(record.mediaType)}`)
            : t('items.mediaType.unknown')
          }
        </Badge>
      ),
      className: 'hidden md:table-cell sticky right-40 z-10 bg-white dark:bg-gray-900 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_rgba(0,0,0,0.3)]',
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (record: ParsedRecord) => (
        <div className="flex items-center justify-end gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {record.status === 'pending' && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => importRecord(record)}
              title={
                hasMarcValidationErrors(record)
                  ? t('importMarc.cannotImportWithValidationErrors')
                  : t('importMarc.importOne')
              }
              leftIcon={<Download className="h-4 w-4" />}
              disabled={!selectedSourceId || hasMarcValidationErrors(record)}
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
              title={
                hasMarcValidationErrors(record)
                  ? t('importMarc.cannotImportWithValidationErrors')
                  : undefined
              }
              leftIcon={<Download className="h-4 w-4" />}
              disabled={!selectedSourceId || hasMarcValidationErrors(record)}
            >
              {t('importMarc.import')}
            </Button>
          )}
        </div>
      ),
      className: 'w-40 sticky right-0 z-10 bg-white dark:bg-gray-900 shadow-[-4px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[-4px_0_8px_rgba(0,0,0,0.3)] whitespace-nowrap',
    },
  ];

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
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

      {/* Recovered background task banner */}
      {recoveredTask && !importTask.task && (
        <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
          recoveredTask.status === 'completed'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
            : recoveredTask.status === 'failed'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          {recoveredTask.status === 'completed' ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : recoveredTask.status === 'failed' ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          ) : (
            <Loader2 className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 animate-spin" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t(`backgroundTask.status.${recoveredTask.status}`)}
            </p>
            {recoveredTask.status === 'completed' && recoveredTask.result && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {t('backgroundTask.marcImport.completedSummary', {
                  imported: getMarcBatchImportedCount(recoveredTask.result),
                  failed: getMarcBatchFailedCount(recoveredTask.result),
                })}
              </p>
            )}
            {(recoveredTask.status === 'pending' || recoveredTask.status === 'running') && recoveredTask.progress && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                  <span>{t('backgroundTask.progress')}</span>
                  <span>{recoveredTask.progress.current} / {recoveredTask.progress.total}</span>
                </div>
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${recoveredTask.progress.total > 0
                        ? (recoveredTask.progress.current / recoveredTask.progress.total) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {recoveredTask.status === 'failed' && recoveredTask.error && (
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">{recoveredTask.error}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setRecoveredTask(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Import section — file upload or existing batch */}
      {records.length === 0 && (
        <Card>
          {/* Mode tabs */}
          <div className="flex gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 mb-5 w-fit">
            <button
              type="button"
              onClick={() => setImportMode('file')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                importMode === 'file'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Upload className="h-4 w-4" />
              {t('importMarc.uploadFile')}
            </button>
            <button
              type="button"
              onClick={() => setImportMode('batch')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                importMode === 'batch'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Server className="h-4 w-4" />
              {t('importMarc.existingBatch')}
            </button>
          </div>

          {/* File upload */}
          {importMode === 'file' && (
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
          )}

          {/* Existing server batches */}
          {importMode === 'batch' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('importMarc.batchHint')}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={fetchMarcBatches}
                  disabled={batchesLoading}
                  leftIcon={<RefreshCw className={`h-4 w-4 ${batchesLoading ? 'animate-spin' : ''}`} />}
                >
                  {t('importMarc.refresh')}
                </Button>
              </div>
              {batchesError && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {batchesError}
                </div>
              )}
              {batchesLoading && marcBatches.length === 0 ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                </div>
              ) : marcBatches.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-10">
                  {t('importMarc.noBatches')}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {marcBatches.map((batch) => {
                    const isExpired = batch.ttlSeconds < 0;
                    const isLoadingThis = loadingBatchId === batch.batchId;
                    return (
                      <li
                        key={batch.batchId}
                        className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                              Batch #{batch.batchId}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {t('importMarc.batchRecords', { count: batch.recordCount })}
                            </span>
                          </div>
                          <div className="mt-0.5">
                            {isExpired ? (
                              <Badge variant="danger">{t('importMarc.batchExpired')}</Badge>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                <Clock className="h-3 w-3" />
                                {t('importMarc.batchTtl', { time: formatTtlSeconds(batch.ttlSeconds) })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleLoadBatch(batch.batchId)}
                          isLoading={isLoadingThis}
                          disabled={isExpired || (loadingBatchId !== null && !isLoadingThis)}
                          leftIcon={<Download className="h-4 w-4" />}
                        >
                          {t('importMarc.loadBatch')}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

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
                  {successCount > 0 && (
                    <Badge variant="success">{t('importMarc.imported', { count: successCount })}</Badge>
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
                      disabled={!selectedSourceId || pendingHasValidationErrors}
                      title={
                        pendingHasValidationErrors
                          ? t('importMarc.cannotImportWithValidationErrors')
                          : undefined
                      }
                    >
                      {t('importMarc.importWithScan')}
                    </Button>
                    <Button
                      onClick={handleImportAll}
                      isLoading={isImporting}
                      leftIcon={<Download className="h-4 w-4" />}
                      disabled={!selectedSourceId || pendingHasValidationErrors}
                      title={
                        pendingHasValidationErrors
                          ? t('importMarc.cannotImportWithValidationErrors')
                          : undefined
                      }
                    >
                      {t('importMarc.importAll', { count: pendingCount })}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Import progress */}
            {isImporting && (
              <div className="mt-4">
                {importTask.task?.progress ? (
                  <>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('importMarc.importProgress')}
                        {(() => {
                          const progressMsg = formatMarcTaskProgressMessage(
                            importTask.task.progress.message,
                            t
                          );
                          return progressMsg ? (
                            <span className="text-xs">— {progressMsg}</span>
                          ) : null;
                        })()}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {importTask.task.progress.current} / {importTask.task.progress.total}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${importTask.task.progress.total > 0
                            ? (importTask.task.progress.current / importTask.task.progress.total) * 100
                            : 0}%`,
                        }}
                      />
                    </div>
                  </>
                ) : importProgress.total > 0 ? (
                  <>
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
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('importMarc.importProgress')}
                  </div>
                )}
              </div>
            )}

            {/* Source selector */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
                  {t('importMarc.source')} :
                </label>
                <select
                  value={selectedSourceId ?? ''}
                  onChange={(e) => setSelectedSourceId(e.target.value || null)}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
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
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{sourcesError}</p>
              )}
            </div>
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
                        className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                          column.align === 'right' ? 'text-right' : 'text-left'
                        } ${column.className || ''}`}
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {pagedRecords.map((record) => (
                    <Fragment key={record.id}>
                      <tr
                        key={record.id}
                        onClick={() => setExpandedRecordId((id) => (id === record.id ? null : record.id))}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${
                              column.align === 'right' ? 'text-right' : 'text-left'
                            } ${column.className || ''}`}
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
                                  {(record.validationIssues?.length ?? 0) > 0 && (
                                    <div className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/30">
                                      <h4 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-2">
                                        {t('importMarc.validationDiagnostics')}
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-red-200 dark:border-red-800">
                                              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                                                {t('importMarc.preview.tag')}
                                              </th>
                                              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                                                {t('importMarc.validationSubfield')}
                                              </th>
                                              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                                                {t('importMarc.validationTargetPath')}
                                              </th>
                                              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                                                {t('importMarc.preview.value')}
                                              </th>
                                              <th className="py-2 text-left text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-300">
                                                {t('importMarc.validationPattern')}
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-red-100 dark:divide-red-900/50">
                                            {record.validationIssues!.map((issue, idx) => (
                                              <tr key={`${issue.tag}-${issue.targetPath}-${idx}`}>
                                                <td className="py-2 pr-3 font-mono text-gray-900 dark:text-gray-100">
                                                  {issue.tag}
                                                </td>
                                                <td className="py-2 pr-3 font-mono text-gray-700 dark:text-gray-300">
                                                  {issue.subfield ?? '-'}
                                                </td>
                                                <td className="py-2 pr-3 text-gray-800 dark:text-gray-200 break-all">
                                                  {issue.targetPath}
                                                </td>
                                                <td className="py-2 pr-3 text-gray-800 dark:text-gray-200 break-all">
                                                  {issue.value}
                                                </td>
                                                <td className="py-2 text-gray-800 dark:text-gray-200 break-all font-mono text-xs">
                                                  {issue.pattern}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                        {t('importMarc.itemDetails')}
                                      </h4>
                                      <dl className="space-y-1 text-sm">
                                        <div className="flex gap-2">
                                          <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('items.titleField')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                            {itemPayload.title || t('items.notSpecified')}
                                          </dd>
                                        </div>
                                        <div className="flex gap-2">
                                          <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('items.isbn')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100 font-mono">
                                            {itemPayload.isbn ? formatIsbnDisplay(itemPayload.isbn) : '-'}
                                          </dd>
                                        </div>
                                        <div className="flex gap-2">
                                          <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('items.authors')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                            {formatAuthors(itemPayload.authors)}
                                          </dd>
                                        </div>
                                        <div className="flex gap-2">
                                          <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('items.publicationDate')} :</dt>
                                          <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                            {itemPayload.publicationDate || '-'}
                                          </dd>
                                        </div>
                                        {itemPayload.mediaType && (
                                          <div className="flex gap-2">
                                            <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">{t('common.type')} :</dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {t(
                                                `items.mediaType.${getMediaTypeTranslationKey(
                                                  itemPayload.mediaType as MediaType
                                                )}`
                                              )}
                                            </dd>
                                          </div>
                                        )}
                                        {itemPayload.edition && (
                                          <>
                                            <div className="flex gap-2">
                                              <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                {t('items.publisher')}
                                              </dt>
                                              <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                                {itemPayload.edition.publisherName || '-'}
                                              </dd>
                                            </div>
                                            <div className="flex gap-2">
                                              <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                {t('items.placeOfPublication')}
                                              </dt>
                                              <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                                {itemPayload.edition.placeOfPublication || '-'}
                                              </dd>
                                            </div>
                                          </>
                                        )}
                                        {itemPayload.abstract && (
                                          <div className="flex gap-2">
                                            <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                              {t('items.abstract')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {itemPayload.abstract}
                                            </dd>
                                          </div>
                                        )}
                                        {itemPayload.keywords && (
                                          <div className="flex gap-2">
                                            <dt className="w-32 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                              {t('items.keywords')}
                                            </dt>
                                            <dd className="flex-1 text-gray-900 dark:text-gray-100">
                                              {itemPayload.keywords}
                                            </dd>
                                          </div>
                                        )}
                                      </dl>
                                  </div>
                                  {(record.biblioShort?.items?.length ?? 0) > 0 && (
                                    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                        {t('items.specimens')} ({record.biblioShort?.items?.length ?? 0})
                                      </h4>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="border-b border-gray-200 dark:border-gray-700">
                                              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                barcode
                                              </th>
                                              <th className="py-2 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                cote
                                              </th>
                                              <th className="py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                source
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {record.biblioShort?.items?.map((spec) => (
                                              <tr key={spec.id}>
                                                <td className="py-2 pr-3 font-mono text-gray-900 dark:text-gray-100">
                                                  {spec.barcode || spec.id}
                                                </td>
                                                <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">
                                                  {spec.callNumber || '-'}
                                                </td>
                                                <td className="py-2 text-gray-700 dark:text-gray-300">
                                                  {spec.sourceName || '-'}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {specimenPreview && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {t('importMarc.source')}:{' '}
                                      {selectedSource
                                        ? selectedSource.name || selectedSource.key || selectedSource.id
                                        : t('importMarc.noSource')}
                                    </div>
                                  )}
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {t('common.page')} {safePage} / {totalPages}
                  <span className="ml-2 text-gray-400 dark:text-gray-500">
                    ({(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, records.length)} / {records.length})
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCurrentPage(1)}
                    disabled={safePage === 1}
                    aria-label="First page"
                  >
                    «
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    leftIcon={<ChevronLeft className="h-4 w-4" />}
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    rightIcon={<ChevronRight className="h-4 w-4" />}
                  >
                    {t('common.next')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={safePage === totalPages}
                    aria-label="Last page"
                  >
                    »
                  </Button>
                </div>
              </div>
            )}
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

      {/* Duplicate ISBN: 3-choice dialog (single import / scan mode only) */}
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
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (replaceConfirmLoading) return;
                  setReplaceConfirmModal(null);
                  setReplaceConfirmError(null);
                }}
                disabled={replaceConfirmLoading}
              >
                {t('importMarc.duplicateIsbnSkip')}
              </Button>
              <Button variant="secondary" onClick={handleCreateNewDuplicateIsbn} isLoading={replaceConfirmLoading}>
                {t('importMarc.duplicateIsbnCreateNew')}
              </Button>
              <Button
                onClick={handleConfirmReplaceExisting}
                isLoading={replaceConfirmLoading}
                disabled={!replaceConfirmModal?.existingId || replaceConfirmLoading}
                title={!replaceConfirmModal?.existingId ? t('importMarc.cannotReplaceNoId') : undefined}
              >
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
                isbn: replaceConfirmModal.record.identification
                  ? formatIsbnDisplay(replaceConfirmModal.record.identification)
                  : '-',
                title: replaceConfirmModal.existingTitle || t('items.notSpecified'),
              })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium text-gray-900 dark:text-white mb-1">{t('importMarc.duplicateIsbnSkip')}</p>
                <p>{t('importMarc.duplicateIsbnSkipHint')}</p>
              </div>
              <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium text-gray-900 dark:text-white mb-1">{t('importMarc.duplicateIsbnCreateNew')}</p>
                <p>{t('importMarc.duplicateIsbnCreateNewHint')}</p>
              </div>
              <div className={`p-3 rounded-lg border text-sm ${
                replaceConfirmModal?.existingId
                  ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                  : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 text-gray-400 dark:text-gray-600'
              }`}>
                <p className={`font-medium mb-1 ${replaceConfirmModal?.existingId ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>
                  {t('importMarc.duplicateIsbnReplace')}
                </p>
                <p>{replaceConfirmModal?.existingId ? t('importMarc.duplicateIsbnReplaceHint') : t('importMarc.cannotReplaceNoId')}</p>
              </div>
            </div>
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
