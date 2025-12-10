/**
 * Data Retention Cleanup Job
 * Automatically archives or deletes old leads based on retention policy settings
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

interface RetentionSettings {
  qualifiedDays: number;
  disqualifiedDays: number;
  duplicateDays: number;
  pendingDays: number;
  callbackDays: number;
  autoArchive: boolean;
  deleteArchivedAfterDays: number;
}

const DEFAULT_RETENTION: RetentionSettings = {
  qualifiedDays: 90,
  disqualifiedDays: 30,
  duplicateDays: 30,
  pendingDays: 0, // 0 = keep forever
  callbackDays: 0, // 0 = keep forever
  autoArchive: true,
  deleteArchivedAfterDays: 365
};

async function getRetentionSettings(): Promise<RetentionSettings> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'dataRetention' }
    });

    if (setting && setting.value) {
      return { ...DEFAULT_RETENTION, ...(setting.value as any) };
    }

    return DEFAULT_RETENTION;
  } catch (error) {
    logger.error('Failed to load retention settings, using defaults', error as Error);
    return DEFAULT_RETENTION;
  }
}

export async function cleanupOldLeads() {
  const startTime = Date.now();
  logger.info('Starting data retention cleanup job');

  try {
    const settings = await getRetentionSettings();
    logger.info('Loaded retention settings', settings);

    if (!settings.autoArchive) {
      logger.info('Auto-archive is disabled, skipping cleanup');
      return;
    }

    const now = new Date();
    let totalArchived = 0;
    let totalDeleted = 0;

    // Archive old Qualified leads
    if (settings.qualifiedDays > 0) {
      const cutoffDate = new Date(now.getTime() - (settings.qualifiedDays * 24 * 60 * 60 * 1000));
      const archived = await prisma.lead.updateMany({
        where: {
          status: 'Qualified',
          createdAt: { lt: cutoffDate },
          archived: false
        },
        data: {
          archived: true,
          archivedAt: now
        }
      });
      totalArchived += archived.count;
      logger.info(`Archived ${archived.count} Qualified leads older than ${settings.qualifiedDays} days`);
    }

    // Archive old Disqualified leads
    if (settings.disqualifiedDays > 0) {
      const cutoffDate = new Date(now.getTime() - (settings.disqualifiedDays * 24 * 60 * 60 * 1000));
      const archived = await prisma.lead.updateMany({
        where: {
          status: 'Disqualified',
          createdAt: { lt: cutoffDate },
          archived: false
        },
        data: {
          archived: true,
          archivedAt: now
        }
      });
      totalArchived += archived.count;
      logger.info(`Archived ${archived.count} Disqualified leads older than ${settings.disqualifiedDays} days`);
    }

    // Archive old Duplicate leads
    if (settings.duplicateDays > 0) {
      const cutoffDate = new Date(now.getTime() - (settings.duplicateDays * 24 * 60 * 60 * 1000));
      const archived = await prisma.lead.updateMany({
        where: {
          status: 'Duplicate',
          createdAt: { lt: cutoffDate },
          archived: false
        },
        data: {
          archived: true,
          archivedAt: now
        }
      });
      totalArchived += archived.count;
      logger.info(`Archived ${archived.count} Duplicate leads older than ${settings.duplicateDays} days`);
    }

    // Archive old Pending leads (if configured)
    if (settings.pendingDays > 0) {
      const cutoffDate = new Date(now.getTime() - (settings.pendingDays * 24 * 60 * 60 * 1000));
      const archived = await prisma.lead.updateMany({
        where: {
          status: 'Pending',
          createdAt: { lt: cutoffDate },
          archived: false
        },
        data: {
          archived: true,
          archivedAt: now
        }
      });
      totalArchived += archived.count;
      logger.info(`Archived ${archived.count} Pending leads older than ${settings.pendingDays} days`);
    }

    // Archive old Callback leads (if configured)
    if (settings.callbackDays > 0) {
      const cutoffDate = new Date(now.getTime() - (settings.callbackDays * 24 * 60 * 60 * 1000));
      const archived = await prisma.lead.updateMany({
        where: {
          status: 'Callback',
          createdAt: { lt: cutoffDate },
          archived: false
        },
        data: {
          archived: true,
          archivedAt: now
        }
      });
      totalArchived += archived.count;
      logger.info(`Archived ${archived.count} Callback leads older than ${settings.callbackDays} days`);
    }

    // Delete very old archived leads (if configured)
    if (settings.deleteArchivedAfterDays > 0) {
      const deleteCutoff = new Date(now.getTime() - (settings.deleteArchivedAfterDays * 24 * 60 * 60 * 1000));
      const deleted = await prisma.lead.deleteMany({
        where: {
          archived: true,
          archivedAt: { lt: deleteCutoff }
        }
      });
      totalDeleted = deleted.count;
      logger.info(`Deleted ${deleted.count} archived leads older than ${settings.deleteArchivedAfterDays} days`);
    }

    const duration = Date.now() - startTime;
    logger.info('Data retention cleanup completed', {
      totalArchived,
      totalDeleted,
      duration
    });

  } catch (error) {
    logger.error('Data retention cleanup failed', error as Error);
    throw error;
  }
}
