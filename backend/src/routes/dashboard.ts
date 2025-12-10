import { Router } from 'express';
import { auth } from '../middleware/auth';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { getWorkDayBounds } from '../utils/workDay';
import { getCurrentMonthBounds } from '../utils/monthPeriod';

const router = Router();

router.use(auth);

// Get dashboard stats
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let where: any = {};
    
    if (req.user.role === 'Agent' || req.user.role === 'SeniorAgent') {
      where.agentId = req.user.userId;
    } else if (req.user.role === 'TeamLeader' && req.user.teamId) {
      where.teamId = req.user.teamId;
    }

    // Get current work day bounds (5 PM to 4 AM next day)
    const workDay = getWorkDayBounds();
    
    // Today's Performance - Current Work Day stats
    const todayWhere = {
      ...where,
      createdAt: {
        gte: workDay.start,
        lt: workDay.end
      }
    };

    const todayLeadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: todayWhere,
      _count: { _all: true }
    });

    const todayStats: any = {
      total: 0,
      qualified: 0,
      disqualified: 0,
      duplicate: 0,
      pending: 0,
      callback: 0
    };

    todayLeadsByStatus.forEach(item => {
      todayStats.total += item._count._all;
      todayStats[item.status.toLowerCase()] = item._count._all;
    });

    // Get current month bounds (1st at 4 AM to next 1st at 4 AM)
    const monthBounds = getCurrentMonthBounds();
    
    // Monthly Overview - Current Month stats
    const monthWhere = {
      ...where,
      createdAt: {
        gte: monthBounds.start,
        lt: monthBounds.end
      }
    };

    const monthLeadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: monthWhere,
      _count: { _all: true }
    });

    const monthStats: any = {
      total: 0,
      qualified: 0,
      disqualified: 0,
      duplicate: 0,
      pending: 0,
      callback: 0
    };

    monthLeadsByStatus.forEach(item => {
      monthStats.total += item._count._all;
      monthStats[item.status.toLowerCase()] = item._count._all;
    });

    res.json({
      today: todayStats,
      month: monthStats
    });
  } catch (error) {
    next(error);
  }
});

export default router;






















