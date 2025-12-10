/**
 * Cleanup Old Recordings Job
 * Deletes recording files older than 90 days to prevent disk space issues
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const RECORDINGS_DIR = path.join(__dirname, '../../uploads/recordings');
const MAX_AGE_DAYS = 90; // Keep recordings for 90 days

export async function cleanupOldRecordings() {
  logger.jobStart('Cleanup Old Recordings');
  
  try {
    // Check if directory exists
    if (!fs.existsSync(RECORDINGS_DIR)) {
      logger.info('Recordings directory does not exist, skipping cleanup');
      return;
    }

    const files = fs.readdirSync(RECORDINGS_DIR);
    const now = Date.now();
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    
    let deletedCount = 0;
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(RECORDINGS_DIR, file);
      
      try {
        const stats = fs.statSync(filePath);
        // Use creation time (birthtime), not modification time
        const fileAge = now - stats.birthtimeMs;

        // Delete if older than max age
        if (fileAge > maxAge) {
          totalSize += stats.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          
          logger.debug('Deleted old recording', {
            file,
            ageInDays: Math.floor(fileAge / (24 * 60 * 60 * 1000)),
            size: `${(stats.size / 1024 / 1024).toFixed(2)}MB`
          });
        }
      } catch (error) {
        logger.error(`Failed to process file: ${file}`, error);
      }
    }

    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    logger.jobComplete('Cleanup Old Recordings', Date.now() - now, deletedCount);
    logger.info('Cleanup summary', {
      filesDeleted: deletedCount,
      spaceFreed: `${totalSizeMB}MB`,
      remainingFiles: files.length - deletedCount
    });

  } catch (error) {
    logger.jobError('Cleanup Old Recordings', error as Error);
    throw error;
  }
}

// Run immediately if called directly
if (require.main === module) {
  cleanupOldRecordings()
    .then(() => {
      console.log('Cleanup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}
