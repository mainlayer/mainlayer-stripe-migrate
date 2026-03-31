import { StripeClient, StripeProduct, StripePrice } from '../stripe-client';
import { MainlayerClient, MainlayerResource, FeeModel } from '../mainlayer-client';
import { MigrationResult } from '../report';
/**
 * Convert a string into a URL-safe slug.
 * e.g. "My SaaS Product!" → "my-saas-product"
 */
export declare function slugify(name: string): string;
/**
 * Determine the fee model from a Stripe Price.
 */
export declare function resolveFeeModel(price: StripePrice): FeeModel;
/**
 * Convert a Stripe Price's unit_amount (cents) to USD dollars.
 * Returns 0 when unit_amount is null (free or custom pricing).
 */
export declare function centsToUsd(unitAmount: number | null): number;
/**
 * Select the "primary" price for a product to use when building the
 * top-level Resource.  Prefers the first active subscription price,
 * falling back to the first one-time price, then the first price overall.
 */
export declare function selectPrimaryPrice(prices: StripePrice[]): StripePrice | undefined;
/**
 * Build a MainlayerResource payload from a Stripe Product + its primary price.
 */
export declare function buildResourcePayload(product: StripeProduct, primaryPrice: StripePrice | undefined): MainlayerResource;
export interface ProductMigratorOptions {
    dryRun?: boolean;
    activeOnly?: boolean;
}
export declare class ProductMigrator {
    private readonly stripe;
    private readonly mainlayer;
    private readonly options;
    constructor(stripe: StripeClient, mainlayer: MainlayerClient, options?: ProductMigratorOptions);
    /**
     * Migrate all Stripe Products (and their Prices) to Mainlayer Resources and Plans.
     * Returns one MigrationResult per product, with child results per price.
     */
    migrate(): Promise<MigrationResult[]>;
    private migrateProduct;
    private migratePrices;
    private buildDryRunPriceResult;
}
//# sourceMappingURL=products.d.ts.map