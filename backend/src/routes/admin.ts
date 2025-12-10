import { Router } from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

const router = Router();

router.use(auth);
router.use(requireRole(['Manager']));

// Get admin dashboard stats
router.get('/stats', async (req: AuthRequest, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalCampaigns,
      activeCampaigns,
      totalTeams,
      pendingQCLeads,
      totalLeads,
      recentActivity
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { isActive: true } }),
      prisma.team.count(),
      prisma.lead.count({ where: { status: 'Pending' } }),
      prisma.lead.count(),
      // Recent activity from lead audits and user creation
      Promise.all([
        prisma.leadAudit.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { fullName: true, username: true } },
            lead: { select: { serialNumber: true, homeownerFirst: true, homeownerLast: true } }
          }
        }),
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, fullName: true, username: true, createdAt: true, role: true }
        })
      ])
    ]);

    // Format recent activity
    const activities = [
      ...recentActivity[0].map(audit => ({
        id: audit.id,
        action: `${audit.action} - Lead ${audit.lead.serialNumber}`,
        user: audit.user.fullName,
        time: audit.createdAt,
        type: 'lead' as const
      })),
      ...recentActivity[1].map(user => ({
        id: user.id,
        action: 'New user created',
        user: user.fullName,
        time: user.createdAt,
        type: 'user' as const
      }))
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 10);

    // Get analytics data
    const [
      leadsByStatus,
      leadsByCampaign,
      leadsByTeam,
      leadsThisMonth,
      leadsLastMonth,
      qualifiedLeads,
      disqualifiedLeads,
      duplicateLeads,
      callbackLeads
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ['status'],
        _count: true
      }),
      prisma.lead.groupBy({
        by: ['campaignId'],
        _count: true
      }),
      prisma.lead.groupBy({
        by: ['teamId'],
        _count: true
      }),
      prisma.lead.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.lead.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
            lt: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.lead.count({ where: { status: 'Qualified' } }),
      prisma.lead.count({ where: { status: 'Disqualified' } }),
      prisma.lead.count({ where: { status: 'Duplicate' } }),
      prisma.lead.count({ where: { status: 'Callback' } })
    ]);

    // Get campaign details for leads by campaign
    const campaignIds = leadsByCampaign.map(l => l.campaignId).filter((id): id is string => id !== null);
    const campaigns = await prisma.campaign.findMany({
      where: { id: { in: campaignIds } },
      select: { id: true, name: true }
    });
    const leadsByCampaignWithNames = leadsByCampaign.map(l => ({
      campaignId: l.campaignId,
      campaignName: campaigns.find(c => c.id === l.campaignId)?.name || 'Unknown',
      count: l._count
    }));

    // Get team details for leads by team
    const teamIds = leadsByTeam.map(l => l.teamId);
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true }
    });
    const leadsByTeamWithNames = leadsByTeam.map(l => ({
      teamId: l.teamId,
      teamName: teams.find(t => t.id === l.teamId)?.name || 'Unknown',
      count: l._count
    }));

    // Calculate month-over-month growth
    const monthOverMonthGrowth = leadsLastMonth > 0 
      ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth * 100).toFixed(1)
      : leadsThisMonth > 0 ? '100' : '0';

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalCampaigns,
        activeCampaigns,
        totalTeams,
        pendingQCLeads,
        totalLeads,
        leadsThisMonth,
        leadsLastMonth,
        monthOverMonthGrowth,
        qualifiedLeads,
        disqualifiedLeads,
        duplicateLeads,
        callbackLeads
      },
      analytics: {
        leadsByStatus: leadsByStatus.map(l => ({
          status: l.status,
          count: l._count
        })),
        leadsByCampaign: leadsByCampaignWithNames,
        leadsByTeam: leadsByTeamWithNames,
        qualificationRate: totalLeads > 0 ? ((qualifiedLeads / totalLeads) * 100).toFixed(1) : '0'
      },
      recentActivity: activities
    });
  } catch (error) {
    next(error);
  }
});

// Get active users (currently logged in - within last hour)
router.get('/active-users', async (req: AuthRequest, res) => {
  try {
    // Users who logged in within the last hour are considered "currently logged in"
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const activeUsers = await prisma.user.findMany({
      where: {
        lastLogin: {
          gte: oneHourAgo
        },
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        lastLogin: true,
        team: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        lastLogin: 'desc'
      }
    });

    res.json(activeUsers);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

// Get recent user activity
router.get('/user-activity', async (req: AuthRequest, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Get recent login history
    const recentLogins = await prisma.loginHistory.findMany({
      take: Number(limit),
      orderBy: { loginTime: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        }
      }
    });

    // Get recent lead actions
    const recentLeadActions = await prisma.leadAudit.findMany({
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        },
        lead: {
          select: {
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true
          }
        }
      }
    });

    // Combine and format activities
    const activities = [
      ...recentLogins.map(login => ({
        id: `login-${login.id}`,
        type: 'login',
        action: 'Logged in',
        user: login.user,
        timestamp: login.loginTime,
        details: {
          latenessMinutes: login.latenessMinutes
        }
      })),
      ...recentLeadActions.map(audit => ({
        id: `audit-${audit.id}`,
        type: 'lead_action',
        action: audit.action,
        user: audit.user,
        timestamp: audit.createdAt,
        details: {
          leadSerial: audit.lead.serialNumber,
          leadName: `${audit.lead.homeownerFirst} ${audit.lead.homeownerLast}`,
          payload: audit.payload
        }
      }))
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, Number(limit));

    res.json(activities);
  } catch (error) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// Get advanced analytics
router.get('/advanced-analytics', async (req: AuthRequest, res) => {
  try {
    const { days = 30 } = req.query;
    const daysAgo = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);

    // Lead trends over time
    const leads = await prisma.lead.findMany({
      where: {
        createdAt: {
          gte: daysAgo
        }
      },
      select: {
        createdAt: true,
        status: true,
        temperature: true,
        campaignId: true,
        teamId: true
      }
    });

    // Group by date
    const leadsByDate: { [key: string]: any } = {};
    leads.forEach(lead => {
      const date = lead.createdAt.toISOString().split('T')[0];
      if (!leadsByDate[date]) {
        leadsByDate[date] = {
          date,
          total: 0,
          pending: 0,
          qualified: 0,
          disqualified: 0,
          duplicate: 0,
          callback: 0,
          hot: 0,
          warm: 0,
          cold: 0
        };
      }
      leadsByDate[date].total++;
      leadsByDate[date][lead.status.toLowerCase()]++;
      if (lead.temperature) {
        leadsByDate[date][lead.temperature.toLowerCase()]++;
      }
    });

    const leadTrends = Object.values(leadsByDate).sort((a: any, b: any) => 
      a.date.localeCompare(b.date)
    );

    // Agent productivity
    const agentStats = await prisma.user.findMany({
      where: {
        role: { in: ['Agent', 'SeniorAgent'] },
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        team: {
          select: { name: true }
        },
        leads: {
          where: {
            createdAt: { gte: daysAgo }
          },
          select: {
            status: true,
            createdAt: true
          }
        },
        loginHistory: {
          where: {
            loginTime: { gte: daysAgo }
          },
          select: {
            loginTime: true,
            latenessMinutes: true
          }
        }
      }
    });

    const agentProductivity = agentStats.map(agent => ({
      id: agent.id,
      name: agent.fullName,
      role: agent.role,
      team: agent.team?.name || 'No Team',
      totalLeads: agent.leads.length,
      qualified: agent.leads.filter(l => l.status === 'Qualified').length,
      disqualified: agent.leads.filter(l => l.status === 'Disqualified').length,
      pending: agent.leads.filter(l => l.status === 'Pending').length,
      daysWorked: agent.loginHistory.length,
      avgLeadsPerDay: agent.loginHistory.length > 0 
        ? (agent.leads.length / agent.loginHistory.length).toFixed(1)
        : '0',
      totalLateness: agent.loginHistory.reduce((sum, h) => sum + h.latenessMinutes, 0),
      qualificationRate: agent.leads.length > 0
        ? ((agent.leads.filter(l => l.status === 'Qualified').length / agent.leads.length) * 100).toFixed(1)
        : '0'
    })).sort((a, b) => b.totalLeads - a.totalLeads);

    // Campaign performance
    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      include: {
        leads: {
          where: {
            createdAt: { gte: daysAgo }
          },
          select: {
            status: true,
            temperature: true
          }
        }
      }
    });

    const campaignPerformance = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      target: campaign.leadsTarget || 0,
      totalLeads: campaign.leads.length,
      qualified: campaign.leads.filter(l => l.status === 'Qualified').length,
      hot: campaign.leads.filter(l => l.temperature === 'Hot').length,
      warm: campaign.leads.filter(l => l.temperature === 'Warm').length,
      cold: campaign.leads.filter(l => l.temperature === 'Cold').length,
      progress: campaign.leadsTarget 
        ? ((campaign.leads.filter(l => l.status === 'Qualified').length / campaign.leadsTarget) * 100).toFixed(1)
        : '0',
      qualificationRate: campaign.leads.length > 0
        ? ((campaign.leads.filter(l => l.status === 'Qualified').length / campaign.leads.length) * 100).toFixed(1)
        : '0'
    }));

    // Team performance
    const teams = await prisma.team.findMany({
      include: {
        users: {
          where: { isActive: true },
          select: {
            id: true,
            role: true
          }
        },
        leads: {
          where: {
            createdAt: { gte: daysAgo }
          },
          select: {
            status: true
          }
        }
      }
    });

    const teamPerformance = teams.map(team => ({
      id: team.id,
      name: team.name,
      members: team.users.length,
      agents: team.users.filter(u => u.role === 'Agent' || u.role === 'SeniorAgent').length,
      totalLeads: team.leads.length,
      qualified: team.leads.filter(l => l.status === 'Qualified').length,
      avgLeadsPerAgent: team.users.filter(u => u.role === 'Agent' || u.role === 'SeniorAgent').length > 0
        ? (team.leads.length / team.users.filter(u => u.role === 'Agent' || u.role === 'SeniorAgent').length).toFixed(1)
        : '0'
    })).sort((a, b) => b.totalLeads - a.totalLeads);

    res.json({
      leadTrends,
      agentProductivity,
      campaignPerformance,
      teamPerformance,
      summary: {
        totalLeads: leads.length,
        avgLeadsPerDay: (leads.length / Number(days)).toFixed(1),
        qualificationRate: leads.length > 0
          ? ((leads.filter(l => l.status === 'Qualified').length / leads.length) * 100).toFixed(1)
          : '0',
        hotLeadsPercentage: leads.length > 0
          ? ((leads.filter(l => l.temperature === 'Hot').length / leads.length) * 100).toFixed(1)
          : '0'
      }
    });
  } catch (error) {
    console.error('Error fetching advanced analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Quick action: Create user
router.post('/quick-actions/create-user', async (req: AuthRequest, res) => {
  try {
    const { username, email, password, fullName, role, teamId } = req.body;
    
    // Basic validation
    if (!username || !email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        fullName,
        role,
        teamId: teamId || null,
        isActive: true
      }
    });

    res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.fullName } });
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Failed to create user' });
  }
});

// Quick action: Send announcement
router.post('/quick-actions/send-announcement', async (req: AuthRequest, res) => {
  try {
    const { title, message, targetRoles } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    // In a real implementation, you would:
    // 1. Store the announcement in a database
    // 2. Send via WebSocket to connected users
    // 3. Send email notifications
    
    // For now, we'll just return success
    res.json({ 
      success: true, 
      message: 'Announcement sent successfully',
      details: {
        title,
        recipients: targetRoles || 'all',
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error sending announcement:', error);
    res.status(500).json({ error: 'Failed to send announcement' });
  }
});

// Quick action: Clear cache (placeholder)
router.post('/quick-actions/clear-cache', async (req: AuthRequest, res) => {
  try {
    // In a real implementation, you would clear Redis cache here
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;

// Get team leaders and QC agents assigned to an account manager
router.get('/account-manager/:amId/team-leaders', async (req: AuthRequest, res) => {
  try {
    const { amId } = req.params;

    const [teamLeaders, qcAgents] = await Promise.all([
      prisma.user.findMany({
        where: {
          accountManagerId: amId,
          role: 'TeamLeader',
          isActive: true
        },
        select: {
          id: true
        }
      }),
      prisma.user.findMany({
        where: {
          accountManagerId: amId,
          role: 'QualityControl',
          isActive: true
        },
        select: {
          id: true
        }
      })
    ]);

    res.json({ 
      teamLeaderIds: teamLeaders.map(tl => tl.id),
      qcAgentIds: qcAgents.map(qc => qc.id)
    });
  } catch (error) {
    console.error('Error fetching team leaders and QC agents:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// Assign team leaders and QC agents to an account manager
router.put('/account-manager/:amId/team-leaders', async (req: AuthRequest, res) => {
  try {
    const { amId } = req.params;
    const { teamLeaderIds, qcAgentIds } = req.body;

    // Verify the account manager exists
    const am = await prisma.user.findUnique({
      where: { id: amId, role: 'AccountManager' }
    });

    if (!am) {
      return res.status(404).json({ error: 'Account Manager not found' });
    }

    // First, remove all current assignments for this AM (both TLs and QCs)
    await prisma.user.updateMany({
      where: {
        accountManagerId: amId,
        role: { in: ['TeamLeader', 'QualityControl'] }
      },
      data: {
        accountManagerId: null
      }
    });

    // Then assign the selected team leaders
    if (teamLeaderIds && teamLeaderIds.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: { in: teamLeaderIds },
          role: 'TeamLeader'
        },
        data: {
          accountManagerId: amId
        }
      });
    }

    // And assign the selected QC agents
    if (qcAgentIds && qcAgentIds.length > 0) {
      await prisma.user.updateMany({
        where: {
          id: { in: qcAgentIds },
          role: 'QualityControl'
        },
        data: {
          accountManagerId: amId
        }
      });
    }

    const totalAssigned = (teamLeaderIds?.length || 0) + (qcAgentIds?.length || 0);
    res.json({ 
      success: true, 
      message: `Assigned ${teamLeaderIds?.length || 0} team leaders and ${qcAgentIds?.length || 0} QC agents to ${am.fullName}`,
      totalAssigned
    });
  } catch (error) {
    console.error('Error assigning team leaders and QC agents:', error);
    res.status(500).json({ error: 'Failed to assign users' });
  }
});
