/**
 * Example: Migrate a full SaaS product catalog from Stripe to Mainlayer.
 *
 * This script demonstrates using the migration library programmatically
 * rather than through the CLI.  Useful for automation pipelines or when
 * you need custom pre/post-processing logic.
 *
 * Usage:
 *   STRIPE_KEY=sk_test_... MAINLAYER_KEY=ml_... ts-node examples/migrate-saas.ts
 */

import { StripeClient } from '../src/stripe-client';
import { MainlayerClient } from '../src/mainlayer-client';
import { ProductMigrator } from '../src/migrators/products';
import { CustomerMigrator, customerExportsToCsv } from '../src/migrators/customers';
import { createReport, finalizeReport, formatReport } from '../src/report';
import * as fs from 'fs';
import * as path from 'path';

const STRIPE_KEY = process.env.STRIPE_KEY ?? '';
const MAINLAYER_KEY = process.env.MAINLAYER_KEY ?? '';
const DRY_RUN = process.env.DRY_RUN === 'true';
const OUTPUT_DIR = process.env.OUTPUT_DIR ?? '.';

async function main(): Promise<void> {
  if (!STRIPE_KEY || !MAINLAYER_KEY) {
    console.error('Error: STRIPE_KEY and MAINLAYER_KEY environment variables are required.');
    process.exit(1);
  }

  console.log('Mainlayer SaaS Migration Example');
  console.log('─'.repeat(40));
  console.log(`Dry run: ${DRY_RUN}`);
  console.log('');

  const stripe = new StripeClient(STRIPE_KEY);
  const mainlayer = new MainlayerClient(MAINLAYER_KEY);

  // Step 1: Verify credentials
  console.log('Step 1: Verifying API keys…');
  const [stripeCheck, mainlayerCheck] = await Promise.all([
    stripe.verifyKey(),
    mainlayer.verifyKey(),
  ]);

  if (!stripeCheck.valid) {
    console.error(`Stripe key invalid: ${stripeCheck.error}`);
    process.exit(1);
  }
  console.log(`  Stripe connected (account: ${stripeCheck.accountId})`);

  if (!mainlayerCheck.valid) {
    console.error(`Mainlayer key invalid: ${mainlayerCheck.error}`);
    process.exit(1);
  }
  console.log(`  Mainlayer connected (account: ${mainlayerCheck.accountId})`);
  console.log('');

  const report = createReport(DRY_RUN);

  // Step 2: Preview products before migration
  console.log('Step 2: Fetching Stripe product catalog…');
  const products = await stripe.listProducts(true);
  console.log(`  Found ${products.length} active products`);

  for (const product of products) {
    const prices = await stripe.listPricesForProduct(product.id, true);
    console.log(`  - ${product.name} (${prices.length} price(s))`);
  }
  console.log('');

  // Step 3: Migrate products and prices
  console.log('Step 3: Migrating products and prices…');
  const productMigrator = new ProductMigrator(stripe, mainlayer, { dryRun: DRY_RUN });
  const productResults = await productMigrator.migrate();
  report.productResults.push(...productResults);

  const successCount = productResults.filter((r) => r.status === 'success').length;
  const failCount = productResults.filter((r) => r.status === 'failed').length;
  console.log(`  Products migrated: ${successCount} succeeded, ${failCount} failed`);
  console.log('');

  // Step 4: Export customer mapping
  console.log('Step 4: Exporting customer mapping…');
  const customerMigrator = new CustomerMigrator(stripe, { dryRun: DRY_RUN });
  const { results: customerResults, exports: customerExports } = await customerMigrator.migrate();
  report.customerResults.push(...customerResults);

  console.log(`  Customers exported: ${customerExports.length}`);

  if (!DRY_RUN && customerExports.length > 0) {
    const jsonPath = path.join(OUTPUT_DIR, 'stripe-customers-export.json');
    const csvPath = path.join(OUTPUT_DIR, 'stripe-customers-export.csv');

    fs.writeFileSync(jsonPath, JSON.stringify(customerExports, null, 2), 'utf-8');
    fs.writeFileSync(csvPath, customerExportsToCsv(customerExports), 'utf-8');

    console.log(`  JSON export: ${jsonPath}`);
    console.log(`  CSV export:  ${csvPath}`);
  }
  console.log('');

  // Step 5: Print and save final report
  const finalReport = finalizeReport(report);
  const reportText = formatReport(finalReport);
  console.log(reportText);

  if (!DRY_RUN) {
    const reportPath = path.join(OUTPUT_DIR, 'migration-report.txt');
    fs.writeFileSync(reportPath, reportText, 'utf-8');
    console.log(`Report saved to: ${reportPath}`);
  }
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
