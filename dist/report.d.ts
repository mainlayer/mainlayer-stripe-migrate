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
export declare function createReport(dryRun: boolean): MigrationReport;
export declare function finalizeReport(report: MigrationReport): MigrationReport;
export declare function summarizeReport(report: MigrationReport): ReportSummary;
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
/**
 * Format the report as a plain-text string suitable for printing or writing to disk.
 */
export declare function formatReport(report: MigrationReport): string;
//# sourceMappingURL=report.d.ts.map