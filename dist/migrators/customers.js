"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerMigrator = void 0;
exports.serializeCustomerExports = serializeCustomerExports;
exports.customerExportsToCsv = customerExportsToCsv;
/**
 * CustomerMigrator exports Stripe customers as a structured mapping.
 *
 * Mainlayer identifies agents/users by API key, not by a customer record.
 * This migrator provides a best-effort export so you can map Stripe customer
 * IDs to Mainlayer-provisioned API keys manually or via your own identity layer.
 */
class CustomerMigrator {
    constructor(stripe, options = {}) {
        this.stripe = stripe;
        this.options = options;
    }
    /**
     * Export all Stripe customers as a CustomerExport array.
     * Each export is reflected in MigrationResults for the report.
     */
    async migrate() {
        const customers = await this.stripe.listCustomers();
        const results = [];
        const exports = [];
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
    exportCustomer(customer) {
        return {
            stripeCustomerId: customer.id,
            email: customer.email,
            name: customer.name,
            createdAt: new Date(customer.created * 1000).toISOString(),
            metadata: customer.metadata,
        };
    }
}
exports.CustomerMigrator = CustomerMigrator;
/**
 * Serialize a customer export list to JSON.
 */
function serializeCustomerExports(exports) {
    return JSON.stringify(exports, null, 2);
}
/**
 * Return a CSV string of customer exports for spreadsheet-friendly use.
 */
function customerExportsToCsv(exports) {
    const header = 'stripe_customer_id,email,name,created_at';
    const rows = exports.map((e) => {
        const escape = (v) => v === null ? '' : `"${v.replace(/"/g, '""')}"`;
        return [
            escape(e.stripeCustomerId),
            escape(e.email),
            escape(e.name),
            escape(e.createdAt),
        ].join(',');
    });
    return [header, ...rows].join('\n');
}
//# sourceMappingURL=customers.js.map