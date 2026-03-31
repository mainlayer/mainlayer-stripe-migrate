const BASE_URL = 'https://api.mainlayer.xyz';

export type FeeModel = 'subscription' | 'one_time' | 'usage';

export interface MainlayerResource {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  price_usd: number;
  fee_model: FeeModel;
  metadata?: Record<string, string>;
}

export interface MainlayerResourceResponse {
  id: string;
  slug: string;
  name: string;
  description?: string;
  price_usd: number;
  fee_model: FeeModel;
  metadata?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface MainlayerPlan {
  id?: string;
  resource_id: string;
  name: string;
  price_usd: number;
  billing_interval?: 'day' | 'week' | 'month' | 'year';
  billing_interval_count?: number;
  metadata?: Record<string, string>;
}

export interface MainlayerPlanResponse {
  id: string;
  resource_id: string;
  name: string;
  price_usd: number;
  billing_interval?: string;
  billing_interval_count?: number;
  metadata?: Record<string, string>;
  created_at: string;
}

export interface MainlayerMigrationStatus {
  resources: MainlayerResourceResponse[];
  total_resources: number;
}

export class MainlayerApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'MainlayerApiError';
  }
}

export class MainlayerClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, baseUrl: string = BASE_URL) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'mainlayer-stripe-migrate/0.1.0',
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      throw new MainlayerApiError(
        `Mainlayer API error: ${response.status} ${response.statusText}`,
        response.status,
        responseBody,
      );
    }

    return responseBody as T;
  }

  /**
   * Create a resource (maps from Stripe Product).
   */
  async createResource(resource: MainlayerResource): Promise<MainlayerResourceResponse> {
    return this.request<MainlayerResourceResponse>('POST', '/v1/resources', resource);
  }

  /**
   * List all resources in the account.
   */
  async listResources(): Promise<MainlayerResourceResponse[]> {
    const response = await this.request<{ data: MainlayerResourceResponse[] }>(
      'GET',
      '/v1/resources',
    );
    return response.data;
  }

  /**
   * Create a plan under a resource (maps from Stripe Price).
   */
  async createPlan(plan: MainlayerPlan): Promise<MainlayerPlanResponse> {
    return this.request<MainlayerPlanResponse>('POST', '/v1/plans', plan);
  }

  /**
   * List all plans for a resource.
   */
  async listPlansForResource(resourceId: string): Promise<MainlayerPlanResponse[]> {
    const response = await this.request<{ data: MainlayerPlanResponse[] }>(
      'GET',
      `/v1/resources/${resourceId}/plans`,
    );
    return response.data;
  }

  /**
   * Verify the Mainlayer API key is valid.
   */
  async verifyKey(): Promise<{ valid: boolean; accountId?: string; error?: string }> {
    try {
      const response = await this.request<{ id: string }>('GET', '/v1/account');
      return { valid: true, accountId: response.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, error: message };
    }
  }

  /**
   * Get a summary of migrated content.
   */
  async getMigrationStatus(): Promise<MainlayerMigrationStatus> {
    const resources = await this.listResources();
    return {
      resources,
      total_resources: resources.length,
    };
  }
}
