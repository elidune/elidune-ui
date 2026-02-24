import axios, { AxiosError, AxiosInstance } from 'axios';
import type { 
  LoginRequest, 
  LoginResponse, 
  User, 
  UserShort,
  Item, 
  ItemShort, 
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
} from '@/types';

const API_BASE_URL = '/api/v1';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

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
        if (error.response?.status === 401) {
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
    identification?: string;
    media_type?: MediaType;
    public_type?: number;
    freesearch?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<ItemShort>> {
    const response = await this.client.get<PaginatedResponse<ItemShort>>('/items', { params });
    return response.data;
  }

  async getItem(id: number): Promise<Item> {
    const response = await this.client.get<Item>(`/items/${id}`);
    return response.data;
  }

  async createItem(item: Partial<Item>): Promise<Item> {
    const response = await this.client.post<Item>('/items', item);
    return response.data;
  }

  async updateItem(id: number, item: Partial<Item>): Promise<Item> {
    const response = await this.client.put<Item>(`/items/${id}`, item);
    return response.data;
  }

  async deleteItem(id: number, force = false): Promise<void> {
    await this.client.delete(`/items/${id}`, { params: { force } });
  }

  async updateSpecimen(itemId: number, specimenId: number, data: Partial<Specimen>): Promise<Specimen> {
    const response = await this.client.put<Specimen>(`/items/${itemId}/specimens/${specimenId}`, data);
    return response.data;
  }

  async deleteSpecimen(itemId: number, specimenId: number): Promise<void> {
    await this.client.delete(`/items/${itemId}/specimens/${specimenId}`);
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

  async getUser(id: number): Promise<User> {
    const response = await this.client.get<User>(`/users/${id}`);
    return response.data;
  }

  async createUser(user: Partial<User> & { password?: string }): Promise<User> {
    const response = await this.client.post<User>('/users', user);
    return response.data;
  }

  async updateUser(id: number, user: Partial<User> & { password?: string }): Promise<User> {
    const response = await this.client.put<User>(`/users/${id}`, user);
    return response.data;
  }

  async deleteUser(id: number, force = false): Promise<void> {
    await this.client.delete(`/users/${id}`, { params: { force } });
  }

  // Loans
  async getUserLoans(userId: number): Promise<Loan[]> {
    const response = await this.client.get<Loan[]>(`/users/${userId}/loans`);
    return response.data;
  }

  async createLoan(data: {
    user_id: number;
    specimen_id?: number;
    specimen_identification?: string;
    force?: boolean;
  }): Promise<{ id: number; issue_date: string; message: string }> {
    const response = await this.client.post('/loans', data);
    return response.data;
  }

  async returnLoan(loanId: number): Promise<{ status: string; loan: Loan }> {
    const response = await this.client.post(`/loans/${loanId}/return`);
    return response.data;
  }

  async renewLoan(loanId: number): Promise<{ id: number; issue_date: string; message: string }> {
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
    public_type?: number;
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

  // Sources
  async getSources(includeArchived = false): Promise<Source[]> {
    const response = await this.client.get<Source[]>('/sources', {
      params: { include_archived: includeArchived },
    });
    return response.data;
  }

  async updateSource(id: number, data: Partial<Source>): Promise<Source> {
    const response = await this.client.put<Source>(`/sources/${id}`, data);
    return response.data;
  }

  async renameSource(id: number, name: string): Promise<Source> {
    return this.updateSource(id, { name });
  }

  async archiveSource(id: number): Promise<Source> {
    const response = await this.client.post<Source>(`/sources/${id}/archive`);
    return response.data;
  }

  async mergeSources(sourceIds: number[], name: string): Promise<Source> {
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
    server_id?: number;
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

  async importZ3950(remoteItemId: number, specimens?: { identification: string; call_number?: string }[], sourceId?: number): Promise<Item> {
    const response = await this.client.post<Item>('/z3950/import', {
      remote_item_id: remoteItemId,
      specimens,
      source_id: sourceId,
    });
    return response.data;
  }
}

export const api = new ApiService();
export default api;


