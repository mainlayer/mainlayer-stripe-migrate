export interface StripeProduct {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    metadata: Record<string, string>;
    created: number;
}
export interface StripePrice {
    id: string;
    product: string;
    unit_amount: number | null;
    currency: string;
    recurring: {
        interval: 'day' | 'week' | 'month' | 'year';
        interval_count: number;
    } | null;
    active: boolean;
    nickname: string | null;
    metadata: Record<string, string>;
}
export interface StripeCustomer {
    id: string;
    email: string | null;
    name: string | null;
    metadata: Record<string, string>;
    created: number;
}
export declare class StripeClient {
    private client;
    constructor(apiKey: string);
    /**
     * Fetch all active products from Stripe with pagination.
     */
    listProducts(activeOnly?: boolean): Promise<StripeProduct[]>;
    /**
     * Fetch all prices for a given product ID.
     */
    listPricesForProduct(productId: string, activeOnly?: boolean): Promise<StripePrice[]>;
    /**
     * Fetch all active customers from Stripe with pagination.
     */
    listCustomers(): Promise<StripeCustomer[]>;
    /**
     * Verify the Stripe API key is valid by fetching account info.
     */
    verifyKey(): Promise<{
        valid: boolean;
        accountId?: string;
        error?: string;
    }>;
}
//# sourceMappingURL=stripe-client.d.ts.map