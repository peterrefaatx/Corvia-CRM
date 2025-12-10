import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const BACKUP_BASE_DIR = path.join(process.cwd(), 'backups');

export type BackupType = 'daily' | 'monthly' | 'yearly' | 'manual';

export interface BackupMetadata {
  timestamp: string;
  type: BackupType;
  size: number;
  checksum: string;
  recordCounts: Record<string, number>;
  version: string;
  method: string;
}

export interface BackupInfo {
  path: string;
  type: BackupType;
  date: string;
  metadata: BackupMetadata;
  folderName: string;
}

/**
 * Create a full database backup using Prisma (no pg_dump required)
 */
export async function createBackup(type: BackupType): Promise<string> {
  const startTime = Date.now();
  logger.info(`[Backup] Starting ${type} backup using Prisma...`);

  try {
    const backupPath = getBackupPath(type);
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Export all data using Prisma
    const data = await exportAllData();

    // Copy uploaded files
    const filesPath = path.join(backupPath, 'files');
    await copyUploadedFiles(filesPath);

    // Save database as JSON
    const databasePath = path.join(backupPath, 'database.json');
    const dataString = JSON.stringify(data, null, 2);
    fs.writeFileSync(databasePath, dataString, 'utf8');

    // Calculate checksum
    const checksum = crypto.createHash('sha256').update(dataString).digest('hex');

    // Get file size
    const stats = fs.statSync(databasePath);

    // Get record counts
    const recordCounts: Record<string, number> = {};
    for (const [table, records] of Object.entries(data)) {
      recordCounts[table] = Array.isArray(records) ? records.length : 0;
    }

    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      type,
      size: stats.size,
      checksum,
      recordCounts,
      version: '3.0.0',
      method: 'prisma'
    };

    const metadataPath = path.join(backupPath, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    const duration = Date.now() - startTime;
    logger.info(`[Backup] ${type} backup completed`, {
      duration: `${duration}ms`,
      size: `${(metadata.size / 1024 / 1024).toFixed(2)}MB`,
      path: backupPath,
      method: 'prisma'
    });

    return backupPath;
  } catch (error) {
    logger.error(`[Backup] Failed:`, error);
    throw error;
  }
}

/**
 * Export all data from database using Prisma
 */
async function exportAllData(): Promise<Record<string, any[]>> {
  logger.info('[Backup] Exporting data using Prisma...');
  
  const data: Record<string, any[]> = {};

  // Export all tables in dependency order (parent tables first)
  data.systemSettings = await prisma.systemSettings.findMany();
  data.pipelineStages = await prisma.pipelineStage.findMany();
  data.formTemplates = await prisma.formTemplate.findMany();
  data.users = await prisma.user.findMany();
  data.teams = await prisma.team.findMany();
  data.campaigns = await prisma.campaign.findMany();
  data.campaignTeams = await prisma.campaignTeam.findMany();
  data.campaignQCs = await prisma.campaignQC.findMany();
  data.leads = await prisma.lead.findMany();
  data.leadNotes = await prisma.leadNote.findMany();
  data.leadAudits = await prisma.leadAudit.findMany();
  data.clientNotes = await prisma.clientNote.findMany();
  data.clientSchedules = await prisma.clientSchedule.findMany();
  data.leaveRequests = await prisma.leaveRequest.findMany();
  data.itTickets = await prisma.iTTicket.findMany();
  data.itTicketResponses = await prisma.iTTicketResponse.findMany();
  data.itTicketStatusHistory = await prisma.iTTicketStatusHistory.findMany();
  data.itAssignments = await prisma.iTAssignment.findMany();
  data.loginHistory = await prisma.loginHistory.findMany();
  data.dailyTopAgents = await prisma.dailyTopAgent.findMany();

  logger.info('[Backup] Data exported successfully');
  return data;
}

/**
 * Copy uploaded files to backup
 */
async function copyUploadedFiles(targetPath: string): Promise<void> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    logger.info('[Backup] No uploads directory found, skipping files backup');
    return;
  }

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  logger.info('[Backup] Copying uploaded files...');
  await copyDirectory(uploadsDir, targetPath);
  logger.info('[Backup] Files copied successfully');
}

/**
 * Recursively copy directory
 */
async function copyDirectory(source: string, target: string): Promise<void> {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

/**
 * Get backup path based on type and current date
 */
function getBackupPath(type: BackupType): string {
  const now = new Date();
  
  switch (type) {
    case 'daily':
      const dateStr = now.toISOString().split('T')[0];
      return path.join(BACKUP_BASE_DIR, 'daily', dateStr);
    
    case 'monthly':
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return path.join(BACKUP_BASE_DIR, 'monthly', monthStr);
    
    case 'yearly':
      const yearStr = String(now.getFullYear());
      return path.join(BACKUP_BASE_DIR, 'yearly', yearStr);
    
    case 'manual':
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      return path.join(BACKUP_BASE_DIR, 'daily', `manual-${timestamp}`);
    
    default:
      throw new Error(`Unknown backup type: ${type}`);
  }
}

/**
 * List all backups
 */
export function listBackups(): BackupInfo[] {
  const backups: BackupInfo[] = [];

  for (const type of ['daily', 'monthly', 'yearly'] as BackupType[]) {
    const typeDir = path.join(BACKUP_BASE_DIR, type);
    
    if (!fs.existsSync(typeDir)) continue;

    const folders = fs.readdirSync(typeDir);
    
    for (const folder of folders) {
      const backupPath = path.join(typeDir, folder);
      const metadataPath = path.join(backupPath, 'metadata.json');
      
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          backups.push({
            path: backupPath,
            type,
            date: folder,
            metadata,
            folderName: folder
          });
        } catch (error) {
          logger.error(`Failed to read metadata for ${backupPath}:`, error);
        }
      }
    }
  }

  backups.sort((a, b) => {
    const timeA = a.metadata?.timestamp || '';
    const timeB = b.metadata?.timestamp || '';
    return timeB.localeCompare(timeA);
  });

  return backups;
}

/**
 * Get backup by path
 */
export function getBackup(backupPath: string): {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
} | null {
  const metadataPath = path.join(backupPath, 'metadata.json');
  const databasePath = path.join(backupPath, 'database.json');

  if (!fs.existsSync(metadataPath) || !fs.existsSync(databasePath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const data = JSON.parse(fs.readFileSync(databasePath, 'utf8'));

    // Verify checksum
    const dataString = fs.readFileSync(databasePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(dataString).digest('hex');
    
    if (checksum !== metadata.checksum) {
      logger.warn(`Checksum mismatch for backup at ${backupPath}`);
    }

    return { metadata, data };
  } catch (error) {
    logger.error(`Failed to read backup at ${backupPath}:`, error);
    return null;
  }
}

/**
 * Delete a backup
 */
export function deleteBackup(backupPath: string): boolean {
  try {
    if (fs.existsSync(backupPath)) {
      fs.rmSync(backupPath, { recursive: true, force: true });
      logger.info(`Deleted backup: ${backupPath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to delete backup at ${backupPath}:`, error);
    return false;
  }
}

/**
 * Cleanup old backups based on retention policy
 */
export async function cleanupOldBackups(): Promise<void> {
  try {
    const settings = await getBackupSettings();
    
    await cleanupBackupType('daily', settings.retentionDays);
    await cleanupBackupType('monthly', settings.retentionMonths);
    
    if (settings.retentionYears > 0) {
      await cleanupBackupType('yearly', settings.retentionYears);
    }
    
    logger.info('[Backup] Cleanup completed');
  } catch (error) {
    logger.error('[Backup] Cleanup failed:', error);
  }
}

async function cleanupBackupType(type: BackupType, keepCount: number): Promise<void> {
  const typeDir = path.join(BACKUP_BASE_DIR, type);
  
  if (!fs.existsSync(typeDir)) return;

  const folders = fs.readdirSync(typeDir)
    .map(folder => ({
      name: folder,
      path: path.join(typeDir, folder),
      time: fs.statSync(path.join(typeDir, folder)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (folders.length > keepCount) {
    const toDelete = folders.slice(keepCount);
    for (const folder of toDelete) {
      fs.rmSync(folder.path, { recursive: true, force: true });
      logger.info(`[Backup] Deleted old ${type} backup: ${folder.name}`);
    }
  }
}

async function getBackupSettings() {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'backup_settings' }
    });

    if (setting && setting.value) {
      return setting.value as any;
    }
  } catch (error) {
    logger.error('[Backup] Failed to load settings:', error);
  }

  return {
    enabled: true,
    retentionDays: 30,
    retentionMonths: 12,
    retentionYears: 5
  };
}
