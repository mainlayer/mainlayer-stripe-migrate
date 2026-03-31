"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrate = runMigrate;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const stripe_client_1 = require("../stripe-client");
const mainlayer_client_1 = require("../mainlayer-client");
const products_1 = require("../migrators/products");
const customers_1 = require("../migrators/customers");
const report_1 = require("../report");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function printBanner(dryRun) {
    console.log('');
    console.log(chalk_1.default.bold.blue('  Mainlayer Migration Tool'));
    console.log(chalk_1.default.gray('  Stripe → Mainlayer'));
    console.log('');
    if (dryRun) {
        console.log(chalk_1.default.yellow.bold('  DRY RUN MODE — no data will be written'));
        console.log('');
    }
}
function printResult(label, total, succeeded, failed) {
    const icon = failed === 0 ? chalk_1.default.green('✓') : chalk_1.default.yellow('~');
    console.log(`  ${icon} ${label}: ${chalk_1.default.green(succeeded)} migrated, ` +
        `${chalk_1.default.gray(total - succeeded - failed)} skipped, ` +
        `${failed > 0 ? chalk_1.default.red(failed) : chalk_1.default.gray(failed)} failed`);
}
async function verifyKeys(stripe, mainlayer) {
    const spinner = (0, ora_1.default)('Verifying API keys…').start();
    const [stripeCheck, mainlayerCheck] = await Promise.all([
        stripe.verifyKey(),
        mainlayer.verifyKey(),
    ]);
    if (!stripeCheck.valid) {
        spinner.fail(chalk_1.default.red(`Stripe key invalid: ${stripeCheck.error}`));
        return false;
    }
    if (!mainlayerCheck.valid) {
        spinner.fail(chalk_1.default.red(`Mainlayer key invalid: ${mainlayerCheck.error}`));
        return false;
    }
    spinner.succeed('API keys verified');
    return true;
}
async function runMigrate(options) {
    const { stripeKey, mainlayerKey, dryRun = false, products: migrateProducts = true, customers: migrateCustomers = false, outputDir, } = options;
    printBanner(dryRun);
    const stripe = new stripe_client_1.StripeClient(stripeKey);
    const mainlayer = new mainlayer_client_1.MainlayerClient(mainlayerKey);
    const keysValid = await verifyKeys(stripe, mainlayer);
    if (!keysValid) {
        process.exit(1);
    }
    const report = (0, report_1.createReport)(dryRun);
    if (migrateProducts) {
        const spinner = (0, ora_1.default)('Migrating products and prices…').start();
        try {
            const migrator = new products_1.ProductMigrator(stripe, mainlayer, { dryRun });
            const results = await migrator.migrate();
            report.productResults.push(...results);
            const priceResults = results.flatMap((r) => r.childResults ?? []);
            const productFailed = results.filter((r) => r.status === 'failed').length;
            const priceFailed = priceResults.filter((r) => r.status === 'failed').length;
            if (productFailed === 0 && priceFailed === 0) {
                spinner.succeed('Products and prices migrated');
            }
            else {
                spinner.warn('Products and prices migrated (with some failures)');
            }
            printResult('Products → Resources', results.length, results.filter((r) => r.status === 'success').length, productFailed);
            printResult('Prices → Plans', priceResults.length, priceResults.filter((r) => r.status === 'success').length, priceFailed);
        }
        catch (err) {
            spinner.fail(chalk_1.default.red(`Product migration failed: ${err instanceof Error ? err.message : String(err)}`));
        }
    }
    if (migrateCustomers) {
        const spinner = (0, ora_1.default)('Exporting customers…').start();
        try {
            const migrator = new customers_1.CustomerMigrator(stripe, { dryRun });
            const { results, exports: customerExports } = await migrator.migrate();
            report.customerResults.push(...results);
            const failed = results.filter((r) => r.status === 'failed').length;
            spinner.succeed(`Customers exported (${results.length} total)`);
            printResult('Customers', results.length, results.filter((r) => r.status === 'success').length, failed);
            if (!dryRun && customerExports.length > 0) {
                const outDir = outputDir ?? '.';
                const outPath = path.join(outDir, 'stripe-customers-export.json');
                fs.writeFileSync(outPath, (0, customers_1.serializeCustomerExports)(customerExports), 'utf-8');
                console.log(chalk_1.default.gray(`  Customer export written to: ${outPath}`));
            }
        }
        catch (err) {
            spinner.fail(chalk_1.default.red(`Customer export failed: ${err instanceof Error ? err.message : String(err)}`));
        }
    }
    const finalReport = (0, report_1.finalizeReport)(report);
    console.log('');
    console.log((0, report_1.formatReport)(finalReport));
    if (outputDir && !dryRun) {
        const reportPath = path.join(outputDir, 'migration-report.txt');
        fs.writeFileSync(reportPath, (0, report_1.formatReport)(finalReport), 'utf-8');
        console.log(chalk_1.default.gray(`Report saved to: ${reportPath}`));
    }
    return finalReport;
}
//# sourceMappingURL=migrate.js.map