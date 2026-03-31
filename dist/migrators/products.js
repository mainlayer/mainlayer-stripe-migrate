"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductMigrator = void 0;
exports.slugify = slugify;
exports.resolveFeeModel = resolveFeeModel;
exports.centsToUsd = centsToUsd;
exports.selectPrimaryPrice = selectPrimaryPrice;
exports.buildResourcePayload = buildResourcePayload;
/**
 * Convert a string into a URL-safe slug.
 * e.g. "My SaaS Product!" → "my-saas-product"
 */
function slugify(name) {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
/**
 * Determine the fee model from a Stripe Price.
 */
function resolveFeeModel(price) {
    return price.recurring ? 'subscription' : 'one_time';
}
/**
 * Convert a Stripe Price's unit_amount (cents) to USD dollars.
 * Returns 0 when unit_amount is null (free or custom pricing).
 */
function centsToUsd(unitAmount) {
    if (unitAmount === null || unitAmount === 0)
        return 0;
    return unitAmount / 100;
}
/**
 * Select the "primary" price for a product to use when building the
 * top-level Resource.  Prefers the first active subscription price,
 * falling back to the first one-time price, then the first price overall.
 */
function selectPrimaryPrice(prices) {
    const subscriptionPrice = prices.find((p) => p.recurring !== null);
    if (subscriptionPrice)
        return subscriptionPrice;
    const oneTimePrice = prices.find((p) => p.recurring === null);
    if (oneTimePrice)
        return oneTimePrice;
    return prices[0];
}
/**
 * Build a MainlayerResource payload from a Stripe Product + its primary price.
 */
function buildResourcePayload(product, primaryPrice) {
    const priceUsd = primaryPrice ? centsToUsd(primaryPrice.unit_amount) : 0;
    const feeModel = primaryPrice ? resolveFeeModel(primaryPrice) : 'one_time';
    return {
        slug: slugify(product.name),
        name: product.name,
        description: product.description ?? undefined,
        price_usd: priceUsd,
        fee_model: feeModel,
        metadata: {
            stripe_product_id: product.id,
            ...product.metadata,
        },
    };
}
class ProductMigrator {
    constructor(stripe, mainlayer, options = {}) {
        this.stripe = stripe;
        this.mainlayer = mainlayer;
        this.options = options;
    }
    /**
     * Migrate all Stripe Products (and their Prices) to Mainlayer Resources and Plans.
     * Returns one MigrationResult per product, with child results per price.
     */
    async migrate() {
        const { dryRun = false, activeOnly = true } = this.options;
        const products = await this.stripe.listProducts(activeOnly);
        const results = [];
        for (const product of products) {
            const result = await this.migrateProduct(product, dryRun);
            results.push(result);
        }
        return results;
    }
    async migrateProduct(product, dryRun) {
        const prices = await this.stripe.listPricesForProduct(product.id);
        const primaryPrice = selectPrimaryPrice(prices);
        const resourcePayload = buildResourcePayload(product, primaryPrice);
        let mainlayerResourceId;
        let mainlayerSlug;
        if (dryRun) {
            mainlayerSlug = resourcePayload.slug;
            const childResults = prices.map((price) => this.buildDryRunPriceResult(price, product));
            return {
                stripeId: product.id,
                stripeName: product.name,
                mainlayerSlug,
                status: 'success',
                childResults,
            };
        }
        try {
            const resource = await this.mainlayer.createResource(resourcePayload);
            mainlayerResourceId = resource.id;
            mainlayerSlug = resource.slug;
        }
        catch (err) {
            return {
                stripeId: product.id,
                stripeName: product.name,
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
                childResults: prices.map((price) => ({
                    stripeId: price.id,
                    stripeName: price.nickname ?? price.id,
                    status: 'skipped',
                    error: 'Parent product migration failed',
                })),
            };
        }
        const childResults = await this.migratePrices(prices, mainlayerResourceId, product.name);
        return {
            stripeId: product.id,
            stripeName: product.name,
            mainlayerId: mainlayerResourceId,
            mainlayerSlug,
            status: 'success',
            childResults,
        };
    }
    async migratePrices(prices, resourceId, productName) {
        const results = [];
        for (const price of prices) {
            try {
                const plan = await this.mainlayer.createPlan({
                    resource_id: resourceId,
                    name: price.nickname ?? `${productName} — ${price.id}`,
                    price_usd: centsToUsd(price.unit_amount),
                    billing_interval: price.recurring?.interval,
                    billing_interval_count: price.recurring?.interval_count,
                    metadata: {
                        stripe_price_id: price.id,
                        stripe_product_id: price.product,
                        ...price.metadata,
                    },
                });
                results.push({
                    stripeId: price.id,
                    stripeName: price.nickname ?? price.id,
                    mainlayerId: plan.id,
                    status: 'success',
                });
            }
            catch (err) {
                results.push({
                    stripeId: price.id,
                    stripeName: price.nickname ?? price.id,
                    status: 'failed',
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return results;
    }
    buildDryRunPriceResult(price, product) {
        return {
            stripeId: price.id,
            stripeName: price.nickname ?? `${product.name} — ${price.id}`,
            mainlayerSlug: undefined,
            status: 'success',
        };
    }
}
exports.ProductMigrator = ProductMigrator;
//# sourceMappingURL=products.js.map