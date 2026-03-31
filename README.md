# mainlayer-stripe-migrate

Migrate from Stripe to Mainlayer in minutes.

Move your Stripe product catalog — products, prices, subscriptions, and customers — to [Mainlayer](https://api.mainlayer.fr) with a single command. The tool maps Stripe concepts to their Mainlayer equivalents automatically, logs everything, and supports a safe dry-run preview mode with detailed progress reporting.

---

## Quick start (2 minutes)

```bash
# Install globally
npm install -g @mainlayer/stripe-migrate

# Or use directly without installing
npx @mainlayer/stripe-migrate stripe \
  --stripe-key sk_test_... \
  --mainlayer-key ml_test_... \
  --dry-run
```

**Always run with `--dry-run` first** to preview what will be migrated before making any changes.

---

## What gets migrated

| Stripe | Mainlayer | Status |
|---|---|---|
| Product | Resource | Automatic |
| Price (recurring) | Plan | Automatic |
| Price (one-time) | Plan | Automatic |
| Subscription | Subscription | New in v0.2.0+ |
| Customer | Export mapping | JSON export |
| Webhooks | Manual | See setup guide |

### What's included by default

- **Products** — `name`, `description`, metadata
- **Prices** — `unit_amount`, billing interval, trial days
- **Metadata preservation** — all Stripe IDs stored for reference
- **Progress reporting** — real-time spinners + final summary
- **Dry-run mode** — preview without writing anything
- **Report generation** — detailed `migration-report.txt`
- **Customer export** — ID mapping for user provisioning

### What you handle separately

- **Subscriptions** — re-activate in Mainlayer (batch import coming v0.3.0)
- **Payment methods** — card data stays in Stripe (PCI compliance)
- **Invoices** — historical records remain in Stripe
- **Discounts/coupons** — migrate manually via Mainlayer Dashboard
- **Webhooks** — re-register endpoints at [mainlayer.fr/webhooks](https://api.mainlayer.fr/webhooks)

---

## Installation

### Global (recommended for CLI use)

```bash
npm install -g @mainlayer/stripe-migrate
mainlayer-migrate --help
```

### As a dev dependency (for programmatic use)

```bash
npm install --save-dev @mainlayer/stripe-migrate
```

### One-off (no install)

```bash
npx @mainlayer/stripe-migrate@latest --help
```

---

## Setup: Get your API keys

1. **Stripe Secret Key**
   - Go to [dashboard.stripe.com](https://dashboard.stripe.com)
   - Navigate to **Developers** → **API Keys**
   - Copy your **Secret Key** (`sk_live_...` or `sk_test_...`)
   - Store safely: `export STRIPE_KEY="sk_live_..."`

2. **Mainlayer API Key**
   - Go to [mainlayer.fr](https://mainlayer.fr)
   - Navigate to **Settings** → **API Keys**
   - Create or copy your key (`ml_...`)
   - Store safely: `export MAINLAYER_KEY="ml_..."`

---

## Step-by-step migration guide

### Step 1: Verify your keys (optional but recommended)

```bash
mainlayer-migrate verify \
  --stripe-key $STRIPE_KEY \
  --mainlayer-key $MAINLAYER_KEY
```

Output:
```
✓ Stripe key valid (account: acme-corp)
✓ Mainlayer key valid (vendor: acme-corp)
```

### Step 2: Run a dry run

Always preview first:

```bash
mainlayer-migrate stripe \
  --stripe-key $STRIPE_KEY \
  --mainlayer-key $MAINLAYER_KEY \
  --dry-run
```

Example output:
```
Mainlayer Migration Tool
Stripe → Mainlayer

DRY RUN MODE — no data will be written

Verifying API keys…
✓ API keys verified

Migrating products and prices…
✓ Products and prices migrated
  ✓ Products → Resources: 5 migrated, 0 skipped, 0 failed
  ✓ Prices → Plans: 12 migrated, 0 skipped, 0 failed

──────────────────────────────────────────
Migration Summary (dry run)
──────────────────────────────────────────
  Resources created:  5
  Plans created:      12
  Customers exported: 0
  Total duration:     2.3s
```

### Step 3: Run the actual migration

When satisfied with the dry run, execute:

```bash
mainlayer-migrate stripe \
  --stripe-key $STRIPE_KEY \
  --mainlayer-key $MAINLAYER_KEY \
  --include-customers \
  --output-dir ./migration-logs
```

Files created:
- `migration-logs/migration-report.txt` — detailed text report
- `migration-logs/stripe-customers-export.json` — ID mapping for your database

### Step 4: Verify success

```bash
mainlayer-migrate status --mainlayer-key $MAINLAYER_KEY
```

Output:
```
Resources in Mainlayer:
  1. pro-plan ($29.00/mo)
  2. api-calls (pay-per-call)
  3. ...

Total: 5 resources, 12 plans
```

### Step 5: Re-provision webhooks

1. Go to [mainlayer.fr/webhooks](https://mainlayer.fr/webhooks)
2. Create a new webhook endpoint
3. Point to your server (e.g., `https://myapp.com/webhooks/mainlayer`)
4. Select events: `payment.completed`, `subscription.created`, `subscription.cancelled`
5. Copy the signing secret and store in your `.env`

See [mainlayer-webhooks](https://github.com/mainlayer/mainlayer-webhooks) for signature verification.

---

## CLI Reference

### `mainlayer-migrate stripe` — full migration

Migrate products, prices, and optionally customers.

```bash
mainlayer-migrate stripe [OPTIONS]
```

**Required options:**
- `--stripe-key <key>` — Stripe secret key
- `--mainlayer-key <key>` — Mainlayer API key

**Optional flags:**
- `--dry-run` — Preview without writing (default: `false`)
- `--include-customers` — Export customer ID mapping (default: `false`)
- `--output-dir <dir>` — Where to save reports (default: `.`)
- `--verbose` — Show detailed logs

**Example:**
```bash
mainlayer-migrate stripe \
  --stripe-key sk_live_abc123 \
  --mainlayer-key ml_live_xyz789 \
  --include-customers \
  --output-dir ./logs
```

---

### `mainlayer-migrate stripe:products` — products & prices only

Migrate products and prices without customers.

```bash
mainlayer-migrate stripe:products [OPTIONS]
```

**Example:**
```bash
mainlayer-migrate stripe:products \
  --stripe-key sk_test_abc123 \
  --mainlayer-key ml_test_xyz789 \
  --dry-run
```

---

### `mainlayer-migrate stripe:customers` — export customers only

Export Stripe customers as a JSON mapping without migrating products.

```bash
mainlayer-migrate stripe:customers [OPTIONS]
```

**Output:**
```json
{
  "exported_at": "2025-03-31T12:00:00Z",
  "stripe_key_prefix": "sk_test",
  "customers": [
    {
      "stripe_id": "cus_abc123",
      "email": "alice@example.com",
      "name": "Alice",
      "metadata": { "company_id": "org_123" }
    }
  ]
}
```

---

### `mainlayer-migrate status` — check current state

List all resources in your Mainlayer account.

```bash
mainlayer-migrate status [OPTIONS]
```

**Example:**
```bash
mainlayer-migrate status --mainlayer-key ml_live_xyz789
```

---

### `mainlayer-migrate verify` — validate API keys

Check if your API keys are valid and working.

```bash
mainlayer-migrate verify [OPTIONS]
```

**Example:**
```bash
mainlayer-migrate verify \
  --stripe-key sk_test_abc123 \
  --mainlayer-key ml_test_xyz789
```

---

## Field mapping reference

```
PRODUCTS & PRICES
─────────────────────────────────────────────────────────────
Stripe Product.name              → Mainlayer Resource.name
Stripe Product.id                → Mainlayer Resource.metadata.stripe_product_id
Stripe Product.description       → Mainlayer Resource.description
Stripe Product.active            → Mainlayer Resource.active

Stripe Price.unit_amount / 100   → Mainlayer Plan.price_usd
Stripe Price.id                  → Mainlayer Plan.metadata.stripe_price_id
Stripe Price.recurring.interval  → Mainlayer Plan.billing_interval
Stripe Price.recurring.trial_days → Mainlayer Plan.trial_days

CUSTOMERS
─────────────────────────────────────────────────────────────
Stripe Customer.id               → customer.stripe_id (in export)
Stripe Customer.email            → customer.email
Stripe Customer.name             → customer.name
Stripe Customer.metadata         → customer.metadata
```

---

## Programmatic API

Use the migrators directly in your own Node.js scripts:

```typescript
import { StripeClient } from '@mainlayer/stripe-migrate/stripe-client';
import { MainlayerClient } from '@mainlayer/stripe-migrate/mainlayer-client';
import { ProductMigrator } from '@mainlayer/stripe-migrate/migrators/products';
import { createReport, finalizeReport, formatReport } from '@mainlayer/stripe-migrate/report';

async function migrate() {
  const stripe = new StripeClient(process.env.STRIPE_KEY!);
  const mainlayer = new MainlayerClient(process.env.MAINLAYER_KEY!);

  const report = createReport(false);
  const migrator = new ProductMigrator(stripe, mainlayer, { dryRun: false });
  const results = await migrator.migrate();

  report.productResults.push(...results);
  console.log(formatReport(finalizeReport(report)));
}

migrate().catch(console.error);
```

See `examples/migrate-saas.ts` for a complete working example.

---

## Common scenarios

### Scenario 1: Migrate test → production

```bash
# First: test environment
mainlayer-migrate stripe \
  --stripe-key sk_test_... \
  --mainlayer-key ml_test_... \
  --dry-run

# Then: live environment
mainlayer-migrate stripe \
  --stripe-key sk_live_... \
  --mainlayer-key ml_live_... \
  --include-customers
```

### Scenario 2: Migrate only specific products

Currently, the tool migrates all active products. For selective migration:

1. Use `--dry-run` to see what would be migrated
2. Archive unwanted products in Stripe first
3. Run the migration

Future releases will support `--products-only` filtering.

### Scenario 3: Backup before migrating

```bash
# Export customers first
mainlayer-migrate stripe:customers \
  --stripe-key sk_live_... \
  --mainlayer-key ml_live_... \
  --output-dir ./backups

# Then migrate
mainlayer-migrate stripe --stripe-key sk_live_... --mainlayer-key ml_live_...
```

---

## Troubleshooting

### `ERR_INVALID_STRIPE_KEY`

- Verify the key is a **secret key** (`sk_live_` or `sk_test_`), not a publishable key
- Check the key hasn't been revoked in Stripe Dashboard
- Ensure no leading/trailing whitespace

```bash
# Test the key
mainlayer-migrate verify --stripe-key $STRIPE_KEY --mainlayer-key $MAINLAYER_KEY
```

### `ERR_MAINLAYER_AUTH_FAILED`

- Verify the key prefix is `ml_` (not `sk_`)
- Check at [mainlayer.fr/settings/keys](https://mainlayer.fr/settings/keys) that the key hasn't been revoked
- Create a new key if needed

### `ERR_NO_PRODUCTS_FOUND`

- Verify products exist in Stripe: [dashboard.stripe.com/products](https://dashboard.stripe.com/products)
- Ensure the Stripe key matches the account where products are stored
- Check that products are **active** (archived products are skipped)

### `ERR_MIGRATION_TIMEOUT`

- The migration may be taking longer than expected
- Try migrating fewer items: `mainlayer-migrate stripe:products` first, then customers
- Contact support: [mainlayer.fr/support](https://mainlayer.fr/support)

---

## Development

```bash
git clone https://github.com/mainlayer/mainlayer-stripe-migrate
cd mainlayer-stripe-migrate
npm install

# Run tests
npm test

# Build
npm run build

# Test the CLI locally
node dist/index.js --help
```

---

## License

MIT

---

**Need help?** See [docs.mainlayer.fr](https://docs.mainlayer.fr) or open an issue on [GitHub](https://github.com/mainlayer/mainlayer-stripe-migrate/issues).
