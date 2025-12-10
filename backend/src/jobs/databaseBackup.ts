import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { createBackup, cleanupOldBackups, BackupType } from '../services/backup.service.prisma';

interface BackupSettings {
  enabled: boolean;
  dailyTime: string;
  retentionDays: number;
  retentionMonths: number;
  retentionYears: number;
}

const DEFAULT_SETTINGS: BackupSettings = {
  enabled: true,
  dailyTime: '04:00',
  retentionDays: 30,
  retentionMonths: 12,
  retentionYears: 5
};

/**
 * Get backup settings from database
 */
async function getBackupSettings(): Promise<BackupSettings> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'backup_settings' }
    });

    if (setting && setting.value) {
      return { ...DEFAULT_SETTINGS, ...(setting.value as any) };
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    logger.error('[Backup] Failed to load settings, using defaults', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Update last backup timestamp
 */
async function updateLastBackupTimestamp(type: BackupType): Promise<void> {
  try {
    const settings = await getBackupSettings();
    
    await prisma.systemSettings.upsert({
      where: { key: 'backup_settings' },
      update: {
        value: {
          ...settings,
          lastBackup: new Date().toISOString(),
          lastBackupType: type
        }
      },
      create: {
        key: 'backup_settings',
        category: 'backup',
        value: {
          ...settings,
          lastBackup: new Date().toISOString(),
          lastBackupType: type
        }
      }
    });
  } catch (error) {
    logger.error('[Backup] Failed to update last backup timestamp', error);
  }
}

/**
 * Perform daily backup
 */
export async function performDailyBackup(): Promise<void> {
  const startTime = Date.now();
  logger.info('[Backup] Starting daily backup job');

  try {
    const settings = await getBackupSettings();

    if (!settings.enabled) {
      logger.info('[Backup] Auto-backup is disabled, skipping');
      return;
    }

    // Create daily backup
    const backupPath = await createBackup('daily');
    logger.info(`[Backup] Daily backup created: ${backupPath}`);

    // Update last backup timestamp
    await updateLastBackupTimestamp('daily');

    // Cleanup old backups
    await cleanupOldBackups();

    const duration = Date.now() - startTime;
    logger.info(`[Backup] Daily backup job completed in ${duration}ms`);

  } catch (error) {
    logger.error('[Backup] Daily backup job failed', error);
    throw error;
  }
}

/**
 * Perform monthly backup (runs on 1st of each month)
 */
export async function performMonthlyBackup(): Promise<void> {
  const startTime = Date.now();
  logger.info('[Backup] Starting monthly backup job');

  try {
    const settings = await getBackupSettings();

    if (!settings.enabled) {
      logger.info('[Backup] Auto-backup is disabled, skipping');
      return;
    }

    // Create monthly backup
    const backupPath = await createBackup('monthly');
    logger.info(`[Backup] Monthly backup created: ${backupPath}`);

    // Update last backup timestamp
    await updateLastBackupTimestamp('monthly');

    const duration = Date.now() - startTime;
    logger.info(`[Backup] Monthly backup job completed in ${duration}ms`);

  } catch (error) {
    logger.error('[Backup] Monthly backup job failed', error);
    throw error;
  }
}

/**
 * Perform yearly backup (runs on January 1st)
 */
export async function performYearlyBackup(): Promise<void> {
  const startTime = Date.now();
  logger.info('[Backup] Starting yearly backup job');

  try {
    const settings = await getBackupSettings();

    if (!settings.enabled) {
      logger.info('[Backup] Auto-backup is disabled, skipping');
      return;
    }

    // Create yearly backup
    const backupPath = await createBackup('yearly');
    logger.info(`[Backup] Yearly backup created: ${backupPath}`);

    // Update last backup timestamp
    await updateLastBackupTimestamp('yearly');

    const duration = Date.now() - startTime;
    logger.info(`[Backup] Yearly backup job completed in ${duration}ms`);

  } catch (error) {
    logger.error('[Backup] Yearly backup job failed', error);
    throw error;
  }
}

/**
 * Perform manual backup
 */
export async function performManualBackup(): Promise<string> {
  const startTime = Date.now();
  logger.info('[Backup] Starting manual backup');

  try {
    const backupPath = await createBackup('manual');
    
    const duration = Date.now() - startTime;
    logger.info(`[Backup] Manual backup completed in ${duration}ms: ${backupPath}`);

    return backupPath;
  } catch (error) {
    logger.error('[Backup] Manual backup failed', error);
    throw error;
  }
}
