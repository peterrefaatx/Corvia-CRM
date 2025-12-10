import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { UserRole } from '@prisma/client';
import { performManualBackup } from '../jobs/databaseBackup';
import { listBackups, deleteBackup, getBackup } from '../services/backup.service.prisma';
import { restoreBackup } from '../services/restore.service.prisma';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { AuthRequest } from '../types';
import * as path from 'path';

const router = Router();

// All backup routes require Manager role
router.use(auth);
router.use(requireRole([UserRole.Manager]));

// Store restore job status
const restoreJobs = new Map<string, {
  status: 'running' | 'completed' | 'failed';
  message: string;
  progress: number;
  currentStep: string;
  startedAt: Date;
  completedAt?: Date;
  safetyBackup?: string;
  error?: string;
  result?: any;
}>();

/**
 * GET /api/backup/list
 * List all available backups
 */
router.get('/list', async (req: AuthRequest, res, next) => {
  try {
    const backups = listBackups();
    res.json({ backups });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/create
 * Create a manual backup
 */
router.post('/create', async (req: AuthRequest, res, next) => {
  try {
    const backupPath = await performManualBackup();
    
    res.json({
      success: true,
      message: 'Backup created successfully',
      backupPath
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backup/settings
 * Get backup settings
 */
router.get('/settings', async (req: AuthRequest, res, next) => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'backup_settings' }
    });

    const defaultSettings = {
      enabled: true,
      dailyTime: '04:00',
      retentionDays: 30,
      retentionMonths: 12,
      retentionYears: 5
    };

    const settings = setting?.value || defaultSettings;

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/backup/settings
 * Update backup settings
 */
router.put('/settings', async (req: AuthRequest, res, next) => {
  try {
    const { enabled, dailyTime, retentionDays, retentionMonths, retentionYears } = req.body;

    const settings = {
      enabled: enabled !== undefined ? enabled : true,
      dailyTime: dailyTime || '04:00',
      retentionDays: retentionDays || 30,
      retentionMonths: retentionMonths || 12,
      retentionYears: retentionYears || 5
    };

    await prisma.systemSettings.upsert({
      where: { key: 'backup_settings' },
      update: {
        value: settings,
        updatedBy: req.user!.userId
      },
      create: {
        key: 'backup_settings',
        category: 'backup',
        value: settings,
        updatedBy: req.user!.userId
      }
    });

    logger.info('[Backup] Settings updated', { userId: req.user!.userId, settings });

    res.json({
      success: true,
      message: 'Backup settings updated successfully',
      settings
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/backup/:type/:date
 * Delete a backup
 */
router.delete('/:type/:date', async (req: AuthRequest, res, next) => {
  try {
    const { type, date } = req.params;
    
    // Security: validate type and date
    if (!['daily', 'monthly', 'yearly'].includes(type)) {
      return res.status(400).json({ error: 'Invalid backup type' });
    }
    
    if (date.includes('..') || date.includes('/') || date.includes('\\')) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const backupPath = path.join(process.cwd(), 'backups', type, date);
    const success = deleteBackup(backupPath);
    
    if (!success) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    logger.info('[Backup] Deleted', { type, date, userId: req.user!.userId });

    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/backup/restore/:type/:date
 * Restore a backup (async with smart merge)
 */
router.post('/restore/:type/:date', async (req: AuthRequest, res, next) => {
  try {
    const { type, date } = req.params;
    
    // Security: validate type and date
    if (!['daily', 'monthly', 'yearly'].includes(type)) {
      return res.status(400).json({ error: 'Invalid backup type' });
    }
    
    if (date.includes('..') || date.includes('/') || date.includes('\\')) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const backupPath = path.join(process.cwd(), 'backups', type, date);
    const backup = getBackup(backupPath);

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Generate job ID
    const jobId = `restore_${Date.now()}`;
    logger.info(`[Restore] Starting job: ${jobId}`, { type, date, userId: req.user!.userId });

    // Initialize job status
    restoreJobs.set(jobId, {
      status: 'running',
      message: 'Starting smart merge restore...',
      progress: 0,
      currentStep: 'Initializing',
      startedAt: new Date()
    });

    // Return immediately with job ID
    res.json({
      success: true,
      jobId,
      message: 'Restore started. Use /api/backup/restore-status/:jobId to check progress.'
    });

    // Run restore asynchronously
    (async () => {
      try {
        const result = await restoreBackup(backupPath, (step, progress) => {
          const job = restoreJobs.get(jobId);
          if (job) {
            restoreJobs.set(jobId, {
              ...job,
              currentStep: step,
              progress,
              message: step
            });
          }
        });

        // Success
        restoreJobs.set(jobId, {
          status: 'completed',
          message: `Restore completed! ${result.totalInserted} inserted, ${result.totalUpdated} updated, ${result.totalSkipped} skipped`,
          progress: 100,
          currentStep: 'Completed',
          startedAt: restoreJobs.get(jobId)!.startedAt,
          completedAt: new Date(),
          safetyBackup: result.safetyBackupPath,
          result
        });

        logger.info('[Restore] Completed successfully', { jobId, result });

      } catch (error: any) {
        logger.error('[Restore] Failed', { jobId, error });
        
        restoreJobs.set(jobId, {
          status: 'failed',
          message: `Restore failed: ${error.message}`,
          progress: 0,
          currentStep: 'Failed',
          startedAt: restoreJobs.get(jobId)!.startedAt,
          completedAt: new Date(),
          error: error.message
        });
      }
    })();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backup/restore-status/:jobId
 * Check restore job status
 */
router.get('/restore-status/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const { jobId } = req.params;
    const job = restoreJobs.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/backup/history
 * Get backup/restore history
 */
router.get('/history', async (req: AuthRequest, res, next) => {
  try {
    const backups = listBackups();
    
    // Get last 50 backups
    const history = backups.slice(0, 50).map(backup => ({
      type: backup.type,
      date: backup.date,
      timestamp: backup.metadata.timestamp,
      size: backup.metadata.size,
      recordCounts: backup.metadata.recordCounts
    }));

    res.json({ history });
  } catch (error) {
    next(error);
  }
});

export default router;
