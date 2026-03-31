import { StripeClient } from '../stripe-client';
import { MigrationResult } from '../report';
export interface CustomerExport {
    stripeCustomerId: string;
    email: string | null;
    name: string | null;
    createdAt: string;
    metadata: Record<string, string>;
}
export interface CustomerMigratorOptions {
    dryRun?: boolean;
}
/**
 * CustomerMigrator exports Stripe customers as a structured mapping.
 *
 * Mainlayer identifies agents/users by API key, not by a customer record.
 * This migrator provides a best-effort export so you can map Stripe customer
 * IDs to Mainlayer-provisioned API keys manually or via your own identity layer.
 */
export declare class CustomerMigrator {
    private readonly stripe;
    private readonly options;
    constructor(stripe: StripeClient, options?: CustomerMigratorOptions);
    /**
     * Export all Stripe customers as a CustomerExport array.
     * Each export is reflected in MigrationResults for the report.
     */
    migrate(): Promise<{
        results: MigrationResult[];
        exports: CustomerExport[];
    }>;
    private exportCustomer;
}
/**
 * Serialize a customer export list to JSON.
 */
export declare function serializeCustomerExports(exports: CustomerExport[]): string;
/**
 * Return a CSV string of customer exports for spreadsheet-friendly use.
 */
export declare function customerExportsToCsv(exports: CustomerExport[]): string;
//# sourceMappingURL=customers.d.ts.map