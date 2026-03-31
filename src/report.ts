export type MigrationResultStatus = 'success' | 'skipped' | 'failed';

export interface MigrationResult {
  stripeId: string;
  stripeName: string;
  mainlayerId?: string;
  mainlayerSlug?: string;
  status: MigrationResultStatus;
  error?: string;
  childResults?: MigrationResult[];
}

export interface MigrationReport {
  startedAt: Date;
  completedAt?: Date;
  dryRun: boolean;
  productResults: MigrationResult[];
  customerResults: MigrationResult[];
}

export function createReport(dryRun: boolean): MigrationReport {
  return {
    startedAt: new Date(),
    dryRun,
    productResults: [],
    customerResults: [],
  };
}

export function finalizeReport(report: MigrationReport): MigrationReport {
  return { ...report, completedAt: new Date() };
}

export function summarizeReport(report: MigrationReport): ReportSummary {
  const productStats = countResults(report.productResults);
  const priceStats = countChildResults(report.productResults);
  const customerStats = countResults(report.customerResults);

  const durationMs =
    report.completedAt && report.startedAt
      ? report.completedAt.getTime() - report.startedAt.getTime()
      : 0;

  return {
    dryRun: report.dryRun,
    durationMs,
    products: productStats,
    prices: priceStats,
    customers: customerStats,
  };
}

export interface ResultStats {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

export interface ReportSummary {
  dryRun: boolean;
  durationMs: number;
  products: ResultStats;
  prices: ResultStats;
  customers: ResultStats;
}

function countResults(results: MigrationResult[]): ResultStats {
  return {
    total: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  };
}

function countChildResults(results: MigrationResult[]): ResultStats {
  const children = results.flatMap((r) => r.childResults ?? []);
  return countResults(children);
}

/**
 * Format the report as a plain-text string suitable for printing or writing to disk.
 */
export function formatReport(report: MigrationReport): string {
  const summary = summarizeReport(report);
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('  Mainlayer Migration Report');
  lines.push('='.repeat(60));
  lines.push('');

  if (summary.dryRun) {
    lines.push('  MODE: DRY RUN — no changes were written');
    lines.push('');
  }

  lines.push(`  Started:   ${report.startedAt.toISOString()}`);
  if (report.completedAt) {
    lines.push(`  Completed: ${report.completedAt.toISOString()}`);
    lines.push(`  Duration:  ${(summary.durationMs / 1000).toFixed(2)}s`);
  }
  lines.push('');

  lines.push('  Products → Resources');
  lines.push(`    Total:     ${summary.products.total}`);
  lines.push(`    Migrated:  ${summary.products.succeeded}`);
  lines.push(`    Skipped:   ${summary.products.skipped}`);
  lines.push(`    Failed:    ${summary.products.failed}`);
  lines.push('');

  lines.push('  Prices → Plans');
  lines.push(`    Total:     ${summary.prices.total}`);
  lines.push(`    Migrated:  ${summary.prices.succeeded}`);
  lines.push(`    Skipped:   ${summary.prices.skipped}`);
  lines.push(`    Failed:    ${summary.prices.failed}`);
  lines.push('');

  if (summary.customers.total > 0) {
    lines.push('  Customers (exported)');
    lines.push(`    Total:     ${summary.customers.total}`);
    lines.push(`    Exported:  ${summary.customers.succeeded}`);
    lines.push(`    Skipped:   ${summary.customers.skipped}`);
    lines.push(`    Failed:    ${summary.customers.failed}`);
    lines.push('');
  }

  const failures = [
    ...report.productResults.filter((r) => r.status === 'failed'),
    ...report.productResults.flatMap((r) => (r.childResults ?? []).filter((c) => c.status === 'failed')),
    ...report.customerResults.filter((r) => r.status === 'failed'),
  ];

  if (failures.length > 0) {
    lines.push('  Failures');
    for (const f of failures) {
      lines.push(`    [${f.stripeId}] ${f.stripeName}: ${f.error ?? 'unknown error'}`);
    }
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}
