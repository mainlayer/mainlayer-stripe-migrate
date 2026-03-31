# mainlayer-stripe-migrate

Migrate from Stripe to Mainlayer in minutes.

Move your Stripe product catalog — products, prices, and customers — to [Mainlayer](https://mainlayer.xyz) with a single command. The tool maps Stripe concepts to their Mainlayer equivalents automatically, logs everything, and supports a safe dry-run preview mode.

---

## What gets migrated

| Stripe | Mainlayer | Notes |
|---|---|---|
| Product | Resource | `name` → `slug` (auto-slugified), `description` preserved |
| Price (recurring) | Plan | `unit_amount` → `price_usd`, `fee_model: subscription` |
| Price (one-time) | Plan | `unit_amount` → `price_usd`, `fee_model: one_time` |
| Customer | Export (JSON/CSV) | Best-effort ID mapping — see note below |

### What doesn't migrate

- **Subscriptions** — active subscriptions must be re-created in Mainlayer after customers onboard
- **Payment methods** — card/bank data stays in Stripe's vault per PCI compliance
- **Invoices and billing history** — historical records remain in Stripe
- **Coupons and discounts** — migrate manually if needed
- **Webhooks** — re-configure your Mainlayer webhook endpoints separately

### Note on customers

Mainlayer identifies agents and users by API key, not by a customer record. The customer export gives you a mapping of Stripe customer IDs → email/name so you can provision Mainlayer keys for your users through your own identity layer.

---

## Installation

```bash
npm install -g mainlayer-stripe-migrate
```

Or use without installing:

```bash
npx mainlayer-stripe-migrate stripe --stripe-key sk_... --mainlayer-key ml_...
```

---

## Quick start

### 1. Get your API keys

- **Stripe**: Dashboard → Developers → API keys → Secret key (`sk_live_...` or `sk_test_...`)
- **Mainlayer**: [mainlayer.xyz](https://mainlayer.xyz) → Settings → API Keys

### 2. Preview with dry run

Always run with `--dry-run` first to see what will be migrated:

```bash
mainlayer-migrate stripe \
  --stripe-key sk_test_... \
  --mainlayer-key ml_... \
  --dry-run
```

The dry run prints a full report without writing anything to Mainlayer.

### 3. Run the migration

```bash
mainlayer-migrate stripe \
  --stripe-key sk_live_... \
  --mainlayer-key ml_...
```

### 4. Verify

```bash
mainlayer-migrate status --mainlayer-key ml_...
```

---

## Commands

### `stripe` — full migration

Migrate all active Stripe products, prices, and (optionally) customers.

```bash
mainlayer-migrate stripe \
  --stripe-key <key> \
  --mainlayer-key <key> \
  [--dry-run] \
  [--include-customers] \
  [--output-dir ./reports]
```

| Flag | Description |
|---|---|
| `--stripe-key` | Stripe secret key (required) |
| `--mainlayer-key` | Mainlayer API key (required) |
| `--dry-run` | Preview only — nothing is written |
| `--include-customers` | Also export the customer mapping |
| `--output-dir` | Where to save the report and export files (default: `.`) |

---

### `stripe:products` — products and prices only

```bash
mainlayer-migrate stripe:products \
  --stripe-key <key> \
  --mainlayer-key <key> \
  [--dry-run] \
  [--output-dir ./reports]
```

---

### `stripe:customers` — customer export only

```bash
mainlayer-migrate stripe:customers \
  --stripe-key <key> \
  --mainlayer-key <key> \
  [--output-dir ./reports]
```

Writes `stripe-customers-export.json` to the output directory.

---

### `status` — view migrated resources

```bash
mainlayer-migrate status --mainlayer-key <key>
```

Lists all resources currently in your Mainlayer account.

---

## Programmatic API

You can also use the migrators directly in your own scripts:

```typescript
import { StripeClient } from 'mainlayer-stripe-migrate/stripe-client';
import { MainlayerClient } from 'mainlayer-stripe-migrate/mainlayer-client';
import { ProductMigrator } from 'mainlayer-stripe-migrate/migrators/products';
import { createReport, finalizeReport, formatReport } from 'mainlayer-stripe-migrate/report';

const stripe = new StripeClient(process.env.STRIPE_KEY!);
const mainlayer = new MainlayerClient(process.env.MAINLAYER_KEY!);

const report = createReport(false);
const migrator = new ProductMigrator(stripe, mainlayer, { dryRun: false });
const results = await migrator.migrate();

report.productResults.push(...results);
console.log(formatReport(finalizeReport(report)));
```

See `examples/migrate-saas.ts` for a complete working example.

---

## Field mapping reference

```
Stripe Product.name              → Mainlayer Resource.slug (slugified)
Stripe Product.name              → Mainlayer Resource.name
Stripe Product.description       → Mainlayer Resource.description
Stripe Price.unit_amount / 100   → Mainlayer Resource.price_usd / Plan.price_usd
Stripe Price.recurring           → Mainlayer Resource.fee_model = "subscription"
Stripe Price (no recurring)      → Mainlayer Resource.fee_model = "one_time"
Stripe Price.recurring.interval  → Mainlayer Plan.billing_interval
Stripe Product.id                → Mainlayer Resource.metadata.stripe_product_id
Stripe Price.id                  → Mainlayer Plan.metadata.stripe_price_id
```

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
