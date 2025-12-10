import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all teams managed by the account manager
router.get('/teams', auth, requireRole(['AccountManager']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    // Get all team leaders under this account manager
    const teamLeaders = await prisma.user.findMany({
      where: {
        accountManagerId: userId,
        role: 'TeamLeader',
        isActive: true
      },
      include: {
        managedTeam: {
          include: {
            users: {
              where: {
                isActive: true,
                role: {
                  in: ['Agent', 'SeniorAgent']
                }
              }
            }
          }
        }
      }
    });

    // Get stats for each team
    const teamsData = await Promise.all(
      teamLeaders.map(async (teamLeader) => {
        if (!teamLeader.managedTeam) return null;

        const team = teamLeader.managedTeam;
        const teamId = team.id;

        // Get today's work day range (4 AM to 4 AM next day)
        const now = new Date();
        const workDayStart = new Date(now);
        workDayStart.setHours(4, 0, 0, 0);
        
        // If current time is before 4 AM, use yesterday's 4 AM
        if (now.getHours() < 4) {
          workDayStart.setDate(workDayStart.getDate() - 1);
        }
        
        const workDayEnd = new Date(workDayStart);
        workDayEnd.setDate(workDayEnd.getDate() + 1);

        // Get this month's date range (1st at 4 AM to next 1st at 4 AM)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 4, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 4, 0, 0, 0);

        // Today's leads (current work day)
        const todayLeads = await prisma.lead.count({
          where: {
            teamId,
            createdAt: {
              gte: workDayStart,
              lt: workDayEnd
            }
          }
        });

        // Month's leads with status breakdown
        const monthLeads = await prisma.lead.findMany({
          where: {
            teamId,
            createdAt: {
              gte: startOfMonth,
              lt: endOfMonth
            }
          },
          select: {
            status: true
          }
        });

        const qualified = monthLeads.filter(l => l.status === 'Qualified').length;
        const pending = monthLeads.filter(l => l.status === 'Pending').length;
        const disqualified = monthLeads.filter(l => l.status === 'Disqualified').length;

        // Get campaigns assigned to this team and sum their targets
        const teamCampaigns = await prisma.campaignTeam.findMany({
          where: { teamId },
          include: {
            campaign: {
              select: {
                leadsTarget: true
              }
            }
          }
        });

        const dailyTarget = teamCampaigns.reduce((sum, tc) => {
          return sum + (tc.campaign.leadsTarget || 0);
        }, 0);

        return {
          teamId: team.id,
          teamName: team.name,
          teamLeaderName: teamLeader.fullName,
          totalAgents: team.users.length,
          todayLeads,
          dailyTarget,
          monthLeads: monthLeads.length,
          qualified,
          pending,
          disqualified
        };
      })
    );

    // Filter out null values
    const validTeams = teamsData.filter(team => team !== null);

    res.json({ teams: validTeams });
  } catch (error) {
    console.error('Error fetching account manager teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams data' });
  }
});

// Get detailed stats for a specific team
router.get('/team/:teamId', auth, requireRole(['AccountManager']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { teamId } = req.params;

    // Verify this team is under this account manager
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        teamLeader: {
          accountManagerId: userId
        }
      },
      include: {
        teamLeader: true,
        users: {
          where: {
            isActive: true,
            role: {
              in: ['Agent', 'SeniorAgent']
            }
          }
        }
      }
    });

    if (!team) {
      return res.status(404).json({ error: 'Team not found or not under your management' });
    }

    // Get agent stats
    const agentStats = await Promise.all(
      team.users.map(async (agent) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

        const todayLeads = await prisma.lead.count({
          where: {
            agentId: agent.id,
            createdAt: {
              gte: today,
              lt: tomorrow
            }
          }
        });

        const monthLeads = await prisma.lead.findMany({
          where: {
            agentId: agent.id,
            createdAt: {
              gte: startOfMonth,
              lte: endOfMonth
            }
          },
          select: {
            status: true
          }
        });

        const qualified = monthLeads.filter(l => l.status === 'Qualified').length;

        return {
          agentId: agent.id,
          agentName: agent.fullName,
          role: agent.role,
          todayLeads,
          monthLeads: monthLeads.length,
          qualified
        };
      })
    );

    res.json({
      team: {
        id: team.id,
        name: team.name,
        teamLeaderName: team.teamLeader?.fullName || 'Not Assigned',
        agents: agentStats
      }
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

// Account Manager Reports - Agent Performance
router.get('/reports/agents', auth, requireRole(['AccountManager']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Date range required' });
    }

    // Use work day ranges (4 PM to 4 AM cutoff)
    // Work day starts at 4 PM and ends at 4 AM next day
    const fromDate = new Date(from as string);
    fromDate.setHours(16, 0, 0, 0); // 4 PM
    
    const toDate = new Date(to as string);
    toDate.setDate(toDate.getDate() + 1);
    toDate.setHours(4, 0, 0, 0); // 4 AM next day

    // Get all team leaders under this account manager
    const teamLeaders = await prisma.user.findMany({
      where: {
        accountManagerId: userId,
        role: 'TeamLeader',
        isActive: true
      },
      select: { teamId: true }
    });

    const teamIds = teamLeaders.map(tl => tl.teamId).filter(id => id !== null) as string[];

    if (teamIds.length === 0) {
      return res.json({ agents: [] });
    }

    // Get all agents from managed teams
    const agents = await prisma.user.findMany({
      where: {
        teamId: { in: teamIds },
        role: { in: ['Agent', 'SeniorAgent'] },
        isActive: true
      },
      include: {
        team: { select: { name: true } },
        leads: {
          where: {
            createdAt: {
              gte: fromDate,
              lt: toDate
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
    console.error('Error fetching agent reports:', error);
    res.status(500).json({ error: 'Failed to fetch agent reports' });
  }
});

// Account Manager Reports - Attendance
router.get('/reports/attendance', auth, requireRole(['AccountManager']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Date range required' });
    }

    // Parse dates - loginDate is stored at midnight, so we need to query by date only
    const fromDate = new Date(from as string);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = new Date(to as string);
    toDate.setHours(23, 59, 59, 999);

    // Get all team leaders under this account manager
    const teamLeaders = await prisma.user.findMany({
      where: {
        accountManagerId: userId,
        role: 'TeamLeader',
        isActive: true
      },
      select: { id: true, teamId: true }
    });

    const teamIds = teamLeaders.map(tl => tl.teamId).filter(id => id !== null) as string[];
    const teamLeaderIds = teamLeaders.map(tl => tl.id);

    // Get QC agents assigned to this account manager
    const qcAgents = await prisma.user.findMany({
      where: {
        accountManagerId: userId,
        role: 'QualityControl',
        isActive: true
      },
      select: { id: true }
    });

    const qcAgentIds = qcAgents.map(qc => qc.id);

    // Get IT roles assigned to this account manager
    const itUsers = await prisma.user.findMany({
      where: {
        accountManagerId: userId,
        role: 'IT',
        isActive: true
      },
      select: { id: true }
    });

    const itUserIds = itUsers.map(it => it.id);

    // Get all users to track: agents from managed teams + assigned TLs + assigned QCs + assigned IT
    const userIds = [
      ...teamLeaderIds,
      ...qcAgentIds,
      ...itUserIds
    ];

    // Get agents from managed teams
    if (teamIds.length > 0) {
      const agents = await prisma.user.findMany({
        where: {
          teamId: { in: teamIds },
          role: { in: ['Agent', 'SeniorAgent'] },
          isActive: true
        },
        select: { id: true }
      });
      userIds.push(...agents.map(a => a.id));
    }

    if (userIds.length === 0) {
      return res.json({ attendance: [] });
    }

    // Get all users with their details
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        team: { select: { name: true } }
      }
    });

    // Get attendance data
    const attendanceReports = await Promise.all(
      users.map(async (user) => {
        const loginRecords = await prisma.loginHistory.findMany({
          where: {
            userId: user.id,
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
        const daysLate = loginRecords.filter(r => r.latenessMinutes > 0).length;
        const totalLateness = loginRecords.reduce((sum, r) => sum + r.latenessMinutes, 0);

        let avgLoginTime = '--:--';
        if (loginRecords.length > 0) {
          const totalMinutes = loginRecords.reduce((sum, r) => {
            const time = new Date(r.loginTime);
            return sum + (time.getHours() * 60 + time.getMinutes());
          }, 0);
          const avgMinutes = Math.floor(totalMinutes / loginRecords.length);
          const hours = Math.floor(avgMinutes / 60);
          const minutes = avgMinutes % 60;
          avgLoginTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        return {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          teamName: user.team?.name || '-',
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
    res.status(500).json({ error: 'Failed to fetch attendance reports' });
  }
});

// Get team details for ACM (Quality Metrics, Completion, Campaign Progress)
router.get('/team/:teamId/details', auth, requireRole(['AccountManager']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { teamId } = req.params;

    // Verify this team is under this account manager
    const teamLeader = await prisma.user.findFirst({
      where: {
        teamId: teamId,
        role: 'TeamLeader',
        accountManagerId: userId
      }
    });

    if (!teamLeader) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get team campaigns and calculate targets
    const teamCampaigns = await prisma.campaignTeam.findMany({
      where: { teamId },
      include: { 
        campaign: { 
          select: { 
            id: true,
            name: true,
            timezone: true,
            leadsTarget: true 
          } 
        } 
      }
    });

    const dailyTarget = teamCampaigns.reduce((sum, tc) => sum + (tc.campaign.leadsTarget || 0), 0);

    // Get active agents count
    const activeAgents = await prisma.user.count({
      where: { teamId, role: { in: ['Agent', 'SeniorAgent'] }, isActive: true }
    });

    // Date calculations with 4 AM cutoff
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 0, 0, 0);
    if (now.getHours() < 4) {
      // If before 4 AM, use yesterday's 4 AM
      todayStart.setDate(todayStart.getDate() - 1);
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 4, 0, 0, 0);

    // Get today's metrics
    const [todayTotal, todayQualified, todayDisqualified, todayCallback, todayPending, todayDuplicate] = await Promise.all([
      prisma.lead.count({ where: { teamId, createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Qualified', createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Disqualified', createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Callback', createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Pending', createdAt: { gte: todayStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Duplicate', createdAt: { gte: todayStart } } })
    ]);

    // Get month's metrics
    const [monthTotal, monthQualified, monthDisqualified, monthCallback, monthPending, monthDuplicate] = await Promise.all([
      prisma.lead.count({ where: { teamId, createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Qualified', createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Disqualified', createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Callback', createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Pending', createdAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { teamId, status: 'Duplicate', createdAt: { gte: monthStart } } })
    ]);

    // Get campaign progress (DAILY)
    const campaignProgress = await Promise.all(
      teamCampaigns.map(async (tc) => {
        const campaignLeads = await prisma.lead.findMany({
          where: { campaignId: tc.campaign.id, teamId, createdAt: { gte: todayStart } },
          select: { status: true }
        });

        const total = campaignLeads.length;
        const pending = campaignLeads.filter(l => l.status === 'Pending').length;
        const callback = campaignLeads.filter(l => l.status === 'Callback').length;
        const achieved = campaignLeads.filter(l => l.status === 'Qualified').length;
        const duplicate = campaignLeads.filter(l => l.status === 'Duplicate').length;
        const disqualified = campaignLeads.filter(l => l.status === 'Disqualified').length;

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
          missed: disqualified,
          total,
          targetReached: achieved >= (tc.campaign.leadsTarget || 0)
        };
      })
    );

    res.json({
      qualityMetrics: {
        today: {
          totalLeads: todayTotal,
          qualifiedLeads: todayQualified,
          disqualifiedLeads: todayDisqualified,
          callbackLeads: todayCallback,
          pendingLeads: todayPending,
          duplicateLeads: todayDuplicate,
          qualityRate: todayTotal > 0 ? parseFloat(((todayQualified / todayTotal) * 100).toFixed(1)) : 0
        },
        month: {
          totalLeads: monthTotal,
          qualifiedLeads: monthQualified,
          disqualifiedLeads: monthDisqualified,
          callbackLeads: monthCallback,
          pendingLeads: monthPending,
          duplicateLeads: monthDuplicate,
          qualityRate: monthTotal > 0 ? parseFloat(((monthQualified / monthTotal) * 100).toFixed(1)) : 0
        },
        dailyTarget,
        activeCampaigns: teamCampaigns.length,
        activeAgents
      },
      completionMetrics: {
        dailyCompletion: dailyTarget > 0 ? parseFloat(((todayQualified / dailyTarget) * 100).toFixed(1)) : 0,
        monthlyCompletion: dailyTarget > 0 ? parseFloat(((monthQualified / (dailyTarget * new Date().getDate())) * 100).toFixed(1)) : 0
      },
      campaignProgress
    });
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

export default router;
