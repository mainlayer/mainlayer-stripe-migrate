import {
  slugify,
  resolveFeeModel,
  centsToUsd,
  selectPrimaryPrice,
  buildResourcePayload,
  ProductMigrator,
} from '../src/migrators/products';
import {
  CustomerMigrator,
  serializeCustomerExports,
  customerExportsToCsv,
} from '../src/migrators/customers';
import { StripeClient, StripePrice, StripeProduct, StripeCustomer } from '../src/stripe-client';
import { MainlayerClient } from '../src/mainlayer-client';
import { createReport, finalizeReport, summarizeReport, formatReport } from '../src/report';

// ──────────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────────

const makeProduct = (overrides: Partial<StripeProduct> = {}): StripeProduct => ({
  id: 'prod_abc123',
  name: 'My SaaS Product',
  description: 'The best SaaS around',
  active: true,
  metadata: {},
  created: 1700000000,
  ...overrides,
});

const makeRecurringPrice = (overrides: Partial<StripePrice> = {}): StripePrice => ({
  id: 'price_sub_001',
  product: 'prod_abc123',
  unit_amount: 2900,
  currency: 'usd',
  recurring: { interval: 'month', interval_count: 1 },
  active: true,
  nickname: 'Pro Monthly',
  metadata: {},
  ...overrides,
});

const makeOneTimePrice = (overrides: Partial<StripePrice> = {}): StripePrice => ({
  id: 'price_one_001',
  product: 'prod_abc123',
  unit_amount: 9900,
  currency: 'usd',
  recurring: null,
  active: true,
  nickname: 'One-time Setup',
  metadata: {},
  ...overrides,
});

const makeCustomer = (overrides: Partial<StripeCustomer> = {}): StripeCustomer => ({
  id: 'cus_xyz789',
  email: 'alice@example.com',
  name: 'Alice Smith',
  metadata: {},
  created: 1700000000,
  ...overrides,
});

// ──────────────────────────────────────────────────────────────────────────────
// slugify
// ──────────────────────────────────────────────────────────────────────────────

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My SaaS Product')).toBe('my-saas-product');
  });

  it('removes special characters', () => {
    expect(slugify('Product! (v2.0)')).toBe('product-v20');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  - hello - ')).toBe('hello');
  });

  it('handles already-slugified strings', () => {
    expect(slugify('already-slugged')).toBe('already-slugged');
  });

  it('handles all-uppercase names', () => {
    expect(slugify('AI API')).toBe('ai-api');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// centsToUsd
// ──────────────────────────────────────────────────────────────────────────────

describe('centsToUsd', () => {
  it('converts cents to dollars', () => {
    expect(centsToUsd(2900)).toBe(29);
  });

  it('handles zero', () => {
    expect(centsToUsd(0)).toBe(0);
  });

  it('returns 0 for null (free / custom pricing)', () => {
    expect(centsToUsd(null)).toBe(0);
  });

  it('handles fractional dollars', () => {
    expect(centsToUsd(999)).toBeCloseTo(9.99);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// resolveFeeModel
// ──────────────────────────────────────────────────────────────────────────────

describe('resolveFeeModel', () => {
  it('returns subscription for recurring prices', () => {
    expect(resolveFeeModel(makeRecurringPrice())).toBe('subscription');
  });

  it('returns one_time for non-recurring prices', () => {
    expect(resolveFeeModel(makeOneTimePrice())).toBe('one_time');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// selectPrimaryPrice
// ──────────────────────────────────────────────────────────────────────────────

describe('selectPrimaryPrice', () => {
  it('prefers a subscription price when one exists', () => {
    const prices = [makeOneTimePrice(), makeRecurringPrice()];
    expect(selectPrimaryPrice(prices)).toEqual(makeRecurringPrice());
  });

  it('falls back to one-time price when no subscription', () => {
    const prices = [makeOneTimePrice()];
    expect(selectPrimaryPrice(prices)).toEqual(makeOneTimePrice());
  });

  it('returns undefined when prices list is empty', () => {
    expect(selectPrimaryPrice([])).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// buildResourcePayload
// ──────────────────────────────────────────────────────────────────────────────

describe('buildResourcePayload', () => {
  it('maps product name to slug', () => {
    const payload = buildResourcePayload(makeProduct(), makeRecurringPrice());
    expect(payload.slug).toBe('my-saas-product');
  });

  it('maps price unit_amount to price_usd', () => {
    const payload = buildResourcePayload(makeProduct(), makeRecurringPrice());
    expect(payload.price_usd).toBe(29);
  });

  it('sets fee_model to subscription for recurring price', () => {
    const payload = buildResourcePayload(makeProduct(), makeRecurringPrice());
    expect(payload.fee_model).toBe('subscription');
  });

  it('sets fee_model to one_time for non-recurring price', () => {
    const payload = buildResourcePayload(makeProduct(), makeOneTimePrice());
    expect(payload.fee_model).toBe('one_time');
  });

  it('includes stripe_product_id in metadata', () => {
    const payload = buildResourcePayload(makeProduct(), makeRecurringPrice());
    expect(payload.metadata?.stripe_product_id).toBe('prod_abc123');
  });

  it('includes product description', () => {
    const payload = buildResourcePayload(makeProduct(), makeRecurringPrice());
    expect(payload.description).toBe('The best SaaS around');
  });

  it('sets price_usd to 0 when no primary price', () => {
    const payload = buildResourcePayload(makeProduct(), undefined);
    expect(payload.price_usd).toBe(0);
  });

  it('merges product metadata into resource metadata', () => {
    const product = makeProduct({ metadata: { tier: 'pro' } });
    const payload = buildResourcePayload(product, makeRecurringPrice());
    expect(payload.metadata?.tier).toBe('pro');
    expect(payload.metadata?.stripe_product_id).toBe('prod_abc123');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ProductMigrator (mocked clients)
// ──────────────────────────────────────────────────────────────────────────────

describe('ProductMigrator', () => {
  const mockStripe = {
    listProducts: jest.fn(),
    listPricesForProduct: jest.fn(),
  } as unknown as StripeClient;

  const mockMainlayer = {
    createResource: jest.fn(),
    createPlan: jest.fn(),
  } as unknown as MainlayerClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success result for a migrated product', async () => {
    (mockStripe.listProducts as jest.Mock).mockResolvedValue([makeProduct()]);
    (mockStripe.listPricesForProduct as jest.Mock).mockResolvedValue([makeRecurringPrice()]);
    (mockMainlayer.createResource as jest.Mock).mockResolvedValue({
      id: 'res_001',
      slug: 'my-saas-product',
      name: 'My SaaS Product',
      price_usd: 29,
      fee_model: 'subscription',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (mockMainlayer.createPlan as jest.Mock).mockResolvedValue({
      id: 'plan_001',
      resource_id: 'res_001',
      name: 'Pro Monthly',
      price_usd: 29,
      created_at: new Date().toISOString(),
    });

    const migrator = new ProductMigrator(mockStripe, mockMainlayer);
    const results = await migrator.migrate();

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('success');
    expect(results[0].mainlayerId).toBe('res_001');
    expect(results[0].childResults).toHaveLength(1);
    expect(results[0].childResults![0].status).toBe('success');
  });

  it('marks product as failed when Mainlayer createResource throws', async () => {
    (mockStripe.listProducts as jest.Mock).mockResolvedValue([makeProduct()]);
    (mockStripe.listPricesForProduct as jest.Mock).mockResolvedValue([makeRecurringPrice()]);
    (mockMainlayer.createResource as jest.Mock).mockRejectedValue(new Error('API error'));

    const migrator = new ProductMigrator(mockStripe, mockMainlayer);
    const results = await migrator.migrate();

    expect(results[0].status).toBe('failed');
    expect(results[0].error).toMatch('API error');
  });

  it('skips child prices when product fails', async () => {
    (mockStripe.listProducts as jest.Mock).mockResolvedValue([makeProduct()]);
    (mockStripe.listPricesForProduct as jest.Mock).mockResolvedValue([makeRecurringPrice()]);
    (mockMainlayer.createResource as jest.Mock).mockRejectedValue(new Error('API error'));

    const migrator = new ProductMigrator(mockStripe, mockMainlayer);
    const results = await migrator.migrate();

    expect(results[0].childResults![0].status).toBe('skipped');
  });

  it('handles products with no prices', async () => {
    (mockStripe.listProducts as jest.Mock).mockResolvedValue([makeProduct()]);
    (mockStripe.listPricesForProduct as jest.Mock).mockResolvedValue([]);
    (mockMainlayer.createResource as jest.Mock).mockResolvedValue({
      id: 'res_001',
      slug: 'my-saas-product',
      name: 'My SaaS Product',
      price_usd: 0,
      fee_model: 'one_time',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const migrator = new ProductMigrator(mockStripe, mockMainlayer);
    const results = await migrator.migrate();

    expect(results[0].status).toBe('success');
    expect(results[0].childResults).toHaveLength(0);
  });

  it('dry run does not call Mainlayer API', async () => {
    (mockStripe.listProducts as jest.Mock).mockResolvedValue([makeProduct()]);
    (mockStripe.listPricesForProduct as jest.Mock).mockResolvedValue([makeRecurringPrice()]);

    const migrator = new ProductMigrator(mockStripe, mockMainlayer, { dryRun: true });
    const results = await migrator.migrate();

    expect(mockMainlayer.createResource).not.toHaveBeenCalled();
    expect(mockMainlayer.createPlan).not.toHaveBeenCalled();
    expect(results[0].status).toBe('success');
  });

  it('migrates multiple products independently', async () => {
    const productA = makeProduct({ id: 'prod_A', name: 'Product A' });
    const productB = makeProduct({ id: 'prod_B', name: 'Product B' });
    (mockStripe.listProducts as jest.Mock).mockResolvedValue([productA, productB]);
    (mockStripe.listPricesForProduct as jest.Mock).mockResolvedValue([]);
    (mockMainlayer.createResource as jest.Mock)
      .mockResolvedValueOnce({ id: 'res_A', slug: 'product-a', name: 'Product A', price_usd: 0, fee_model: 'one_time', created_at: '', updated_at: '' })
      .mockResolvedValueOnce({ id: 'res_B', slug: 'product-b', name: 'Product B', price_usd: 0, fee_model: 'one_time', created_at: '', updated_at: '' });

    const migrator = new ProductMigrator(mockStripe, mockMainlayer);
    const results = await migrator.migrate();

    expect(results).toHaveLength(2);
    expect(results[0].mainlayerId).toBe('res_A');
    expect(results[1].mainlayerId).toBe('res_B');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// CustomerMigrator (mocked Stripe client)
// ──────────────────────────────────────────────────────────────────────────────

describe('CustomerMigrator', () => {
  const mockStripe = {
    listCustomers: jest.fn(),
  } as unknown as StripeClient;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports a customer as a MigrationResult with success status', async () => {
    (mockStripe.listCustomers as jest.Mock).mockResolvedValue([makeCustomer()]);
    const migrator = new CustomerMigrator(mockStripe);
    const { results } = await migrator.migrate();

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('success');
    expect(results[0].stripeId).toBe('cus_xyz789');
  });

  it('exports customer data with correct fields', async () => {
    (mockStripe.listCustomers as jest.Mock).mockResolvedValue([makeCustomer()]);
    const migrator = new CustomerMigrator(mockStripe);
    const { exports } = await migrator.migrate();

    expect(exports[0].email).toBe('alice@example.com');
    expect(exports[0].name).toBe('Alice Smith');
    expect(exports[0].stripeCustomerId).toBe('cus_xyz789');
  });

  it('handles customers with no email', async () => {
    (mockStripe.listCustomers as jest.Mock).mockResolvedValue([makeCustomer({ email: null })]);
    const migrator = new CustomerMigrator(mockStripe);
    const { exports } = await migrator.migrate();

    expect(exports[0].email).toBeNull();
  });

  it('returns empty arrays when no customers exist', async () => {
    (mockStripe.listCustomers as jest.Mock).mockResolvedValue([]);
    const migrator = new CustomerMigrator(mockStripe);
    const { results, exports } = await migrator.migrate();

    expect(results).toHaveLength(0);
    expect(exports).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// serializeCustomerExports / customerExportsToCsv
// ──────────────────────────────────────────────────────────────────────────────

describe('serializeCustomerExports', () => {
  it('produces valid JSON', () => {
    const exports = [
      {
        stripeCustomerId: 'cus_001',
        email: 'a@b.com',
        name: 'A B',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {},
      },
    ];
    const json = serializeCustomerExports(exports);
    expect(() => JSON.parse(json)).not.toThrow();
    expect(JSON.parse(json)[0].email).toBe('a@b.com');
  });
});

describe('customerExportsToCsv', () => {
  it('includes a header row', () => {
    const csv = customerExportsToCsv([]);
    expect(csv.startsWith('stripe_customer_id,email,name,created_at')).toBe(true);
  });

  it('includes customer data rows', () => {
    const exports = [
      {
        stripeCustomerId: 'cus_001',
        email: 'alice@example.com',
        name: 'Alice',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {},
      },
    ];
    const csv = customerExportsToCsv(exports);
    expect(csv).toContain('cus_001');
    expect(csv).toContain('alice@example.com');
  });

  it('escapes double quotes in fields', () => {
    const exports = [
      {
        stripeCustomerId: 'cus_002',
        email: null,
        name: 'Bob "The Builder"',
        createdAt: '2024-01-01T00:00:00.000Z',
        metadata: {},
      },
    ];
    const csv = customerExportsToCsv(exports);
    expect(csv).toContain('""The Builder""');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Report helpers
// ──────────────────────────────────────────────────────────────────────────────

describe('report helpers', () => {
  it('createReport initializes with empty results', () => {
    const report = createReport(false);
    expect(report.productResults).toHaveLength(0);
    expect(report.customerResults).toHaveLength(0);
    expect(report.dryRun).toBe(false);
  });

  it('finalizeReport sets completedAt', () => {
    const report = createReport(false);
    const finalized = finalizeReport(report);
    expect(finalized.completedAt).toBeInstanceOf(Date);
  });

  it('summarizeReport counts successes and failures', () => {
    const report = createReport(false);
    report.productResults.push(
      { stripeId: 'p1', stripeName: 'P1', status: 'success' },
      { stripeId: 'p2', stripeName: 'P2', status: 'failed', error: 'oops' },
    );
    const summary = summarizeReport(report);
    expect(summary.products.succeeded).toBe(1);
    expect(summary.products.failed).toBe(1);
    expect(summary.products.total).toBe(2);
  });

  it('formatReport includes dry run notice when applicable', () => {
    const report = createReport(true);
    const text = formatReport(finalizeReport(report));
    expect(text).toContain('DRY RUN');
  });

  it('formatReport lists failures', () => {
    const report = createReport(false);
    report.productResults.push({
      stripeId: 'p1',
      stripeName: 'Broken Product',
      status: 'failed',
      error: 'Resource slug already exists',
    });
    const text = formatReport(finalizeReport(report));
    expect(text).toContain('Broken Product');
    expect(text).toContain('Resource slug already exists');
  });
});
