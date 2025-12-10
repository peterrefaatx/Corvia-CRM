import express, { Response } from 'express';
import { UserRole } from '@prisma/client';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import prisma from '../lib/prisma';
import { getDateRangeWith4AMCutoff, getWorkDayBounds } from '../utils/workDay';

const router = express.Router();

// Enhanced Team Leader Dashboard with all features
router.get('/dashboard-enhanced', [
  auth,
  requireRole([UserRole.TeamLeader, UserRole.Manager])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const period = (req.query.period as string) || 'today';
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        teamId: true,
        fullName: true
      }
    });

    if (!user?.teamId) {
      return res.json({
        teamInfo: { teamName: 'Not Assigned', totalAgents: 0 },
        keyMetrics: {},
        agentPerformance: [],
        campaignProgress: [],
        qualityMetrics: {},
        recentActivity: [],
        agentComparison: []
      });
    }

    // Get team info
    const team = await prisma.team.findUnique({
      where: { id: user.teamId },
      select: { id: true, name: true }
    });

    const agentsCount = await prisma.user.count({ 
      where: { teamId: user.teamId, role: UserRole.Agent } 
    });

    // Date calculations with 4 AM cutoff
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;
    
    if (period === 'today') {
      // Today starts at 4 AM
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0, 0);
      if (now.getHours() < 4) {
        // If before 4 AM, use yesterday's 4 AM
        startDate.setDate(startDate.getDate() - 1);
      }
      
      // Previous day (yesterday's 4 AM to today's 4 AM)
      previousStartDate = new Date(startDate);
      previousStartDate.setDate(previousStartDate.getDate() - 1);
      previousEndDate = startDate;
    } else {
      // Month starts at 4 AM on the 1st
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 4, 0, 0, 0);
      
      // Previous month
      previousStartDate = new Date(startDate);
      previousStartDate.setMonth(previousStartDate.getMonth() - 1);
      previousEndDate = startDate;
    }

    // Get all agents in team
    const agents = await prisma.user.findMany({
      where: { teamId: user.teamId, role: UserRole.Agent },
      select: { id: true, fullName: true, email: true }
    });

    // Agent Performance with trends
    const agentPerformance = await Promise.all(
      agents.map(async (agent) => {
        const [currentTotal, currentQualified, previousTotal] = await Promise.all([
          prisma.lead.count({
            where: { agentId: agent.id, createdAt: { gte: startDate } }
          }),
          prisma.lead.count({
            where: { agentId: agent.id, status: 'Qualified', createdAt: { gte: startDate } }
          }),
          prisma.lead.count({
            where: { 
              agentId: agent.id, 
              createdAt: { gte: previousStartDate, lt: previousEndDate }
            }
          })
        ]);

        const qualityRate = currentTotal > 0 ? (currentQualified / currentTotal) * 100 : 0;
        
        let trend = 'stable';
        if (previousTotal > 0) {
          const change = ((currentTotal - previousTotal) / previousTotal) * 100;
          if (change > 10) trend = 'improving';
          else if (change < -10) trend = 'declining';
        } else if (currentTotal > 0) {
          trend = 'improving';
        }

        return {
          agentId: agent.id,
          agentName: agent.fullName,
          agentEmail: agent.email,
          todaySubmissions: currentTotal,
          monthSubmissions: currentTotal,
          qualifiedLeads: currentQualified,
          qualityRate: Math.round(qualityRate * 10) / 10,
          trend
        };
      })
    );

    // Sort by submissions
    agentPerformance.sort((a, b) => b.todaySubmissions - a.todaySubmissions);

    // Campaign Progress (Manager Analytics Style)
    const teamCampaigns = await prisma.campaignTeam.findMany({
      where: { teamId: user.teamId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            leadsTarget: true,
            isActive: true,
            timezone: true
          }
        }
      }
    });

    // Get work day bounds for daily reset at 4 AM
    const { start: workDayStart, end: workDayEnd } = getWorkDayBounds();

    const campaignProgress = await Promise.all(
      teamCampaigns
        .filter(tc => tc.campaign.isActive)
        .map(async (tc) => {
          const campaignData = tc.campaign;
          
          const campaignLeads = await prisma.lead.findMany({
            where: {
              campaignId: campaignData.id,
              teamId: user.teamId!,
              createdAt: { 
                gte: workDayStart,  // From 4 AM of current work day
                lt: workDayEnd      // Until 4 AM of next work day
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

          const target = campaignData.leadsTarget || 0;
          const targetReached = achieved >= target;

          return {
            campaignId: campaignData.id,
            campaignName: campaignData.name,
            timezone: campaignData.timezone || '-',
            target,
            pending,
            callback,
            achieved,
            duplicate,
            disqualified,
            missed,
            total,
            targetReached,
            progress: target > 0 ? ((achieved / target) * 100).toFixed(1) : '0'
          };
        })
    );

    // Quality Metrics (Both Today and Month)
    const todayMetricsStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0, 0);
    if (now.getHours() < 4) {
      todayMetricsStart.setDate(todayMetricsStart.getDate() - 1);
    }
    
    const monthMetricsStart = new Date(now.getFullYear(), now.getMonth(), 1, 4, 0, 0, 0);

    // Today's metrics
    const [totalLeadsToday, qualifiedLeadsToday, disqualifiedLeadsToday, callbackLeadsToday, pendingLeadsToday, duplicateLeadsToday] = await Promise.all([
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          createdAt: { gte: todayMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Qualified',
          createdAt: { gte: todayMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Disqualified',
          createdAt: { gte: todayMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Callback',
          createdAt: { gte: todayMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Pending',
          createdAt: { gte: todayMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Duplicate',
          createdAt: { gte: todayMetricsStart }
        }
      })
    ]);

    // Month's metrics
    const [totalLeadsMonth, qualifiedLeadsMonth, disqualifiedLeadsMonth, callbackLeadsMonth, pendingLeadsMonth, duplicateLeadsMonth] = await Promise.all([
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          createdAt: { gte: monthMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Qualified',
          createdAt: { gte: monthMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Disqualified',
          createdAt: { gte: monthMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Callback',
          createdAt: { gte: monthMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Pending',
          createdAt: { gte: monthMetricsStart }
        }
      }),
      prisma.lead.count({
        where: {
          agent: { teamId: user.teamId },
          status: 'Duplicate',
          createdAt: { gte: monthMetricsStart }
        }
      })
    ]);

    const qualityRateToday = totalLeadsToday > 0 ? (qualifiedLeadsToday / totalLeadsToday) * 100 : 0;
    const qualityRateMonth = totalLeadsMonth > 0 ? (qualifiedLeadsMonth / totalLeadsMonth) * 100 : 0;
    
    // Calculate daily target for quality metrics
    const dailyTargetForMetrics = campaignProgress.reduce((sum, c) => sum + c.target, 0);

    const qualityMetrics = {
      today: {
        totalLeads: totalLeadsToday,
        qualifiedLeads: qualifiedLeadsToday,
        disqualifiedLeads: disqualifiedLeadsToday,
        callbackLeads: callbackLeadsToday,
        pendingLeads: pendingLeadsToday,
        duplicateLeads: duplicateLeadsToday,
        qualityRate: Math.round(qualityRateToday * 10) / 10
      },
      month: {
        totalLeads: totalLeadsMonth,
        qualifiedLeads: qualifiedLeadsMonth,
        disqualifiedLeads: disqualifiedLeadsMonth,
        callbackLeads: callbackLeadsMonth,
        pendingLeads: pendingLeadsMonth,
        duplicateLeads: duplicateLeadsMonth,
        qualityRate: Math.round(qualityRateMonth * 10) / 10
      },
      dailyTarget: dailyTargetForMetrics,
      activeCampaigns: campaignProgress.length,
      activeAgents: agentsCount
    };

    // Completion Percentages
    // Campaign targets are DAILY targets, not monthly
    const dailyTarget = campaignProgress.reduce((sum, c) => sum + c.target, 0);
    
    // Calculate working days in month (exclude Saturdays and Sundays)
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    
    // Monthly target = Daily target × Working days
    const totalMonthlyTarget = dailyTarget * workingDays;
    
    // Calculate today's achieved (qualified leads today only)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0, 0);
    if (now.getHours() < 4) {
      todayStart.setDate(todayStart.getDate() - 1);
    }
    
    const todayAchievedCount = await prisma.lead.count({
      where: {
        agent: { teamId: user.teamId! },
        status: 'Qualified',
        createdAt: { gte: todayStart }
      }
    });
    
    // Calculate month's achieved (qualified leads this month)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 4, 0, 0, 0);
    const monthAchievedCount = await prisma.lead.count({
      where: {
        agent: { teamId: user.teamId! },
        status: 'Qualified',
        createdAt: { gte: monthStart }
      }
    });
    
    // Daily completion
    const dailyCompletion = dailyTarget > 0 ? (todayAchievedCount / dailyTarget) * 100 : 0;
    
    // Monthly completion (month's achieved vs monthly target)
    const monthlyCompletion = totalMonthlyTarget > 0 ? (monthAchievedCount / totalMonthlyTarget) * 100 : 0;

    const completionMetrics = {
      dailyTarget,
      todayAchieved: todayAchievedCount,
      dailyCompletion: Math.round(dailyCompletion * 10) / 10,
      monthlyTarget: totalMonthlyTarget,
      monthlyAchieved: monthAchievedCount,
      monthlyCompletion: Math.round(monthlyCompletion * 10) / 10,
      workingDays,
      totalDays: daysInMonth
    };

    // Recent Activity Feed
    const recentLeads = await prisma.lead.findMany({
      where: {
        agent: { teamId: user.teamId }
      },
      include: {
        agent: { select: { fullName: true } },
        campaign: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });

    const recentActivity = recentLeads.map(lead => {
      let activityType = 'submission';
      let description = `${lead.agent.fullName} submitted a lead`;
      
      if (lead.status === 'Qualified') {
        activityType = 'qualified';
        description = `${lead.agent.fullName}'s lead was qualified`;
      } else if (lead.status === 'Disqualified') {
        activityType = 'disqualified';
        description = `${lead.agent.fullName}'s lead was disqualified`;
      } else if (lead.status === 'Callback') {
        activityType = 'callback';
        description = `${lead.agent.fullName}'s lead needs a callback`;
      } else if (lead.status === 'Duplicate') {
        activityType = 'duplicate';
        description = `${lead.agent.fullName}'s lead was marked as duplicate`;
      } else if (lead.status === 'Pending') {
        activityType = 'pending';
        description = `${lead.agent.fullName}'s lead is pending review`;
      }

      return {
        id: lead.id,
        type: activityType,
        description,
        agentName: lead.agent.fullName,
        campaignName: lead.campaign?.name || 'N/A',
        serialNumber: lead.serialNumber,
        timestamp: lead.updatedAt,
        status: lead.status
      };
    });

    // Agent Comparison Data for Charts
    const agentComparison = agentPerformance.map(agent => ({
      agentName: agent.agentName,
      totalSubmissions: agent.todaySubmissions,
      qualifiedLeads: agent.qualifiedLeads,
      qualityRate: agent.qualityRate
    }));

    // Key Metrics Summary (based on period selection)
    const periodTotalLeads = await prisma.lead.count({
      where: {
        agent: { teamId: user.teamId },
        createdAt: { gte: startDate }
      }
    });
    
    const periodQualifiedLeads = await prisma.lead.count({
      where: {
        agent: { teamId: user.teamId },
        status: 'Qualified',
        createdAt: { gte: startDate }
      }
    });
    
    const periodQualityRate = periodTotalLeads > 0 ? (periodQualifiedLeads / periodTotalLeads) * 100 : 0;

    const keyMetrics = {
      totalSubmissions: periodTotalLeads,
      qualifiedLeads: periodQualifiedLeads,
      qualityRate: Math.round(periodQualityRate),
      activeAgents: agentsCount,
      activeCampaigns: campaignProgress.length
    };

    res.json({
      teamInfo: { 
        teamName: team?.name || 'Unknown', 
        totalAgents: agentsCount,
        teamLeaderName: user.fullName
      },
      keyMetrics,
      agentPerformance,
      campaignProgress,
      qualityMetrics,
      completionMetrics,
      recentActivity,
      agentComparison
    });
  } catch (error) {
    console.error('Team Leader dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


// Team Performance Report
router.get('/reports/team-performance', [
  auth,
  requireRole([UserRole.TeamLeader, UserRole.Manager])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const period = (req.query.period as string) || 'today';
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json({
        totalLeads: 0,
        qualifiedLeads: 0,
        disqualifiedLeads: 0,
        duplicateLeads: 0,
        callbackLeads: 0,
        qualityRate: 0,
        targetProgress: 0,
        dailyAverage: 0
      });
    }

    // Date range calculation with 4 AM cutoff
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    let daysDiff: number;
    
    // Determine current working day (day starts at 4 AM)
    const currentWorkingDay = new Date(now);
    if (now.getHours() < 4) {
      currentWorkingDay.setDate(currentWorkingDay.getDate() - 1);
    }
    
    if (period === 'today') {
      // Today: from 4 AM today (or 4 AM yesterday if before 4 AM)
      startDate = new Date(currentWorkingDay);
      startDate.setHours(4, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(4, 0, 0, 0);
      daysDiff = 1;
    } else if (period === 'week') {
      // Week: Monday to Friday (working days only)
      // Find the most recent Monday at 4 AM
      const dayOfWeek = currentWorkingDay.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      let daysToMonday = 0;
      
      if (dayOfWeek === 0) { // Sunday
        daysToMonday = 6; // Go back to previous Monday
      } else if (dayOfWeek === 6) { // Saturday
        daysToMonday = 5; // Go back to previous Monday
      } else {
        daysToMonday = dayOfWeek - 1; // Go back to Monday of current week
      }
      
      startDate = new Date(currentWorkingDay);
      startDate.setDate(startDate.getDate() - daysToMonday);
      startDate.setHours(4, 0, 0, 0);
      
      // End date is end of Friday (Saturday 4 AM)
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5); // Monday + 5 days = Saturday 4 AM
      endDate.setHours(4, 0, 0, 0);
      
      daysDiff = 5; // Monday to Friday = 5 working days
    } else {
      // Month - from 1st of current month at 4 AM
      startDate = new Date(currentWorkingDay.getFullYear(), currentWorkingDay.getMonth(), 1);
      startDate.setHours(4, 0, 0, 0);
      
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      
      // Count working days (Mon-Fri) in current month up to today
      let workingDays = 0;
      const tempDate = new Date(startDate);
      while (tempDate <= currentWorkingDay) {
        const day = tempDate.getDay();
        if (day !== 0 && day !== 6) { // Not Sunday or Saturday
          workingDays++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
      }
      daysDiff = workingDays;
    }

    console.log(`Team Performance Report - Period: ${period}, Start: ${startDate}, End: ${endDate}, Working Days: ${daysDiff}`);

    // Get leads for the period
    const leads = await prisma.lead.findMany({
      where: {
        teamId: user.teamId,
        createdAt: { 
          gte: startDate,
          lt: period === 'today' || period === 'week' ? endDate : undefined
        }
      },
      select: {
        status: true,
        createdAt: true
      }
    });

    console.log(`Found ${leads.length} leads for team in period ${period}`);

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(l => l.status === 'Qualified').length;
    const disqualifiedLeads = leads.filter(l => l.status === 'Disqualified').length;
    const duplicateLeads = leads.filter(l => l.status === 'Duplicate').length;
    const callbackLeads = leads.filter(l => l.status === 'Callback').length;
    
    const qualityRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
    
    // Calculate daily average
    const dailyAverage = daysDiff > 0 ? Math.round(totalLeads / daysDiff) : 0;

    // Get team target
    const campaigns = await prisma.campaign.findMany({
      where: {
        teams: {
          some: { teamId: user.teamId }
        },
        isActive: true
      },
      select: { leadsTarget: true }
    });

    const totalTarget = campaigns.reduce((sum, c) => sum + (c.leadsTarget || 0), 0);
    const targetProgress = totalTarget > 0 ? Math.round((totalLeads / totalTarget) * 100) : 0;

    res.json({
      totalLeads,
      qualifiedLeads,
      disqualifiedLeads,
      duplicateLeads,
      callbackLeads,
      qualityRate,
      targetProgress,
      dailyAverage
    });
  } catch (error) {
    console.error('Team performance report error:', error);
    res.status(500).json({ error: 'Failed to generate team performance report' });
  }
});

// Agent Performance Report
router.get('/reports/agent-performance', [
  auth,
  requireRole([UserRole.TeamLeader, UserRole.Manager])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const period = (req.query.period as string) || 'today';
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json([]);
    }

    // Date range calculation with 4 AM cutoff (same as team performance)
    const now = new Date();
    let startDate: Date;
    let endDate: Date | undefined;
    
    const currentWorkingDay = new Date(now);
    if (now.getHours() < 4) {
      currentWorkingDay.setDate(currentWorkingDay.getDate() - 1);
    }
    
    if (period === 'today') {
      startDate = new Date(currentWorkingDay);
      startDate.setHours(4, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(4, 0, 0, 0);
    } else if (period === 'week') {
      const dayOfWeek = currentWorkingDay.getDay();
      let daysToMonday = 0;
      
      if (dayOfWeek === 0) {
        daysToMonday = 6;
      } else if (dayOfWeek === 6) {
        daysToMonday = 5;
      } else {
        daysToMonday = dayOfWeek - 1;
      }
      
      startDate = new Date(currentWorkingDay);
      startDate.setDate(startDate.getDate() - daysToMonday);
      startDate.setHours(4, 0, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);
      endDate.setHours(4, 0, 0, 0);
    } else {
      startDate = new Date(currentWorkingDay.getFullYear(), currentWorkingDay.getMonth(), 1);
      startDate.setHours(4, 0, 0, 0);
      endDate = undefined;
    }

    console.log(`Agent Performance Report - Period: ${period}, Start: ${startDate}, End: ${endDate}`);

    // Get agents in team
    const agents = await prisma.user.findMany({
      where: {
        teamId: user.teamId,
        role: UserRole.Agent
      },
      select: {
        id: true,
        fullName: true,
        leads: {
          where: {
            createdAt: endDate ? { gte: startDate, lt: endDate } : { gte: startDate }
          },
          select: {
            status: true
          }
        }
      }
    });

    console.log(`Found ${agents.length} agents with leads data`);

    // Calculate performance for each agent
    const agentPerformance = agents.map(agent => {
      const totalLeads = agent.leads.length;
      const qualifiedLeads = agent.leads.filter(l => l.status === 'Qualified').length;
      const duplicateLeads = agent.leads.filter(l => l.status === 'Duplicate').length;
      
      const qualityRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
      const duplicateRate = totalLeads > 0 ? Math.round((duplicateLeads / totalLeads) * 100) : 0;

      return {
        id: agent.id,
        fullName: agent.fullName,
        totalLeads,
        qualifiedLeads,
        qualityRate,
        duplicateRate,
        rank: 0
      };
    });

    // Sort by total leads and assign ranks
    agentPerformance.sort((a, b) => b.totalLeads - a.totalLeads);
    agentPerformance.forEach((agent, index) => {
      agent.rank = index + 1;
    });

    res.json(agentPerformance);
  } catch (error) {
    console.error('Agent performance report error:', error);
    res.status(500).json({ error: 'Failed to generate agent performance report' });
  }
});

// Campaign Progress Report
router.get('/reports/campaign-progress', [
  auth,
  requireRole([UserRole.TeamLeader, UserRole.Manager])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const period = (req.query.period as string) || 'today';
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json([]);
    }

    // Date range calculation with 4 AM cutoff (same as team performance)
    const now = new Date();
    let startDate: Date;
    let endDate: Date | undefined;
    
    const currentWorkingDay = new Date(now);
    if (now.getHours() < 4) {
      currentWorkingDay.setDate(currentWorkingDay.getDate() - 1);
    }
    
    if (period === 'today') {
      startDate = new Date(currentWorkingDay);
      startDate.setHours(4, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      endDate.setHours(4, 0, 0, 0);
    } else if (period === 'week') {
      const dayOfWeek = currentWorkingDay.getDay();
      let daysToMonday = 0;
      
      if (dayOfWeek === 0) {
        daysToMonday = 6;
      } else if (dayOfWeek === 6) {
        daysToMonday = 5;
      } else {
        daysToMonday = dayOfWeek - 1;
      }
      
      startDate = new Date(currentWorkingDay);
      startDate.setDate(startDate.getDate() - daysToMonday);
      startDate.setHours(4, 0, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);
      endDate.setHours(4, 0, 0, 0);
    } else {
      startDate = new Date(currentWorkingDay.getFullYear(), currentWorkingDay.getMonth(), 1);
      startDate.setHours(4, 0, 0, 0);
      endDate = undefined;
    }

    console.log(`Campaign Progress Report - Period: ${period}, Start: ${startDate}, End: ${endDate}`);

    // Get campaigns assigned to team
    const campaigns = await prisma.campaign.findMany({
      where: {
        teams: {
          some: { teamId: user.teamId }
        },
        isActive: true
      },
      select: {
        id: true,
        name: true,
        leadsTarget: true,
        createdAt: true,
        timezone: true,
        leads: {
          where: {
            teamId: user.teamId,
            createdAt: endDate ? { gte: startDate, lt: endDate } : { gte: startDate }
          },
          select: {
            status: true
          }
        }
      }
    });

    console.log(`Found ${campaigns.length} campaigns with leads data`);

    // Calculate progress for each campaign
    const campaignProgress = campaigns.map(campaign => {
      const achieved = campaign.leads.length;
      const target = campaign.leadsTarget || 0;
      const percentage = target > 0 ? Math.round((achieved / target) * 100) : 0;
      
      const qualifiedLeads = campaign.leads.filter(l => l.status === 'Qualified').length;
      const qualityRate = achieved > 0 ? Math.round((qualifiedLeads / achieved) * 100) : 0;

      // Calculate remaining days (assuming 30 days per campaign)
      const daysSinceStart = Math.floor((now.getTime() - campaign.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.max(0, 30 - daysSinceStart);

      return {
        id: campaign.id,
        name: campaign.name,
        timezone: campaign.timezone || '-',
        target,
        achieved,
        percentage,
        qualityRate,
        remainingDays
      };
    });

    res.json(campaignProgress);
  } catch (error) {
    console.error('Campaign progress report error:', error);
    res.status(500).json({ error: 'Failed to generate campaign progress report' });
  }
});


// Team Leader Reports - Agent Performance
router.get('/reports/agents', [
  auth,
  requireRole([UserRole.TeamLeader])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { from, to, allTeams } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json({ agents: [] });
    }

    const fromDateInput = from ? new Date(from as string) : new Date();
    const toDateInput = to ? new Date(to as string) : new Date();
    
    // Apply 4 AM cutoff
    const { start: fromDate, end: toDate } = getDateRangeWith4AMCutoff(fromDateInput, toDateInput);

    // Build where clause based on allTeams parameter
    const whereClause: any = {
      role: { in: [UserRole.Agent, UserRole.SeniorAgent] },
      isActive: true
    };

    // If not showing all teams, filter by team leader's team
    if (allTeams !== 'true') {
      whereClause.teamId = user.teamId;
    }

    const agents = await prisma.user.findMany({
      where: whereClause,
      include: {
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
      const score = pushed - disqualified; // Score = Pushed - Disqualified
      const callback = leads.filter(l => l.status === 'Callback').length;
      const duplicate = leads.filter(l => l.status === 'Duplicate').length;

      return {
        id: agent.id,
        fullName: agent.fullName,
        role: agent.role,
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
    console.error('Error fetching agent reports:', error);
    res.status(500).json({ error: 'Failed to fetch agent reports' });
  }
});

// Team Leader Reports - Attendance (Historical)
router.get('/reports/attendance', [
  auth,
  requireRole([UserRole.TeamLeader])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { from, to } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json({ attendance: [] });
    }

    const fromDateInput = from ? new Date(from as string) : new Date();
    const toDateInput = to ? new Date(to as string) : new Date();
    
    // Apply 4 AM cutoff
    const { start: fromDate, end: toDate } = getDateRangeWith4AMCutoff(fromDateInput, toDateInput);

    console.log(`Attendance Report - From: ${fromDate}, To: ${toDate}`);

    // Get all agents in team
    const agents = await prisma.user.findMany({
      where: {
        teamId: user.teamId,
        role: { in: [UserRole.Agent, UserRole.SeniorAgent] },
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        role: true
      }
    });

    // Get historical login data from LoginHistory table
    const attendanceReports = await Promise.all(
      agents.map(async (agent) => {
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
          daysPresent,
          daysLate,
          totalLateness,
          avgLoginTime
        };
      })
    );

    console.log(`Found attendance data for ${attendanceReports.length} agents`);

    res.json({ attendance: attendanceReports });
  } catch (error) {
    console.error('Error fetching attendance reports:', error);
    res.status(500).json({ error: 'Failed to fetch attendance reports' });
  }
});

// Team Leader Reports - Campaign Performance
router.get('/reports/campaigns', [
  auth,
  requireRole([UserRole.TeamLeader])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { from, to } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json({ campaigns: [] });
    }

    const fromDateInput = from ? new Date(from as string) : new Date();
    const toDateInput = to ? new Date(to as string) : new Date();
    
    // Apply 4 AM cutoff
    const { start: fromDate, end: toDate } = getDateRangeWith4AMCutoff(fromDateInput, toDateInput);

    const campaignTeams = await prisma.campaignTeam.findMany({
      where: { teamId: user.teamId },
      include: {
        campaign: {
          include: {
            leads: {
              where: {
                teamId: user.teamId,
                createdAt: {
                  gte: fromDate,
                  lte: toDate
                }
              },
              select: {
                status: true
              }
            }
          }
        }
      }
    });

    const campaignReports = campaignTeams.map(ct => {
      const leads = ct.campaign.leads;
      const totalLeads = leads.length;
      const qualified = leads.filter(l => l.status === 'Qualified').length;
      const disqualified = leads.filter(l => l.status === 'Disqualified').length;
      const target = ct.campaign.leadsTarget || 0;
      const achievementRate = target > 0 ? (totalLeads / target) * 100 : 0;

      return {
        id: ct.campaign.id,
        name: ct.campaign.name,
        totalLeads,
        qualified,
        disqualified,
        target,
        achievementRate
      };
    });

    res.json({ campaigns: campaignReports });
  } catch (error) {
    console.error('Error fetching campaign reports:', error);
    res.status(500).json({ error: 'Failed to fetch campaign reports' });
  }
});

// Team Leader Reports - Daily Breakdown
// Reads from pre-calculated DailyTopAgent snapshots
router.get('/reports/daily', [
  auth,
  requireRole([UserRole.TeamLeader])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { from, to } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json({ daily: [] });
    }

    const fromDateInput = from ? new Date(from as string) : new Date();
    const toDateInput = to ? new Date(to as string) : new Date();
    
    // Apply 4 AM cutoff
    const { start: fromDate, end: toDate } = getDateRangeWith4AMCutoff(fromDateInput, toDateInput);

    // Read from DailyTopAgent table
    const dailyRecords = await prisma.dailyTopAgent.findMany({
      where: {
        teamId: user.teamId,
        date: {
          gte: fromDate,
          lte: toDate
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    const dailyBreakdown = dailyRecords.map((record: any) => ({
      date: record.date.toISOString().split('T')[0],
      totalLeads: record.totalLeads,
      qualified: record.qualified,
      disqualified: record.disqualified,
      topAgent: record.topAgentName
    }));

    res.json({ daily: dailyBreakdown });
  } catch (error) {
    console.error('Error fetching daily reports:', error);
    res.status(500).json({ error: 'Failed to fetch daily reports' });
  }
});

// Team Leader Reports - Team Overview
router.get('/reports/team', [
  auth,
  requireRole([UserRole.TeamLeader])
], async (req: any, res: Response) => {
  try {
    const userId = req.user.userId;
    const { from, to } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true }
    });

    if (!user?.teamId) {
      return res.json({ totalLeads: 0, qualified: 0, disqualified: 0, qualificationRate: 0 });
    }

    const fromDateInput = from ? new Date(from as string) : new Date();
    const toDateInput = to ? new Date(to as string) : new Date();
    
    // Apply 4 AM cutoff
    const { start: fromDate, end: toDate } = getDateRangeWith4AMCutoff(fromDateInput, toDateInput);

    const leads = await prisma.lead.findMany({
      where: {
        teamId: user.teamId,
        createdAt: {
          gte: fromDate,
          lte: toDate
        }
      },
      select: {
        status: true
      }
    });

    const totalLeads = leads.length;
    const qualified = leads.filter(l => l.status === 'Qualified').length;
    const disqualified = leads.filter(l => l.status === 'Disqualified').length;
    const qualificationRate = totalLeads > 0 ? (qualified / totalLeads) * 100 : 0;

    res.json({
      totalLeads,
      qualified,
      disqualified,
      qualificationRate
    });
  } catch (error) {
    console.error('Error fetching team overview:', error);
    res.status(500).json({ error: 'Failed to fetch team overview' });
  }
});
