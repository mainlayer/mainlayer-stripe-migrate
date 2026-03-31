import { StripeClient, StripeProduct, StripePrice } from '../stripe-client';
import {
  MainlayerClient,
  MainlayerResource,
  FeeModel,
} from '../mainlayer-client';
import { MigrationResult } from '../report';

/**
 * Convert a string into a URL-safe slug.
 * e.g. "My SaaS Product!" → "my-saas-product"
 */
export function slugify(name: string): string {
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
export function resolveFeeModel(price: StripePrice): FeeModel {
  return price.recurring ? 'subscription' : 'one_time';
}

/**
 * Convert a Stripe Price's unit_amount (cents) to USD dollars.
 * Returns 0 when unit_amount is null (free or custom pricing).
 */
export function centsToUsd(unitAmount: number | null): number {
  if (unitAmount === null || unitAmount === 0) return 0;
  return unitAmount / 100;
}

/**
 * Select the "primary" price for a product to use when building the
 * top-level Resource.  Prefers the first active subscription price,
 * falling back to the first one-time price, then the first price overall.
 */
export function selectPrimaryPrice(prices: StripePrice[]): StripePrice | undefined {
  const subscriptionPrice = prices.find((p) => p.recurring !== null);
  if (subscriptionPrice) return subscriptionPrice;

  const oneTimePrice = prices.find((p) => p.recurring === null);
  if (oneTimePrice) return oneTimePrice;

  return prices[0];
}

/**
 * Build a MainlayerResource payload from a Stripe Product + its primary price.
 */
export function buildResourcePayload(
  product: StripeProduct,
  primaryPrice: StripePrice | undefined,
): MainlayerResource {
  const priceUsd = primaryPrice ? centsToUsd(primaryPrice.unit_amount) : 0;
  const feeModel: FeeModel = primaryPrice ? resolveFeeModel(primaryPrice) : 'one_time';

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

export interface ProductMigratorOptions {
  dryRun?: boolean;
  activeOnly?: boolean;
}

export class ProductMigrator {
  constructor(
    private readonly stripe: StripeClient,
    private readonly mainlayer: MainlayerClient,
    private readonly options: ProductMigratorOptions = {},
  ) {}

  /**
   * Migrate all Stripe Products (and their Prices) to Mainlayer Resources and Plans.
   * Returns one MigrationResult per product, with child results per price.
   */
  async migrate(): Promise<MigrationResult[]> {
    const { dryRun = false, activeOnly = true } = this.options;
    const products = await this.stripe.listProducts(activeOnly);
    const results: MigrationResult[] = [];

    for (const product of products) {
      const result = await this.migrateProduct(product, dryRun);
      results.push(result);
    }

    return results;
  }

  private async migrateProduct(product: StripeProduct, dryRun: boolean): Promise<MigrationResult> {
    const prices = await this.stripe.listPricesForProduct(product.id);
    const primaryPrice = selectPrimaryPrice(prices);
    const resourcePayload = buildResourcePayload(product, primaryPrice);

    let mainlayerResourceId: string | undefined;
    let mainlayerSlug: string | undefined;

    if (dryRun) {
      mainlayerSlug = resourcePayload.slug;
      const childResults = prices.map((price) =>
        this.buildDryRunPriceResult(price, product),
      );

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
    } catch (err: unknown) {
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

  private async migratePrices(
    prices: StripePrice[],
    resourceId: string,
    productName: string,
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = [];

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
      } catch (err: unknown) {
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

  private buildDryRunPriceResult(price: StripePrice, product: StripeProduct): MigrationResult {
    return {
      stripeId: price.id,
      stripeName: price.nickname ?? `${product.name} — ${price.id}`,
      mainlayerSlug: undefined,
      status: 'success',
    };
  }
}
