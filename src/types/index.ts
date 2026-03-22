// Library info types
export interface LibraryInfo {
  name?: string | null;
  addr_line1?: string | null;
  addr_line2?: string | null;
  addr_postcode?: string | null;
  addr_city?: string | null;
  addr_country?: string | null;
  email?: string | null;
  phones: string[];
  updated_at?: string | null;
}

export interface UpdateLibraryInfoRequest {
  name?: string | null;
  addr_line1?: string | null;
  addr_line2?: string | null;
  addr_postcode?: string | null;
  addr_city?: string | null;
  addr_country?: string | null;
  email?: string | null;
  phones?: string[] | null;
}

// Schedule types
export interface SchedulePeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at?: string | null;
  update_at?: string | null;
}

export interface ScheduleSlot {
  id: string;
  period_id: string;
  day_of_week: number; // 0=Monday, 6=Sunday
  open_time: string;
  close_time: string;
  created_at?: string | null;
}

export interface ScheduleClosure {
  id: string;
  closure_date: string;
  reason?: string | null;
  created_at?: string | null;
}

export interface CreateSchedulePeriod {
  name: string;
  start_date: string;
  end_date: string;
  notes?: string | null;
}

export interface UpdateSchedulePeriod {
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

export interface CreateScheduleSlot {
  day_of_week: number;
  open_time: string;
  close_time: string;
}

export interface CreateScheduleClosure {
  closure_date: string;
  reason?: string | null;
}

// User types
export interface User {
  id: string;
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
  public_type?: string | null;
  status?: number;
  // Date fields
  created_at?: string;
  update_at?: string;
  archived_at?: string;
  issue_at?: string;
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
  id: string;
  firstname?: string;
  lastname?: string;
  account_type?: string;
  public_type?: string | null;
  /** @deprecated prefer counting loans.length (specimens) */
  nb_loans?: number;
  nb_late_loans?: number;
  /** When present, number of emprunts = loans.length (one loan = one specimen) */
  loans?: Loan[];
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
    id: string;
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
  user_id: string;
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
  user_id: string;
  code: string;
}

// Media type enum matching server definition (camelCase strings)
export type MediaType =
  | 'all'
  | 'unknown'
  | 'printedText'
  | 'multimedia'
  | 'comics'
  | 'periodic'
  | 'video'
  | 'videoTape'
  | 'videoDvd'
  | 'audio'
  | 'audioMusic'
  | 'audioMusicTape'
  | 'audioMusicCd'
  | 'audioNonMusic'
  | 'audioNonMusicTape'
  | 'audioNonMusicCd'
  | 'cdRom'
  | 'images';

export interface MediaTypeOption {
  value: MediaType | '';
  label: string;
}

// Item types — aligned with README-items-specimens-data.md

export interface Author {
  id: string;
  lastname?: string | null;
  firstname?: string | null;
  bio?: string | null;
  notes?: string | null;
  function?: string | null;
}

export interface Edition {
  id: string | null;
  publisher_name?: string | null;
  place_of_publication?: string | null;
  date?: string | null;
}

export interface Serie {
  id: string | null;
  key?: string | null;
  name?: string | null;
  issn?: string | null;
}

export interface Collection {
  id: string | null;
  key?: string | null;
  primary_title?: string | null;
  secondary_title?: string | null;
  tertiary_title?: string | null;
  issn?: string | null;
}

export interface Item {
  id?: string | null;
  marc_format?: string | null;
  media_type?: MediaType | string | null;
  isbn?: string | null;
  barcode?: string | null;
  call_number?: string | null;
  price?: string | null;
  title?: string | null;
  genre?: number | null;
  subject?: string | null;
  audience_type?: string | null;
  lang?: string | null;
  lang_orig?: string | null;
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
  series_id?: string | null;
  series_volume_number?: number | null;
  edition_id?: string | null;
  collection_id?: string | null;
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

/** Simplified specimen as returned in ItemShort.specimens */
export interface SpecimenShort {
  id: string;
  barcode?: string | null;
  call_number?: string | null;
  borrowable?: boolean | null;
  source_name?: string | null;
  availability?: number | null;
}

export interface ItemShort {
  id: string;
  media_type?: MediaType | string | null;
  isbn?: string | null;
  title?: string | null;
  date?: string | null;
  status?: number | null;
  is_local?: number | null;
  is_valid?: number | null;
  archived_at?: string | null;
  /** Simplified list of specimens (replaces nb_specimens / nb_available) */
  specimens?: SpecimenShort[];
  author?: Author | null;
  source_name?: string | null;
}

export interface Specimen {
  id: string;
  item_id?: string | null;
  source_id?: string | null;
  barcode?: string | null;
  call_number?: string | null;
  volume_designation?: string | null;
  place?: number | null;
  borrowable?: boolean | null;
  circulation_status?: number | null;
  notes?: string | null;
  price?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  source_name?: string | null;
  availability?: number | null;
}

/** Specimen data when creating an item in one request (POST /items with specimens) */
export interface CreateItemSpecimenInput {
  barcode?: string | null;
  call_number?: string | null;
  source_id: string;
}

/** Payload for POST /items/{id}/specimens */
export interface CreateSpecimen {
  barcode?: string | null;
  call_number?: string | null;
  volume_designation?: string | null;
  place?: number | null;
  borrowable?: boolean | null;
  notes?: string | null;
  price?: string | null;
  source_id?: string | null;
  source_name?: string | null;
}

/** Payload for PUT /items/{id}/specimens/{sid} */
export interface UpdateSpecimen {
  barcode?: string | null;
  call_number?: string | null;
  volume_designation?: string | null;
  place?: number | null;
  borrowable?: boolean | null;
  notes?: string | null;
  price?: string | null;
  source_id?: string | null;
}

// Loan types
export interface Loan {
  id: string;
  start_date: string;
  issue_at: string;
  /** Present when the loan has been returned */
  returned_at?: string | null;
  renew_at?: string;
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
  user_id: string;
  firstname: string;
  lastname: string;
  total_loans: number;
  active_loans: number;
  overdue_loans: number;
}

// Catalog stats from /stats/catalog
export interface CatalogStatsBreakdown {
  label?: string;
  source_id?: string;
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
  user_id?: string;
  public_type?: string;
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
  existing_id?: string;
  warnings: string[];
  message?: string;
}

export interface ImportResult<T> {
  item: T;
  import_report: ImportReport;
}

// UNIMARC batch upload / import
export interface EnqueueResult {
  /** Unique batch identifier in Redis (stringified i64) */
  batch_id: string;
  /** Lightweight preview of records in this batch */
  items: ItemShort[];
}

export interface MarcBatchImportError {
  /** Redis key of the failing record: marc:record:<batch_id>:<id> */
  record_key: string;
  /** Human‑readable error message */
  error: string;
}

export interface MarcBatchImportReport {
  /** Batch identifier (stringified i64) */
  batch_id: string;
  /** Number of successfully imported records */
  imported: number;
  /** Detailed list of per‑record errors, if any */
  failed: MarcBatchImportError[];
}

export interface DuplicateConfirmationRequired {
  code: 'duplicate_isbn_needs_confirmation';
  existing_id: string;
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
  id: string;
  name: string;
  address: string;
  port: number;
  database?: string;
  format?: string;
  login?: string;
  password?: string;
  is_active: boolean;
}

// Public types (audience types for users)
export interface PublicType {
  id: string;
  name: string;
  label: string;
  subscription_duration_days?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  subscription_price?: number | null;
  max_loans?: number | null;
  loan_duration_days?: number | null;
}

export interface PublicTypeLoanSettings {
  id: string;
  public_type_id: string;
  media_type: MediaType;
  duration: number;
  nb_max: number;
  nb_renews: number;
}

export interface CreatePublicType {
  name: string;
  label: string;
  subscription_duration_days?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  subscription_price?: number | null;
  max_loans?: number | null;
  loan_duration_days?: number | null;
}

export interface UpdatePublicType {
  name?: string;
  label?: string;
  subscription_duration_days?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  subscription_price?: number | null;
  max_loans?: number | null;
  loan_duration_days?: number | null;
}

export interface UpsertLoanSettingRequest {
  media_type: MediaType;
  duration?: number | null;
  nb_max?: number | null;
  nb_renews?: number | null;
}

// Source type
export interface Source {
  id: string;
  key: string | null;
  name: string | null;
  is_archive: number | null;
  archived_at: string | null;
  default?: boolean;
}

// Account types for permissions
export type AccountType = 'Guest' | 'Reader' | 'Librarian' | 'Administrator';

export const isAdmin = (accountType?: string): boolean => {
  const n = accountType?.trim().toLowerCase();
  return n === 'admin' || n === 'administrator';
};

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

// Admin dynamic config (GET/PUT/DELETE /admin/config)
export type AdminConfigSectionKey = 'email' | 'logging' | 'reminders' | 'audit';

export interface ConfigSectionInfo {
  key: string;
  value: Record<string, unknown>;
  overridden: boolean;
  overridable: boolean;
}

export interface AdminConfigResponse {
  sections: ConfigSectionInfo[];
}

/** POST /admin/reindex-search */
export interface ReindexSearchResponse {
  items_queued: number;
  meilisearch_available: boolean;
}

// Audit log
export interface AuditLogEntry {
  id: number;
  event_type: string;
  user_id: number | null;
  entity_type: string | null;
  entity_id: number | null;
  ip_address: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  per_page: number;
}

// Overdue loans dashboard
export interface OverdueLoanInfo {
  loan_id: number;
  user_id: number;
  firstname?: string;
  lastname?: string;
  user_email?: string;
  item_id: number;
  title?: string;
  authors?: string;
  specimen_barcode?: string;
  loan_date: string;
  issue_at: string | null;
  last_reminder_sent_at: string | null;
  reminder_count: number;
}

export interface OverdueLoansPage {
  loans: OverdueLoanInfo[];
  total: number;
  page: number;
  per_page: number;
}

export interface ReminderDetail {
  user_id: number;
  email: string;
  firstname?: string;
  lastname?: string;
  loan_count: number;
}

export interface ReminderError {
  user_id: number;
  email: string;
  error_message: string;
}

export interface ReminderReport {
  dry_run: boolean;
  emails_sent: number;
  loans_reminded: number;
  details: ReminderDetail[];
  errors: ReminderError[];
}

// Events
// event_type: 0=animation, 1=school_visit, 2=exhibition, 3=conference, 4=workshop, 5=show, 6=other
// target_public: 97=adult, 106=children, null=all
export interface Event {
  id: string;
  name: string;
  event_type: number;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  partner_name?: string | null;
  school_name?: string | null;
  class_name?: string | null;
  attendees_count?: number | null;
  students_count?: number | null;
  target_public?: number | null;
  notes?: string | null;
  announcement_sent_at?: string | null;
  created_at?: string | null;
  update_at?: string | null;
}

export interface CreateEvent {
  name: string;
  event_date: string;
  event_type?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  partner_name?: string | null;
  school_name?: string | null;
  class_name?: string | null;
  attendees_count?: number | null;
  students_count?: number | null;
  target_public?: number | null;
  notes?: string | null;
}

export interface UpdateEvent {
  name?: string | null;
  event_date?: string | null;
  event_type?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  description?: string | null;
  partner_name?: string | null;
  school_name?: string | null;
  class_name?: string | null;
  attendees_count?: number | null;
  students_count?: number | null;
  target_public?: number | null;
  notes?: string | null;
}

export interface EventsListResponse {
  events: Event[];
  total: number;
}
