import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth';
import { AuthRequest } from '../types/express';
import { getStageCompletionStatus, notifyStageComplete } from '../utils/stageCompletion';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to check if user is client or team member
const getUserContext = async (req: AuthRequest) => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  if (userRole === 'Client') {
    return { type: 'client', id: userId, clientId: userId };
  }

  if (userRole === 'TeamMember') {
    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: { clientId: true }
    });
    
    if (!teamMember) {
      throw new Error('Team member not found');
    }
    
    return { type: 'team_member', id: userId, clientId: teamMember.clientId };
  }

  // Default to client for backward compatibility
  return { type: 'client', id: userId, clientId: userId };
};

// Create task
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const { leadId, assignedUserId, title, description, dueDate } = req.body;
    const userContext = await getUserContext(req);

    // Validate required fields
    if (!leadId || !assignedUserId || !title || !dueDate) {
      return res.status(400).json({ error: 'Lead, assigned user, title, and due date are required' });
    }

    // Verify lead belongs to client
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId: userContext.clientId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Verify assigned user belongs to client
    const teamMember = await prisma.clientTeamMember.findFirst({
      where: {
        id: assignedUserId,
        clientId: userContext.clientId
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        clientId: userContext.clientId,
        leadId,
        assignedUserId,
        createdByUserId: assignedUserId, // Temporary - will fix with proper auth
        createdByType: 'client',
        title,
        description,
        dueDate: new Date(dueDate),
        status: 'pending'
      },
      include: {
        lead: {
          select: {
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true,
            addressText: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            positionTitle: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId: userContext.clientId,
        userId: null,
        userType: 'client',
        actionType: 'task_created',
        entityType: 'task',
        entityId: task.id,
        description: `Created task: ${title} for lead ${lead.serialNumber}`,
        metadata: { leadId, assignedUserId }
      }
    });

    // Create notification
    await prisma.notification.create({
      data: {
        recipientId: assignedUserId,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `You have been assigned a new task: ${title}`,
        entityType: 'task',
        entityId: task.id
      }
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get all tasks (filtered by client)
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const userContext = await getUserContext(req);
    const { status, assignedUserId, leadId } = req.query;

    const where: any = {
      clientId: userContext.clientId
    };

    if (status) where.status = status;
    if (assignedUserId) where.assignedUserId = assignedUserId;
    if (leadId) where.leadId = leadId;

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
            pipelineStage: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            positionTitle: true
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get my assigned tasks
router.get('/my-tasks', auth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { status } = req.query;

    // Determine clientId and assignedUserId based on role
    let clientId: string;
    let assignedUserId: string | undefined;

    if (userRole === 'TeamMember') {
      // Team member - get their own tasks
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId },
        select: { clientId: true }
      });
      
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      clientId = teamMember.clientId;
      assignedUserId = userId; // Filter by this team member's tasks
    } else if (userRole === 'Client') {
      // Client - get all tasks for their organization
      clientId = userId;
      // Don't filter by assignedUserId - show all tasks
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const where: any = {
      clientId,
      ...(assignedUserId && { assignedUserId })
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
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task
router.get('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userContext = await getUserContext(req);

    const task = await prisma.task.findFirst({
      where: {
        id,
        clientId: userContext.clientId
      },
      include: {
        lead: {
          select: {
            id: true,
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true,
            phone: true,
            email: true,
            addressText: true,
            pipelineStage: true,
            temperature: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            positionTitle: true
          }
        }
      }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update task
router.put('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, assignedUserId } = req.body;
    const userContext = await getUserContext(req);

    // Verify task belongs to client
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        clientId: userContext.clientId
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update task
    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(assignedUserId && { assignedUserId })
      },
      include: {
        lead: {
          select: {
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            positionTitle: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId: userContext.clientId,
        userId: null,
        userType: 'client',
        actionType: 'task_created',
        entityType: 'task',
        entityId: id,
        description: `Updated task: ${task.title}`,
        metadata: req.body
      }
    });

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Complete task
router.put('/:id/complete', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { completionNote, qualityRating } = req.body;
    const userContext = await getUserContext(req);

    // Verify task belongs to client or is assigned to team member
    const whereClause: any = {
      id,
      clientId: userContext.clientId
    };

    // If team member, also check if task is assigned to them
    if (userContext.type === 'team_member') {
      whereClause.OR = [
        { assignedUserId: userContext.id },
        { clientId: userContext.clientId }
      ];
      delete whereClause.clientId; // Remove the direct clientId check when using OR
      whereClause.AND = [
        { clientId: userContext.clientId }
      ];
    }

    const existingTask = await prisma.task.findFirst({
      where: whereClause,
      include: {
        lead: true,
        assignedUser: true
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Mark task as completed
    const task = await prisma.task.update({
      where: { id },
      data: {
        status: 'completed',
        completionNote,
        qualityRating,
        completedAt: new Date()
      },
      include: {
        lead: {
          select: {
            id: true,
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true,
            pipelineStage: true
          }
        },
        assignedUser: {
          select: {
            name: true,
            positionTitle: true
          }
        }
      }
    });

    // Save stage-specific quality rating
    if (qualityRating && ['green', 'orange', 'red'].includes(qualityRating)) {
      await prisma.leadStageQuality.upsert({
        where: {
          leadId_pipelineStage: {
            leadId: existingTask.leadId,
            pipelineStage: existingTask.lead.pipelineStage
          }
        },
        update: {
          qualityRating,
          ratedAt: new Date(),
          ratedBy: userContext.id,
          ratedByName: existingTask.assignedUser.name
        },
        create: {
          leadId: existingTask.leadId,
          pipelineStage: existingTask.lead.pipelineStage,
          qualityRating,
          ratedBy: userContext.id,
          ratedByName: existingTask.assignedUser.name
        }
      });

      // Also update the lead's current quality indicator for backward compatibility
      await prisma.lead.update({
        where: { id: existingTask.leadId },
        data: {
          taskQualityIndicator: qualityRating,
          taskQualityStage: existingTask.lead.pipelineStage
        }
      });
    }

    // Log activity with team member name
    await prisma.activityLog.create({
      data: {
        clientId: userContext.clientId,
        userId: existingTask.assignedUserId,
        userType: 'team_member',
        actionType: 'task_completed',
        entityType: 'lead',
        entityId: existingTask.leadId,
        description: `Task completed for ${existingTask.lead.pipelineStage} stage by ${task.assignedUser.name}`,
        metadata: { 
          completionNote, 
          qualityRating,
          taskId: id,
          taskTitle: task.title,
          completedBy: task.assignedUser.name,
          stage: existingTask.lead.pipelineStage
        }
      }
    });

    // Check if all tasks for this stage are now complete
    const stageStatus = await getStageCompletionStatus(
      existingTask.leadId,
      existingTask.lead.pipelineStage
    );

    if (stageStatus.isComplete) {
      // Notify client that stage is ready to progress
      await notifyStageComplete(
        existingTask.leadId,
        userContext.clientId,
        existingTask.lead.pipelineStage
      );
    }

    res.json(task);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// Reassign task
router.put('/:id/assign', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { assignedUserId } = req.body;
    const userContext = await getUserContext(req);

    if (!assignedUserId) {
      return res.status(400).json({ error: 'Assigned user ID is required' });
    }

    // Verify task belongs to client
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        clientId: userContext.clientId
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify new assigned user belongs to client
    const teamMember = await prisma.clientTeamMember.findFirst({
      where: {
        id: assignedUserId,
        clientId: userContext.clientId
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Reassign task
    const task = await prisma.task.update({
      where: { id },
      data: { assignedUserId },
      include: {
        lead: {
          select: {
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true
          }
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            positionTitle: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId: userContext.clientId,
        userId: null,
        userType: 'client',
        actionType: 'task_assigned',
        entityType: 'task',
        entityId: id,
        description: `Reassigned task: ${task.title} to ${teamMember.name}`,
        metadata: { assignedUserId, previousUserId: existingTask.assignedUserId }
      }
    });

    // Create notification for new assignee
    await prisma.notification.create({
      data: {
        recipientId: assignedUserId,
        type: 'task_assigned',
        title: 'Task Reassigned to You',
        message: `You have been assigned task: ${task.title}`,
        entityType: 'task',
        entityId: task.id
      }
    });

    res.json(task);
  } catch (error) {
    console.error('Error reassigning task:', error);
    res.status(500).json({ error: 'Failed to reassign task' });
  }
});

// Get stage completion status for a lead
router.get('/lead/:leadId/stage-status', auth, async (req: AuthRequest, res) => {
  try {
    const { leadId } = req.params;
    const userContext = await getUserContext(req);

    // Verify lead belongs to client
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId: userContext.clientId }
      },
      select: {
        pipelineStage: true
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const stageStatus = await getStageCompletionStatus(leadId, lead.pipelineStage);
    res.json(stageStatus);
  } catch (error) {
    console.error('Error fetching stage completion status:', error);
    res.status(500).json({ error: 'Failed to fetch stage completion status' });
  }
});

// Delete task
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userContext = await getUserContext(req);

    // Verify task belongs to client
    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        clientId: userContext.clientId
      }
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Delete task
    await prisma.task.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId: userContext.clientId,
        userId: null,
        userType: 'client',
        actionType: 'task_created',
        entityType: 'task',
        entityId: id,
        description: `Deleted task: ${existingTask.title}`,
        metadata: {}
      }
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
