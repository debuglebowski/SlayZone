export { getStateDir } from './dirs'
export { migrateXdgIfNeeded, migrateCliBinIfNeeded, type MigrationResult, type CliMigrationResult } from './migrations'
export { installCli, checkCliInstalled, getCliBinTarget, getManualInstallHint, type CliInstallResult } from './cli-install'
