/**
 * Daily Login Snapshot Job - SAFETY NET
 * Runs at 4 AM daily to catch any login records that weren't saved immediately
 * 
 * NOTE: With the enhanced system, most records are saved immediately during login.
 * This job acts as a safety net to catch any that might have been missed.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function saveDailyLoginHistory() {
  logger.info('[Daily Login Snapshot] Starting safety net job...');
  
  try {
    // Get yesterday's work day date (normalized to start of day)
    const now = new Date();
    const loginDate = new Date(now);
    loginDate.setHours(4, 0, 0, 0);
    loginDate.setDate(loginDate.getDate() - 1); // Yesterday at 4 AM
    
    // Calculate next day for date range query
    const nextDay = new Date(loginDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    logger.info(`[Daily Login Snapshot] Checking login data for: ${loginDate.toISOString().split('T')[0]}`);
    
    // Get all users who logged in yesterday
    // Use date range instead of exact match to handle timezone/millisecond differences
    const users = await prisma.user.findMany({
      where: {
        todayLoginTime: { not: null },
        isActive: true,
        role: { in: ['Agent', 'SeniorAgent', 'TeamLeader', 'AccountManager', 'QualityControl', 'IT'] },
        lastLoginDate: {
          gte: loginDate,  // Greater than or equal to start of yesterday
          lt: nextDay      // Less than start of today
        }
      },
      select: {
        id: true,
        fullName: true,
        todayLoginTime: true,
        todayLatenessMinutes: true,
        lastLoginDate: true
      }
    });
    
    logger.info(`[Daily Login Snapshot] Found ${users.length} users who logged in yesterday`);
    
    let alreadyExisted = 0;
    let newlySaved = 0;
    
    for (const user of users) {
      try {
        if (!user.todayLoginTime || !user.lastLoginDate) continue;
        
        // Normalize user's actual login date to start of day
        const userLoginDate = new Date(user.lastLoginDate);
        userLoginDate.setHours(0, 0, 0, 0);
        
        // Try to create record (will fail silently if already exists due to upsert)
        const result = await prisma.loginHistory.upsert({
          where: {
            userId_loginDate: {
              userId: user.id,
              loginDate: userLoginDate
            }
          },
          update: {
            // Don't update if exists - preserve the immediate recording
          },
          create: {
            userId: user.id,
            loginDate: userLoginDate,
            loginTime: user.todayLoginTime,
            latenessMinutes: user.todayLatenessMinutes || 0
          }
        });
        
        // Check if this was newly created or already existed
        const wasJustCreated = Math.abs(result.createdAt.getTime() - new Date().getTime()) < 5000;
        
        if (wasJustCreated) {
          newlySaved++;
          logger.warn(`  ⚠️  Safety net caught missing record for ${user.fullName}`);
        } else {
          alreadyExisted++;
        }
        
      } catch (error) {
        logger.error(`  ✗ Error processing login for ${user.fullName}:`, error);
      }
    }
    
    // Log results
    if (newlySaved === 0) {
      logger.info(`✓ All ${alreadyExisted} records were already saved during login (system working perfectly)`);
    } else {
      logger.warn(`⚠️  WARNING: ${newlySaved} records were missing and caught by safety net!`);
      logger.info(`✓ ${alreadyExisted} records were already saved during login`);
    }
    
    logger.info(`[Daily Login Snapshot] Safety net job completed successfully`);
    
  } catch (error) {
    logger.error('[Daily Login Snapshot] Safety net job failed:', error);
    throw error;
  }
}

// Run immediately if called directly
if (require.main === module) {
  saveDailyLoginHistory()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}
