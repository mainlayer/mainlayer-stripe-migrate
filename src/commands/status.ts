import chalk from 'chalk';
import ora from 'ora';
import { MainlayerClient } from '../mainlayer-client';

export interface StatusOptions {
  mainlayerKey: string;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export async function runStatus(options: StatusOptions): Promise<void> {
  const { mainlayerKey } = options;

  const mainlayer = new MainlayerClient(mainlayerKey);

  const verifySpinner = ora('Verifying Mainlayer key…').start();
  const keyCheck = await mainlayer.verifyKey();

  if (!keyCheck.valid) {
    verifySpinner.fail(chalk.red(`Mainlayer key invalid: ${keyCheck.error}`));
    process.exit(1);
  }
  verifySpinner.succeed(`Connected to Mainlayer (account: ${keyCheck.accountId ?? 'unknown'})`);

  const statusSpinner = ora('Fetching migration status…').start();
  let status;
  try {
    status = await mainlayer.getMigrationStatus();
    statusSpinner.succeed('Status loaded');
  } catch (err: unknown) {
    statusSpinner.fail(
      chalk.red(`Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`),
    );
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold('  Mainlayer Account Status'));
  console.log('  ' + '─'.repeat(40));
  console.log(`  Resources:    ${chalk.cyan(status.total_resources)}`);
  console.log('');

  if (status.resources.length === 0) {
    console.log(chalk.gray('  No resources found. Run a migration to get started.'));
    console.log('');
    return;
  }

  console.log(chalk.bold('  Resources'));
  console.log('');

  for (const resource of status.resources) {
    const priceLabel = `$${resource.price_usd.toFixed(2)}`;
    const modelLabel = resource.fee_model === 'subscription' ? 'subscription' : 'one-time';
    const dateLabel = formatDate(resource.created_at);
    const migratedFrom = resource.metadata?.stripe_product_id;

    console.log(
      `  ${chalk.green('●')} ${chalk.bold(resource.name)} ${chalk.gray(`(${resource.slug})`)}`
    );
    console.log(
      `    ${priceLabel} · ${modelLabel} · created ${dateLabel}` +
        (migratedFrom ? chalk.gray(` · from Stripe ${migratedFrom}`) : ''),
    );
    console.log('');
  }
}
