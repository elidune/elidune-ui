// Library info types
export interface LibraryInfo {
  name?: string | null;
  addrLine1?: string | null;
  addrLine2?: string | null;
  addrPostcode?: string | null;
  addrCity?: string | null;
  addrCountry?: string | null;
  email?: string | null;
  phones: string[];
  updatedAt?: string | null;
}

export interface UpdateLibraryInfoRequest {
  name?: string | null;
  addrLine1?: string | null;
  addrLine2?: string | null;
  addrPostcode?: string | null;
  addrCity?: string | null;
  addrCountry?: string | null;
  email?: string | null;
  phones?: string[] | null;
}

// Schedule types
export interface SchedulePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
  createdAt?: string | null;
  updateAt?: string | null;
}

export interface ScheduleSlot {
  id: string;
  periodId: string;
  dayOfWeek: number; // 0=Monday, 6=Sunday
  openTime: string;
  closeTime: string;
  createdAt?: string | null;
}

export interface ScheduleClosure {
  id: string;
  closureDate: string;
  reason?: string | null;
  createdAt?: string | null;
}

export interface CreateSchedulePeriod {
  name: string;
  startDate: string;
  endDate: string;
  notes?: string | null;
}

export interface UpdateSchedulePeriod {
  name?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
}

export interface CreateScheduleSlot {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
}

export interface CreateScheduleClosure {
  closureDate: string;
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
  accountType?: string;
  language?: string;
  // Address fields
  addrStreet?: string;
  addrZipCode?: number;
  addrCity?: string;
  // Additional fields
  birthdate?: string;
  notes?: string;
  fee?: string;
  groupId?: string | null;
  publicType?: string | null;
  status?: number;
  // Date fields
  createdAt?: string;
  updateAt?: string;
  archivedAt?: string;
  /** Subscription / membership expiry (ISO). Null = unlimited. */
  expiryAt?: string | null;
  // 2FA fields
  twoFactorEnabled?: boolean;
  twoFactorMethod?: string | null;
  // Other
  receiveReminders?: boolean;
  mustChangePassword?: boolean;
  sex?: string | null;
  staffType?: string | null;
  hoursPerWeek?: number | null;
  staffStartDate?: string | null;
  staffEndDate?: string | null;
}

// Update profile request type
export interface UpdateProfileRequest {
  firstname?: string;
  lastname?: string;
  email?: string;
  login?: string;
  addrStreet?: string;
  addrZipCode?: number;
  addrCity?: string;
  phone?: string;
  birthdate?: string;
  currentPassword?: string;
  newPassword?: string;
  language?: string;
}

/** First-login / forced password change via POST /auth/change-password */
export interface ChangePasswordRequest {
  newPassword: string;
}

export interface UserShort {
  id: string;
  firstname?: string | null;
  lastname?: string | null;
  accountType?: string | null;
  publicType?: string | null;
  nbLoans?: number | null;
  nbLateLoans?: number | null;
  loans?: Loan[];
  /** Subscription / membership expiry (ISO). Null = unlimited. */
  expiryAt?: string | null;
  createdAt?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
  deviceId?: string;
}

export interface LoginResponse {
  token?: string;
  tokenType: string;
  expiresIn: number;
  requires2fa: boolean;
  /** When true, the user must change password before using the app. */
  mustChangePassword?: boolean;
  twoFactorMethod?: string | null;
  deviceId?: string | null;
  user: {
    id: string;
    username: string;
    login: string;
    firstname?: string;
    lastname?: string;
    accountType: string;
    language: string;
  };
}

// 2FA Types
export type TwoFactorMethod = 'totp' | 'email';

export interface Setup2FARequest {
  method: TwoFactorMethod;
}

export interface Setup2FAResponse {
  provisioningUri?: string;
  recoveryCodes: string[];
}

export interface Verify2FARequest {
  userId: string;
  code: string;
  trustDevice?: boolean;
  deviceId?: string;
}

export interface Verify2FAResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  deviceId?: string | null;
  mustChangePassword?: boolean;
}

export interface VerifyRecoveryRequest {
  userId: string;
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
  publisherName?: string | null;
  placeOfPublication?: string | null;
  date?: string | null;
}

export interface Serie {
  id: string | null;
  key?: string | null;
  name?: string | null;
  issn?: string | null;
  volumeNumber?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  name?: string | null;
  secondaryTitle?: string | null;
  tertiaryTitle?: string | null;
  issn?: string | null;
  volumeNumber?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
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
  callNumber?: string | null;
  borrowable?: boolean | null;
  sourceName?: string | null;
  borrowed?: boolean;
}

/** Short bibliographic record as returned in list endpoints */
export interface BiblioShort {
  id: string;
  mediaType?: MediaType | string | null;
  isbn?: string | null;
  title?: string | null;
  date?: string | null;
  status?: number | null;
  isLocal?: number | null;
  isValid?: number | null;
  archivedAt?: string | null;
  /** Simplified list of physical items (replaces nb_items / nb_available) */
  items?: ItemShort[];
  author?: Author | null;
  sourceName?: string | null;
}

/** Full physical copy (exemplaire) */
export interface Item {
  id: string;
  biblioId?: string | null;
  sourceId?: string | null;
  barcode?: string | null;
  callNumber?: string | null;
  volumeDesignation?: string | null;
  place?: number | null;
  borrowable?: boolean | null;
  circulationStatus?: number | null;
  notes?: string | null;
  price?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
  sourceName?: string | null;
  borrowed?: boolean;
}

/** Full bibliographic record */
export interface Biblio {
  id?: string | null;
  marcFormat?: string | null;
  mediaType?: MediaType | string | null;
  isbn?: string | null;
  barcode?: string | null;
  callNumber?: string | null;
  price?: string | null;
  title?: string | null;
  genre?: number | null;
  subject?: string | null;
  audienceType?: string | null;
  lang?: string | null;
  langOrig?: string | null;
  publicationDate?: string | null;
  pageExtent?: string | null;
  format?: string | null;
  tableOfContents?: string | null;
  accompanyingMaterial?: string | null;
  abstract?: string | null;
  notes?: string | null;
  keywords?: string | string[] | null;
  state?: string | null;
  isValid?: number | null;
  seriesIds?: string[];
  seriesVolumeNumbers?: (number | null)[];
  collectionIds?: string[];
  collectionVolumeNumbers?: (number | null)[];
  editionId?: string | null;
  collectionId?: string | null;
  collectionSequenceNumber?: number | null;
  collectionVolumeNumber?: number | null;
  status?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
  authors?: Author[];
  series?: Serie[];
  collections?: Collection[];
  /** Legacy single-collection (kept for backward compat with Z3950 / old data) */
  collection?: Collection | null;
  edition?: Edition | null;
  /** Physical copies of this bibliographic record */
  items?: Item[];
  marcRecord?: unknown;
}

/** Physical item data when creating a Biblio in one request (POST /biblios with items) */
export interface CreateBiblioItemInput {
  barcode?: string | null;
  callNumber?: string | null;
  sourceId: string;
}

/** Payload for POST /biblios/{id}/items */
export interface CreateItem {
  barcode?: string | null;
  callNumber?: string | null;
  volumeDesignation?: string | null;
  place?: number | null;
  borrowable?: boolean | null;
  notes?: string | null;
  price?: string | null;
  sourceId?: string | null;
  sourceName?: string | null;
}

/** Payload for PUT /biblios/{id}/items */
export interface UpdateItem {
  barcode?: string | null;
  callNumber?: string | null;
  volumeDesignation?: string | null;
  place?: number | null;
  borrowable?: boolean | null;
  notes?: string | null;
  price?: string | null;
  sourceId?: string | null;
}

// Loan types
export interface Loan {
  id: string;
  startDate: string;
  expiryAt: string;
  /** Present when the loan has been returned */
  returnedAt?: string | null;
  renewalDate?: string | null;
  nbRenews: number;
  /** Bibliographic record associated with the loan */
  biblio: BiblioShort;
  user?: UserShort;
  itemIdentification?: string | null;
  isOverdue: boolean;
}

// Stats types
export interface Stats {
  biblios: {
    total: number;
    byMediaType: StatEntry[];
    byPublicType: StatEntry[];
    acquisitions?: number;
    acquisitionsByMediaType?: StatEntry[];
    withdrawals?: number;
    withdrawalsByMediaType?: StatEntry[];
  };
  users: {
    total: number;
    active: number;
    byAccountType: StatEntry[];
  };
  loans: {
    active: number;
    overdue: number;
    returnedToday: number;
    byMediaType: StatEntry[];
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
  newUsersTotal: number;
  activeBorrowersTotal: number;
  usersTotal: number;
  newUsersByPublicType?: StatEntry[];
  activeBorrowersByPublicType?: StatEntry[];
  usersByPublicType?: StatEntry[];
  usersBySex?: StatEntry[];
  newUsersBySex?: StatEntry[];
  activeBorrowersBySex?: StatEntry[];
  groupsTotal?: number;
}

// Time-based stats for charts
export interface LoanTimeStats {
  date: string;
  loans: number;
  returns: number;
}

export interface UserLoanStats {
  userId: string;
  firstname: string;
  lastname: string;
  totalLoans: number;
  activeLoans: number;
  overdueLoans: number;
}

// Catalog stats from /stats/catalog
export interface CatalogStatsBreakdown {
  label?: string;
  sourceId?: string;
  sourceName?: string;
  activeItems: number;
  enteredItems: number;
  archivedItems: number;
  loans: number;
  byMediaType?: CatalogStatsBreakdown[] | null;
  byPublicType?: CatalogStatsBreakdown[] | null;
}

export interface CatalogStats {
  totals: {
    activeItems: number;
    enteredItems: number;
    archivedItems: number;
    loans: number;
  };
  bySource?: CatalogStatsBreakdown[] | null;
  byMediaType?: CatalogStatsBreakdown[] | null;
  byPublicType?: CatalogStatsBreakdown[] | null;
}

// Advanced stats types
export type StatsInterval = 'day' | 'week' | 'month' | 'year';

export interface AdvancedStatsParams {
  startDate: string;
  endDate: string;
  interval?: StatsInterval;
  mediaType?: MediaType;
  userId?: string;
  publicType?: string;
}

export interface LoanStatsTimeSeries {
  period: string;
  loans: number;
  returns: number;
}

export interface LoanStatsResponse {
  totalLoans: number;
  totalReturns: number;
  timeSeries: LoanStatsTimeSeries[];
  byMediaType: StatEntry[];
}

// Flexible stats builder (`GET /stats/schema`, `POST /stats/query`, `/stats/saved`)
export type StatsFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull';

export type StatsAggregateFunction = 'count' | 'countDistinct' | 'sum' | 'avg' | 'min' | 'max';

export type StatsTimeGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export interface StatsSelectField {
  field: string;
  alias?: string | null;
}

export interface StatsGroupByField {
  field: string;
  alias?: string | null;
}

export interface StatsFilterClause {
  field: string;
  op: StatsFilterOperator;
  value: unknown;
}

export interface StatsHavingFilter {
  field: string;
  op: StatsFilterOperator;
  value: unknown;
}

export interface StatsAggregation {
  fn: StatsAggregateFunction;
  field: string;
  alias: string;
}

export interface StatsTimeBucket {
  field: string;
  granularity: StatsTimeGranularity;
  alias?: string | null;
}

export interface StatsOrderBy {
  field: string;
  dir?: 'asc' | 'desc' | null;
}

export interface StatsBuilderBody {
  entity: string;
  joins: string[];
  select: StatsSelectField[];
  filters: StatsFilterClause[];
  /**
   * OR-of-AND groups combined with top-level `filters` as:
   * `(AND filters) AND ((AND g0) OR (AND g1) OR …)`.
   */
  filterGroups?: StatsFilterClause[][];
  /**
   * Additional root tables to combine with `entity` via UNION ALL (e.g. `loans` + `loans_archives`).
   * Discovery lists allowed branches on `entities.<name>.unionWith`.
   */
  unionWith?: string[];
  aggregations: StatsAggregation[];
  groupBy: StatsGroupByField[];
  having: StatsHavingFilter[];
  timeBucket?: StatsTimeBucket | null;
  orderBy: StatsOrderBy[];
  limit?: number | null;
  offset?: number | null;
}

export interface StatsColumnMeta {
  name: string;
  label: string;
  dataType: string;
}

export interface StatsTableResponse {
  columns: StatsColumnMeta[];
  rows: Record<string, unknown>[];
  totalRows: number;
  limit: number;
  offset: number;
}

export interface StatsSchemaRelation {
  join: [string, string];
  label: string;
}

/** Field metadata from `GET /stats/schema` (computed = SQL expression, not a physical column). */
export interface StatsSchemaField {
  type: string;
  label: string;
  computed?: boolean;
}

export interface StatsSchemaEntity {
  label: string;
  fields: Record<string, StatsSchemaField>;
  relations: Record<string, StatsSchemaRelation>;
  /** Additional roots that can be UNION ALL’d with this entity (e.g. `["loans_archives"]` for `loans`). */
  unionWith?: string[];
}

export interface StatsSchema {
  entities: Record<string, StatsSchemaEntity>;
  aggregationFunctions: string[];
  operators: string[];
  timeGranularities: string[];
  /** Human-readable explanation of `filterGroups` OR-of-AND semantics (from server). */
  filterGroupsSemantics?: string;
  /** Explains `unionWith` / multi-root UNION ALL (from server). */
  unionWithSemantics?: string;
}

export interface SavedStatsQuery {
  id: number;
  name: string;
  description?: string | null;
  query: StatsBuilderBody;
  userId: number;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedStatsQueryWrite {
  name: string;
  description?: string | null;
  query: StatsBuilderBody;
  isShared: boolean;
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
  action: 'created' | 'mergedBibliographic' | 'replacedArchived' | 'replacedConfirmed';
  existingId?: string;
  warnings: string[];
  message?: string;
}

export interface ImportResult<T> {
  /** Imported bibliographic record */
  biblio: T;
  importReport: ImportReport;
}

// UNIMARC batch upload / import (POST load-marc, GET marc-batch/:id)
/** Single validation issue from marc-rs `Record::validation_issues` (JSON: camelCase). */
export interface RecordValidationIssue {
  tag: string;
  /** Subfield code when applicable (serialized as a one-character string) */
  subfield?: string | null;
  targetPath: string;
  value: string;
  pattern: string;
}

/** BiblioShort-shaped preview plus optional MARC parse validation diagnostics. */
export type MarcImportPreview = BiblioShort & {
  validationIssues: RecordValidationIssue[];
};

export interface EnqueueResult {
  /** Unique batch identifier in Redis (stringified i64) */
  batchId: string;
  /** One entry per cached notice (same order as upload for load-marc) */
  previews: MarcImportPreview[];
}

export interface MarcBatchImportError {
  key: string;
  error: string;
  /** ID of the existing biblio that caused a duplicate ISBN conflict */
  existingId?: string | null;
}

export interface MarcBatchImportReport {
  batchId: string;
  /** IDs of successfully imported records */
  imported: string[];
  failed: MarcBatchImportError[];
}

export interface MarcBatchInfo {
  /** Unique batch identifier in Redis (stringified i64) */
  batchId: string;
  recordCount: number;
  /** Redis TTL semantics: -1 no expiry, -2 key missing/expired */
  ttlSeconds: number;
}

export interface DuplicateConfirmationRequired {
  code: 'duplicate_isbn_needs_confirmation';
  existingId: string;
  message: string;
}

// Background tasks (async long-running operations)
export type TaskKind = 'marcBatchImport' | 'maintenance' | 'inventoryBatchScan';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskProgress {
  current: number;
  total: number;
  /** Plain text or structured counts (e.g. MARC batch import) from the server */
  message?: string | { imported?: number | string[]; failed?: number | unknown[] };
}

export interface TaskStartResponse {
  taskId: string;
}

export interface BackgroundTask {
  id: string;
  kind: TaskKind;
  status: TaskStatus;
  progress?: TaskProgress | null;
  result?: MarcBatchImportReport | MaintenanceResponse | InventoryScan[] | null;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  userId: string;
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
  mediaType: MediaType;
  maxLoans: number;
  maxRenewals: number;
  durationDays: number;
}

export interface Settings {
  loanSettings: LoanSettings[];
  z3950Servers: Z3950Server[];
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
  encoding?: string;
  isActive: boolean;
}

// Public types (audience types for users)
export interface PublicType {
  id: string;
  name: string;
  label: string;
  subscriptionDurationDays?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
  subscriptionPrice?: number | null;
  maxLoans?: number | null;
  loanDurationDays?: number | null;
}

export interface PublicTypeLoanSettings {
  id: string;
  publicTypeId: string;
  mediaType: MediaType;
  duration: number;
  nbMax: number;
  nbRenews: number;
}

export interface CreatePublicType {
  name: string;
  label: string;
  subscriptionDurationDays?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
  subscriptionPrice?: number | null;
  maxLoans?: number | null;
  loanDurationDays?: number | null;
}

export interface UpdatePublicType {
  name?: string;
  label?: string;
  subscriptionDurationDays?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
  subscriptionPrice?: number | null;
  maxLoans?: number | null;
  loanDurationDays?: number | null;
}

export interface UpsertLoanSettingRequest {
  mediaType: MediaType;
  duration?: number | null;
  nbMax?: number | null;
  nbRenews?: number | null;
}

// Source type
export interface Source {
  id: string;
  key: string | null;
  name: string | null;
  isArchive?: number | null;
  archivedAt?: string | null;
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
export type AdminConfigSectionKey = 'email' | 'logging' | 'reminders' | 'audit' | 'holds';

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
  itemsQueued: number;
  meilisearchAvailable: boolean;
}

export type MaintenanceAction =
  | 'cleanupDanglingBiblioSeries'
  | 'cleanupDanglingBiblioCollections'
  | 'cleanupSeries'
  | 'cleanupCollections'
  | 'mergeDuplicateSeries'
  | 'mergeDuplicateCollections'
  | 'cleanupOrphanAuthors'
  | 'cleanupUsers';

/** POST /maintenance — tagged action for Z39.50 catalog refresh (requires server id). */
export interface Z3950RefreshMaintenanceAction {
  action: 'z3950Refresh';
  z3950ServerId: number;
  rebuildAll?: boolean;
}

export type MaintenanceRequestAction = MaintenanceAction | Z3950RefreshMaintenanceAction;

/** Summary in maintenance report `details` for z3950Refresh (camelCase from API). */
export interface CatalogZ3950RefreshResult {
  z3950ServerId: number;
  rebuildAll: boolean;
  total: number;
  updated: number;
  notFound: number;
  failed: number;
}

export interface MaintenanceActionReport {
  action: MaintenanceRequestAction | string;
  success: boolean;
  details: Record<string, number> | CatalogZ3950RefreshResult;
  error?: string;
}

export interface MaintenanceResponse {
  reports: MaintenanceActionReport[];
}

// Audit log
export interface AuditLogEntry {
  id: number;
  eventType: string;
  userId: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  perPage: number;
}

// Overdue loans dashboard
export interface OverdueLoanInfo {
  loanId: string;
  userId: string;
  firstname?: string;
  lastname?: string;
  userEmail?: string;
  biblioId?: string;
  title?: string;
  authors?: string;
  itemBarcode?: string;
  loanDate: string;
  expiryAt: string | null;
  lastReminderSentAt: string | null;
  reminderCount: number;
}

export interface OverdueLoansPage {
  loans: OverdueLoanInfo[];
  total: number;
  page: number;
  perPage: number;
}

export interface ReminderDetail {
  userId: string;
  email: string;
  firstname?: string;
  lastname?: string;
  loanCount: number;
}

export interface ReminderError {
  userId: string;
  email: string;
  errorMessage: string;
}

export interface ReminderReport {
  dryRun: boolean;
  emailsSent: number;
  loansReminded: number;
  details: ReminderDetail[];
  errors: ReminderError[];
}

// Events
export interface Event {
  id: string;
  name: string;
  eventType: number;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  partnerName?: string | null;
  schoolName?: string | null;
  className?: string | null;
  attendeesCount?: number | null;
  studentsCount?: number | null;
  targetPublic?: number | null;
  notes?: string | null;
  announcementSentAt?: string | null;
  createdAt?: string | null;
  updateAt?: string | null;
}

export interface CreateEvent {
  name: string;
  eventDate: string;
  eventType?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  partnerName?: string | null;
  schoolName?: string | null;
  className?: string | null;
  attendeesCount?: number | null;
  studentsCount?: number | null;
  targetPublic?: number | null;
  notes?: string | null;
}

export interface UpdateEvent {
  name?: string | null;
  eventDate?: string | null;
  eventType?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  partnerName?: string | null;
  schoolName?: string | null;
  className?: string | null;
  attendeesCount?: number | null;
  studentsCount?: number | null;
  targetPublic?: number | null;
  notes?: string | null;
}

export interface EventsListResponse {
  events: Event[];
  total: number;
}

// ──────────────────────────────────────────────────────────────────
// Holds (physical copy queue) — API tag `holds`
// ──────────────────────────────────────────────────────────────────

export type HoldStatus = 'pending' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';

/**
 * Hold detail rows (GET list endpoints). Aligned with {@link Loan}: `biblio.items`
 * contains exactly one {@link ItemShort} — the reserved specimen.
 */
export interface Hold {
  id: string;
  userId: string;
  itemId: string;
  createdAt: string;
  notifiedAt: string | null;
  expiresAt: string | null;
  status: HoldStatus;
  position: number;
  notes: string | null;
  /** Populated on GET /holds, GET /items/:id/holds, GET /users/:id/holds */
  biblio?: BiblioShort | null;
  user?: UserShort | null;
}

export interface CreateHold {
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
  userId?: string;
  amount: string;
  paidAmount?: string;
  status: FineStatus;
  createdAt?: string;
  paidAt?: string | null;
  notes?: string | null;
}

export interface FinesResponse {
  totalUnpaid?: string;
  fines: Fine[];
}

export interface FineRule {
  id?: number;
  mediaType?: MediaType | null;
  dailyRate?: string;
  maxAmount?: string;
  graceDays?: number;
  notes?: string | null;
}

// ──────────────────────────────────────────────────────────────────
// Inventory / Stock check
// ──────────────────────────────────────────────────────────────────

export type InventoryScanResultCode = 'found' | 'found_archived' | 'unknown_barcode';

export interface InventorySession {
  id: string;
  /** Session label (required on create; may be absent on legacy rows) */
  name?: string;
  locationFilter?: string | null;
  status: 'open' | 'closed';
  startedAt?: string | null;
  /** @deprecated prefer startedAt */
  createdAt?: string;
  closedAt?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  /** When set, scope is active non-archived items with this `items.place` only; null = entire active collection */
  scopePlace?: number | null;
}

export interface CreateInventorySession {
  name: string;
  locationFilter?: string | null;
  notes?: string | null;
  scopePlace?: number | null;
}

export interface InventoryScan {
  id: number;
  sessionId: string;
  barcode: string;
  itemId?: string | null;
  scannedAt?: string | null;
  result: InventoryScanResultCode;
  scannedBy?: string | null;
}

/** @deprecated use InventoryScan */
export type InventoryScanResult = InventoryScan;

export interface InventoryMissingRow {
  itemId: string;
  barcode?: string | null;
  callNumber?: string | null;
  place?: number | null;
  biblioTitle?: string | null;
}

export interface InventoryReport {
  sessionId: string;
  expectedInScope?: number;
  totalScanned?: number;
  totalFound?: number;
  totalFoundArchived?: number;
  totalUnknown?: number;
  distinctItemsScanned?: number;
  duplicateScanCount?: number;
  missingCount?: number;
  missingScannable?: number;
  missingWithoutBarcode?: number;
}

// ──────────────────────────────────────────────────────────────────
// Reading history (RGPD)
// ──────────────────────────────────────────────────────────────────

export interface HistoryPreference {
  userId?: string;
  historyEnabled?: boolean;
}

export interface ReadingHistoryEntry {
  id: string;
  loanId?: string | null;
  biblio?: BiblioShort | null;
  returnedAt?: string;
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
}

// ──────────────────────────────────────────────────────────────────
// First setup (GET /health, POST /first_setup)
// ──────────────────────────────────────────────────────────────────

export interface HealthSetupInfo {
  needFirstSetup?: boolean;
  need_first_setup?: boolean;
}

export interface HealthResponse {
  status: string;
  version?: string;
  database?: { connected?: boolean };
  setup?: HealthSetupInfo;
}

/** True when the server requires the initial wizard (no users / no settings yet). */
export function healthNeedsFirstSetup(h: HealthResponse | undefined | null): boolean {
  if (!h) return false;
  if (h.status === 'need_first_setup') return true;
  const s = h.setup;
  if (!s) return false;
  return Boolean(s.needFirstSetup ?? s.need_first_setup);
}

/** True when the app cannot operate normally (e.g. DB unreachable — GET /health still 200). */
export function healthIsDegraded(h: HealthResponse | undefined | null): boolean {
  if (!h) return false;
  if (h.status === 'degraded') return true;
  if (h.database?.connected === false) return true;
  return false;
}

export interface FirstSetupAdmin {
  login: string;
  password: string;
  firstname: string;
  lastname: string;
  sex: 'm' | 'f';
  birthdate: string;
  email?: string;
  language?: string;
}

export interface FirstSetupEmailOverride {
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpFromName?: string;
  smtpUseTls?: boolean;
  templatesDir?: string;
}

export interface FirstSetupRequest {
  admin: FirstSetupAdmin;
  library: UpdateLibraryInfoRequest;
  email?: FirstSetupEmailOverride;
}

export interface FirstSetupResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: LoginResponse['user'];
  libraryInfo: LibraryInfo;
}
