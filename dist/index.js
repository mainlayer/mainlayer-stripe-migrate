#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const migrate_1 = require("./commands/migrate");
const status_1 = require("./commands/status");
const program = new commander_1.Command();
program
    .name('mainlayer-migrate')
    .description('Migrate from Stripe to Mainlayer — products, prices, and customers')
    .version('0.1.0');
// ──────────────────────────────────────────────────────────────────────────────
// mainlayer-migrate stripe
// Full migration: products + prices (+ optionally customers)
// ──────────────────────────────────────────────────────────────────────────────
program
    .command('stripe')
    .description('Migrate Stripe products, prices, and (optionally) customers to Mainlayer')
    .requiredOption('--stripe-key <key>', 'Stripe secret key (sk_live_... or sk_test_...)')
    .requiredOption('--mainlayer-key <key>', 'Mainlayer API key')
    .option('--dry-run', 'Preview what would be migrated without writing anything', false)
    .option('--include-customers', 'Also export Stripe customers', false)
    .option('--output-dir <dir>', 'Directory to write report and export files', '.')
    .action(async (opts) => {
    await (0, migrate_1.runMigrate)({
        stripeKey: opts.stripeKey,
        mainlayerKey: opts.mainlayerKey,
        dryRun: opts.dryRun,
        products: true,
        customers: opts.includeCustomers,
        outputDir: opts.outputDir,
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// mainlayer-migrate stripe:products
// Migrate only products and prices
// ──────────────────────────────────────────────────────────────────────────────
program
    .command('stripe:products')
    .description('Migrate only Stripe products and prices to Mainlayer resources and plans')
    .requiredOption('--stripe-key <key>', 'Stripe secret key')
    .requiredOption('--mainlayer-key <key>', 'Mainlayer API key')
    .option('--dry-run', 'Preview what would be migrated without writing anything', false)
    .option('--output-dir <dir>', 'Directory to write the migration report', '.')
    .action(async (opts) => {
    await (0, migrate_1.runMigrate)({
        stripeKey: opts.stripeKey,
        mainlayerKey: opts.mainlayerKey,
        dryRun: opts.dryRun,
        products: true,
        customers: false,
        outputDir: opts.outputDir,
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// mainlayer-migrate stripe:customers
// Export customer mapping only
// ──────────────────────────────────────────────────────────────────────────────
program
    .command('stripe:customers')
    .description('Export Stripe customers as a JSON mapping file')
    .requiredOption('--stripe-key <key>', 'Stripe secret key')
    .requiredOption('--mainlayer-key <key>', 'Mainlayer API key')
    .option('--dry-run', 'Preview without writing files', false)
    .option('--output-dir <dir>', 'Directory to write the customer export JSON', '.')
    .action(async (opts) => {
    await (0, migrate_1.runMigrate)({
        stripeKey: opts.stripeKey,
        mainlayerKey: opts.mainlayerKey,
        dryRun: opts.dryRun,
        products: false,
        customers: true,
        outputDir: opts.outputDir,
    });
});
// ──────────────────────────────────────────────────────────────────────────────
// mainlayer-migrate status
// Show what is currently in the Mainlayer account
// ──────────────────────────────────────────────────────────────────────────────
program
    .command('status')
    .description('Show current Mainlayer account resources (post-migration overview)')
    .requiredOption('--mainlayer-key <key>', 'Mainlayer API key')
    .action(async (opts) => {
    await (0, status_1.runStatus)({ mainlayerKey: opts.mainlayerKey });
});
program.parseAsync(process.argv).catch((err) => {
    console.error('Fatal error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
});
//# sourceMappingURL=index.js.map