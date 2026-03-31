import { MigrationReport } from '../report';
export interface MigrateOptions {
    stripeKey: string;
    mainlayerKey: string;
    dryRun?: boolean;
    products?: boolean;
    customers?: boolean;
    outputDir?: string;
}
export declare function runMigrate(options: MigrateOptions): Promise<MigrationReport>;
//# sourceMappingURL=migrate.d.ts.map