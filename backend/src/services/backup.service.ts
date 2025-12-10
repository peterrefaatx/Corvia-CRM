import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';

const execAsync = promisify(exec);
const BACKUP_BASE_DIR = path.join(process.cwd(), 'backups');

export type BackupType = 'daily' | 'monthly' | 'yearly' | 'manual';

export interface BackupMetadata {
  timestamp: string;
  type: BackupType;
  size: number;
  checksum: string;
  recordCounts: Record<string, number>;
  version: string;
  databaseUrl: string;
}

export interface BackupInfo {
  path: string;
  type: BackupType;
  date: string;
  metadata: BackupMetadata;
  folderName: string;
}

/**
 * Create a full database backup with files
 */
export async function createBackup(type: BackupType): Promise<string> {
  const startTime = Date.now();
  logger.info(`[Backup] Starting ${type} backup...`);

  try {
    const backupPath = getBackupPath(type);
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Export database using pg_dump
    const databasePath = path.join(backupPath, 'database.sql');
    await exportDatabase(databasePath);

    // Copy uploaded files
    const filesPath = path.join(backupPath, 'files');
    await copyUploadedFiles(filesPath);

    // Get record counts
    const recordCounts = await getRecordCounts();

    // Calculate checksum
    const checksum = await calculateFileChecksum(databasePath);

    // Get file size
    const stats = fs.statSync(databasePath);

    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      type,
      size: stats.size,
      checksum,
      recordCounts,
      version: '3.0.0',
      databaseUrl: config.databaseUrl.replace(/:[^:@]+@/, ':****@') // Hide password
    };

    const metadataPath = path.join(backupPath, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    const duration = Date.now() - startTime;
    logger.info(`[Backup] ${type} backup completed`, {
      duration: `${duration}ms`,
      size: `${(metadata.size / 1024 / 1024).toFixed(2)}MB`,
      path: backupPath
    });

    return backupPath;
  } catch (error) {
    logger.error(`[Backup] Failed:`, error);
    throw error;
  }
}

/**
 * Export database using pg_dump
 */
async function exportDatabase(outputPath: string): Promise<void> {
  try {
    const dbUrl = new URL(config.databaseUrl);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const database = dbUrl.pathname.slice(1);
    const username = dbUrl.username;
    const password = dbUrl.password;

    // Set PGPASSWORD environment variable
    const env = { ...process.env, PGPASSWORD: password };

    const command = `pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F p -f "${outputPath}"`;
    
    logger.info('[Backup] Exporting database...');
    await execAsync(command, { env, maxBuffer: 1024 * 1024 * 100 }); // 100MB buffer
    logger.info('[Backup] Database exported successfully');
  } catch (error: any) {
    logger.error('[Backup] Database export failed:', error);
    throw new Error(`Database export failed: ${error.message}`);
  }
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
 * Get record counts from all tables
 */
async function getRecordCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  counts.users = await prisma.user.count();
  counts.teams = await prisma.team.count();
  counts.campaigns = await prisma.campaign.count();
  counts.leads = await prisma.lead.count();
  counts.leadNotes = await prisma.leadNote.count();
  counts.leadAudits = await prisma.leadAudit.count();
  counts.clientNotes = await prisma.clientNote.count();
  counts.clientSchedules = await prisma.clientSchedule.count();
  counts.pipelineStages = await prisma.pipelineStage.count();
  counts.formTemplates = await prisma.formTemplate.count();
  counts.leaveRequests = await prisma.leaveRequest.count();
  counts.itTickets = await prisma.iTTicket.count();
  counts.itTicketResponses = await prisma.iTTicketResponse.count();
  counts.itAssignments = await prisma.iTAssignment.count();
  counts.loginHistory = await prisma.loginHistory.count();
  counts.dailyTopAgents = await prisma.dailyTopAgent.count();
  counts.systemSettings = await prisma.systemSettings.count();

  return counts;
}

/**
 * Calculate file checksum
 */
async function calculateFileChecksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
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
  databasePath: string;
  filesPath: string;
} | null {
  const metadataPath = path.join(backupPath, 'metadata.json');
  const databasePath = path.join(backupPath, 'database.sql');
  const filesPath = path.join(backupPath, 'files');

  if (!fs.existsSync(metadataPath) || !fs.existsSync(databasePath)) {
    return null;
  }

  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

    // Verify checksum
    const currentChecksum = crypto.createHash('sha256')
      .update(fs.readFileSync(databasePath))
      .digest('hex');
    
    if (currentChecksum !== metadata.checksum) {
      logger.warn(`Checksum mismatch for backup at ${backupPath}`);
    }

    return { metadata, databasePath, filesPath };
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
    
    // Cleanup daily backups
    await cleanupBackupType('daily', settings.retentionDays);
    
    // Cleanup monthly backups
    await cleanupBackupType('monthly', settings.retentionMonths);
    
    // Cleanup yearly backups (usually keep all)
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
