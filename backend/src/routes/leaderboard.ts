import { Router } from 'express';
import { auth } from '../middleware/auth';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { getCurrentMonthBounds } from '../utils/monthPeriod';

const router = Router();

router.use(auth);

// Get agent leaderboard
router.get('/agents', async (req: AuthRequest, res, next) => {
  try {
    // Use current month bounds (1st at 4 AM to next 1st at 4 AM)
    const { start, end } = getCurrentMonthBounds();

    const agentStats = await prisma.user.findMany({
      where: {
        role: {
          in: ['Agent', 'SeniorAgent']
        },
        isActive: true
      },
      include: {
        team: {
          select: { name: true }
        },
        leads: {
          where: {
            createdAt: {
              gte: start,
              lt: end
            }
          },
          select: {
            status: true,
            updatedAt: true
          }
        }
      }
    });

    const leaderboardData = agentStats.map(agent => {
      const leads = agent.leads;
      const total = leads.length;
      const pending = leads.filter(lead => lead.status === 'Pending').length;
      const callback = leads.filter(lead => lead.status === 'Callback').length;
      const qualified = leads.filter(lead => lead.status === 'Qualified').length;
      const disqualified = leads.filter(lead => lead.status === 'Disqualified').length;
      const duplicate = leads.filter(lead => lead.status === 'Duplicate').length;
      const score = qualified - disqualified;

      // Find earliest qualified lead timestamp for tiebreaker
      const qualifiedLeads = leads.filter(lead => lead.status === 'Qualified');
      const earliestQualified = qualifiedLeads.length > 0
        ? Math.min(...qualifiedLeads.map(lead => new Date(lead.updatedAt).getTime()))
        : Date.now();

      return {
        id: agent.id,
        fullName: agent.fullName,
        team: agent.team || { name: 'No Team' },
        total,
        pending,
        callback,
        qualified,
        disqualified,
        duplicate,
        score,
        earliestQualified
      };
    });

    const sortedAgents = leaderboardData
      .filter(agent => agent.total > 0)
      .sort((a, b) => {
        // Primary sort: by score (descending)
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Tiebreaker: by earliest qualified timestamp (ascending - earlier is better)
        return a.earliestQualified - b.earliestQualified;
      });

    res.json(sortedAgents);
  } catch (error) {
    next(error);
  }
});

// Get team leaderboard
router.get('/teams', async (req: AuthRequest, res, next) => {
  try {
    // Use current month bounds (1st at 4 AM to next 1st at 4 AM)
    const { start, end } = getCurrentMonthBounds();

    const teamStats = await prisma.team.findMany({
      include: {
        _count: {
          select: {
            users: {
              where: {
                role: 'Agent',
                isActive: true
              }
            }
          }
        },
        leads: {
          where: {
            createdAt: {
              gte: start,
              lt: end
            }
          },
          select: {
            status: true
          }
        }
      }
    });

    const leaderboardData = teamStats.map(team => {
      const leads = team.leads;
      const total = leads.length;
      const qualified = leads.filter(lead => lead.status === 'Qualified').length;
      const disqualified = leads.filter(lead => lead.status === 'Disqualified').length;
      const duplicate = leads.filter(lead => lead.status === 'Duplicate').length;
      const qualifiedPercent = total > 0 ? Math.round((qualified / total) * 100) : 0;

      return {
        id: team.id,
        name: team.name,
        total,
        qualified,
        disqualified,
        duplicate,
        qualifiedPercent,
        agentCount: team._count.users
      };
    });

    const sortedTeams = leaderboardData
      .filter(team => team.total > 0)
      .sort((a, b) => b.qualified - a.qualified);

    res.json(sortedTeams);
  } catch (error) {
    next(error);
  }
});

export default router;

















