import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { config } from '../config';
import { createBackup } from './backup.service';

const execAsync = promisify(exec);

export interface RestoreReport {
  table: string;
  inserted: number;
  updated: number;
  skipped: number;
  conflicts: Array<{
    id: string;
    reason: string;
    backupTimestamp?: string;
    currentTimestamp?: string;
  }>;
}

export interface RestoreResult {
  success: boolean;
  safetyBackupPath?: string;
  reports: RestoreReport[];
  totalInserted: number;
  totalUpdated: number;
  totalSkipped: number;
  totalConflicts: number;
  duration: number;
  error?: string;
}

/**
 * Restore backup with smart merge logic
 * - Creates safety backup first
 * - Never deletes existing data
 * - Inserts missing records
 * - Updates only if backup data is newer (based on updatedAt timestamps)
 */
export async function restoreBackup(
  backupPath: string,
  onProgress?: (step: string, progress: number) => void
): Promise<RestoreResult> {
  const startTime = Date.now();
  logger.info(`[Restore] Starting restore from: ${backupPath}`);

  const result: RestoreResult = {
    success: false,
    reports: [],
    totalInserted: 0,
    totalUpdated: 0,
    totalSkipped: 0,
    totalConflicts: 0,
    duration: 0
  };

  try {
    // Step 1: Create safety backup
    onProgress?.('Creating safety backup', 10);
    logger.info('[Restore] Creating safety backup...');
    const safetyBackupPath = await createBackup('manual');
    result.safetyBackupPath = safetyBackupPath;
    logger.info(`[Restore] Safety backup created: ${safetyBackupPath}`);

    // Step 2: Load backup data
    onProgress?.('Loading backup data', 20);
    logger.info('[Restore] Loading backup data...');
    
    const databasePath = path.join(backupPath, 'database.sql');
    const filesPath = path.join(backupPath, 'files');
    
    if (!fs.existsSync(databasePath)) {
      throw new Error('Backup database file not found');
    }

    // Step 3: Create temporary database for comparison
    onProgress?.('Preparing restore', 30);
    logger.info('[Restore] Creating temporary database...');
    const tempDbName = `restore_temp_${Date.now()}`;
    await createTempDatabase(tempDbName);

    try {
      // Step 4: Import backup into temp database
      onProgress?.('Importing backup data', 40);
      logger.info('[Restore] Importing backup into temporary database...');
      await importDatabaseToTemp(databasePath, tempDbName);

      // Step 5: Perform smart merge
      onProgress?.('Performing smart merge', 50);
      logger.info('[Restore] Starting smart merge...');
      const reports = await performSmartMerge(tempDbName, onProgress);
      result.reports = reports;

      // Calculate totals
      for (const report of reports) {
        result.totalInserted += report.inserted;
        result.totalUpdated += report.updated;
        result.totalSkipped += report.skipped;
        result.totalConflicts += report.conflicts.length;
      }

      // Step 6: Restore files
      onProgress?.('Restoring files', 90);
      if (fs.existsSync(filesPath)) {
        logger.info('[Restore] Restoring uploaded files...');
        await restoreFiles(filesPath);
      }

      result.success = true;
      onProgress?.('Restore completed', 100);
      
    } finally {
      // Cleanup temp database
      logger.info('[Restore] Cleaning up temporary database...');
      await dropTempDatabase(tempDbName);
    }

    result.duration = Date.now() - startTime;
    logger.info(`[Restore] Completed successfully`, {
      duration: `${result.duration}ms`,
      inserted: result.totalInserted,
      updated: result.totalUpdated,
      skipped: result.totalSkipped,
      conflicts: result.totalConflicts
    });

    return result;
  } catch (error: any) {
    logger.error('[Restore] Failed:', error);
    result.success = false;
    result.error = error.message;
    result.duration = Date.now() - startTime;
    throw error;
  }
}

/**
 * Create temporary database
 */
async function createTempDatabase(dbName: string): Promise<void> {
  const dbUrl = new URL(config.databaseUrl);
  const host = dbUrl.hostname;
  const port = dbUrl.port || '5432';
  const username = dbUrl.username;
  const password = dbUrl.password;

  const env = { ...process.env, PGPASSWORD: password };
  const command = `psql -h ${host} -p ${port} -U ${username} -d postgres -c "CREATE DATABASE ${dbName};"`;
  
  await execAsync(command, { env });
  logger.info(`[Restore] Temporary database created: ${dbName}`);
}

/**
 * Drop temporary database
 */
async function dropTempDatabase(dbName: string): Promise<void> {
  try {
    const dbUrl = new URL(config.databaseUrl);
    const host = dbUrl.hostname;
    const port = dbUrl.port || '5432';
    const username = dbUrl.username;
    const password = dbUrl.password;

    const env = { ...process.env, PGPASSWORD: password };
    const command = `psql -h ${host} -p ${port} -U ${username} -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`;
    
    await execAsync(command, { env });
    logger.info(`[Restore] Temporary database dropped: ${dbName}`);
  } catch (error) {
    logger.error(`[Restore] Failed to drop temp database:`, error);
  }
}

/**
 * Import database backup into temporary database
 */
async function importDatabaseToTemp(sqlPath: string, dbName: string): Promise<void> {
  const dbUrl = new URL(config.databaseUrl);
  const host = dbUrl.hostname;
  const port = dbUrl.port || '5432';
  const username = dbUrl.username;
  const password = dbUrl.password;

  const env = { ...process.env, PGPASSWORD: password };
  const command = `psql -h ${host} -p ${port} -U ${username} -d ${dbName} -f "${sqlPath}"`;
  
  await execAsync(command, { env, maxBuffer: 1024 * 1024 * 100 });
  logger.info('[Restore] Backup imported into temporary database');
}

/**
 * Perform smart merge from temp database to production
 */
async function performSmartMerge(
  tempDbName: string,
  onProgress?: (step: string, progress: number) => void
): Promise<RestoreReport[]> {
  const reports: RestoreReport[] = [];

  // Define tables in dependency order
  const tables = [
    'users',
    'teams',
    'form_templates',
    'campaigns',
    'campaign_teams',
    'campaign_qc',
    'pipeline_stages',
    'leads',
    'lead_notes',
    'lead_audits',
    'client_notes',
    'client_schedules',
    'leave_requests',
    'it_tickets',
    'it_ticket_responses',
    'it_ticket_status_history',
    'it_assignments',
    'login_history',
    'daily_top_agents',
    'system_settings'
  ];

  const totalTables = tables.length;
  let processedTables = 0;

  for (const table of tables) {
    processedTables++;
    const progress = 50 + Math.floor((processedTables / totalTables) * 40);
    onProgress?.(`Merging ${table}`, progress);
    
    const report = await mergeTable(table, tempDbName);
    reports.push(report);
  }

  return reports;
}

/**
 * Merge a single table with smart conflict resolution
 */
async function mergeTable(tableName: string, tempDbName: string): Promise<RestoreReport> {
  const report: RestoreReport = {
    table: tableName,
    inserted: 0,
    updated: 0,
    skipped: 0,
    conflicts: []
  };

  logger.info(`[Restore] Merging table: ${tableName}`);

  try {
    const dbUrl = new URL(config.databaseUrl);
    const prodDbName = dbUrl.pathname.slice(1);

    // Get records from temp database
    const tempRecords = await queryTempDatabase(tempDbName, `SELECT * FROM "${tableName}"`);
    
    if (tempRecords.length === 0) {
      logger.info(`[Restore] No records in ${tableName}, skipping`);
      return report;
    }

    // Process each record
    for (const tempRecord of tempRecords) {
      try {
        // Check if record exists in production
        const existingRecord = await queryProductionDatabase(
          prodDbName,
          `SELECT * FROM "${tableName}" WHERE id = $1`,
          [tempRecord.id]
        );

        if (existingRecord.length === 0) {
          // Insert new record
          await insertRecord(tableName, tempRecord);
          report.inserted++;
        } else {
          // Compare timestamps
          const existing = existingRecord[0];
          const tempUpdatedAt = tempRecord.updated_at ? new Date(tempRecord.updated_at) : null;
          const existingUpdatedAt = existing.updated_at ? new Date(existing.updated_at) : null;

          if (tempUpdatedAt && existingUpdatedAt) {
            if (tempUpdatedAt > existingUpdatedAt) {
              // Backup data is newer, update
              await updateRecord(tableName, tempRecord);
              report.updated++;
            } else if (tempUpdatedAt < existingUpdatedAt) {
              // Current data is newer, skip
              report.skipped++;
              report.conflicts.push({
                id: tempRecord.id,
                reason: 'Current data is newer',
                backupTimestamp: tempUpdatedAt.toISOString(),
                currentTimestamp: existingUpdatedAt.toISOString()
              });
            } else {
              // Same timestamp, skip
              report.skipped++;
            }
          } else {
            // No timestamp comparison possible, skip to be safe
            report.skipped++;
            report.conflicts.push({
              id: tempRecord.id,
              reason: 'No timestamp available for comparison'
            });
          }
        }
      } catch (error: any) {
        logger.error(`[Restore] Error processing record ${tempRecord.id}:`, error);
        report.conflicts.push({
          id: tempRecord.id,
          reason: `Error: ${error.message}`
        });
      }
    }

    logger.info(`[Restore] ${tableName}: ${report.inserted} inserted, ${report.updated} updated, ${report.skipped} skipped`);
  } catch (error: any) {
    logger.error(`[Restore] Failed to merge table ${tableName}:`, error);
    report.conflicts.push({
      id: 'TABLE_ERROR',
      reason: `Table merge failed: ${error.message}`
    });
  }

  return report;
}

/**
 * Query temporary database
 */
async function queryTempDatabase(dbName: string, query: string): Promise<any[]> {
  const dbUrl = new URL(config.databaseUrl);
  const tempUrl = `postgresql://${dbUrl.username}:${dbUrl.password}@${dbUrl.hostname}:${dbUrl.port || 5432}/${dbName}`;
  
  const { PrismaClient } = await import('@prisma/client');
  const tempPrisma = new PrismaClient({
    datasources: { db: { url: tempUrl } }
  });

  try {
    const result = await tempPrisma.$queryRawUnsafe(query);
    return result as any[];
  } finally {
    await tempPrisma.$disconnect();
  }
}

/**
 * Query production database
 */
async function queryProductionDatabase(dbName: string, query: string, params: any[] = []): Promise<any[]> {
  const result = await prisma.$queryRawUnsafe(query, ...params);
  return result as any[];
}

/**
 * Insert record into production database
 */
async function insertRecord(tableName: string, record: any): Promise<void> {
  const columns = Object.keys(record);
  const values = Object.values(record);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  
  const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
  await prisma.$executeRawUnsafe(query, ...values);
}

/**
 * Update record in production database
 */
async function updateRecord(tableName: string, record: any): Promise<void> {
  const { id, ...updates } = record;
  const columns = Object.keys(updates);
  const values = Object.values(updates);
  
  const setClause = columns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
  const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${columns.length + 1}`;
  
  await prisma.$executeRawUnsafe(query, ...values, id);
}

/**
 * Restore uploaded files
 */
async function restoreFiles(filesPath: string): Promise<void> {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  await copyDirectory(filesPath, uploadsDir);
  logger.info('[Restore] Files restored successfully');
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
      // Only copy if file doesn't exist or is older
      if (!fs.existsSync(targetPath)) {
        fs.copyFileSync(sourcePath, targetPath);
      } else {
        const sourceStats = fs.statSync(sourcePath);
        const targetStats = fs.statSync(targetPath);
        
        if (sourceStats.mtime > targetStats.mtime) {
          fs.copyFileSync(sourcePath, targetPath);
        }
      }
    }
  }
}
