import Stripe from 'stripe';

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

export class StripeClient {
  private client: Stripe;

  constructor(apiKey: string) {
    this.client = new Stripe(apiKey, {
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
  async listProducts(activeOnly = true): Promise<StripeProduct[]> {
    const products: StripeProduct[] = [];
    const params: Stripe.ProductListParams = {
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
        metadata: product.metadata as Record<string, string>,
        created: product.created,
      });
    }

    return products;
  }

  /**
   * Fetch all prices for a given product ID.
   */
  async listPricesForProduct(productId: string, activeOnly = true): Promise<StripePrice[]> {
    const prices: StripePrice[] = [];
    const params: Stripe.PriceListParams = {
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
        metadata: price.metadata as Record<string, string>,
      });
    }

    return prices;
  }

  /**
   * Fetch all active customers from Stripe with pagination.
   */
  async listCustomers(): Promise<StripeCustomer[]> {
    const customers: StripeCustomer[] = [];

    for await (const customer of this.client.customers.list({ limit: 100 })) {
      if (customer.deleted) continue;
      customers.push({
        id: customer.id,
        email: customer.email,
        name: customer.name ?? null,
        metadata: customer.metadata as Record<string, string>,
        created: customer.created,
      });
    }

    return customers;
  }

  /**
   * Verify the Stripe API key is valid by fetching account info.
   */
  async verifyKey(): Promise<{ valid: boolean; accountId?: string; error?: string }> {
    try {
      const account = await this.client.accounts.retrieve();
      return { valid: true, accountId: account.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { valid: false, error: message };
    }
  }
}
