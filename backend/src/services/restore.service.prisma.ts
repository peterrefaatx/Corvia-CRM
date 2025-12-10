import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { createBackup } from './backup.service.prisma';

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
 * Restore backup with smart merge logic using Prisma
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
    
    const databasePath = path.join(backupPath, 'database.json');
    const filesPath = path.join(backupPath, 'files');
    
    if (!fs.existsSync(databasePath)) {
      throw new Error('Backup database file not found');
    }

    const backupData = JSON.parse(fs.readFileSync(databasePath, 'utf8'));

    // Step 3: Perform smart merge
    onProgress?.('Performing smart merge', 30);
    logger.info('[Restore] Starting smart merge...');
    const reports = await performSmartMerge(backupData, onProgress);
    result.reports = reports;

    // Calculate totals
    for (const report of reports) {
      result.totalInserted += report.inserted;
      result.totalUpdated += report.updated;
      result.totalSkipped += report.skipped;
      result.totalConflicts += report.conflicts.length;
    }

    // Step 3.5: Fix orphaned campaign references
    onProgress?.('Fixing campaign references', 85);
    logger.info('[Restore] Fixing orphaned campaign references...');
    await fixOrphanedCampaignReferences(backupData);
    logger.info('[Restore] Campaign references fixed');

    // Step 4: Restore files
    onProgress?.('Restoring files', 90);
    if (fs.existsSync(filesPath)) {
      logger.info('[Restore] Restoring uploaded files...');
      await restoreFiles(filesPath);
    }

    result.success = true;
    onProgress?.('Restore completed', 100);
    
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
 * Perform smart merge using Prisma
 */
async function performSmartMerge(
  backupData: Record<string, any[]>,
  onProgress?: (step: string, progress: number) => void
): Promise<RestoreReport[]> {
  const reports: RestoreReport[] = [];

  // Define tables in correct dependency order (parent tables first)
  const tables = [
    'systemSettings',
    'pipelineStages',
    'formTemplates',
    'users',
    'teams',
    'campaigns',
    'campaignTeams',
    'campaignQCs',
    'leads',
    'leadNotes',
    'leadAudits',
    'clientNotes',
    'clientSchedules',
    'leaveRequests',
    'itTickets',
    'itTicketResponses',
    'itTicketStatusHistory',
    'itAssignments',
    'loginHistory',
    'dailyTopAgents'
  ];

  const tableMapping: Record<string, { model: string; hasUpdatedAt: boolean }> = {
    'systemSettings': { model: 'systemSettings', hasUpdatedAt: true },
    'pipelineStages': { model: 'pipelineStage', hasUpdatedAt: true },
    'formTemplates': { model: 'formTemplate', hasUpdatedAt: true },
    'users': { model: 'user', hasUpdatedAt: false },
    'teams': { model: 'team', hasUpdatedAt: false },
    'campaigns': { model: 'campaign', hasUpdatedAt: false },
    'campaignTeams': { model: 'campaignTeam', hasUpdatedAt: false },
    'campaignQCs': { model: 'campaignQC', hasUpdatedAt: false },
    'leads': { model: 'lead', hasUpdatedAt: true },
    'leadNotes': { model: 'leadNote', hasUpdatedAt: false },
    'leadAudits': { model: 'leadAudit', hasUpdatedAt: false },
    'clientNotes': { model: 'clientNote', hasUpdatedAt: true },
    'clientSchedules': { model: 'clientSchedule', hasUpdatedAt: true },
    'leaveRequests': { model: 'leaveRequest', hasUpdatedAt: false },
    'itTickets': { model: 'iTTicket', hasUpdatedAt: true },
    'itTicketResponses': { model: 'iTTicketResponse', hasUpdatedAt: false },
    'itTicketStatusHistory': { model: 'iTTicketStatusHistory', hasUpdatedAt: false },
    'itAssignments': { model: 'iTAssignment', hasUpdatedAt: false },
    'loginHistory': { model: 'loginHistory', hasUpdatedAt: false },
    'dailyTopAgents': { model: 'dailyTopAgent', hasUpdatedAt: false }
  };
  const totalTables = tables.length;
  let processedTables = 0;

  for (const table of tables) {
    if (backupData[table]) {
      processedTables++;
      const progress = 30 + Math.floor((processedTables / totalTables) * 60);
      onProgress?.(`Merging ${table}`, progress);
      
      const { model, hasUpdatedAt } = tableMapping[table];
      const report = await restoreTable(model, backupData[table], table, hasUpdatedAt);
      reports.push(report);
    }
  }

  return reports;
}

/**
 * Restore a single table with smart merge logic
 */
async function restoreTable(
  modelName: string,
  backupRecords: any[],
  displayName: string,
  hasUpdatedAt: boolean
): Promise<RestoreReport> {
  const report: RestoreReport = {
    table: displayName,
    inserted: 0,
    updated: 0,
    skipped: 0,
    conflicts: []
  };

  logger.info(`[Restore] Merging table: ${displayName} (${backupRecords.length} records)`);

  const model = (prisma as any)[modelName];
  
  if (!model) {
    logger.warn(`No Prisma model found for: ${modelName}`);
    report.skipped = backupRecords.length;
    return report;
  }

  // Special handling for users table (circular reference)
  if (modelName === 'user') {
    return await restoreUsersTable(model, backupRecords, displayName);
  }

  for (const backupRecord of backupRecords) {
    try {
      const existing = await model.findUnique({
        where: { id: backupRecord.id }
      });

      if (!existing) {
        // Insert new record (was deleted or never existed)
        try {
          await model.create({ data: backupRecord });
          report.inserted++;
          logger.info(`[Restore] Inserted ${displayName} record: ${backupRecord.id}`);
        } catch (createError: any) {
          // If creation fails due to foreign key, log it
          logger.error(`[Restore] Failed to insert ${displayName} record ${backupRecord.id}:`, createError.message);
          report.conflicts.push({
            id: backupRecord.id,
            reason: `Insert failed: ${createError.message}`
          });
        }
      } else if (hasUpdatedAt) {
        // Compare timestamps
        const backupUpdatedAt = backupRecord.updatedAt ? new Date(backupRecord.updatedAt) : null;
        const currentUpdatedAt = existing.updatedAt ? new Date(existing.updatedAt) : null;

        if (backupUpdatedAt && currentUpdatedAt) {
          if (backupUpdatedAt > currentUpdatedAt) {
            await model.update({
              where: { id: backupRecord.id },
              data: backupRecord
            });
            report.updated++;
            logger.info(`[Restore] Updated ${displayName} record: ${backupRecord.id}`);
          } else {
            report.skipped++;
            
            if (backupUpdatedAt < currentUpdatedAt) {
              report.conflicts.push({
                id: backupRecord.id,
                reason: 'Current data is newer',
                backupTimestamp: backupUpdatedAt.toISOString(),
                currentTimestamp: currentUpdatedAt.toISOString()
              });
            }
          }
        } else {
          report.skipped++;
          report.conflicts.push({
            id: backupRecord.id,
            reason: 'No timestamp available for comparison'
          });
        }
      } else {
        // No timestamp, skip to be safe (record exists and we can't compare)
        report.skipped++;
        logger.info(`[Restore] Skipped ${displayName} record (no timestamp): ${backupRecord.id}`);
      }
    } catch (error: any) {
      logger.error(`Error restoring record ${backupRecord.id} in ${displayName}:`, error);
      report.conflicts.push({
        id: backupRecord.id,
        reason: `Error: ${error.message}`
      });
    }
  }

  logger.info(`[Restore] ${displayName}: ${report.inserted} inserted, ${report.updated} updated, ${report.skipped} skipped`);

  return report;
}

/**
 * Special handler for users table (two-pass approach for circular references)
 */
async function restoreUsersTable(
  model: any,
  backupRecords: any[],
  tableName: string
): Promise<RestoreReport> {
  const report: RestoreReport = {
    table: tableName,
    inserted: 0,
    updated: 0,
    skipped: 0,
    conflicts: []
  };

  logger.info(`[Restore] Using two-pass approach for users table (${backupRecords.length} records)`);

  // Pass 1: Create/update users without accountManagerId
  for (const backupRecord of backupRecords) {
    try {
      const existing = await model.findUnique({
        where: { id: backupRecord.id }
      });

      const { accountManagerId, ...recordWithoutAM } = backupRecord;

      if (!existing) {
        await model.create({ data: recordWithoutAM });
        report.inserted++;
      } else {
        // For users, we skip updates to avoid conflicts
        report.skipped++;
      }
    } catch (error: any) {
      logger.error(`Error in pass 1 for user ${backupRecord.id}:`, error);
      report.conflicts.push({
        id: backupRecord.id,
        reason: `Pass 1 Error: ${error.message}`
      });
    }
  }

  // Pass 2: Update accountManagerId references
  let accountManagerUpdates = 0;
  for (const backupRecord of backupRecords) {
    if (backupRecord.accountManagerId) {
      try {
        const accountManagerExists = await model.findUnique({
          where: { id: backupRecord.accountManagerId }
        });

        if (accountManagerExists) {
          await model.update({
            where: { id: backupRecord.id },
            data: { accountManagerId: backupRecord.accountManagerId }
          });
          accountManagerUpdates++;
        }
      } catch (error: any) {
        logger.warn(`Could not set accountManagerId for user ${backupRecord.id}:`, error.message);
      }
    }
  }

  logger.info(`[Restore] ${tableName}: ${report.inserted} inserted, ${report.updated} updated, ${report.skipped} skipped, ${accountManagerUpdates} account manager links restored`);
  return report;
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
 * Fix all orphaned references (SetNull relationships)
 * This handles cases where related records were deleted (setting foreign keys to null)
 * and then restored, but the referencing records still have null foreign keys
 */
async function fixOrphanedCampaignReferences(backupData: Record<string, any[]>): Promise<void> {
  let totalFixed = 0;

  // Fix Users: teamId, accountManagerId
  if (backupData.users) {
    let fixed = 0;
    for (const backupUser of backupData.users) {
      const updates: any = {};
      
      if (backupUser.teamId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: backupUser.id },
          select: { teamId: true }
        });
        if (currentUser && !currentUser.teamId) {
          updates.teamId = backupUser.teamId;
        }
      }
      
      if (backupUser.accountManagerId) {
        const currentUser = await prisma.user.findUnique({
          where: { id: backupUser.id },
          select: { accountManagerId: true }
        });
        if (currentUser && !currentUser.accountManagerId) {
          updates.accountManagerId = backupUser.accountManagerId;
        }
      }

      if (Object.keys(updates).length > 0) {
        try {
          await prisma.user.update({
            where: { id: backupUser.id },
            data: updates
          });
          fixed++;
        } catch (error: any) {
          logger.warn(`[Restore] Could not fix user references for ${backupUser.id}:`, error.message);
        }
      }
    }
    if (fixed > 0) {
      logger.info(`[Restore] Fixed ${fixed} orphaned user references`);
      totalFixed += fixed;
    }
  }

  // Fix Teams: teamLeaderUserId
  if (backupData.teams) {
    let fixed = 0;
    for (const backupTeam of backupData.teams) {
      if (backupTeam.teamLeaderUserId) {
        const currentTeam = await prisma.team.findUnique({
          where: { id: backupTeam.id },
          select: { teamLeaderUserId: true }
        });
        if (currentTeam && !currentTeam.teamLeaderUserId) {
          try {
            await prisma.team.update({
              where: { id: backupTeam.id },
              data: { teamLeaderUserId: backupTeam.teamLeaderUserId }
            });
            fixed++;
          } catch (error: any) {
            logger.warn(`[Restore] Could not fix team leader for ${backupTeam.id}:`, error.message);
          }
        }
      }
    }
    if (fixed > 0) {
      logger.info(`[Restore] Fixed ${fixed} orphaned team leader references`);
      totalFixed += fixed;
    }
  }

  // Fix Campaigns: clientId, qcUserId, formTemplateId
  if (backupData.campaigns) {
    let fixed = 0;
    for (const backupCampaign of backupData.campaigns) {
      const updates: any = {};
      
      if (backupCampaign.clientId) {
        const current = await prisma.campaign.findUnique({
          where: { id: backupCampaign.id },
          select: { clientId: true }
        });
        if (current && !current.clientId) {
          updates.clientId = backupCampaign.clientId;
        }
      }
      
      if (backupCampaign.qcUserId) {
        const current = await prisma.campaign.findUnique({
          where: { id: backupCampaign.id },
          select: { qcUserId: true }
        });
        if (current && !current.qcUserId) {
          updates.qcUserId = backupCampaign.qcUserId;
        }
      }
      
      if (backupCampaign.formTemplateId) {
        const current = await prisma.campaign.findUnique({
          where: { id: backupCampaign.id },
          select: { formTemplateId: true }
        });
        if (current && !current.formTemplateId) {
          updates.formTemplateId = backupCampaign.formTemplateId;
        }
      }

      if (Object.keys(updates).length > 0) {
        try {
          await prisma.campaign.update({
            where: { id: backupCampaign.id },
            data: updates
          });
          fixed++;
        } catch (error: any) {
          logger.warn(`[Restore] Could not fix campaign references for ${backupCampaign.id}:`, error.message);
        }
      }
    }
    if (fixed > 0) {
      logger.info(`[Restore] Fixed ${fixed} orphaned campaign references`);
      totalFixed += fixed;
    }
  }

  // Fix Leads: campaignId, qcUserId
  if (backupData.leads) {
    let fixed = 0;
    for (const backupLead of backupData.leads) {
      const updates: any = {};
      
      if (backupLead.campaignId) {
        const current = await prisma.lead.findUnique({
          where: { id: backupLead.id },
          select: { campaignId: true }
        });
        if (current && !current.campaignId) {
          updates.campaignId = backupLead.campaignId;
        }
      }
      
      if (backupLead.qcUserId) {
        const current = await prisma.lead.findUnique({
          where: { id: backupLead.id },
          select: { qcUserId: true }
        });
        if (current && !current.qcUserId) {
          updates.qcUserId = backupLead.qcUserId;
        }
      }

      if (Object.keys(updates).length > 0) {
        try {
          await prisma.lead.update({
            where: { id: backupLead.id },
            data: updates
          });
          fixed++;
        } catch (error: any) {
          logger.warn(`[Restore] Could not fix lead references for ${backupLead.id}:`, error.message);
        }
      }
    }
    if (fixed > 0) {
      logger.info(`[Restore] Fixed ${fixed} orphaned lead references`);
      totalFixed += fixed;
    }
  }

  // Fix Leave Requests: managerId
  if (backupData.leaveRequests) {
    let fixed = 0;
    for (const backupRequest of backupData.leaveRequests) {
      if (backupRequest.managerId) {
        const current = await prisma.leaveRequest.findUnique({
          where: { id: backupRequest.id },
          select: { managerId: true }
        });
        if (current && !current.managerId) {
          try {
            await prisma.leaveRequest.update({
              where: { id: backupRequest.id },
              data: { managerId: backupRequest.managerId }
            });
            fixed++;
          } catch (error: any) {
            logger.warn(`[Restore] Could not fix leave request manager for ${backupRequest.id}:`, error.message);
          }
        }
      }
    }
    if (fixed > 0) {
      logger.info(`[Restore] Fixed ${fixed} orphaned leave request manager references`);
      totalFixed += fixed;
    }
  }

  // Fix IT Tickets: assignedITId
  if (backupData.itTickets) {
    let fixed = 0;
    for (const backupTicket of backupData.itTickets) {
      if (backupTicket.assignedITId) {
        const current = await prisma.iTTicket.findUnique({
          where: { id: backupTicket.id },
          select: { assignedITId: true }
        });
        if (current && !current.assignedITId) {
          try {
            await prisma.iTTicket.update({
              where: { id: backupTicket.id },
              data: { assignedITId: backupTicket.assignedITId }
            });
            fixed++;
          } catch (error: any) {
            logger.warn(`[Restore] Could not fix IT ticket assignment for ${backupTicket.id}:`, error.message);
          }
        }
      }
    }
    if (fixed > 0) {
      logger.info(`[Restore] Fixed ${fixed} orphaned IT ticket assignments`);
      totalFixed += fixed;
    }
  }

  if (totalFixed > 0) {
    logger.info(`[Restore] Total orphaned references fixed: ${totalFixed}`);
  } else {
    logger.info(`[Restore] No orphaned references found`);
  }
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
