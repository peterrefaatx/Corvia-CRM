/**
 * Job Scheduler
 * Schedules recurring jobs using node-cron
 */

import cron from 'node-cron';
import { calculateDailyTopAgents } from './dailyTopAgentSnapshot';
import { saveDailyLoginHistory } from './dailyLoginSnapshot';
import { saveDailyITTicketSnapshot } from './dailyITTicketSnapshot';
import { cleanupOldRecordings } from './cleanupOldRecordings';
import { cleanupOldLeads } from './dataRetentionCleanup';
import { performDailyBackup, performMonthlyBackup, performYearlyBackup } from './databaseBackup';
import { logger } from '../utils/logger';

interface JobResult {
  name: string;
  success: boolean;
  duration: number;
  error?: Error;
}

async function runJobWithTracking(
  jobName: string, 
  jobFunction: () => Promise<void>
): Promise<JobResult> {
  const startTime = Date.now();
  logger.jobStart(jobName);
  
  try {
    await jobFunction();
    const duration = Date.now() - startTime;
    logger.jobComplete(jobName, duration);
    return { name: jobName, success: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.jobError(jobName, error as Error);
    return { name: jobName, success: false, duration, error: error as Error };
  }
}

async function runDailyJobs() {
  logger.info('Starting daily jobs execution at 4 AM');
  const results: JobResult[] = [];
  
  // Run jobs sequentially with tracking
  results.push(await runJobWithTracking('Daily Database Backup', performDailyBackup));
  results.push(await runJobWithTracking('Daily Login History', saveDailyLoginHistory));
  results.push(await runJobWithTracking('Daily Top Agent Snapshot', calculateDailyTopAgents));
  results.push(await runJobWithTracking('Daily IT Ticket Snapshot', saveDailyITTicketSnapshot));
  results.push(await runJobWithTracking('Cleanup Old Recordings', cleanupOldRecordings));
  results.push(await runJobWithTracking('Data Retention Cleanup', cleanupOldLeads));
  
  // Check if it's the 1st of the month for monthly backup (in Cairo timezone)
  // Since cron runs at 4 AM Cairo time, we can use local date
  const today = new Date();
  if (today.getDate() === 1) {
    results.push(await runJobWithTracking('Monthly Database Backup', performMonthlyBackup));
  }
  
  // Check if it's January 1st for yearly backup (in Cairo timezone)
  if (today.getMonth() === 0 && today.getDate() === 1) {
    results.push(await runJobWithTracking('Yearly Database Backup', performYearlyBackup));
  }
  
  // Summary
  const failed = results.filter(r => !r.success);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  if (failed.length > 0) {
    logger.error('Daily jobs completed with failures', undefined, {
      total: results.length,
      failed: failed.length,
      failedJobs: failed.map(f => f.name),
      totalDuration
    });
    
    // In production, send notification email/slack here
    // await sendJobFailureNotification(failed);
  } else {
    logger.info('All daily jobs completed successfully', {
      total: results.length,
      totalDuration
    });
  }
}

export function startScheduler() {
  logger.info('Starting job scheduler...');
  
  // Run daily at 4:00 AM Cairo time
  // Cron format: minute hour day month weekday
  // '0 4 * * *' = At 4:00 AM every day
  cron.schedule('0 4 * * *', runDailyJobs, {
    timezone: 'Africa/Cairo'
  });
  
  logger.info('Jobs scheduled successfully', {
    timezone: 'Africa/Cairo',
    schedule: '4:00 AM daily (Cairo time)',
    jobs: [
      'Daily Database Backup',
      'Daily Login History',
      'Daily Top Agent Snapshot',
      'Daily IT Ticket Snapshot',
      'Cleanup Old Recordings',
      'Data Retention Cleanup',
      'Monthly Backup (1st of month)',
      'Yearly Backup (January 1st)'
    ]
  });
}
