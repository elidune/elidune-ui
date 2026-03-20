import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  User,
  UserShort,
  Item,
  ItemShort,
  ImportResult,
  Loan,
  Stats,
  Settings,
  PaginatedResponse,
  ApiError,
  UpdateProfileRequest,
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
  Source,
  Specimen,
  CreateItemSpecimenInput,
  CreateSpecimen,
  UpdateSpecimen,
  EnqueueResult,
  MarcBatchImportReport,
  PublicType,
  PublicTypeLoanSettings,
  CreatePublicType,
  UpdatePublicType,
  UpsertLoanSettingRequest,
  AdminConfigSectionKey,
  ConfigSectionInfo,
  AdminConfigResponse,
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
} from '@/types';

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

    return true;
  }

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    this.token = localStorage.getItem('auth_token');

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Response interceptor for error handling
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

  // Auth
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Add device_id if available
    
    const deviceId = this.getDeviceId();
    console.log('Device ID:', deviceId);
    const loginData = deviceId ? { ...credentials, device_id: deviceId } : credentials;
    console.log('Login data:', loginData);
    const response = await this.client.post<LoginResponse>('/auth/login', loginData);
    const responseData = response.data;
    
    // Store device_id if provided in response (when 2FA is bypassed)
    if (responseData.device_id) {
      console.log('Storing device_id from login response:', responseData.device_id);
      this.setDeviceId(responseData.device_id);
      // Verify it was stored
      const stored = this.getDeviceId();
      console.log('Device ID stored in localStorage:', stored);
    }
    
    // Only set token if 2FA is not required
    if (!responseData.requires_2fa && responseData.token) {
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

  // 2FA Methods
  async setup2FA(data: Setup2FARequest): Promise<Setup2FAResponse> {
    const response = await this.client.post<Setup2FAResponse>('/auth/setup-2fa', data);
    return response.data;
  }

  async verify2FA(data: Verify2FARequest): Promise<Verify2FAResponse> {
    const response = await this.client.post<Verify2FAResponse>('/auth/verify-2fa', data);
    const responseData = response.data;
    this.setToken(responseData.token);
    // Note: device_id is not returned in verify2FA response, it's returned in login response
    return responseData;
  }

  async verifyRecovery(data: VerifyRecoveryRequest): Promise<Verify2FAResponse> {
    const response = await this.client.post<Verify2FAResponse>('/auth/verify-recovery', data);
    this.setToken(response.data.token);
    return response.data;
  }

  async disable2FA(): Promise<void> {
    await this.client.post('/auth/disable-2fa');
  }

  // Items
  async getItems(params?: {
    title?: string;
    author?: string;
    isbn?: string;
    media_type?: MediaType;
    audience_type?: number;
    freesearch?: string;
    page?: number;
    per_page?: number;
    archive?: boolean;
  }): Promise<PaginatedResponse<ItemShort>> {
    const response = await this.client.get<PaginatedResponse<ItemShort>>('/items', { params });
    return response.data;
  }

  async getItem(id: string, params?: { full_record?: boolean }): Promise<Item> {
    const response = await this.client.get<Item>(`/items/${id}`, { params });
    return response.data;
  }

  async createItem(
    payload: Omit<Partial<Item>, 'specimens'> & { specimens?: CreateItemSpecimenInput[] },
    options?: { allowDuplicateIsbn?: boolean; confirmReplaceExistingId?: string | null }
  ): Promise<ImportResult<Item>> {
    const params: Record<string, any> = {
      allow_duplicate_isbn: options?.allowDuplicateIsbn === true,
    };
    if (options?.confirmReplaceExistingId != null) {
      params.confirm_replace_existing_id = options.confirmReplaceExistingId;
    }
    const response = await this.client.post<ImportResult<Item>>('/items', payload, { params });
    return response.data;
  }

  async updateItem(id: string, item: Partial<Item>): Promise<Item> {
    const response = await this.client.put<Item>(`/items/${id}`, item);
    return response.data;
  }

  async deleteItem(id: string, force = false): Promise<void> {
    await this.client.delete(`/items/${id}`, { params: { force } });
  }

  async updateSpecimen(itemId: string, specimenId: string, data: UpdateSpecimen): Promise<Specimen> {


    const response = await this.client.put<Specimen>(`/items/${itemId}/specimens`, {
      id: specimenId,
      ...data,
    });
    return response.data;
  }

  async deleteSpecimen(itemId: string, specimenId: string, force = false): Promise<void> {
    await this.client.delete(`/items/${itemId}/specimens/${specimenId}`, { params: { force } });
  }

  async createSpecimen(itemId: string, data: CreateSpecimen): Promise<Specimen> {
    const response = await this.client.post<Specimen>(`/items/${itemId}/specimens`, data);
    return response.data;
  }

  // Users
  async getUsers(params?: {
    name?: string;
    barcode?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<UserShort>> {
    const response = await this.client.get<PaginatedResponse<UserShort>>('/users', { params });
    return response.data;
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

  // Loans
  async getUserLoans(
    userId: string,
    options?: { archived?: boolean }
  ): Promise<Loan[]> {
    const response = await this.client.get<Loan[]>(`/users/${userId}/loans`, {
      params: {
        archived: options?.archived,
      },
    });
    return response.data;
  }

  async createLoan(data: {
    user_id: string;
    specimen_id?: string;
    specimen_identification?: string;
    force?: boolean;
  }): Promise<{ id: string; issue_at: string; message: string }> {
    const response = await this.client.post('/loans', data);
    return response.data;
  }

  async returnLoan(loanId: string): Promise<{ status: string; loan: Loan }> {
    const response = await this.client.post(`/loans/${loanId}/return`);
    return response.data;
  }

  async renewLoan(loanId: string): Promise<{ id: string; issue_at: string; message: string }> {
    const response = await this.client.post(`/loans/${loanId}/renew`);
    return response.data;
  }

  async returnLoanByBarcode(specimenBarcode: string): Promise<{ status: string; loan: Loan }> {
    const response = await this.client.post(`/loans/specimens/${specimenBarcode}/return`);
    return response.data;
  }

  // Stats
  async getStats(params?: {
    year?: number;
    media_type?: MediaType;
    public_type?: string;
  }): Promise<Stats> {
    const response = await this.client.get<Stats>('/stats', { params });
    return response.data;
  }

  // Aggregate user stats (new registrations, active borrowers)
  async getUserAggregateStats(params: {
    start_date?: string;
    end_date?: string;
  }): Promise<UserAggregateStats> {
    const response = await this.client.get<UserAggregateStats>('/stats/users', {
      params: { ...params, mode: 'aggregate' },
    });
    return response.data;
  }

  async getUserLoanStats(params?: {
    sort_by?: 'total_loans' | 'active_loans' | 'overdue_loans';
    limit?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<UserLoanStats[]> {
    const response = await this.client.get('/stats/users', { params });
    const data = response.data;
    // Handle both array and object-wrapped responses
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
    start_date?: string;
    end_date?: string;
    by_source?: boolean;
    by_media_type?: boolean;
    by_public_type?: boolean;
  }): Promise<CatalogStats> {
    const response = await this.client.get<CatalogStats>('/stats/catalog', { params });
    return response.data;
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const response = await this.client.get<Settings>('/settings');
    return response.data;
  }

  async updateSettings(settings: Partial<Settings>): Promise<Settings> {
    const response = await this.client.put<Settings>('/settings', settings);
    return response.data;
  }

  // Public types
  async getPublicTypes(): Promise<PublicType[]> {
    const response = await this.client.get<PublicType[]>('/public-types');
    return response.data;
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

  async deletePublicTypeLoanSetting(
    publicTypeId: string,
    mediaType: MediaType
  ): Promise<void> {
    await this.client.delete(`/public-types/${publicTypeId}/loan-settings/${mediaType}`);
  }

  // Sources
  async getSources(includeArchived = false): Promise<Source[]> {
    const response = await this.client.get<Source[]>('/sources', {
      params: { include_archived: includeArchived },
    });
    return response.data;
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
      source_ids: sourceIds,
      name,
    });
    return response.data;
  }

  // Z39.50 Search
  async searchZ3950(params: {
    isbn?: string;
    title?: string;
    author?: string;
    server_id?: string;
    max_results?: number;
  }): Promise<{ total: number; items: ItemShort[]; source: string }> {
    // Build CQL query from parameters
    const cqlParts: string[] = [];
    
    if (params.isbn) {
      // Exact match for ISBN
      cqlParts.push(`isbn="${params.isbn.trim()}"`);
    }
    if (params.title) {
      // Use "all" for text search to match all words in title
      cqlParts.push(`title = "${params.title.trim()}"`);
    }
    if (params.author) {
      // Use "all" for text search to match all words in author name
      cqlParts.push(`author = "${params.author.trim()}"`);
    }
    
    const cqlQuery = cqlParts.length > 0 ? cqlParts.join(' AND ') : '';
    
    // Send CQL query along with server_id and max_results
    const requestParams: Record<string, any> = {
      query: cqlQuery,
      server_id: params.server_id,
      max_results: params.max_results,
    };
    
    const response = await this.client.get('/z3950/search', { params: requestParams });
    return response.data;
  }

  async importZ3950(
    itemId: string,
    specimens?: { barcode: string; call_number?: string }[],
    sourceId?: string,
    options?: { confirmReplaceExistingId?: string | null }
  ): Promise<ImportResult<Item>> {
    const specimensWithSource =
      specimens?.map((specimen) => ({
        ...specimen,
        source_id: sourceId,
      })) ?? undefined;

    const response = await this.client.post<ImportResult<Item>>('/z3950/import', {
      item_id: itemId,
      specimens: specimensWithSource,
      source_id: sourceId,
      ...(options?.confirmReplaceExistingId != null && {
        confirm_replace_existing_id: options.confirmReplaceExistingId,
      }),
    });
    return response.data;
  }

  // MARC UNIMARC load (server-side parsing, batch preview). source_id optional for load; required for import.
  async uploadUnimarc(file: File, sourceId?: string | number | null): Promise<EnqueueResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<EnqueueResult>('/items/load-marc', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: sourceId != null ? { source_id: sourceId } : undefined,
    });

    return response.data;
  }

  // Import one or all records from an UNIMARC batch
  async importMarcBatch(
    batchId: string,
    recordId?: number,
    sourceId?: string | number | null,
    options?: { allowDuplicateIsbn?: boolean; confirmReplaceExistingId?: string | null }
  ): Promise<MarcBatchImportReport> {
    const params: Record<string, any> = { batch_id: batchId };
    if (recordId != null) {
      params.record_id = recordId;
    }
    if (sourceId != null) {
      params.source_id = sourceId;
    }
    if (options?.allowDuplicateIsbn === true) {
      params.allow_duplicate_isbn = true;
    }
    if (options?.confirmReplaceExistingId != null) {
      params.confirm_replace_existing_id = options.confirmReplaceExistingId;
    }

    const response = await this.client.post<MarcBatchImportReport>(
      '/items/import-marc',
      null,
      { params }
    );
    return response.data;
  }

  // Admin: dynamic server config (runtime overrides)
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

  async getAuditLog(params?: {
    event_type?: string;
    entity_type?: string;
    entity_id?: number;
    user_id?: number;
    from_date?: string;
    to_date?: string;
    page?: number;
    per_page?: number;
  }): Promise<AuditLogPage> {
    const response = await this.client.get<AuditLogPage>('/audit', { params });
    return response.data;
  }

  async exportAuditLog(params?: {
    format?: 'json' | 'csv';
    event_type?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<Blob> {
    const response = await this.client.get('/audit/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  async getOverdueLoans(params?: { page?: number; per_page?: number }): Promise<OverdueLoansPage> {
    const response = await this.client.get<OverdueLoansPage>('/loans/overdue', { params });
    return response.data;
  }

  async sendOverdueReminders(options?: { dry_run?: boolean }): Promise<ReminderReport> {
    const response = await this.client.post<ReminderReport>(
      '/loans/send-overdue-reminders',
      {},
      { params: { dry_run: options?.dry_run === true } }
    );
    return response.data;
  }

  // Events
  async getEvents(params?: {
    start_date?: string;
    end_date?: string;
    event_type?: number;
    page?: number;
    per_page?: number;
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

  // Library info
  async getLibraryInfo(): Promise<LibraryInfo> {
    const response = await this.client.get<LibraryInfo>('/library-info');
    return response.data;
  }

  async updateLibraryInfo(data: UpdateLibraryInfoRequest): Promise<LibraryInfo> {
    const response = await this.client.put<LibraryInfo>('/library-info', data);
    return response.data;
  }

  // Schedules — Periods
  async getSchedulePeriods(): Promise<SchedulePeriod[]> {
    const response = await this.client.get<SchedulePeriod[]>('/schedules/periods');
    return response.data;
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

  // Schedules — Slots
  async getScheduleSlots(periodId: string): Promise<ScheduleSlot[]> {
    const response = await this.client.get<ScheduleSlot[]>(`/schedules/periods/${periodId}/slots`);
    return response.data;
  }

  async createScheduleSlot(periodId: string, data: CreateScheduleSlot): Promise<ScheduleSlot> {
    const response = await this.client.post<ScheduleSlot>(`/schedules/periods/${periodId}/slots`, data);
    return response.data;
  }

  async deleteScheduleSlot(id: string): Promise<void> {
    await this.client.delete(`/schedules/slots/${id}`);
  }

  // Schedules — Closures
  async getScheduleClosures(params?: { start_date?: string; end_date?: string }): Promise<ScheduleClosure[]> {
    const response = await this.client.get<ScheduleClosure[]>('/schedules/closures', { params });
    return response.data;
  }

  async createScheduleClosure(data: CreateScheduleClosure): Promise<ScheduleClosure> {
    const response = await this.client.post<ScheduleClosure>('/schedules/closures', data);
    return response.data;
  }

  async deleteScheduleClosure(id: string): Promise<void> {
    await this.client.delete(`/schedules/closures/${id}`);
  }

  // Health
  async getHealth(): Promise<{ version?: string; [key: string]: unknown }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
export default api;


