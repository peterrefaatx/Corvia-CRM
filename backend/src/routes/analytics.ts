import { Router } from 'express';
import { auth } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { getCurrentMonthBounds } from '../utils/monthPeriod';
import { getWorkDayRangeForPeriod } from '../utils/workDayRange';

const router = Router();

router.use(auth);

// Get user analytics
router.get('/user/:userId', async (req: AuthRequest, res, next) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;

    // Authorization check
    const requestingUser = await prisma.user.findUnique({
      where: { id: req.user?.userId }
    });

    if (!requestingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow viewing own stats unless Manager/QC/TeamLeader/AccountManager
    if ((requestingUser.role === UserRole.Agent || requestingUser.role === UserRole.SeniorAgent) && userId !== req.user?.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Account Managers can only view stats for agents in their managed teams
    if (requestingUser.role === UserRole.AccountManager) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { teamId: true }
      });

      if (targetUser?.teamId) {
        const managedTeamLeaders = await prisma.user.findMany({
          where: {
            accountManagerId: req.user?.userId,
            role: UserRole.TeamLeader,
            isActive: true
          },
          select: { teamId: true }
        });

        const managedTeamIds = managedTeamLeaders
          .map(tl => tl.teamId)
          .filter((id): id is string => id !== null);

        if (!managedTeamIds.includes(targetUser.teamId)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Use work day ranges (4 PM to 4 AM cutoff)
    let startDate: Date, endDate: Date;
    if (from && to) {
      const range = getWorkDayRangeForPeriod(from as string, to as string);
      startDate = range.start;
      endDate = range.end;
    } else {
      const monthBounds = getCurrentMonthBounds();
      startDate = monthBounds.start;
      endDate = monthBounds.end;
    }

    // Get user leads
    const leads = await prisma.lead.findMany({
      where: {
        agentId: userId,
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      },
      select: {
        id: true,
        status: true,
        createdAt: true
      }
    });

    // Calculate stats
    const total = leads.length;
    const qualified = leads.filter(l => l.status === 'Qualified').length;
    const disqualified = leads.filter(l => l.status === 'Disqualified').length;
    const duplicate = leads.filter(l => l.status === 'Duplicate').length;
    const pending = leads.filter(l => l.status === 'Pending').length;
    const callback = leads.filter(l => l.status === 'Callback').length;

    const qualificationRate = total > 0 ? (qualified / total) * 100 : 0;
    const duplicateRate = total > 0 ? (duplicate / total) * 100 : 0;

    // Daily breakdown
    const dailyStats: Record<string, any> = {};
    leads.forEach(lead => {
      const date = lead.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, qualified: 0, disqualified: 0, duplicate: 0, pending: 0, callback: 0 };
      }
      dailyStats[date].total++;
      dailyStats[date][lead.status.toLowerCase()]++;
    });

    const dailyData = Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
      date,
      ...(stats as object)
    }));

    // Status distribution
    const statusDistribution = [
      { name: 'Qualified', value: qualified, color: '#10b981' },
      { name: 'Disqualified', value: disqualified, color: '#ef4444' },
      { name: 'Duplicate', value: duplicate, color: '#3b82f6' },
      { name: 'Pending', value: pending, color: '#f59e0b' },
      { name: 'Callback', value: callback, color: '#000000' }
    ];

    res.json({
      summary: {
        total,
        qualified,
        disqualified,
        duplicate,
        pending,
        callback,
        qualificationRate: qualificationRate.toFixed(1),
        duplicateRate: duplicateRate.toFixed(1)
      },
      dailyData,
      statusDistribution,
      period: {
        from: startDate,
        to: endDate
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get team analytics
router.get('/team/:teamId', async (req: AuthRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const { from, to } = req.query;

    // Use work day ranges (4 PM to 4 AM cutoff)
    let startDate: Date, endDate: Date;
    if (from && to) {
      const range = getWorkDayRangeForPeriod(from as string, to as string);
      startDate = range.start;
      endDate = range.end;
    } else {
      const monthBounds = getCurrentMonthBounds();
      startDate = monthBounds.start;
      endDate = monthBounds.end;
    }

    // Get team info
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        users: {
          where: { 
            role: { in: [UserRole.Agent, UserRole.SeniorAgent] },
            isActive: true 
          }
        },
        campaigns: {
          include: {
            campaign: true
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team leads
    const leads = await prisma.lead.findMany({
      where: {
        teamId,
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      },
      include: {
        agent: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });

    // Team summary
    const total = leads.length;
    const qualified = leads.filter(l => l.status === 'Qualified').length;
    const disqualified = leads.filter(l => l.status === 'Disqualified').length;
    const duplicate = leads.filter(l => l.status === 'Duplicate').length;
    const qualificationRate = total > 0 ? (qualified / total) * 100 : 0;

    // Agent breakdown
    const agentStats: any = {};
    leads.forEach(lead => {
      const agentId = lead.agentId;
      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          agentId,
          agentName: lead.agent.fullName,
          total: 0,
          qualified: 0,
          disqualified: 0,
          duplicate: 0
        };
      }
      agentStats[agentId].total++;
      if (lead.status === 'Qualified') agentStats[agentId].qualified++;
      if (lead.status === 'Disqualified') agentStats[agentId].disqualified++;
      if (lead.status === 'Duplicate') agentStats[agentId].duplicate++;
    });

    const agentData = Object.values(agentStats).map((agent: any) => ({
      ...agent,
      qualificationRate: agent.total > 0 ? ((agent.qualified / agent.total) * 100).toFixed(1) : '0'
    }));

    // Daily trend
    const dailyStats: Record<string, any> = {};
    leads.forEach(lead => {
      const date = lead.createdAt.toISOString().split('T')[0];
      if (!dailyStats[date]) {
        dailyStats[date] = { total: 0, qualified: 0 };
      }
      dailyStats[date].total++;
      if (lead.status === 'Qualified') dailyStats[date].qualified++;
    });

    const dailyData = Object.entries(dailyStats).map(([date, stats]: [string, any]) => ({
      date,
      ...(stats as object)
    }));

    res.json({
      team: {
        id: team.id,
        name: team.name,
        agentCount: team.users.length
      },
      summary: {
        total,
        qualified,
        disqualified,
        duplicate,
        qualificationRate: qualificationRate.toFixed(1),
        avgPerAgent: team.users.length > 0 ? (total / team.users.length).toFixed(1) : '0'
      },
      agentData,
      dailyData,
      campaignProgress: [], // Will be added in next update
      period: {
        from: startDate,
        to: endDate
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get all teams comparison
router.get('/teams/compare', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query;

    // Use work day ranges (4 PM to 4 AM cutoff)
    let startDate: Date, endDate: Date;
    if (from && to) {
      const range = getWorkDayRangeForPeriod(from as string, to as string);
      startDate = range.start;
      endDate = range.end;
    } else {
      const monthBounds = getCurrentMonthBounds();
      startDate = monthBounds.start;
      endDate = monthBounds.end;
    }

    const teams = await prisma.team.findMany({
      include: {
        users: {
          where: { 
            role: { in: [UserRole.Agent, UserRole.SeniorAgent] },
            isActive: true 
          }
        }
      }
    });

    // Get leads for each team separately to avoid relation issues
    const teamComparison = await Promise.all(teams.map(async (team) => {
      const leads = await prisma.lead.findMany({
        where: {
          teamId: team.id,
          createdAt: {
            gte: startDate,
            lt: endDate
          }
        },
        select: {
          status: true
        }
      });

      const total = leads.length;
      const qualified = leads.filter(l => l.status === 'Qualified').length;
      const qualificationRate = total > 0 ? (qualified / total) * 100 : 0;

      return {
        teamId: team.id,
        teamName: team.name,
        total,
        qualified,
        qualificationRate: qualificationRate.toFixed(1),
        agentCount: team.users.length,
        avgPerAgent: team.users.length > 0 ? (total / team.users.length).toFixed(1) : '0'
      };
    }));

    res.json(teamComparison);
  } catch (error) {
    console.error('Error in teams/compare:', error);
    next(error);
  }
});

// Get campaign progress for team
router.get('/team/:teamId/campaigns', async (req: AuthRequest, res, next) => {
  try {
    const { teamId } = req.params;
    const { from, to } = req.query;

    // Use work day ranges (4 PM to 4 AM cutoff)
    let startDate: Date, endDate: Date;
    if (from && to) {
      const range = getWorkDayRangeForPeriod(from as string, to as string);
      startDate = range.start;
      endDate = range.end;
    } else {
      const monthBounds = getCurrentMonthBounds();
      startDate = monthBounds.start;
      endDate = monthBounds.end;
    }

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        campaigns: {
          include: {
            campaign: true
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const campaignProgress = await Promise.all(
      team.campaigns.map(async (tc) => {
        const campaignLeads = await prisma.lead.findMany({
          where: {
            campaignId: tc.campaign.id,
            teamId,
            createdAt: {
              gte: startDate,
              lt: endDate
            }
          }
        });

        const total = campaignLeads.length;
        const pending = campaignLeads.filter(l => l.status === 'Pending').length;
        const callback = campaignLeads.filter(l => l.status === 'Callback').length;
        const achieved = campaignLeads.filter(l => l.status === 'Qualified').length;
        const duplicate = campaignLeads.filter(l => l.status === 'Duplicate').length;
        const disqualified = campaignLeads.filter(l => l.status === 'Disqualified').length;
        const missed = disqualified;

        return {
          campaignId: tc.campaign.id,
          campaignName: tc.campaign.name,
          timezone: tc.campaign.timezone || '-',
          target: tc.campaign.leadsTarget || 0,
          pending,
          callback,
          achieved,
          duplicate,
          disqualified,
          missed,
          total,
          targetReached: achieved >= (tc.campaign.leadsTarget ?? 0),
          progress: (tc.campaign.leadsTarget ?? 0) > 0 ? ((achieved / (tc.campaign.leadsTarget ?? 1)) * 100).toFixed(1) : '0'
        };
      })
    );

    res.json({
      teamName: team.name,
      campaigns: campaignProgress
    });
  } catch (error) {
    next(error);
  }
});


// Get all agents performance (for Manager)
router.get('/agents/performance', async (req: AuthRequest, res, next) => {
  try {
    const { from, to } = req.query;

    // Use work day ranges (4 PM to 4 AM cutoff)
    let fromDate: Date, toDate: Date;
    if (from && to) {
      const range = getWorkDayRangeForPeriod(from as string, to as string);
      fromDate = range.start;
      toDate = range.end;
    } else {
      // Default to current month
      const monthBounds = getCurrentMonthBounds();
      fromDate = monthBounds.start;
      toDate = monthBounds.end;
    }

    // Get all agents with their teams
    const agents = await prisma.user.findMany({
      where: {
        role: { in: [UserRole.Agent, UserRole.SeniorAgent] },
        isActive: true
      },
      include: {
        team: {
          select: {
            name: true
          }
        },
        leads: {
          where: {
            createdAt: {
              gte: fromDate,
              lte: toDate
            }
          },
          select: {
            status: true,
            overrideQualified: true
          }
        }
      }
    });

    const agentReports = agents.map(agent => {
      const leads = agent.leads;
      const totalLeads = leads.length;
      const qualified = leads.filter(l => l.status === 'Qualified').length;
      const overrideQualified = leads.filter(l => l.overrideQualified === true).length;
      const pushed = qualified + overrideQualified;
      const disqualified = leads.filter(l => l.status === 'Disqualified').length;
      const score = pushed - disqualified;
      const callback = leads.filter(l => l.status === 'Callback').length;
      const duplicate = leads.filter(l => l.status === 'Duplicate').length;

      return {
        id: agent.id,
        fullName: agent.fullName,
        role: agent.role,
        teamName: agent.team?.name || 'No Team',
        score,
        totalLeads,
        qualified,
        disqualified,
        callback,
        duplicate,
        pushed
      };
    });

    res.json({ agents: agentReports });
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    next(error);
  }
});

// Get all users attendance (for Manager) - includes all roles
router.get('/agents/attendance', async (req: AuthRequest, res, next) => {
  try {
    const { from, to, teamId, role } = req.query;

    const fromDateInput = from ? new Date(from as string) : new Date();
    const toDateInput = to ? new Date(to as string) : new Date();
    
    const fromDate = new Date(fromDateInput);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(toDateInput);
    toDate.setHours(23, 59, 59, 999);

    // Build where clause with filters
    const whereClause: any = {
      isActive: true,
      role: {
        notIn: [UserRole.Client, UserRole.Manager] // Exclude clients and managers
      }
    };

    // Add team filter if provided
    if (teamId && teamId !== 'all') {
      whereClause.teamId = teamId as string;
    }

    // Add role filter if provided
    if (role && role !== 'all') {
      whereClause.role = role as UserRole;
    }

    // Get all users (exclude Client and Manager roles)
    const agents = await prisma.user.findMany({
      where: whereClause,
      include: {
        team: {
          select: {
            name: true
          }
        }
      }
    });

    // Define role priority for sorting (lower number = higher priority)
    const rolePriority: Record<string, number> = {
      'Admin': 0,
      'IT': 1,
      'AccountManager': 2,
      'QualityControl': 3,
      'TeamLeader': 4,
      'SeniorAgent': 5,
      'Agent': 6
    };

    // Sort agents by role priority, then by name
    const sortedAgents = agents.sort((a, b) => {
      const priorityA = rolePriority[a.role] ?? 999;
      const priorityB = rolePriority[b.role] ?? 999;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return a.fullName.localeCompare(b.fullName);
    });

    // Get attendance data for each agent
    const attendanceReports = await Promise.all(
      sortedAgents.map(async (agent) => {
        const loginRecords = await prisma.loginHistory.findMany({
          where: {
            userId: agent.id,
            loginDate: {
              gte: fromDate,
              lte: toDate
            }
          },
          select: {
            loginTime: true,
            latenessMinutes: true
          }
        });

        const daysPresent = loginRecords.length;
        const daysLate = loginRecords.filter((r: any) => r.latenessMinutes > 0).length;
        const totalLateness = loginRecords.reduce((sum: number, r: any) => sum + r.latenessMinutes, 0);

        // Calculate average login time
        let avgLoginTime = '--:--';
        if (loginRecords.length > 0) {
          const totalMinutes = loginRecords.reduce((sum: number, r: any) => {
            const time = new Date(r.loginTime);
            return sum + (time.getHours() * 60 + time.getMinutes());
          }, 0);
          const avgMinutes = Math.floor(totalMinutes / loginRecords.length);
          const hours = Math.floor(avgMinutes / 60);
          const minutes = avgMinutes % 60;
          avgLoginTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        return {
          id: agent.id,
          fullName: agent.fullName,
          role: agent.role,
          teamName: agent.team?.name || 'No Team',
          daysPresent,
          daysLate,
          totalLateness,
          avgLoginTime
        };
      })
    );

    res.json({ attendance: attendanceReports });
  } catch (error) {
    console.error('Error fetching attendance reports:', error);
    next(error);
  }
});

export default router;
