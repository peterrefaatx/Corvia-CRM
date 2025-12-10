/**
 * Login History Utility
 * Handles immediate recording of login history for accurate attendance tracking
 */

import prisma from '../lib/prisma';
import { getWorkDayDate } from './timezone';
import { logger } from './logger';

interface LoginHistoryData {
  userId: string;
  loginTime: Date;
  latenessMinutes: number;
}

/**
 * Record login history immediately when user logs in
 * This ensures attendance data is never lost, even if daily job fails
 */
export async function recordLoginHistory(data: LoginHistoryData): Promise<boolean> {
  try {
    const { userId, loginTime, latenessMinutes } = data;
    
    const loginDate = getWorkDayDate();
    
    const result = await prisma.loginHistory.upsert({
      where: {
        userId_loginDate: {
          userId,
          loginDate
        }
      },
      update: {
      },
      create: {
        userId,
        loginDate,
        loginTime,
        latenessMinutes
      }
    });
    
    const wasCreated = result.createdAt.getTime() === new Date().getTime();
    
    if (wasCreated) {
      logger.info(`✓ Recorded login history for user ${userId} on ${loginDate.toISOString().split('T')[0]}`);
      return true;
    } else {
      logger.info(`Login history already exists for user ${userId} on ${loginDate.toISOString().split('T')[0]}`);
      return false;
    }
    
  } catch (error) {
    logger.error('Failed to record login history:', error);
    return false;
  }
}

/**
 * Check if user has already logged in today (for the current work day)
 */
export async function hasLoggedInToday(userId: string): Promise<boolean> {
  try {
    const loginDate = getWorkDayDate();
    
    const record = await prisma.loginHistory.findUnique({
      where: {
        userId_loginDate: {
          userId,
          loginDate
        }
      }
    });
    
    return !!record;
    
  } catch (error) {
    logger.error('Failed to check login history:', error);
    return false;
  }
}

/**
 * Get user's login history for a date range
 */
export async function getUserLoginHistory(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  try {
    return await prisma.loginHistory.findMany({
      where: {
        userId,
        loginDate: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        loginDate: 'asc'
      }
    });
  } catch (error) {
    logger.error('Failed to get login history:', error);
    return [];
  }
}
