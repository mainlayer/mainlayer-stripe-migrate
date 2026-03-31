import { StripeClient, StripeCustomer } from '../stripe-client';
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
export class CustomerMigrator {
  constructor(
    private readonly stripe: StripeClient,
    private readonly options: CustomerMigratorOptions = {},
  ) {}

  /**
   * Export all Stripe customers as a CustomerExport array.
   * Each export is reflected in MigrationResults for the report.
   */
  async migrate(): Promise<{
    results: MigrationResult[];
    exports: CustomerExport[];
  }> {
    const customers = await this.stripe.listCustomers();
    const results: MigrationResult[] = [];
    const exports: CustomerExport[] = [];

    for (const customer of customers) {
      const exported = this.exportCustomer(customer);
      exports.push(exported);

      results.push({
        stripeId: customer.id,
        stripeName: customer.name ?? customer.email ?? customer.id,
        status: 'success',
      });
    }

    return { results, exports };
  }

  private exportCustomer(customer: StripeCustomer): CustomerExport {
    return {
      stripeCustomerId: customer.id,
      email: customer.email,
      name: customer.name,
      createdAt: new Date(customer.created * 1000).toISOString(),
      metadata: customer.metadata,
    };
  }
}

/**
 * Serialize a customer export list to JSON.
 */
export function serializeCustomerExports(exports: CustomerExport[]): string {
  return JSON.stringify(exports, null, 2);
}

/**
 * Return a CSV string of customer exports for spreadsheet-friendly use.
 */
export function customerExportsToCsv(exports: CustomerExport[]): string {
  const header = 'stripe_customer_id,email,name,created_at';
  const rows = exports.map((e) => {
    const escape = (v: string | null): string =>
      v === null ? '' : `"${v.replace(/"/g, '""')}"`;
    return [
      escape(e.stripeCustomerId),
      escape(e.email),
      escape(e.name),
      escape(e.createdAt),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
