import chalk from 'chalk';
import ora from 'ora';
import { StripeClient } from '../stripe-client';
import { MainlayerClient } from '../mainlayer-client';
import { ProductMigrator } from '../migrators/products';
import { CustomerMigrator, serializeCustomerExports } from '../migrators/customers';
import {
  createReport,
  finalizeReport,
  formatReport,
  MigrationReport,
} from '../report';
import * as fs from 'fs';
import * as path from 'path';

export interface MigrateOptions {
  stripeKey: string;
  mainlayerKey: string;
  dryRun?: boolean;
  products?: boolean;
  customers?: boolean;
  outputDir?: string;
}

function printBanner(dryRun: boolean): void {
  console.log('');
  console.log(chalk.bold.blue('  Mainlayer Migration Tool'));
  console.log(chalk.gray('  Stripe → Mainlayer'));
  console.log('');
  if (dryRun) {
    console.log(chalk.yellow.bold('  DRY RUN MODE — no data will be written'));
    console.log('');
  }
}

function printResult(label: string, total: number, succeeded: number, failed: number): void {
  const icon = failed === 0 ? chalk.green('✓') : chalk.yellow('~');
  console.log(
    `  ${icon} ${label}: ${chalk.green(succeeded)} migrated, ` +
      `${chalk.gray(total - succeeded - failed)} skipped, ` +
      `${failed > 0 ? chalk.red(failed) : chalk.gray(failed)} failed`,
  );
}

async function verifyKeys(
  stripe: StripeClient,
  mainlayer: MainlayerClient,
): Promise<boolean> {
  const spinner = ora('Verifying API keys…').start();

  const [stripeCheck, mainlayerCheck] = await Promise.all([
    stripe.verifyKey(),
    mainlayer.verifyKey(),
  ]);

  if (!stripeCheck.valid) {
    spinner.fail(chalk.red(`Stripe key invalid: ${stripeCheck.error}`));
    return false;
  }

  if (!mainlayerCheck.valid) {
    spinner.fail(chalk.red(`Mainlayer key invalid: ${mainlayerCheck.error}`));
    return false;
  }

  spinner.succeed('API keys verified');
  return true;
}

export async function runMigrate(options: MigrateOptions): Promise<MigrationReport> {
  const {
    stripeKey,
    mainlayerKey,
    dryRun = false,
    products: migrateProducts = true,
    customers: migrateCustomers = false,
    outputDir,
  } = options;

  printBanner(dryRun);

  const stripe = new StripeClient(stripeKey);
  const mainlayer = new MainlayerClient(mainlayerKey);

  const keysValid = await verifyKeys(stripe, mainlayer);
  if (!keysValid) {
    process.exit(1);
  }

  const report = createReport(dryRun);

  if (migrateProducts) {
    const spinner = ora('Migrating products and prices…').start();
    try {
      const migrator = new ProductMigrator(stripe, mainlayer, { dryRun });
      const results = await migrator.migrate();
      report.productResults.push(...results);

      const priceResults = results.flatMap((r) => r.childResults ?? []);
      const productFailed = results.filter((r) => r.status === 'failed').length;
      const priceFailed = priceResults.filter((r) => r.status === 'failed').length;

      if (productFailed === 0 && priceFailed === 0) {
        spinner.succeed('Products and prices migrated');
      } else {
        spinner.warn('Products and prices migrated (with some failures)');
      }

      printResult('Products → Resources', results.length, results.filter((r) => r.status === 'success').length, productFailed);
      printResult('Prices → Plans', priceResults.length, priceResults.filter((r) => r.status === 'success').length, priceFailed);
    } catch (err: unknown) {
      spinner.fail(chalk.red(`Product migration failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  if (migrateCustomers) {
    const spinner = ora('Exporting customers…').start();
    try {
      const migrator = new CustomerMigrator(stripe, { dryRun });
      const { results, exports: customerExports } = await migrator.migrate();
      report.customerResults.push(...results);

      const failed = results.filter((r) => r.status === 'failed').length;
      spinner.succeed(`Customers exported (${results.length} total)`);
      printResult('Customers', results.length, results.filter((r) => r.status === 'success').length, failed);

      if (!dryRun && customerExports.length > 0) {
        const outDir = outputDir ?? '.';
        const outPath = path.join(outDir, 'stripe-customers-export.json');
        fs.writeFileSync(outPath, serializeCustomerExports(customerExports), 'utf-8');
        console.log(chalk.gray(`  Customer export written to: ${outPath}`));
      }
    } catch (err: unknown) {
      spinner.fail(chalk.red(`Customer export failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  const finalReport = finalizeReport(report);
  console.log('');
  console.log(formatReport(finalReport));

  if (outputDir && !dryRun) {
    const reportPath = path.join(outputDir, 'migration-report.txt');
    fs.writeFileSync(reportPath, formatReport(finalReport), 'utf-8');
    console.log(chalk.gray(`Report saved to: ${reportPath}`));
  }

  return finalReport;
}
