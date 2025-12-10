import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';

// Simple error class for HTTP errors
class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

const router = Router();

router.use(auth);

// Get active campaigns (filtered by team for agents/team leaders)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    let where: any = { isActive: true };
    
    console.log('GET /campaigns - User:', { 
      role: req.user?.role, 
      teamId: req.user?.teamId,
      userId: req.user?.userId 
    });
    
    // If user is Agent, SeniorAgent, or TeamLeader, filter campaigns by their team
    if (req.user?.role === 'Agent' || req.user?.role === 'SeniorAgent' || req.user?.role === 'TeamLeader') {
      if (req.user.teamId) {
        // Filter campaigns by team if user has a team assigned
        where.teams = {
          some: {
            teamId: req.user.teamId
          }
        };
        console.log('Filtering campaigns by teamId:', req.user.teamId);
      } else {
        console.log('User has no team, showing all active campaigns');
      }
      // If user has no team, show all active campaigns (fallback behavior)
      // This allows users without teams to still submit leads
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      include: {
        manager: {
          select: { fullName: true }
        },
        teams: {
          include: {
            team: {
              select: { id: true, name: true }
            }
          }
        },
        qcAgents: {
          include: {
            qcAgent: {
              select: { id: true, fullName: true, username: true }
            }
          }
        },
        _count: {
          select: { leads: true }
        }
      }
    });
    
    console.log(`Found ${campaigns.length} campaigns`);
    campaigns.forEach(c => {
      console.log(`  - ${c.name}: teams = ${c.teams.map(t => t.team.name).join(', ') || 'none'}`);
    });
    
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

// Get resources (teams, QC agents, clients) for a specific Account Manager
router.get('/account-manager/:amId/resources', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'Manager') {
      throw new AppError(403, 'Insufficient permissions');
    }

    const { amId } = req.params;

    // Verify the Account Manager exists
    const accountManager = await prisma.user.findUnique({
      where: { id: amId, role: 'AccountManager' }
    });

    if (!accountManager) {
      throw new AppError(404, 'Account Manager not found');
    }

    // Get Team Leaders assigned to this Account Manager
    const teamLeaders = await prisma.user.findMany({
      where: {
        accountManagerId: amId,
        role: 'TeamLeader',
        isActive: true
      },
      select: {
        id: true,
        teamId: true
      }
    });

    // Get teams from those team leaders
    const teamIds = teamLeaders.map(tl => tl.teamId).filter((id): id is string => id !== null);
    const teams = await prisma.team.findMany({
      where: {
        id: { in: teamIds }
      },
      select: {
        id: true,
        name: true
      }
    });

    // Get QC agents assigned to this Account Manager
    const qcAgents = await prisma.user.findMany({
      where: {
        accountManagerId: amId,
        role: 'QualityControl',
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        username: true
      }
    });

    // Get clients (for now, return all active clients - you can add client assignment logic later)
    const clients = await prisma.user.findMany({
      where: {
        role: 'Client',
        isActive: true
      },
      select: {
        id: true,
        fullName: true
      }
    });

    res.json({
      accountManager: {
        id: accountManager.id,
        fullName: accountManager.fullName
      },
      teams,
      qcAgents,
      clients
    });
  } catch (error) {
    next(error);
  }
});

// Get all campaigns (for management)
router.get('/all', async (req: AuthRequest, res, next) => {
  try {
    // Allow Managers, QC Agents, and Team Leaders to view campaigns
    if (!['Manager', 'QualityControl', 'TeamLeader'].includes(req.user?.role || '')) {
      throw new AppError(403, 'Insufficient permissions');
    }

    const campaigns = await prisma.campaign.findMany({
      include: {
        manager: {
          select: { fullName: true }
        },
        client: {
          select: { id: true, fullName: true }
        },
        teams: {
          include: {
            team: {
              select: { id: true, name: true }
            }
          }
        },
        qcAgents: {
          include: {
            qcAgent: {
              select: { id: true, fullName: true, username: true }
            }
          }
        },
        _count: {
          select: { leads: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

// Create campaign
router.post(
  '/',
  validate([
    body('name').notEmpty().withMessage('Campaign name is required')
  ]),
  async (req: AuthRequest, res, next) => {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const { name, accountManagerId } = req.body;

      if (!name || !name.trim()) {
        throw new AppError(400, 'Campaign name is required');
      }

      if (!accountManagerId) {
        throw new AppError(400, 'Account Manager is required');
      }

      // Verify Account Manager exists and has correct role
      const accountManager = await prisma.user.findUnique({
        where: { id: accountManagerId, role: 'AccountManager' }
      });

      if (!accountManager) {
        throw new AppError(400, 'Invalid Account Manager');
      }

      const existingCampaign = await prisma.campaign.findFirst({
        where: {
          name: {
            equals: name.trim(),
            mode: 'insensitive'
          }
        }
      });

      if (existingCampaign) {
        throw new AppError(400, 'Campaign name already exists');
      }

      const { leadsTarget, clientId, teamIds, qcUserIds, timezone, formConfig, formTemplateId, qualifications } = req.body;

      // Validate that teams belong to the Account Manager (optional - teams can be empty)
      if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
        // Get all teams assigned to this Account Manager via Team Leaders
        const teamLeaders = await prisma.user.findMany({
          where: {
            accountManagerId,
            role: 'TeamLeader',
            isActive: true
          },
          select: {
            teamId: true
          }
        });

        const allowedTeamIds = teamLeaders.map(tl => tl.teamId).filter((id): id is string => id !== null);
        
        // Check if all selected teams are in the allowed list
        const invalidTeams = teamIds.filter((teamId: string) => !allowedTeamIds.includes(teamId));
        
        if (invalidTeams.length > 0) {
          throw new AppError(400, 'One or more teams are not assigned to this Account Manager');
        }
      }

      // Validate that QC agents belong to the Account Manager
      if (qcUserIds && Array.isArray(qcUserIds) && qcUserIds.length > 0) {
        const qcAgents = await prisma.user.findMany({
          where: {
            id: { in: qcUserIds },
            accountManagerId,
            role: 'QualityControl'
          }
        });

        if (qcAgents.length !== qcUserIds.length) {
          throw new AppError(400, 'One or more QC agents are not assigned to this Account Manager');
        }
      }

      const campaign = await prisma.campaign.create({
        data: {
          name: name.trim(),
          isActive: true,
          managerId: req.user.userId!,
          accountManagerId,
          clientId: clientId || null,
          leadsTarget: leadsTarget ? parseInt(leadsTarget) : null,
          timezone: timezone || null,
          formConfig: formConfig ? JSON.stringify(formConfig) : undefined,
          formTemplateId: formTemplateId || undefined,
          qualifications: qualifications || null,
          teams: teamIds && Array.isArray(teamIds) && teamIds.length > 0 ? {
            create: teamIds.map((teamId: string) => ({
              teamId
            }))
          } : undefined,
          qcAgents: qcUserIds && Array.isArray(qcUserIds) && qcUserIds.length > 0 ? {
            create: qcUserIds.map((qcUserId: string) => ({
              qcUserId
            }))
          } : undefined
        },
        include: {
          manager: {
            select: { fullName: true }
          },
          accountManager: {
            select: { id: true, fullName: true }
          },
          teams: {
            include: {
              team: {
                select: { id: true, name: true }
              }
            }
          },
          qcAgents: {
            include: {
              qcAgent: {
                select: { id: true, fullName: true, username: true }
              }
            }
          },
          _count: {
            select: { leads: true }
          }
        }
      });

      res.status(201).json(campaign);
    } catch (error) {
      next(error);
    }
  }
);

// Update campaign
router.put('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'Manager') {
      throw new AppError(403, 'Insufficient permissions');
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id }
    });

    if (!campaign) {
      throw new AppError(404, 'Campaign not found');
    }

    const { name, accountManagerId, leadsTarget, clientId, teamIds, qcUserIds, isActive, timezone, formConfig, formTemplateId, qualifications } = req.body;

    // If Account Manager is being changed, validate new teams and QC agents
    if (accountManagerId && accountManagerId !== campaign.accountManagerId) {
      const accountManager = await prisma.user.findUnique({
        where: { id: accountManagerId, role: 'AccountManager' }
      });

      if (!accountManager) {
        throw new AppError(400, 'Invalid Account Manager');
      }

      // Validate teams belong to new Account Manager
      if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
        // Get all teams assigned to this Account Manager via Team Leaders
        const teamLeaders = await prisma.user.findMany({
          where: {
            accountManagerId,
            role: 'TeamLeader',
            isActive: true
          },
          select: {
            teamId: true
          }
        });

        const allowedTeamIds = teamLeaders.map(tl => tl.teamId).filter((id): id is string => id !== null);
        
        // Check if all selected teams are in the allowed list
        const invalidTeams = teamIds.filter((teamId: string) => !allowedTeamIds.includes(teamId));
        
        if (invalidTeams.length > 0) {
          throw new AppError(400, 'One or more teams are not assigned to the new Account Manager');
        }
      }

      // Validate QC agents belong to new Account Manager
      if (qcUserIds && Array.isArray(qcUserIds) && qcUserIds.length > 0) {
        const qcAgents = await prisma.user.findMany({
          where: {
            id: { in: qcUserIds },
            accountManagerId,
            role: 'QualityControl'
          }
        });

        if (qcAgents.length !== qcUserIds.length) {
          throw new AppError(400, 'One or more QC agents are not assigned to the new Account Manager');
        }
      }
    }

    // Check name uniqueness if changing
    if (name && name.trim() !== campaign.name) {
      const existingCampaign = await prisma.campaign.findFirst({
        where: {
          name: {
            equals: name.trim(),
            mode: 'insensitive'
          },
          id: { not: req.params.id }
        }
      });

      if (existingCampaign) {
        throw new AppError(400, 'Campaign name already exists');
      }
    }

    // Update campaign
    const updatedCampaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        name: name ? name.trim() : undefined,
        accountManagerId: accountManagerId !== undefined ? (accountManagerId || null) : undefined,
        leadsTarget: leadsTarget !== undefined ? (leadsTarget ? parseInt(leadsTarget) : null) : undefined,
        clientId: clientId !== undefined ? (clientId || null) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        timezone: timezone !== undefined ? (timezone || null) : undefined,
        formConfig: formConfig !== undefined ? (formConfig ? JSON.stringify(formConfig) : undefined) : undefined,
        formTemplateId: formTemplateId !== undefined ? (formTemplateId || undefined) : undefined,
        qualifications: qualifications !== undefined ? (qualifications || null) : undefined,
        // Update teams
        teams: teamIds !== undefined ? {
          deleteMany: {},
          create: Array.isArray(teamIds) && teamIds.length > 0 ? teamIds.map((teamId: string) => ({
            teamId
          })) : []
        } : undefined,
        // Update QC agents
        qcAgents: qcUserIds !== undefined ? {
          deleteMany: {},
          create: Array.isArray(qcUserIds) && qcUserIds.length > 0 ? qcUserIds.map((qcUserId: string) => ({
            qcUserId
          })) : []
        } : undefined
      },
      include: {
        manager: {
          select: { fullName: true }
        },
        accountManager: {
          select: { id: true, fullName: true }
        },
        teams: {
          include: {
            team: {
              select: { id: true, name: true }
            }
          }
        },
        qcAgents: {
          include: {
            qcAgent: {
              select: { id: true, fullName: true, username: true }
            }
          }
        },
        _count: {
          select: { leads: true }
        }
      }
    });

    res.json(updatedCampaign);
  } catch (error) {
    next(error);
  }
});

// Update campaign status
router.patch('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'Manager') {
      throw new AppError(403, 'Insufficient permissions');
    }

    const { isActive } = req.body;

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { isActive },
      include: {
        manager: {
          select: { fullName: true }
        },
        _count: {
          select: { leads: true }
        }
      }
    });

    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// Delete campaign
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    if (req.user?.role !== 'Manager') {
      throw new AppError(403, 'Insufficient permissions');
    }

    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      throw new AppError(404, 'Campaign not found');
    }

    // Delete the campaign - the database will automatically set campaignId to null
    // for all associated leads due to ON DELETE SET NULL constraint
    await prisma.campaign.delete({
      where: { id: campaignId }
    });

    res.json({
      message: `Campaign "${campaign.name}" deleted successfully`,
      leadsAffected: campaign.leads.length,
      leadsAction: 'disassociated_from_campaign'
    });
  } catch (error) {
    next(error);
  }
});

export default router;










