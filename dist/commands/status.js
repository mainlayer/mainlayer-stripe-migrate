"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStatus = runStatus;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const mainlayer_client_1 = require("../mainlayer-client");
function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
async function runStatus(options) {
    const { mainlayerKey } = options;
    const mainlayer = new mainlayer_client_1.MainlayerClient(mainlayerKey);
    const verifySpinner = (0, ora_1.default)('Verifying Mainlayer key…').start();
    const keyCheck = await mainlayer.verifyKey();
    if (!keyCheck.valid) {
        verifySpinner.fail(chalk_1.default.red(`Mainlayer key invalid: ${keyCheck.error}`));
        process.exit(1);
    }
    verifySpinner.succeed(`Connected to Mainlayer (account: ${keyCheck.accountId ?? 'unknown'})`);
    const statusSpinner = (0, ora_1.default)('Fetching migration status…').start();
    let status;
    try {
        status = await mainlayer.getMigrationStatus();
        statusSpinner.succeed('Status loaded');
    }
    catch (err) {
        statusSpinner.fail(chalk_1.default.red(`Failed to fetch status: ${err instanceof Error ? err.message : String(err)}`));
        process.exit(1);
    }
    console.log('');
    console.log(chalk_1.default.bold('  Mainlayer Account Status'));
    console.log('  ' + '─'.repeat(40));
    console.log(`  Resources:    ${chalk_1.default.cyan(status.total_resources)}`);
    console.log('');
    if (status.resources.length === 0) {
        console.log(chalk_1.default.gray('  No resources found. Run a migration to get started.'));
        console.log('');
        return;
    }
    console.log(chalk_1.default.bold('  Resources'));
    console.log('');
    for (const resource of status.resources) {
        const priceLabel = `$${resource.price_usd.toFixed(2)}`;
        const modelLabel = resource.fee_model === 'subscription' ? 'subscription' : 'one-time';
        const dateLabel = formatDate(resource.created_at);
        const migratedFrom = resource.metadata?.stripe_product_id;
        console.log(`  ${chalk_1.default.green('●')} ${chalk_1.default.bold(resource.name)} ${chalk_1.default.gray(`(${resource.slug})`)}`);
        console.log(`    ${priceLabel} · ${modelLabel} · created ${dateLabel}` +
            (migratedFrom ? chalk_1.default.gray(` · from Stripe ${migratedFrom}`) : ''));
        console.log('');
    }
}
//# sourceMappingURL=status.js.map