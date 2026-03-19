// Mapping of server property codes to i18n translation keys.
// Each entry maps { value (sent to/from API), labelKey (i18n key) }.

export interface CodeOption {
  value: string;
  labelKey: string;
}

// Public type (tab_public)
export const PUBLIC_TYPE_OPTIONS: CodeOption[] = [
  { value: '97', labelKey: 'codes.publicType.adult' },
  { value: '106', labelKey: 'codes.publicType.children' },
  { value: '117', labelKey: 'codes.publicType.unknown' },
];

// User/specimen status (tab_status)
export const STATUS_OPTIONS: CodeOption[] = [
  { value: '98', labelKey: 'codes.status.borrowable' },
  { value: '110', labelKey: 'codes.status.notBorrowable' },
];

// Occupation (tab_occupations)
export const OCCUPATION_OPTIONS: CodeOption[] = [
  { value: '0', labelKey: 'codes.occupation.unknown' },
  { value: '1', labelKey: 'codes.occupation.farm' },
  { value: '2', labelKey: 'codes.occupation.crafts' },
  { value: '3', labelKey: 'codes.occupation.frameworks' },
  { value: '4', labelKey: 'codes.occupation.intermediate' },
  { value: '5', labelKey: 'codes.occupation.operative' },
  { value: '6', labelKey: 'codes.occupation.workmen' },
  { value: '7', labelKey: 'codes.occupation.reprocessed' },
  { value: '8', labelKey: 'codes.occupation.other' },
];

// Language (tab_lang)
export const LANG_OPTIONS: CodeOption[] = [
  { value: '0', labelKey: 'codes.lang.unknown' },
  { value: '1', labelKey: 'codes.lang.fr' },
  { value: '2', labelKey: 'codes.lang.en' },
  { value: '3', labelKey: 'codes.lang.de' },
  { value: '4', labelKey: 'codes.lang.jp' },
  { value: '5', labelKey: 'codes.lang.es' },
  { value: '6', labelKey: 'codes.lang.po' },
];

// Sex (tab_sex)
export const SEX_OPTIONS: CodeOption[] = [
  { value: '77', labelKey: 'codes.sex.male' },
  { value: '70', labelKey: 'codes.sex.female' },
  { value: '85', labelKey: 'codes.sex.unknown' },
];

// Account type (tab_accounttype)
export const ACCOUNT_TYPE_OPTIONS: CodeOption[] = [
  { value: '0', labelKey: 'codes.accountType.unknown' },
  { value: '1', labelKey: 'codes.accountType.guest' },
  { value: '2', labelKey: 'codes.accountType.reader' },
  { value: '3', labelKey: 'codes.accountType.librarian' },
  { value: '4', labelKey: 'codes.accountType.admin' },
  { value: '8', labelKey: 'codes.accountType.group' },
];

// Genre (tab_genre)
export const GENRE_OPTIONS: CodeOption[] = [
  { value: '0', labelKey: 'codes.genre.unknown' },
  { value: '1', labelKey: 'codes.genre.litteratureGeneral' },
  { value: '2', labelKey: 'codes.genre.litteratureFiction' },
  { value: '3', labelKey: 'codes.genre.litteratureComic' },
  { value: '4', labelKey: 'codes.genre.litteratureTheatre' },
  { value: '5', labelKey: 'codes.genre.litteraturePoem' },
  { value: '6', labelKey: 'codes.genre.litteraturePhilosophy' },
  { value: '7', labelKey: 'codes.genre.litteratureReligion' },
  { value: '8', labelKey: 'codes.genre.litteratureSocialSciences' },
  { value: '9', labelKey: 'codes.genre.litteratureLanguages' },
  { value: '10', labelKey: 'codes.genre.litteratureSciences' },
  { value: '11', labelKey: 'codes.genre.litteratureTechnical' },
  { value: '12', labelKey: 'codes.genre.litteratureArt' },
  { value: '13', labelKey: 'codes.genre.litteratureSport' },
  { value: '14', labelKey: 'codes.genre.litteratureLitterature' },
  { value: '15', labelKey: 'codes.genre.litteratureHistory' },
  { value: '16', labelKey: 'codes.genre.litteratureGeography' },
  { value: '17', labelKey: 'codes.genre.litteratureOther' },
  { value: '100', labelKey: 'codes.genre.audioUnknown' },
  { value: '101', labelKey: 'codes.genre.audioJazz' },
  { value: '102', labelKey: 'codes.genre.audioBlues' },
  { value: '103', labelKey: 'codes.genre.audioRock' },
  { value: '104', labelKey: 'codes.genre.audioWorld' },
  { value: '105', labelKey: 'codes.genre.audioClassical' },
  { value: '200', labelKey: 'codes.genre.videoUnknown' },
  { value: '201', labelKey: 'codes.genre.videoFiction' },
  { value: '202', labelKey: 'codes.genre.videoHistory' },
  { value: '203', labelKey: 'codes.genre.videoArt' },
  { value: '204', labelKey: 'codes.genre.videoDocumentary' },
  { value: '205', labelKey: 'codes.genre.videoMusical' },
];

// Author function (tab_functions) — most common ones
export const FUNCTION_OPTIONS: CodeOption[] = [
  { value: '0', labelKey: 'codes.function.unknown' },
  { value: '5', labelKey: 'codes.function.actor' },
  { value: '10', labelKey: 'codes.function.adapter' },
  { value: '20', labelKey: 'codes.function.annotator' },
  { value: '30', labelKey: 'codes.function.arranger' },
  { value: '40', labelKey: 'codes.function.artist' },
  { value: '70', labelKey: 'codes.function.author' },
  { value: '80', labelKey: 'codes.function.authorIntroduction' },
  { value: '180', labelKey: 'codes.function.cartographer' },
  { value: '200', labelKey: 'codes.function.choreographer' },
  { value: '205', labelKey: 'codes.function.collaborator' },
  { value: '210', labelKey: 'codes.function.commentator' },
  { value: '220', labelKey: 'codes.function.compiler' },
  { value: '230', labelKey: 'codes.function.composer' },
  { value: '245', labelKey: 'codes.function.conceptor' },
  { value: '250', labelKey: 'codes.function.conductor' },
  { value: '270', labelKey: 'codes.function.corrector' },
  { value: '300', labelKey: 'codes.function.director' },
  { value: '340', labelKey: 'codes.function.editor' },
  { value: '370', labelKey: 'codes.function.filmEditor' },
  { value: '440', labelKey: 'codes.function.illustrator' },
  { value: '460', labelKey: 'codes.function.interviewee' },
  { value: '470', labelKey: 'codes.function.interviewer' },
  { value: '480', labelKey: 'codes.function.librettist' },
  { value: '520', labelKey: 'codes.function.lyricist' },
  { value: '545', labelKey: 'codes.function.musician' },
  { value: '550', labelKey: 'codes.function.narrator' },
  { value: '570', labelKey: 'codes.function.other' },
  { value: '590', labelKey: 'codes.function.performer' },
  { value: '600', labelKey: 'codes.function.photographer' },
  { value: '630', labelKey: 'codes.function.producer' },
  { value: '650', labelKey: 'codes.function.publisher' },
  { value: '690', labelKey: 'codes.function.scenarist' },
  { value: '721', labelKey: 'codes.function.singer' },
  { value: '730', labelKey: 'codes.function.translator' },
];

/**
 * Find the translation key for a given code value in a CodeOption array.
 * Returns the labelKey or undefined if not found.
 */
export function getCodeLabelKey(options: CodeOption[], value: string | number | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const strValue = String(value);
  return options.find((o) => o.value === strValue)?.labelKey;
}

/**
 * Get the translated label for a code value.
 * @param t - i18next translation function
 * @param options - CodeOption array
 * @param value - the raw code value
 * @param fallback - fallback string if code not found (defaults to the raw value)
 */
export function getCodeLabel(
  t: (key: string) => string,
  options: CodeOption[],
  value: string | number | undefined | null,
  fallback?: string
): string {
  const key = getCodeLabelKey(options, value);
  if (key) return t(key);
  if (value === undefined || value === null || value === '') return fallback ?? '';
  return fallback ?? String(value);
}

// Media type → i18n key mapping.
// Supports both new camelCase values and legacy short codes for backward compatibility.
const MEDIA_TYPE_KEY_MAP: Record<string, string> = {
  // New values
  '': 'items.mediaType.unknown',
  'all': 'items.allTypes',
  'unknown': 'items.mediaType.unknown',
  'printedText': 'items.mediaType.printedText',
  'multimedia': 'items.mediaType.multimedia',
  'comics': 'items.mediaType.comics',
  'periodic': 'items.mediaType.periodic',
  'video': 'items.mediaType.video',
  'videoTape': 'items.mediaType.videoTape',
  'videoDvd': 'items.mediaType.videoDvd',
  'audio': 'items.mediaType.audio',
  'audioMusic': 'items.mediaType.audioMusic',
  'audioMusicTape': 'items.mediaType.audioMusicTape',
  'audioMusicCd': 'items.mediaType.audioMusicCd',
  'audioNonMusic': 'items.mediaType.audioNonMusic',
  'audioNonMusicTape': 'items.mediaType.audioNonMusicTape',
  'audioNonMusicCd': 'items.mediaType.audioNonMusicCd',
  'cdRom': 'items.mediaType.cdRom',
  'images': 'items.mediaType.images',

  // Legacy codes
  'u': 'items.mediaType.unknown',
  'b': 'items.mediaType.printedText',
  'm': 'items.mediaType.multimedia',
  'bc': 'items.mediaType.comics',
  'p': 'items.mediaType.periodic',
  'v': 'items.mediaType.video',
  'vt': 'items.mediaType.videoTape',
  'vd': 'items.mediaType.videoDvd',
  'a': 'items.mediaType.audio',
  'am': 'items.mediaType.audioMusic',
  'amt': 'items.mediaType.audioMusicTape',
  'amc': 'items.mediaType.audioMusicCd',
  'an': 'items.mediaType.audioNonMusic',
  'ant': 'items.mediaType.audioNonMusicTape',
  'anc': 'items.mediaType.audioNonMusicCd',
  'c': 'items.mediaType.cdRom',
  'i': 'items.mediaType.images',
};

// Textual label → i18n key mapping for public types (when API returns text labels instead of codes)
const PUBLIC_TYPE_TEXT_MAP: Record<string, string> = {
  'adult': 'codes.publicType.adult',
  'child': 'codes.publicType.children',
  'children': 'codes.publicType.children',
  'senior': 'codes.publicType.senior',
  'school': 'codes.publicType.school',
  'staff': 'codes.publicType.staff',
  'unknown': 'codes.publicType.unknown',
};

// Textual label → i18n key mapping for sex (when API returns text labels instead of codes)
const SEX_TEXT_MAP: Record<string, string> = {
  'male': 'codes.sex.male',
  'female': 'codes.sex.female',
  'unknown': 'codes.sex.unknown',
};

/**
 * Translate a stat entry label (code from API) to a human-readable translated string.
 * Works for media type codes, account type codes, public type codes, and sex codes.
 * If no match found, returns the original label.
 */
export function translateStatLabel(
  t: (key: string) => string,
  label: string,
  category: 'mediaType' | 'accountType' | 'publicType' | 'sex'
): string {
  switch (category) {
    case 'mediaType': {
      const normalized = (label ?? '').trim();
      const key = MEDIA_TYPE_KEY_MAP[normalized];
      return key ? t(key) : label;
    }
    case 'accountType': {
      const opt = ACCOUNT_TYPE_OPTIONS.find((o) => o.value === label);
      return opt ? t(opt.labelKey) : label;
    }
    case 'publicType': {
      // First try textual labels (adult, children, unknown)
      const textKey = PUBLIC_TYPE_TEXT_MAP[label.toLowerCase()];
      if (textKey) return t(textKey);
      // Then try numeric codes
      const opt = PUBLIC_TYPE_OPTIONS.find((o) => o.value === label);
      return opt ? t(opt.labelKey) : label;
    }
    case 'sex': {
      // First try textual labels (male, female, unknown)
      const textKey = SEX_TEXT_MAP[label.toLowerCase()];
      if (textKey) return t(textKey);
      // Then try numeric codes
      const opt = SEX_OPTIONS.find((o) => o.value === label);
      return opt ? t(opt.labelKey) : label;
    }
    default:
      return label;
  }
}
