"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeClient = void 0;
const stripe_1 = __importDefault(require("stripe"));
class StripeClient {
    constructor(apiKey) {
        this.client = new stripe_1.default(apiKey, {
            apiVersion: '2023-10-16',
            appInfo: {
                name: 'mainlayer-stripe-migrate',
                version: '0.1.0',
            },
        });
    }
    /**
     * Fetch all active products from Stripe with pagination.
     */
    async listProducts(activeOnly = true) {
        const products = [];
        const params = {
            limit: 100,
        };
        if (activeOnly) {
            params.active = true;
        }
        for await (const product of this.client.products.list(params)) {
            products.push({
                id: product.id,
                name: product.name,
                description: product.description,
                active: product.active,
                metadata: product.metadata,
                created: product.created,
            });
        }
        return products;
    }
    /**
     * Fetch all prices for a given product ID.
     */
    async listPricesForProduct(productId, activeOnly = true) {
        const prices = [];
        const params = {
            product: productId,
            limit: 100,
        };
        if (activeOnly) {
            params.active = true;
        }
        for await (const price of this.client.prices.list(params)) {
            prices.push({
                id: price.id,
                product: typeof price.product === 'string' ? price.product : price.product.id,
                unit_amount: price.unit_amount,
                currency: price.currency,
                recurring: price.recurring
                    ? {
                        interval: price.recurring.interval,
                        interval_count: price.recurring.interval_count,
                    }
                    : null,
                active: price.active,
                nickname: price.nickname,
                metadata: price.metadata,
            });
        }
        return prices;
    }
    /**
     * Fetch all active customers from Stripe with pagination.
     */
    async listCustomers() {
        const customers = [];
        for await (const customer of this.client.customers.list({ limit: 100 })) {
            if (customer.deleted)
                continue;
            customers.push({
                id: customer.id,
                email: customer.email,
                name: customer.name ?? null,
                metadata: customer.metadata,
                created: customer.created,
            });
        }
        return customers;
    }
    /**
     * Verify the Stripe API key is valid by fetching account info.
     */
    async verifyKey() {
        try {
            const account = await this.client.accounts.retrieve();
            return { valid: true, accountId: account.id };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { valid: false, error: message };
        }
    }
}
exports.StripeClient = StripeClient;
//# sourceMappingURL=stripe-client.js.map