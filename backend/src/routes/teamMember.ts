import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth';
import { PERMISSIONS } from '../utils/permissions';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  user?: {
    userId: string;
    role: string;
    clientId?: string;
  };
}

// Middleware to check team member permissions
const checkPermission = (permissionPath: string) => {
  return async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const userId = req.user!.userId;
      const role = req.user!.role;

      if (role !== 'TeamMember') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId },
        select: {
          position: {
            select: {
              permissionSet: true
            }
          }
        }
      });

      if (!teamMember?.position) {
        return res.status(403).json({ error: 'No position assigned' });
      }

      const permissions = teamMember.position.permissionSet as any;
      const keys = permissionPath.split('.');
      let value = permissions;
      
      for (const key of keys) {
        value = value?.[key];
      }

      if (value !== true) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Get all leads for team member's client
router.get('/leads', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const leads = await prisma.lead.findMany({
      where: {
        campaign: {
          clientId: teamMember.clientId
        },
        status: 'Qualified',
        archived: false
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            formTemplateId: true,
            formTemplate: {
              select: {
                id: true,
                name: true,
                fields: true
              }
            }
          }
        },
        agent: {
          select: {
            id: true,
            fullName: true
          }
        },
        clientNotes: {
          orderBy: { createdAt: 'desc' }
        },
        schedules: {
          orderBy: { scheduledDate: 'asc' }
        },
        stageQualities: {
          orderBy: { ratedAt: 'desc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(leads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle star on lead
router.patch('/leads/:id/star', auth, checkPermission('leads.view_all'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const { starred } = req.body;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { starred }
    });

    res.json(lead);
  } catch (error) {
    console.error('Star lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move lead to pipeline (mark as reviewed)
router.patch('/leads/:id/review', auth, checkPermission('leads.view_all'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { clientReviewed: true }
    });

    res.json(lead);
  } catch (error) {
    console.error('Review lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update lead pipeline stage
router.patch('/leads/:id/stage', auth, checkPermission('pipeline.full_access'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const { pipelineStage } = req.body;
    const userId = req.user!.userId;

    // Get team member's client ID
    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Get current lead to check current stage
    const currentLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { pipelineStage: true }
    });

    if (!currentLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get stage orders to prevent backward movement
    if (currentLead.pipelineStage) {
      const [currentStage, newStage] = await Promise.all([
        prisma.pipelineStage.findFirst({
          where: { name: currentLead.pipelineStage },
          select: { order: true }
        }),
        prisma.pipelineStage.findFirst({
          where: { name: pipelineStage },
          select: { order: true }
        })
      ]);

      // Prevent moving backwards in the pipeline
      if (currentStage && newStage && newStage.order < currentStage.order) {
        return res.status(400).json({ 
          error: 'Cannot move lead backwards in the pipeline. Leads can only progress forward.' 
        });
      }
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { 
        pipelineStage,
        // Clear quality rating when moving to new stage
        taskQualityIndicator: null,
        taskQualityStage: null
      }
    });

    // Execute pipeline automation
    console.log(`[TeamMember Route] Executing automation for lead ${leadId}, stage: ${pipelineStage}, client: ${teamMember.clientId}`);
    const { executePipelineAutomation } = await import('./automationRules');
    await executePipelineAutomation(leadId, pipelineStage, teamMember.clientId);
    console.log(`[TeamMember Route] Automation execution completed`);

    res.json(lead);
  } catch (error) {
    console.error('Update stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lead with full details
router.get('/leads/:id', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const userId = req.user!.userId;

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId: teamMember.clientId
        }
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            formTemplateId: true,
            formTemplate: {
              select: {
                id: true,
                name: true,
                fields: true
              }
            }
          }
        },
        agent: {
          select: {
            id: true,
            fullName: true
          }
        },
        schedules: {
          orderBy: { scheduledDate: 'asc' }
        },
        clientNotes: {
          orderBy: { createdAt: 'desc' }
        },
        stageQualities: {
          orderBy: { ratedAt: 'desc' }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lead schedules
router.get('/leads/:id/schedules', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    
    const schedules = await prisma.clientSchedule.findMany({
      where: { leadId },
      orderBy: { scheduledDate: 'asc' }
    });

    res.json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all schedules for team member's assigned leads
router.get('/schedules', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get team member's client ID
    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Get leads currently assigned to this team member
    const assignedLeads = await prisma.lead.findMany({
      where: {
        assignedUserId: userId,
        campaign: {
          clientId: teamMember.clientId
        }
      },
      select: { id: true }
    });

    const leadIds = assignedLeads.map(lead => lead.id);

    console.log(`[Team Member Schedules] Member ${userId} has ${leadIds.length} assigned leads`);

    // If no leads assigned, return empty array
    if (leadIds.length === 0) {
      console.log(`[Team Member Schedules] No leads assigned, returning empty array`);
      return res.json([]);
    }

    // Get schedules for those leads
    const schedules = await prisma.clientSchedule.findMany({
      where: {
        leadId: { in: leadIds },
        clientId: teamMember.clientId
      },
      include: {
        lead: {
          select: {
            id: true,
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true,
            phone: true,
            addressText: true,
            pipelineStage: true
          }
        }
      },
      orderBy: { scheduledDate: 'asc' }
    });

    // Filter out schedules for closed/dead leads
    const activeSchedules = schedules.filter(schedule => 
      schedule.lead.pipelineStage !== 'Closed' && 
      schedule.lead.pipelineStage !== 'Dead'
    );

    res.json(activeSchedules);
  } catch (error) {
    console.error('Get team member schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lead notes
router.get('/leads/:id/notes', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    
    const notes = await prisma.clientNote.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get lead activity history
router.get('/leads/:id/activity', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const userId = req.user!.userId;

    // Verify team member has access to this lead
    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Verify lead belongs to client
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId: teamMember.clientId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Fetch activity logs for this lead
    const activities = await prisma.activityLog.findMany({
      where: {
        entityType: 'lead',
        entityId: leadId
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(activities);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add schedule
router.post('/leads/:id/schedules', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const { scheduledDate, type, notes } = req.body;
    const userId = req.user!.userId;

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const schedule = await prisma.clientSchedule.create({
      data: {
        leadId,
        clientId: teamMember.clientId,
        scheduledDate: new Date(scheduledDate),
        type,
        notes,
        status: 'SCHEDULED'
      }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Add schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update schedule
router.patch('/schedules/:id', auth, checkPermission('pipeline.full_access'), async (req: AuthRequest, res) => {
  try {
    const { id: scheduleId } = req.params;
    const updates = req.body;

    const schedule = await prisma.clientSchedule.update({
      where: { id: scheduleId },
      data: updates
    });

    res.json(schedule);
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete schedule
router.delete('/schedules/:id', auth, checkPermission('pipeline.full_access'), async (req: AuthRequest, res) => {
  try {
    const { id: scheduleId } = req.params;

    await prisma.clientSchedule.delete({
      where: { id: scheduleId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add note
router.post('/leads/:id/notes', auth, checkPermission('pipeline.view_pipeline'), async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const { content, recordingUrl } = req.body;
    const userId = req.user!.userId;

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true, name: true }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const note = await prisma.clientNote.create({
      data: {
        leadId,
        clientId: teamMember.clientId,
        content,
        recordingUrl,
        authorName: teamMember.name,
        authorType: 'team_member'
      }
    });

    res.json(note);
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update note
router.put('/notes/:id', auth, checkPermission('pipeline.full_access'), async (req: AuthRequest, res) => {
  try {
    const { id: noteId } = req.params;
    const { content, recordingUrl } = req.body;

    const note = await prisma.clientNote.update({
      where: { id: noteId },
      data: { content, recordingUrl }
    });

    res.json(note);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete note
router.delete('/notes/:id', auth, checkPermission('pipeline.full_access'), async (req: AuthRequest, res) => {
  try {
    const { id: noteId } = req.params;

    await prisma.clientNote.delete({
      where: { id: noteId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team member's tasks
router.get('/tasks', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const { status } = req.query;

    const where: any = {
      assignedUserId: userId
    };

    if (status) where.status = status;
    
    const tasks = await prisma.task.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true,
            addressText: true,
            pipelineStage: true,
            phone: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            positionTitle: true
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching team member tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Mark lead as Closed or Dead
router.patch('/leads/:id/archive', auth, async (req: AuthRequest, res) => {
  try {
    const { id: leadId } = req.params;
    const { pipelineStage } = req.body;
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get team member permissions
    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: {
        position: {
          select: {
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember?.position) {
      return res.status(403).json({ error: 'No position assigned' });
    }

    const permissions = teamMember.position.permissionSet as any;

    // Check specific permission based on stage
    if (pipelineStage === 'Closed') {
      if (permissions?.pipeline?.mark_closed !== true) {
        return res.status(403).json({ error: 'Permission denied: Cannot mark as Closed' });
      }
    } else if (pipelineStage === 'Dead') {
      if (permissions?.pipeline?.mark_dead !== true) {
        return res.status(403).json({ error: 'Permission denied: Cannot mark as Dead' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid pipeline stage for archiving' });
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStage,
        archived: true,
        archivedAt: new Date()
      }
    });

    // Auto-complete all pending tasks for this lead when marked as Closed or Dead
    await prisma.task.updateMany({
      where: {
        leadId,
        status: 'pending'
      },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    console.log(`[Archive Lead] Auto-completed all pending tasks for lead ${leadId} (marked as ${pipelineStage})`);

    res.json(lead);
  } catch (error) {
    console.error('Archive lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as teamMemberRoutes };
