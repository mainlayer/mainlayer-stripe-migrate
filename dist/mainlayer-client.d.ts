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
export declare class MainlayerApiError extends Error {
    readonly statusCode: number;
    readonly body: unknown;
    constructor(message: string, statusCode: number, body: unknown);
}
export declare class MainlayerClient {
    private readonly baseUrl;
    private readonly apiKey;
    constructor(apiKey: string, baseUrl?: string);
    private request;
    /**
     * Create a resource (maps from Stripe Product).
     */
    createResource(resource: MainlayerResource): Promise<MainlayerResourceResponse>;
    /**
     * List all resources in the account.
     */
    listResources(): Promise<MainlayerResourceResponse[]>;
    /**
     * Create a plan under a resource (maps from Stripe Price).
     */
    createPlan(plan: MainlayerPlan): Promise<MainlayerPlanResponse>;
    /**
     * List all plans for a resource.
     */
    listPlansForResource(resourceId: string): Promise<MainlayerPlanResponse[]>;
    /**
     * Verify the Mainlayer API key is valid.
     */
    verifyKey(): Promise<{
        valid: boolean;
        accountId?: string;
        error?: string;
    }>;
    /**
     * Get a summary of migrated content.
     */
    getMigrationStatus(): Promise<MainlayerMigrationStatus>;
}
//# sourceMappingURL=mainlayer-client.d.ts.map