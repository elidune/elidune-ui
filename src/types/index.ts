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

/** First-login / forced password change via POST /auth/change-password */
export interface ChangePasswordRequest {
  new_password: string;
}

export interface UserShort {
  id: string;
  firstname?: string;
  lastname?: string;
  account_type?: string;
  public_type?: string | null;
  /** @deprecated prefer counting loans.length */
  nb_loans?: number;
  nb_late_loans?: number;
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
  /** When true, the user must change password before using the app (token may still be issued). */
  must_change_password?: boolean;
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
  must_change_password?: boolean;
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

// ──────────────────────────────────────────────────────────────────
// Domain: Biblio (notice bibliographique) and Item (exemplaire physique)
//
// Server rename:
//   old Item      → Biblio   (bibliographic record: title, ISBN, authors…)
//   old Specimen  → Item     (physical copy: barcode, location…)
// ──────────────────────────────────────────────────────────────────

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
  /** Volume number in this series context (only in biblio linking) */
  volumeNumber?: number | null;
  /** Server JSON (canonical) */
  volume_number?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Server JSON (canonical) */
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateSerie {
  name: string;
  key?: string;
  issn?: string | null;
}

export interface UpdateSerie {
  name?: string;
  issn?: string | null;
}

export interface Collection {
  id: string | null;
  key?: string | null;
  /** Primary display title — server canonical field name */
  name?: string | null;
  /** Alias kept for backward compat (Z3950 import data, etc.) */
  primary_title?: string | null;
  secondaryTitle?: string | null;
  /** Alias kept for backward compat */
  secondary_title?: string | null;
  tertiaryTitle?: string | null;
  /** Alias kept for backward compat */
  tertiary_title?: string | null;
  issn?: string | null;
  /** Volume number in this collection context (only in biblio linking) */
  volumeNumber?: number | null;
  /** Server JSON (canonical) */
  volume_number?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  /** Server JSON (canonical) */
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CreateCollection {
  name: string;
  key?: string;
  secondaryTitle?: string | null;
  tertiaryTitle?: string | null;
  issn?: string | null;
}

export interface UpdateCollection {
  name?: string;
  secondaryTitle?: string | null;
  tertiaryTitle?: string | null;
  issn?: string | null;
}

/** Simplified physical copy (Item) as returned inside BiblioShort */
export interface ItemShort {
  id: string;
  barcode?: string | null;
  call_number?: string | null;
  borrowable?: boolean | null;
  source_name?: string | null;
  availability?: number | null;
}

/** Short bibliographic record as returned in list endpoints */
export interface BiblioShort {
  id: string;
  media_type?: MediaType | string | null;
  isbn?: string | null;
  title?: string | null;
  date?: string | null;
  status?: number | null;
  is_local?: number | null;
  is_valid?: number | null;
  archived_at?: string | null;
  /** Simplified list of physical items (replaces nb_items / nb_available) */
  items?: ItemShort[];
  author?: Author | null;
  source_name?: string | null;
}

/** Full physical copy (exemplaire) */
export interface Item {
  id: string;
  biblio_id?: string | null;
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

/** Full bibliographic record */
export interface Biblio {
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
  seriesIds?: string[];
  seriesVolumeNumbers?: (number | null)[];
  /** Server JSON (canonical) */
  series_ids?: string[];
  series_volume_numbers?: (number | null)[];
  collectionIds?: string[];
  collectionVolumeNumbers?: (number | null)[];
  /** Server JSON (canonical) */
  collection_ids?: string[];
  collection_volume_numbers?: (number | null)[];
  edition_id?: string | null;
  collection_id?: string | null;
  collection_sequence_number?: number | null;
  collection_volume_number?: number | null;
  status?: number;
  created_at?: string | null;
  updated_at?: string | null;
  archived_at?: string | null;
  authors?: Author[];
  series?: Serie[];
  /** New: array of linked collections (server v2) */
  collections?: Collection[];
  /** Legacy single-collection (kept for backward compat with Z3950 / old data) */
  collection?: Collection | null;
  edition?: Edition | null;
  /** Physical copies of this bibliographic record */
  items?: Item[];
  marc_record?: unknown;
}

/** Physical item data when creating a Biblio in one request (POST /biblios with items) */
export interface CreateBiblioItemInput {
  barcode?: string | null;
  call_number?: string | null;
  source_id: string;
}

/** Payload for POST /biblios/{id}/items */
export interface CreateItem {
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

/** Payload for PUT /biblios/{id}/items */
export interface UpdateItem {
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
  /** Bibliographic record associated with the loan */
  biblio: BiblioShort;
  user?: UserShort;
  item_identification?: string;
  is_overdue: boolean;
}

// Stats types
export interface Stats {
  biblios: {
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
  active_items: number;
  entered_items: number;
  archived_items: number;
  loans: number;
  by_media_type?: CatalogStatsBreakdown[];
  by_public_type?: CatalogStatsBreakdown[];
}

export interface CatalogStats {
  totals: {
    active_items: number;
    entered_items: number;
    archived_items: number;
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

/** Normalized client shape; server JSON uses `per_page` and `page_count` (see `normalizePaginatedResponse`). */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

export interface ImportReport {
  action: 'created' | 'merged_bibliographic' | 'replaced_archived' | 'replaced_confirmed';
  existing_id?: string;
  warnings: string[];
  message?: string;
}

export interface ImportResult<T> {
  /** Imported bibliographic record */
  biblio: T;
  import_report: ImportReport;
}

// UNIMARC batch upload / import
export interface EnqueueResult {
  /** Unique batch identifier in Redis (stringified i64) */
  batch_id: string;
  /** Lightweight preview of bibliographic records in this batch */
  biblios: BiblioShort[];
}

export interface MarcBatchImportError {
  record_key: string;
  error: string;
  /** ID of the existing biblio that caused a duplicate ISBN conflict */
  existing_id?: number | string | null;
}

export interface MarcBatchImportReport {
  batch_id: string;
  imported: number;
  failed: MarcBatchImportError[];
}

export interface MarcBatchInfo {
  /** Unique batch identifier in Redis (stringified i64) */
  batch_id: string;
  record_count: number;
  /** Redis TTL semantics: -1 no expiry, -2 key missing/expired */
  ttl_seconds: number;
}

export interface DuplicateConfirmationRequired {
  code: 'duplicate_isbn_needs_confirmation';
  existing_id: string;
  message: string;
}

// Error response — code is now a string
export interface ApiError {
  code: string;
  error: string;
  message: string;
}

export type ApiErrorCode =
  | 'authentication_failed'
  | 'authorization_failed'
  | 'not_found'
  | 'validation_error'
  | 'bad_request'
  | 'conflict'
  | 'business_rule_violation'
  | 'duplicate_isbn_needs_confirmation'
  | 'duplicate_barcode_needs_confirmation'
  | 'z3950_error'
  | 'database_error'
  | 'internal_error';

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

export type MaintenanceAction =
  | 'cleanup_dangling_biblio_series'
  | 'cleanup_dangling_biblio_collections'
  | 'cleanup_series'
  | 'cleanup_collections'
  | 'merge_duplicate_series'
  | 'merge_duplicate_collections'
  | 'cleanup_orphan_authors';

export interface MaintenanceActionReport {
  action: MaintenanceAction | string;
  success: boolean;
  details: Record<string, number>;
  error?: string;
}

export interface MaintenanceResponse {
  reports: MaintenanceActionReport[];
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

// ──────────────────────────────────────────────────────────────────
// Reservations / Holds
// ──────────────────────────────────────────────────────────────────

export type ReservationStatus = 'pending' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';

export interface Reservation {
  id: string;
  userId?: string;
  itemId?: string;
  /** Server JSON (canonical) */
  user_id?: string;
  item_id?: string;
  status: ReservationStatus;
  position: number;
  createdAt?: string;
  notifiedAt?: string | null;
  expiresAt?: string | null;
  /** Server JSON (canonical) */
  created_at?: string;
  notified_at?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}

export interface CreateReservation {
  userId: string;
  itemId: string;
  notes?: string | null;
}

// ──────────────────────────────────────────────────────────────────
// Fines / Penalties
// ──────────────────────────────────────────────────────────────────

export type FineStatus = 'pending' | 'partial' | 'paid' | 'waived';

export interface Fine {
  id: string;
  loanId?: string;
  /** Server JSON (canonical) */
  loan_id?: string;
  amount: string;
  paidAmount?: string;
  /** Server JSON (canonical) */
  paid_amount?: string;
  status: FineStatus;
  createdAt?: string;
  /** Server JSON (canonical) */
  created_at?: string;
}

export interface FinesResponse {
  totalUnpaid?: string;
  /** Server JSON (canonical) */
  total_unpaid?: string;
  fines: Fine[];
}

export interface FineRule {
  mediaType?: MediaType | null;
  dailyRate?: string;
  maxAmount?: string;
  graceDays?: number;
  /** Server JSON (canonical) */
  media_type?: MediaType | null;
  daily_rate?: string;
  max_amount?: string;
  grace_days?: number;
}

// ──────────────────────────────────────────────────────────────────
// Inventory / Stock check
// ──────────────────────────────────────────────────────────────────

export interface InventorySession {
  id: string;
  locationFilter?: string | null;
  /** Server JSON (canonical) */
  location_filter?: string | null;
  status: 'open' | 'closed';
  createdAt?: string;
  /** Server JSON (canonical) */
  created_at?: string;
  closedAt?: string | null;
  /** Server JSON (canonical) */
  closed_at?: string | null;
}

export interface CreateInventorySession {
  locationFilter?: string | null;
}

export interface InventoryScanResult {
  barcode: string;
  found: boolean;
  itemId?: string | null;
  /** Server JSON (canonical) */
  item_id?: string | null;
}

export interface InventoryReport {
  sessionId?: string;
  totalScanned?: number;
  totalFound?: number;
  totalUnknown?: number;
  missingCount?: number;
  /** Server JSON (canonical) */
  session_id?: string;
  total_scanned?: number;
  total_found?: number;
  total_unknown?: number;
  missing_count?: number;
}

// ──────────────────────────────────────────────────────────────────
// Reading history (RGPD)
// ──────────────────────────────────────────────────────────────────

export interface HistoryPreference {
  userId?: string;
  historyEnabled?: boolean;
  /** Server JSON (canonical) */
  user_id?: string;
  history_enabled?: boolean;
}

export interface ReadingHistoryEntry {
  id: string;
  loanId?: string | null;
  biblio?: BiblioShort | null;
  returnedAt?: string;
  /** Server JSON (canonical) */
  loan_id?: string | null;
  returned_at?: string;
}

// ──────────────────────────────────────────────────────────────────
// Batch operations (scanner / return kiosk)
// ──────────────────────────────────────────────────────────────────

export interface BatchReturnResult {
  barcode: string;
  success: boolean;
  loan?: Loan | null;
  error?: string | null;
}

export interface BatchReturnResponse {
  returned: number;
  errors: number;
  results: BatchReturnResult[];
}

export interface BatchCreateResult {
  barcode: string;
  success: boolean;
  loanId?: string | null;
  /** Server JSON (canonical) */
  loan_id?: string | null;
  error?: string | null;
}

export interface BatchCreateResponse {
  created: number;
  errors: number;
  results: BatchCreateResult[];
}

// ──────────────────────────────────────────────────────────────────
// OPAC — public unauthenticated catalogue
// ──────────────────────────────────────────────────────────────────

export interface OPACAvailability {
  biblioId?: string;
  activeLoans?: number;
  holdCount?: number;
  /** Server JSON (canonical) */
  biblio_id?: string;
  active_loans?: number;
  hold_count?: number;
}
