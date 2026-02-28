// User types
export interface User {
  id: number;
  username: string;
  login?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  barcode?: string;
  account_type?: string;
  account_type_id?: number;
  language?: string;
  // Address fields
  addr_street?: string;
  addr_zip_code?: number;
  addr_city?: string;
  // Additional fields
  occupation_id?: number;
  birthdate?: string;
  notes?: string;
  fee?: string;
  group_id?: number;
  public_type?: number;
  status?: number;
  // Date fields
  crea_date?: string;
  modif_date?: string;
  archived_date?: string;
  issue_date?: string;
  // 2FA fields
  two_factor_enabled?: boolean;
  two_factor_method?: string;
}

// Update profile request type
export interface UpdateProfileRequest {
  firstname?: string;
  lastname?: string;
  email?: string;
  login?: string;
  addr_street?: string;
  addr_zip_code?: number;
  addr_city?: string;
  phone?: string;
  occupation_id?: number;
  birthdate?: string;
  current_password?: string;
  new_password?: string;
  language?: string;
}

export interface UserShort {
  id: number;
  firstname?: string;
  lastname?: string;
  account_type?: string;
  nb_loans?: number;
  nb_late_loans?: number;
}

export interface LoginRequest {
  username: string;
  password: string;
  device_id?: string;
}

export interface LoginResponse {
  token?: string;
  token_type: string;
  expires_in: number;
  requires_2fa: boolean;
  two_factor_method?: string;
  device_id?: string;
  user: {
    id: number;
    username: string;
    login: string;
    firstname?: string;
    lastname?: string;
    account_type: string;
    language: string;
  };
}

// 2FA Types
export type TwoFactorMethod = 'totp' | 'email';

export interface Setup2FARequest {
  method: TwoFactorMethod;
}

export interface Setup2FAResponse {
  provisioning_uri?: string;
  recovery_codes: string[];
}

export interface Verify2FARequest {
  user_id: number;
  code: string;
  trust_device?: boolean;
  device_id?: string;
}

export interface Verify2FAResponse {
  token: string;
  token_type: string;
  expires_in: number;
  device_id?: string;
}

export interface VerifyRecoveryRequest {
  user_id: number;
  code: string;
}

// Media type enum matching server definition
export type MediaType =
  | 'u'  // Unknown
  | 'b'  // PrintedText
  | 'bc' // Comics
  | 'p'  // Periodic
  | 'v'  // Video
  | 'vt' // VideoTape
  | 'vd' // VideoDvd
  | 'a'  // Audio
  | 'am' // AudioMusic
  | 'amt' // AudioMusicTape
  | 'amc' // AudioMusicCd
  | 'an' // AudioNonMusic
  | 'c'  // CdRom
  | 'i'  // Images
  | 'm'; // Multimedia

export interface MediaTypeOption {
  value: MediaType | '';
  label: string;
}

// Item types — aligned with README-items-specimens-data.md

export interface Author {
  id: number;
  lastname?: string | null;
  firstname?: string | null;
  bio?: string | null;
  notes?: string | null;
  function?: string | null;
}

export interface Edition {
  id: number | null;
  publisher_name?: string | null;
  place_of_publication?: string | null;
  date?: string | null;
}

export interface Serie {
  id: number | null;
  key?: string | null;
  name?: string | null;
  issn?: string | null;
}

export interface Collection {
  id: number | null;
  key?: string | null;
  primary_title?: string | null;
  secondary_title?: string | null;
  tertiary_title?: string | null;
  issn?: string | null;
}

export interface Item {
  id?: number | null;
  marc_format?: string | null;
  media_type?: MediaType | string | null;
  isbn?: string | null;
  barcode?: string | null;
  call_number?: string | null;
  price?: string | null;
  title?: string | null;
  genre?: number | null;
  subject?: string | null;
  audience_type?: number | null;
  lang?: number | null;
  lang_orig?: number | null;
  publication_date?: string | null;
  page_extent?: string | null;
  format?: string | null;
  table_of_contents?: string | null;
  accompanying_material?: string | null;
  abstract_?: string | null;
  notes?: string | null;
  keywords?: string | null;
  state?: string | null;
  is_valid?: number | null;
  series_id?: number | null;
  series_volume_number?: number | null;
  edition_id?: number | null;
  collection_id?: number | null;
  collection_sequence_number?: number | null;
  collection_volume_number?: number | null;
  status?: number;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  authors?: Author[];
  series?: Serie | null;
  collection?: Collection | null;
  edition?: Edition | null;
  specimens?: Specimen[];
  marc_record?: unknown;
}

export interface ItemShort {
  id: number;
  media_type?: MediaType | string | null;
  isbn?: string | null;
  title?: string | null;
  date?: string | null;
  status?: number | null;
  is_local?: number | null;
  is_valid?: number | null;
  archived_at?: string | null;
  nb_specimens?: number | null;
  nb_available?: number | null;
  author?: Author | null;
  source_name?: string | null;
}

export interface Specimen {
  id: number;
  item_id?: number | null;
  source_id?: number | null;
  barcode?: string | null;
  call_number?: string | null;
  volume_designation?: string | null;
  place?: number | null;
  borrow_status?: number | null;
  circulation_status?: number | null;
  notes?: string | null;
  price?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  source_name?: string | null;
  availability?: number | null;
}

/** Payload for POST /items/{id}/specimens */
export interface CreateSpecimen {
  barcode?: string | null;
  call_number?: string | null;
  volume_designation?: string | null;
  place?: number | null;
  borrow_status?: number | null;
  notes?: string | null;
  price?: string | null;
  source_id?: number | null;
  source_name?: string | null;
}

/** Payload for PUT /items/{id}/specimens/{sid} */
export interface UpdateSpecimen {
  barcode?: string | null;
  call_number?: string | null;
  volume_designation?: string | null;
  place?: number | null;
  borrow_status?: number | null;
  notes?: string | null;
  price?: string | null;
  source_id?: number | null;
}

// Loan types
export interface Loan {
  id: number;
  start_date: string;
  issue_date: string;
  renewal_date?: string;
  nb_renews: number;
  item: ItemShort;
  user?: UserShort;
  specimen_identification?: string;
  is_overdue: boolean;
}

// Stats types
export interface Stats {
  items: {
    total: number;
    by_media_type: StatEntry[];
    by_public_type: StatEntry[];
  };
  users: {
    total: number;
    active: number;
    by_account_type: StatEntry[];
  };
  loans: {
    active: number;
    overdue: number;
    returned_today: number;
    by_media_type: StatEntry[];
  };
}

export interface StatEntry {
  label: string;
  value: number;
  // Available when year param is provided to /stats
  acquisitions?: number;
  eliminations?: number;
}

// Aggregate user stats from /stats/users?mode=aggregate
export interface UserAggregateStats {
  new_users_total: number;
  active_borrowers_total: number;
  users_total: number;
  new_users_by_public_type?: StatEntry[];
  active_borrowers_by_public_type?: StatEntry[];
  users_by_public_type?: StatEntry[];
}

// Time-based stats for charts
export interface LoanTimeStats {
  date: string;
  loans: number;
  returns: number;
}

export interface UserLoanStats {
  user_id: number;
  firstname: string;
  lastname: string;
  total_loans: number;
  active_loans: number;
  overdue_loans: number;
}

// Catalog stats from /stats/catalog
export interface CatalogStatsBreakdown {
  label?: string;
  source_id?: number;
  source_name?: string;
  active_specimens: number;
  entered_specimens: number;
  archived_specimens: number;
  loans: number;
  // Hierarchical nesting: source → media_type → public_type
  by_media_type?: CatalogStatsBreakdown[];
  by_public_type?: CatalogStatsBreakdown[];
}

export interface CatalogStats {
  totals: {
    active_specimens: number;
    entered_specimens: number;
    archived_specimens: number;
    loans: number;
  };
  by_source?: CatalogStatsBreakdown[];
  by_media_type?: CatalogStatsBreakdown[];
  by_public_type?: CatalogStatsBreakdown[];
}

// Advanced stats types
export type StatsInterval = 'day' | 'week' | 'month' | 'year';

export interface AdvancedStatsParams {
  start_date: string;
  end_date: string;
  interval?: StatsInterval;
  media_type?: MediaType;
  user_id?: number;
  public_type?: number;
}

export interface LoanStatsTimeSeries {
  period: string;
  loans: number;
  returns: number;
}

export interface LoanStatsResponse {
  total_loans: number;
  total_returns: number;
  time_series: LoanStatsTimeSeries[];
  by_media_type: StatEntry[];
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ImportReport {
  action: 'created' | 'merged_bibliographic' | 'replaced_archived' | 'replaced_confirmed';
  existing_id?: number;
  warnings: string[];
  message?: string;
}

export interface ImportResult<T> {
  item: T;
  import_report: ImportReport;
}

export interface DuplicateConfirmationRequired {
  code: 'duplicate_isbn_needs_confirmation';
  existing_id: number;
  message: string;
}

// Error response
export interface ApiError {
  code: number;
  error: string;
  message: string;
}

// Settings
export interface LoanSettings {
  media_type: MediaType;
  max_loans: number;
  max_renewals: number;
  duration_days: number;
}

export interface Settings {
  loan_settings: LoanSettings[];
  z3950_servers: Z3950Server[];
}

export interface Z3950Server {
  id: number;
  name: string;
  address: string;
  port: number;
  database?: string;
  format?: string;
  login?: string;
  password?: string;
  is_active: boolean;
}

// Source type
export interface Source {
  id: number;
  key: string | null;
  name: string | null;
  is_archive: number | null;
  archive_date: string | null;
  default?: boolean;
}

// Account types for permissions
export type AccountType = 'Guest' | 'Reader' | 'Librarian' | 'Administrator';

export const isAdmin = (accountType?: string): boolean => 
  accountType?.trim().toLowerCase() === 'admin';

export const isLibrarian = (accountType?: string): boolean => {
  const normalized = accountType?.trim().toLowerCase();
  return normalized === 'admin' || normalized === 'librarian';
};

export const canManageItems = (accountType?: string): boolean => 
  isLibrarian(accountType);

export const canManageUsers = (accountType?: string): boolean => 
  isLibrarian(accountType);

export const canManageLoans = (accountType?: string): boolean => 
  isLibrarian(accountType);

export const canViewStats = (accountType?: string): boolean => 
  isLibrarian(accountType);

export const canManageSettings = (accountType?: string): boolean => 
  isAdmin(accountType);


