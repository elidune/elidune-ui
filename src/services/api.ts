import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  User,
  UserShort,
  Biblio,
  BiblioShort,
  ImportResult,
  Loan,
  Stats,
  LoanSettings,
  Z3950Server,
  PaginatedResponse,
  ApiError,
  UpdateProfileRequest,
  ChangePasswordRequest,
  Setup2FARequest,
  Setup2FAResponse,
  Verify2FARequest,
  Verify2FAResponse,
  VerifyRecoveryRequest,
  AdvancedStatsParams,
  LoanStatsResponse,
  MediaType,
  UserLoanStats,
  UserAggregateStats,
  CatalogStats,
  StatsSchema,
  StatsBuilderBody,
  StatsTableResponse,
  SavedStatsQuery,
  SavedStatsQueryWrite,
  Source,
  Item,
  CreateBiblioItemInput,
  CreateItem,
  UpdateItem,
  EnqueueResult,
  MarcBatchInfo,
  TaskStartResponse,
  BackgroundTask,
  PublicType,
  PublicTypeLoanSettings,
  CreatePublicType,
  UpdatePublicType,
  UpsertLoanSettingRequest,
  AdminConfigSectionKey,
  ConfigSectionInfo,
  AdminConfigResponse,
  Hold,
  ReindexSearchResponse,
  MaintenanceAction,
  AuditLogPage,
  OverdueLoansPage,
  ReminderReport,
  Event,
  EventsListResponse,
  CreateEvent,
  UpdateEvent,
  SchedulePeriod,
  ScheduleSlot,
  ScheduleClosure,
  CreateSchedulePeriod,
  UpdateSchedulePeriod,
  CreateScheduleSlot,
  CreateScheduleClosure,
  LibraryInfo,
  UpdateLibraryInfoRequest,
  CreateHold,
  FinesResponse,
  FineRule,
  InventorySession,
  CreateInventorySession,
  InventoryScan,
  InventoryReport,
  InventoryMissingRow,
  HistoryPreference,
  ReadingHistoryEntry,
  BatchReturnResponse,
  BatchCreateResponse,
  OPACAvailability,
  Serie,
  CreateSerie,
  UpdateSerie,
  Collection,
  CreateCollection,
  UpdateCollection,
} from '@/types';
import { normalizePaginatedResponse } from '@/utils/serverJson';

function normalizeZ3950ServersPayload(data: unknown): Z3950Server[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.servers)) return o.servers as Z3950Server[];
    if (Array.isArray(o.z3950Servers)) return o.z3950Servers as Z3950Server[];
  }
  return [];
}

function normalizeLoanSettingsResponse(data: unknown): { loanSettings: LoanSettings[] } {
  if (Array.isArray(data)) {
    return { loanSettings: data as LoanSettings[] };
  }
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.loanSettings)) {
      return { loanSettings: o.loanSettings as LoanSettings[] };
    }
    if (Array.isArray(o.loan_settings)) {
      return { loanSettings: o.loan_settings as LoanSettings[] };
    }
  }
  return { loanSettings: [] };
}

const API_BASE_URL = '/api/v1';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  private shouldLogoutOnUnauthorized(error: AxiosError<ApiError>): boolean {
    if (error.response?.status !== 401) {
      return false;
    }

    const method = error.config?.method?.toLowerCase();
    const url = error.config?.url || '';

    // Wrong current password during profile password update can return 401
    // while the current auth token is still valid.
    if (method === 'put' && url.endsWith('/auth/profile')) {
      return false;
    }

    // Validation errors on forced first-login password change can return 401
    // without invalidating the session token.
    if (method === 'post' && url.endsWith('/auth/change-password')) {
      return false;
    }

    return true;
  }

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.token = localStorage.getItem('auth_token');

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (this.shouldLogoutOnUnauthorized(error)) {
          this.logout();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  setDeviceId(deviceId: string) {
    localStorage.setItem('device_id', deviceId);
  }

  getDeviceId(): string | null {
    return localStorage.getItem('device_id');
  }

  clearDeviceId() {
    localStorage.removeItem('device_id');
  }

  logout() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // ─── Auth ───────────────────────────────────────────────────────

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const deviceId = this.getDeviceId();
    const loginData = deviceId ? { ...credentials, deviceId } : credentials;
    const response = await this.client.post<LoginResponse>('/auth/login', loginData);
    const responseData = response.data;

    if (responseData.deviceId) {
      this.setDeviceId(responseData.deviceId);
    }

    if (!responseData.requires2fa && responseData.token) {
      this.setToken(responseData.token);
    }
    return responseData;
  }

  async getProfile(): Promise<User> {
    const response = await this.client.get<User>('/auth/me');
    return response.data;
  }

  async updateProfile(data: UpdateProfileRequest): Promise<User> {
    const response = await this.client.put<User>('/auth/profile', data);
    return response.data;
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    await this.client.post('/auth/change-password', data);
  }

  // 2FA
  async setup2FA(data: Setup2FARequest): Promise<Setup2FAResponse> {
    const response = await this.client.post<Setup2FAResponse>('/auth/setup-2fa', data);
    return response.data;
  }

  async verify2FA(data: Verify2FARequest): Promise<Verify2FAResponse> {
    const response = await this.client.post<Verify2FAResponse>('/auth/verify-2fa', data);
    this.setToken(response.data.token);
    return response.data;
  }

  async verifyRecovery(data: VerifyRecoveryRequest): Promise<Verify2FAResponse> {
    const response = await this.client.post<Verify2FAResponse>('/auth/verify-recovery', data);
    this.setToken(response.data.token);
    return response.data;
  }

  async disable2FA(): Promise<void> {
    await this.client.post('/auth/disable-2fa');
  }

  // ─── Biblios (notices bibliographiques) ─────────────────────────

  async getBiblios(params?: {
    title?: string;
    author?: string;
    isbn?: string;
    mediaType?: MediaType;
    audienceType?: string;
    freesearch?: string;
    page?: number;
    perPage?: number;
    archive?: boolean;
    serieId?: string;
    collectionId?: string;
  }): Promise<PaginatedResponse<BiblioShort>> {
    const response = await this.client.get('/biblios', { params });
    return normalizePaginatedResponse<BiblioShort>(response.data);
  }

  async getBiblio(id: string, params?: { fullRecord?: boolean }): Promise<Biblio> {
    const response = await this.client.get<Biblio>(`/biblios/${id}`, { params });
    return response.data;
  }

  async createBiblio(
    payload: Omit<Partial<Biblio>, 'items'> & { items?: CreateBiblioItemInput[] },
    options?: { allowDuplicateIsbn?: boolean; confirmReplaceExistingId?: string | null }
  ): Promise<ImportResult<Biblio>> {
    const params: Record<string, unknown> = {
      allowDuplicateIsbn: options?.allowDuplicateIsbn === true,
    };
    if (options?.confirmReplaceExistingId != null) {
      params.confirmReplaceExistingId = options.confirmReplaceExistingId;
    }
    const response = await this.client.post<ImportResult<Biblio>>('/biblios', payload, { params });
    return response.data;
  }

  async updateBiblio(id: string, biblio: Partial<Biblio>): Promise<Biblio> {
    const response = await this.client.put<Biblio>(`/biblios/${id}`, biblio);
    return response.data;
  }

  async deleteBiblio(id: string, force = false): Promise<void> {
    await this.client.delete(`/biblios/${id}`, { params: { force } });
  }

  // ─── Series ──────────────────────────────────────────────────────

  async getSeries(params?: {
    name?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<Serie>> {
    const response = await this.client.get('/series', { params });
    return normalizePaginatedResponse<Serie>(response.data);
  }

  async getSerie(id: string): Promise<Serie> {
    const response = await this.client.get<Serie>(`/series/${id}`);
    return response.data;
  }

  async getSerieBiblios(id: string): Promise<BiblioShort[]> {
    const response = await this.client.get<BiblioShort[]>(`/series/${id}/biblios`);
    return response.data;
  }

  async createSerie(data: CreateSerie): Promise<Serie> {
    const response = await this.client.post<Serie>('/series', data);
    return response.data;
  }

  async updateSerie(id: string, data: UpdateSerie): Promise<Serie> {
    const response = await this.client.put<Serie>(`/series/${id}`, data);
    return response.data;
  }

  async deleteSerie(id: string): Promise<void> {
    await this.client.delete(`/series/${id}`);
  }

  // ─── Collections ─────────────────────────────────────────────────

  async getCollections(params?: {
    name?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<Collection>> {
    const response = await this.client.get('/collections', { params });
    return normalizePaginatedResponse<Collection>(response.data);
  }

  async getCollection(id: string): Promise<Collection> {
    const response = await this.client.get<Collection>(`/collections/${id}`);
    return response.data;
  }

  async getCollectionBiblios(id: string): Promise<BiblioShort[]> {
    const response = await this.client.get<BiblioShort[]>(`/collections/${id}/biblios`);
    return response.data;
  }

  async createCollection(data: CreateCollection): Promise<Collection> {
    const response = await this.client.post<Collection>('/collections', data);
    return response.data;
  }

  async updateCollection(id: string, data: UpdateCollection): Promise<Collection> {
    const response = await this.client.put<Collection>(`/collections/${id}`, data);
    return response.data;
  }

  async deleteCollection(id: string): Promise<void> {
    await this.client.delete(`/collections/${id}`);
  }

  // ─── Items (exemplaires physiques) ──────────────────────────────

  async updateItem(biblioId: string, itemId: string, data: UpdateItem): Promise<Item> {
    const response = await this.client.put<Item>(`/biblios/${biblioId}/items`, {
      id: itemId,
      ...data,
    });
    return response.data;
  }

  async deleteItem(biblioId: string, itemId: string, force = false): Promise<void> {
    await this.client.delete(`/biblios/${biblioId}/items/${itemId}`, { params: { force } });
  }

  async createItem(biblioId: string, data: CreateItem): Promise<Item> {
    const response = await this.client.post<Item>(`/biblios/${biblioId}/items`, data);
    return response.data;
  }

  // ─── Users ──────────────────────────────────────────────────────

  async getUsers(params?: {
    name?: string;
    barcode?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<UserShort>> {
    const response = await this.client.get('/users', { params });
    return normalizePaginatedResponse<UserShort>(response.data);
  }

  async getUser(id: string): Promise<User> {
    const response = await this.client.get<User>(`/users/${id}`);
    return response.data;
  }

  async createUser(user: Partial<User> & { password?: string }): Promise<User> {
    const response = await this.client.post<User>('/users', user);
    return response.data;
  }

  async updateUser(id: string, user: Partial<User> & { password?: string }): Promise<User> {
    const response = await this.client.put<User>(`/users/${id}`, user);
    return response.data;
  }

  async deleteUser(id: string, force = false): Promise<void> {
    await this.client.delete(`/users/${id}`, { params: { force } });
  }

  // ─── Loans ──────────────────────────────────────────────────────

  async getUserLoans(
    userId: string,
    options?: { archived?: boolean; page?: number; perPage?: number }
  ): Promise<PaginatedResponse<Loan>> {
    const response = await this.client.get(`/users/${userId}/loans`, {
      params: {
        archived: options?.archived,
        page: options?.page,
        perPage: options?.perPage,
      },
    });
    return normalizePaginatedResponse<Loan>(response.data);
  }

  async createLoan(data: {
    userId: string;
    itemId?: string;
    itemIdentification?: string;
    force?: boolean;
  }): Promise<{ id: string; expiryAt: string; message: string }> {
    const response = await this.client.post('/loans', data);
    return response.data;
  }

  async returnLoan(loanId: string): Promise<{ status: string; loan: Loan }> {
    const response = await this.client.post(`/loans/${loanId}/return`);
    return response.data;
  }

  async renewLoan(loanId: string): Promise<{ id: string; expiryAt: string; message: string }> {
    const response = await this.client.post(`/loans/${loanId}/renew`);
    return response.data;
  }

  async returnLoanByBarcode(itemBarcode: string): Promise<{ status: string; loan: Loan }> {
    const response = await this.client.post(`/loans/items/${itemBarcode}/return`);
    return response.data;
  }

  async renewLoanByBarcode(itemBarcode: string): Promise<{ id: string; expiryAt: string; message: string }> {
    const response = await this.client.post(`/loans/items/${itemBarcode}/renew`);
    return response.data;
  }

  async getOverdueLoans(params?: { page?: number; perPage?: number }): Promise<OverdueLoansPage> {
    const response = await this.client.get<OverdueLoansPage>('/loans/overdue', { params });
    return response.data;
  }

  async sendOverdueReminders(options?: { dryRun?: boolean }): Promise<ReminderReport> {
    const response = await this.client.post<ReminderReport>(
      '/loans/send-overdue-reminders',
      {},
      { params: { dryRun: options?.dryRun === true } }
    );
    return response.data;
  }

  // ─── Batch operations ───────────────────────────────────────────

  async batchReturn(barcodes: string[]): Promise<BatchReturnResponse> {
    const response = await this.client.post<BatchReturnResponse>('/loans/batch-return', { barcodes });
    return response.data;
  }

  async batchCreate(data: {
    userId: string;
    barcodes: string[];
    force?: boolean;
  }): Promise<BatchCreateResponse> {
    const response = await this.client.post<BatchCreateResponse>('/loans/batch-create', data);
    return response.data;
  }

  // ─── Holds ──────────────────────────────────────────────────────

  async createHold(data: CreateHold): Promise<Hold> {
    const response = await this.client.post<Hold>('/holds', {
      userId: data.userId,
      itemId: data.itemId,
      notes: data.notes,
    });
    return response.data;
  }

  async cancelHold(holdId: string): Promise<Hold> {
    const response = await this.client.delete<Hold>(`/holds/${holdId}`);
    return response.data;
  }

  async getItemHolds(itemId: string): Promise<Hold[]> {
    const response = await this.client.get<Hold[]>(`/items/${itemId}/holds`);
    return response.data;
  }

  async getUserHolds(
    userId: string,
    options?: { page?: number; perPage?: number }
  ): Promise<PaginatedResponse<Hold>> {
    const response = await this.client.get(`/users/${userId}/holds`, {
      params: {
        page: options?.page,
        perPage: options?.perPage,
      },
    });
    const data = response.data;
    if (Array.isArray(data)) {
      const items = data as Hold[];
      const n = items.length;
      return {
        items,
        total: n,
        page: 1,
        perPage: Math.max(n, 1),
        pageCount: 1,
      };
    }
    return normalizePaginatedResponse<Hold>(data);
  }

  async getHolds(params?: {
    page?: number;
    perPage?: number;
    /** When true, only pending + ready holds (ongoing). */
    activeOnly?: boolean;
  }): Promise<PaginatedResponse<Hold>> {
    const response = await this.client.get('/holds', {
      params: {
        page: params?.page,
        perPage: params?.perPage,
        activeOnly: params?.activeOnly,
      },
    });
    return normalizePaginatedResponse<Hold>(response.data);
  }

  // ─── Fines / Penalties ──────────────────────────────────────────

  async getUserFines(userId: string): Promise<FinesResponse> {
    const response = await this.client.get<FinesResponse>(`/users/${userId}/fines`);
    return response.data;
  }

  async payFine(id: string): Promise<void> {
    await this.client.post(`/fines/${id}/pay`);
  }

  async waiveFine(id: string): Promise<void> {
    await this.client.post(`/fines/${id}/waive`);
  }

  async getFineRules(): Promise<FineRule[]> {
    const response = await this.client.get<FineRule[]>('/fines/rules');
    return response.data;
  }

  async updateFineRules(rules: FineRule[]): Promise<FineRule[]> {
    const response = await this.client.put<FineRule[]>('/fines/rules', rules);
    return response.data;
  }

  // ─── Inventory ──────────────────────────────────────────────────

  async getInventorySessions(params?: {
    page?: number;
    perPage?: number;
    status?: 'open' | 'closed';
  }): Promise<PaginatedResponse<InventorySession>> {
    const response = await this.client.get('/inventory/sessions', { params });
    return normalizePaginatedResponse<InventorySession>(response.data);
  }

  async createInventorySession(data: CreateInventorySession): Promise<InventorySession> {
    const response = await this.client.post<InventorySession>('/inventory/sessions', data);
    return response.data;
  }

  async getInventorySession(id: string): Promise<InventorySession> {
    const response = await this.client.get<InventorySession>(`/inventory/sessions/${id}`);
    return response.data;
  }

  async closeInventorySession(id: string): Promise<InventorySession> {
    const response = await this.client.post<InventorySession>(`/inventory/sessions/${id}/close`);
    return response.data;
  }

  async scanInventoryItem(sessionId: string, barcode: string): Promise<InventoryScan> {
    const response = await this.client.post<InventoryScan>(
      `/inventory/sessions/${sessionId}/scan`,
      { barcode }
    );
    return response.data;
  }

  async batchInventoryScans(sessionId: string, barcodes: string[]): Promise<InventoryScan[]> {
    const response = await this.client.post<InventoryScan[]>(
      `/inventory/sessions/${sessionId}/scans/batch`,
      { barcodes }
    );
    return response.data;
  }

  async getInventoryScans(
    sessionId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<PaginatedResponse<InventoryScan>> {
    const response = await this.client.get(`/inventory/sessions/${sessionId}/scans`, { params });
    return normalizePaginatedResponse<InventoryScan>(response.data);
  }

  async getInventoryMissing(
    sessionId: string,
    params?: { page?: number; perPage?: number }
  ): Promise<PaginatedResponse<InventoryMissingRow>> {
    const response = await this.client.get(`/inventory/sessions/${sessionId}/missing`, { params });
    return normalizePaginatedResponse<InventoryMissingRow>(response.data);
  }

  async getInventoryReport(sessionId: string): Promise<InventoryReport> {
    const response = await this.client.get<InventoryReport>(
      `/inventory/sessions/${sessionId}/report`
    );
    return response.data;
  }

  // ─── Reading history (RGPD) ──────────────────────────────────────

  async getReadingHistory(userId: string): Promise<ReadingHistoryEntry[]> {
    const response = await this.client.get<ReadingHistoryEntry[]>(`/users/${userId}/history`);
    return response.data;
  }

  async getHistoryPreference(userId: string): Promise<HistoryPreference> {
    const response = await this.client.get<HistoryPreference>(`/users/${userId}/history/preference`);
    return response.data;
  }

  async updateHistoryPreference(userId: string, enabled: boolean): Promise<HistoryPreference> {
    const response = await this.client.put<HistoryPreference>(
      `/users/${userId}/history/preference`,
      { enabled }
    );
    return response.data;
  }

  // ─── Stats ──────────────────────────────────────────────────────

  async getStats(params?: {
    year?: number;
    mediaType?: MediaType;
    publicType?: string;
  }): Promise<Stats> {
    const response = await this.client.get('/stats', { params });
    const d = response.data as Partial<Stats> & { items?: Stats['biblios'] };
    // Server sends `items` (catalog totals); keep `biblios` as the frontend key
    const biblios =
      d.biblios ??
      d.items ?? {
        total: 0,
        byMediaType: [],
        byPublicType: [],
      };
    const users = d.users ?? {
      total: 0,
      active: 0,
      byAccountType: [],
    };
    const loans = d.loans ?? {
      active: 0,
      overdue: 0,
      returnedToday: 0,
      byMediaType: [],
    };
    return { biblios, users, loans };
  }

  async getUserAggregateStats(params: {
    startDate?: string;
    endDate?: string;
  }): Promise<UserAggregateStats> {
    const response = await this.client.get<UserAggregateStats>('/stats/users', {
      params: { ...params, mode: 'aggregate' },
    });
    return response.data;
  }

  async getUserLoanStats(params?: {
    sortBy?: 'totalLoans' | 'activeLoans' | 'overdueLoans';
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<UserLoanStats[]> {
    const response = await this.client.get('/stats/users', { params });
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data?.users && Array.isArray(data.users)) return data.users;
    if (data?.items && Array.isArray(data.items)) return data.items;
    return [];
  }

  async getLoanStats(params: AdvancedStatsParams): Promise<LoanStatsResponse> {
    const response = await this.client.get<LoanStatsResponse>('/stats/loans', { params });
    return response.data;
  }

  async getCatalogStats(params?: {
    startDate?: string;
    endDate?: string;
    bySource?: boolean;
    byMediaType?: boolean;
    byPublicType?: boolean;
  }): Promise<CatalogStats> {
    const response = await this.client.get<CatalogStats>('/stats/catalog', { params });
    return response.data;
  }

  async getStatsSchema(): Promise<StatsSchema> {
    const response = await this.client.get<StatsSchema>('/stats/schema');
    return response.data;
  }

  async postStatsQuery(body: StatsBuilderBody): Promise<StatsTableResponse> {
    const response = await this.client.post<StatsTableResponse>('/stats/query', body);
    return response.data;
  }

  async getSavedStatsQueries(): Promise<SavedStatsQuery[]> {
    const response = await this.client.get<SavedStatsQuery[]>('/stats/saved');
    return response.data;
  }

  async createSavedStatsQuery(body: SavedStatsQueryWrite): Promise<SavedStatsQuery> {
    const response = await this.client.post<SavedStatsQuery>('/stats/saved', body);
    return response.data;
  }

  async updateSavedStatsQuery(id: number | string, body: SavedStatsQueryWrite): Promise<SavedStatsQuery> {
    const response = await this.client.put<SavedStatsQuery>(`/stats/saved/${id}`, body);
    return response.data;
  }

  async deleteSavedStatsQuery(id: number | string): Promise<{ ok: boolean }> {
    const response = await this.client.delete<{ ok: boolean }>(`/stats/saved/${id}`);
    return response.data;
  }

  async runSavedStatsQuery(id: number | string): Promise<StatsTableResponse> {
    const response = await this.client.get<StatsTableResponse>(`/stats/saved/${id}/run`);
    return response.data;
  }

  // ─── Settings (global loans + Z39.50; split API resources) ─────

  async getLoanSettings(): Promise<{ loanSettings: LoanSettings[] }> {
    const response = await this.client.get<unknown>('/loans/settings');
    return normalizeLoanSettingsResponse(response.data);
  }

  async updateLoanSettings(body: { loanSettings: LoanSettings[] }): Promise<{ loanSettings: LoanSettings[] }> {
    const response = await this.client.put<unknown>('/loans/settings', body);
    return normalizeLoanSettingsResponse(response.data);
  }

  async getZ3950Servers(): Promise<Z3950Server[]> {
    const response = await this.client.get<unknown>('/z3950/servers');
    return normalizeZ3950ServersPayload(response.data);
  }

  async updateZ3950Servers(servers: Z3950Server[]): Promise<Z3950Server[]> {
    const response = await this.client.put<unknown>('/z3950/servers', { z3950Servers: servers });
    const next = normalizeZ3950ServersPayload(response.data);
    return next.length > 0 ? next : servers;
  }

  // ─── Public types ────────────────────────────────────────────────

  async getPublicTypes(): Promise<PublicType[]> {
    const response = await this.client.get('/public-types');
    const data = response.data;
    if (Array.isArray(data)) return data;
    return normalizePaginatedResponse<PublicType>(data).items;
  }

  async getPublicType(id: string): Promise<[PublicType, PublicTypeLoanSettings[]]> {
    const response = await this.client.get<[PublicType, PublicTypeLoanSettings[]]>(`/public-types/${id}`);
    return response.data;
  }

  async createPublicType(data: CreatePublicType): Promise<PublicType> {
    const response = await this.client.post<PublicType>('/public-types', data);
    return response.data;
  }

  async updatePublicType(id: string, data: UpdatePublicType): Promise<PublicType> {
    const response = await this.client.put<PublicType>(`/public-types/${id}`, data);
    return response.data;
  }

  async deletePublicType(id: string): Promise<void> {
    await this.client.delete(`/public-types/${id}`);
  }

  async upsertPublicTypeLoanSetting(
    publicTypeId: string,
    data: UpsertLoanSettingRequest
  ): Promise<void> {
    await this.client.put(`/public-types/${publicTypeId}/loan-settings`, data);
  }

  async deletePublicTypeLoanSetting(publicTypeId: string, mediaType: MediaType): Promise<void> {
    await this.client.delete(`/public-types/${publicTypeId}/loan-settings/${mediaType}`);
  }

  // ─── Sources ─────────────────────────────────────────────────────

  async getSources(includeArchived = false): Promise<Source[]> {
    const response = await this.client.get('/sources', {
      params: { includeArchived },
    });
    const data = response.data;
    if (Array.isArray(data)) return data;
    return normalizePaginatedResponse<Source>(data).items;
  }

  async createSource(data: { name: string }): Promise<Source> {
    const response = await this.client.post<Source>('/sources', data);
    return response.data;
  }

  async updateSource(id: string, data: Partial<Source>): Promise<Source> {
    const response = await this.client.put<Source>(`/sources/${id}`, data);
    return response.data;
  }

  async renameSource(id: string, name: string): Promise<Source> {
    return this.updateSource(id, { name });
  }

  async archiveSource(id: string): Promise<Source> {
    const response = await this.client.post<Source>(`/sources/${id}/archive`);
    return response.data;
  }

  async mergeSources(sourceIds: string[], name: string): Promise<Source> {
    const response = await this.client.post<Source>('/sources/merge', {
      sourceIds,
      name,
    });
    return response.data;
  }

  // ─── Z39.50 ──────────────────────────────────────────────────────

  async searchZ3950(params: {
    isbn?: string;
    title?: string;
    author?: string;
    serverId?: string;
    maxResults?: number;
  }): Promise<{ total: number; biblios: Biblio[]; source: string }> {
    const cqlParts: string[] = [];

    if (params.isbn) cqlParts.push(`isbn="${params.isbn.trim()}"`);
    if (params.title) cqlParts.push(`title = "${params.title.trim()}"`);
    if (params.author) cqlParts.push(`author = "${params.author.trim()}"`);

    const cqlQuery = cqlParts.length > 0 ? cqlParts.join(' AND ') : '';

    const requestParams: Record<string, unknown> = {
      query: cqlQuery,
      serverId: params.serverId,
    };
    if (params.maxResults != null) {
      requestParams.maxResults = params.maxResults;
    }

    const response = await this.client.get('/z3950/search', { params: requestParams });
    return response.data;
  }

  async importZ3950(
    biblioId: string,
    items?: { barcode: string; callNumber?: string }[],
    sourceId?: string,
    options?: { confirmReplaceExistingId?: string | null }
  ): Promise<ImportResult<Biblio>> {
    const itemsWithSource =
      items?.map((item) => ({
        ...item,
        sourceId,
      })) ?? undefined;

    const response = await this.client.post<ImportResult<Biblio>>('/z3950/import', {
      biblioId,
      items: itemsWithSource,
      sourceId,
      ...(options?.confirmReplaceExistingId != null && {
        confirmReplaceExistingId: options.confirmReplaceExistingId,
      }),
    });
    return response.data;
  }

  // ─── MARC / UNIMARC ──────────────────────────────────────────────

  async uploadUnimarc(file: File, sourceId?: string | number | null): Promise<EnqueueResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<EnqueueResult>('/biblios/load-marc', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: sourceId != null ? { sourceId } : undefined,
    });
    return response.data;
  }

  async listMarcBatches(): Promise<MarcBatchInfo[]> {
    const response = await this.client.get<MarcBatchInfo[]>('/biblios/list-marc-batches');
    return response.data;
  }

  async loadMarcBatch(batchId: string): Promise<EnqueueResult> {
    const response = await this.client.get<EnqueueResult>(`/biblios/marc-batch/${batchId}`);
    return response.data;
  }

  async importMarcBatch(
    batchId: string,
    sourceId?: string | number | null,
  ): Promise<TaskStartResponse> {
    const params: Record<string, unknown> = { batchId };
    if (sourceId != null) params.sourceId = sourceId;

    const response = await this.client.post<TaskStartResponse>('/biblios/import-marc-batch', null, {
      params,
    });
    return response.data;
  }

  // ─── Export ──────────────────────────────────────────────────────

  async exportBibliosCsv(params?: {
    title?: string;
    author?: string;
    isbn?: string;
    mediaType?: MediaType;
  }): Promise<Blob> {
    const response = await this.client.get('/biblios/export.csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // ─── Cover images (proxy) ────────────────────────────────────────

  getCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'M'): string {
    return `${API_BASE_URL}/covers/isbn/${isbn}?size=${size}`;
  }

  // ─── OPAC (public unauthenticated) ───────────────────────────────

  async getOPACBiblios(params?: {
    freesearch?: string;
    title?: string;
    author?: string;
    isbn?: string;
    mediaType?: MediaType;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<BiblioShort>> {
    const response = await this.client.get('/opac/biblios', {
      params,
    });
    return normalizePaginatedResponse<BiblioShort>(response.data);
  }

  async getOPACBiblio(id: string): Promise<Biblio> {
    const response = await this.client.get<Biblio>(`/opac/biblios/${id}`);
    return response.data;
  }

  async getOPACAvailability(biblioId: string): Promise<OPACAvailability> {
    const response = await this.client.get<OPACAvailability>(
      `/opac/biblios/${biblioId}/availability`
    );
    return response.data;
  }

  // ─── Admin: dynamic server config ────────────────────────────────

  async getAdminConfig(): Promise<AdminConfigResponse> {
    const response = await this.client.get<AdminConfigResponse>('/admin/config');
    return response.data;
  }

  async putAdminConfigSection(
    section: AdminConfigSectionKey,
    value: Record<string, unknown>
  ): Promise<ConfigSectionInfo> {
    const response = await this.client.put<ConfigSectionInfo>(`/admin/config/${section}`, {
      value,
    });
    return response.data;
  }

  async deleteAdminConfigSection(section: AdminConfigSectionKey): Promise<ConfigSectionInfo> {
    const response = await this.client.delete<ConfigSectionInfo>(`/admin/config/${section}`);
    return response.data;
  }

  async postAdminEmailTest(to: string): Promise<void> {
    await this.client.post('/admin/config/email/test', { to });
  }

  async postAdminReindexSearch(): Promise<ReindexSearchResponse> {
    const response = await this.client.post<ReindexSearchResponse>('/admin/reindex-search');
    return response.data;
  }

  async postMaintenance(actions: MaintenanceAction[]): Promise<TaskStartResponse> {
    const response = await this.client.post<TaskStartResponse>('/maintenance', { actions });
    return response.data;
  }

  // ─── Background tasks ────────────────────────────────────────────

  async getTask(id: string): Promise<BackgroundTask> {
    const response = await this.client.get<BackgroundTask>(`/tasks/${id}`);
    return response.data;
  }

  async listTasks(): Promise<BackgroundTask[]> {
    const response = await this.client.get<BackgroundTask[]>('/tasks');
    return response.data;
  }

  // ─── Audit log ───────────────────────────────────────────────────

  async getAuditLog(params?: {
    eventType?: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    perPage?: number;
  }): Promise<AuditLogPage> {
    const response = await this.client.get<AuditLogPage>('/audit', { params });
    return response.data;
  }

  async exportAuditLog(params?: {
    format?: 'json' | 'csv';
    eventType?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Blob> {
    const response = await this.client.get('/audit/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // ─── Events ──────────────────────────────────────────────────────

  async getEvents(params?: {
    startDate?: string;
    endDate?: string;
    eventType?: number;
    page?: number;
    perPage?: number;
  }): Promise<EventsListResponse> {
    const response = await this.client.get<EventsListResponse>('/events', { params });
    return response.data;
  }

  async getEvent(id: string): Promise<Event> {
    const response = await this.client.get<Event>(`/events/${id}`);
    return response.data;
  }

  async createEvent(data: CreateEvent): Promise<Event> {
    const response = await this.client.post<Event>('/events', data);
    return response.data;
  }

  async updateEvent(id: string, data: UpdateEvent): Promise<Event> {
    const response = await this.client.put<Event>(`/events/${id}`, data);
    return response.data;
  }

  async deleteEvent(id: string): Promise<void> {
    await this.client.delete(`/events/${id}`);
  }

  async sendEventAnnouncement(id: string): Promise<void> {
    await this.client.post(`/events/${id}/send-announcement`, {});
  }

  // ─── Library info ─────────────────────────────────────────────────

  async getLibraryInfo(): Promise<LibraryInfo> {
    const response = await this.client.get<LibraryInfo>('/library-info');
    return response.data;
  }

  async updateLibraryInfo(data: UpdateLibraryInfoRequest): Promise<LibraryInfo> {
    const response = await this.client.put<LibraryInfo>('/library-info', data);
    return response.data;
  }

  // ─── Schedules — Periods ─────────────────────────────────────────

  async getSchedulePeriods(): Promise<SchedulePeriod[]> {
    const response = await this.client.get('/schedules/periods');
    const data = response.data;
    if (Array.isArray(data)) return data;
    return normalizePaginatedResponse<SchedulePeriod>(data).items;
  }

  async createSchedulePeriod(data: CreateSchedulePeriod): Promise<SchedulePeriod> {
    const response = await this.client.post<SchedulePeriod>('/schedules/periods', data);
    return response.data;
  }

  async updateSchedulePeriod(id: string, data: UpdateSchedulePeriod): Promise<SchedulePeriod> {
    const response = await this.client.put<SchedulePeriod>(`/schedules/periods/${id}`, data);
    return response.data;
  }

  async deleteSchedulePeriod(id: string): Promise<void> {
    await this.client.delete(`/schedules/periods/${id}`);
  }

  // ─── Schedules — Slots ───────────────────────────────────────────

  async getScheduleSlots(periodId: string): Promise<ScheduleSlot[]> {
    const response = await this.client.get(`/schedules/periods/${periodId}/slots`);
    const data = response.data;
    if (Array.isArray(data)) return data;
    return normalizePaginatedResponse<ScheduleSlot>(data).items;
  }

  async createScheduleSlot(periodId: string, data: CreateScheduleSlot): Promise<ScheduleSlot> {
    const response = await this.client.post<ScheduleSlot>(
      `/schedules/periods/${periodId}/slots`,
      data
    );
    return response.data;
  }

  async deleteScheduleSlot(id: string): Promise<void> {
    await this.client.delete(`/schedules/slots/${id}`);
  }

  // ─── Schedules — Closures ────────────────────────────────────────

  async getScheduleClosures(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<ScheduleClosure[]> {
    const response = await this.client.get('/schedules/closures', { params });
    const data = response.data;
    if (Array.isArray(data)) return data;
    return normalizePaginatedResponse<ScheduleClosure>(data).items;
  }

  async createScheduleClosure(data: CreateScheduleClosure): Promise<ScheduleClosure> {
    const response = await this.client.post<ScheduleClosure>('/schedules/closures', data);
    return response.data;
  }

  async deleteScheduleClosure(id: string): Promise<void> {
    await this.client.delete(`/schedules/closures/${id}`);
  }

  // ─── Health ───────────────────────────────────────────────────────

  async getHealth(): Promise<{ version?: string; [key: string]: unknown }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
export default api;
