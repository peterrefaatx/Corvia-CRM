import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, requireRole, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all automation rules for client
router.get('/', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;

    const rules = await prisma.pipelineAutomationRule.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(rules);
  } catch (error) {
    console.error('Error fetching automation rules:', error);
    res.status(500).json({ error: 'Failed to fetch automation rules' });
  }
});

// Get single automation rule
router.get('/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    const rule = await prisma.pipelineAutomationRule.findFirst({
      where: {
        id,
        clientId
      }
    });

    if (!rule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Error fetching automation rule:', error);
    res.status(500).json({ error: 'Failed to fetch automation rule' });
  }
});

// Create automation rule
router.post('/', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { pipelineStage, ruleConfig, isActive } = req.body;

    // Validate required fields
    if (!pipelineStage || !ruleConfig) {
      return res.status(400).json({ error: 'Pipeline stage and rule configuration are required' });
    }

    // Validate ruleConfig structure
    if (!ruleConfig.tasks || !Array.isArray(ruleConfig.tasks)) {
      return res.status(400).json({ error: 'Rule config must contain a tasks array' });
    }

    // Create automation rule
    const rule = await prisma.pipelineAutomationRule.create({
      data: {
        clientId,
        pipelineStage,
        ruleConfig,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'automation_rule_created',
        entityType: 'automation_rule',
        entityId: rule.id,
        description: `Created automation rule for stage: ${pipelineStage}`,
        metadata: { pipelineStage, taskCount: ruleConfig.tasks.length }
      }
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating automation rule:', error);
    res.status(500).json({ error: 'Failed to create automation rule' });
  }
});

// Update automation rule
router.put('/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { pipelineStage, ruleConfig, isActive } = req.body;

    // Verify rule belongs to client
    const existingRule = await prisma.pipelineAutomationRule.findFirst({
      where: {
        id,
        clientId
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    // Update rule
    const rule = await prisma.pipelineAutomationRule.update({
      where: { id },
      data: {
        ...(pipelineStage && { pipelineStage }),
        ...(ruleConfig && { ruleConfig }),
        ...(isActive !== undefined && { isActive })
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'automation_rule_updated',
        entityType: 'automation_rule',
        entityId: id,
        description: `Updated automation rule for stage: ${rule.pipelineStage}`,
        metadata: req.body
      }
    });

    res.json(rule);
  } catch (error) {
    console.error('Error updating automation rule:', error);
    res.status(500).json({ error: 'Failed to update automation rule' });
  }
});

// Toggle automation rule active status
router.patch('/:id/toggle', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    // Verify rule belongs to client
    const existingRule = await prisma.pipelineAutomationRule.findFirst({
      where: {
        id,
        clientId
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    // Toggle status
    const rule = await prisma.pipelineAutomationRule.update({
      where: { id },
      data: {
        isActive: !existingRule.isActive
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'automation_rule_updated',
        entityType: 'automation_rule',
        entityId: id,
        description: `${rule.isActive ? 'Activated' : 'Deactivated'} automation rule for stage: ${rule.pipelineStage}`,
        metadata: { isActive: rule.isActive }
      }
    });

    res.json(rule);
  } catch (error) {
    console.error('Error toggling automation rule:', error);
    res.status(500).json({ error: 'Failed to toggle automation rule' });
  }
});

// Delete automation rule
router.delete('/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    // Verify rule belongs to client
    const existingRule = await prisma.pipelineAutomationRule.findFirst({
      where: {
        id,
        clientId
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: 'Automation rule not found' });
    }

    // Delete rule
    await prisma.pipelineAutomationRule.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'automation_rule_deleted',
        entityType: 'automation_rule',
        entityId: id,
        description: `Deleted automation rule for stage: ${existingRule.pipelineStage}`,
        metadata: {}
      }
    });

    res.json({ message: 'Automation rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    res.status(500).json({ error: 'Failed to delete automation rule' });
  }
});

// Helper function to get next team member using round-robin
async function getNextTeamMemberRoundRobin(clientId: string, positionTitle: string): Promise<string | null> {
  console.log(`[Round-Robin] Looking for position: "${positionTitle}" for client: ${clientId}`);
  
  // Find the position
  const position = await prisma.position.findFirst({
    where: {
      clientId,
      title: positionTitle,
      isActive: true
    }
  });

  if (!position) {
    console.log(`[Round-Robin] Position not found, trying fallback by positionTitle`);
    // Fallback: find by positionTitle directly
    const teamMembers = await prisma.clientTeamMember.findMany({
      where: {
        clientId,
        positionTitle,
        status: 'active'
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`[Round-Robin] Fallback found ${teamMembers.length} team members`);
    if (teamMembers.length === 0) return null;
    return teamMembers[0].id;
  }

  console.log(`[Round-Robin] Position found: ${position.title} (ID: ${position.id})`);

  // Get all active AND available team members for this position
  const teamMembers = await prisma.clientTeamMember.findMany({
    where: {
      positionId: position.id,
      status: 'active',
      isAvailable: true // Only include available members (not on day off)
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`[Round-Robin] Found ${teamMembers.length} active and available team members for position`);
  if (teamMembers.length === 0) {
    console.log(`[Round-Robin] No available team members found (all may be on day off)`);
    return null;
  }

  // Get the next index using round-robin
  const nextIndex = position.lastAssignedIndex % teamMembers.length;
  const selectedMember = teamMembers[nextIndex];

  console.log(`[Round-Robin] Selected member: ${selectedMember.name} (index: ${nextIndex})`);

  // Update the position's lastAssignedIndex
  await prisma.position.update({
    where: { id: position.id },
    data: { lastAssignedIndex: nextIndex + 1 }
  });

  return selectedMember.id;
}

// Execute automation rules when pipeline stage changes
export async function executePipelineAutomation(leadId: string, newStage: string, clientId: string) {
  try {
    // SMART CHECK: Has this lead been in this stage before?
    // If yes, skip automation to preserve previous state (tasks, assignments, etc.)
    const previousVisit = await prisma.activityLog.findFirst({
      where: {
        entityType: 'lead',
        entityId: leadId,
        actionType: 'pipeline_changed',
        metadata: {
          path: ['newStage'],
          equals: newStage
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (previousVisit) {
      console.log(`Lead ${leadId} returning to stage "${newStage}", skipping automation to preserve previous state`);
      return;
    }

    // First time in this stage - proceed with automation
    console.log(`Lead ${leadId} entering stage "${newStage}" for the first time, running automation`);

    // Log the pipeline stage change
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'pipeline_changed',
        entityType: 'lead',
        entityId: leadId,
        description: `Pipeline stage changed to ${newStage}`,
        metadata: {
          newStage,
          timestamp: new Date().toISOString()
        }
      }
    });

    // Find active automation rules for this stage and client
    const rules = await prisma.pipelineAutomationRule.findMany({
      where: {
        clientId,
        pipelineStage: newStage,
        isActive: true
      }
    });

    console.log(`[Automation] Found ${rules.length} active rules for stage "${newStage}"`);
    if (rules.length === 0) {
      console.log(`[Automation] No automation rules found for stage "${newStage}"`);
      return;
    }

    // Get lead details
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead) {
      return;
    }

    // Execute each rule
    for (const rule of rules) {
      const ruleConfig = rule.ruleConfig as any;
      
      if (!ruleConfig.tasks || !Array.isArray(ruleConfig.tasks)) {
        continue;
      }

      // Create tasks for each task in the rule
      for (const taskConfig of ruleConfig.tasks) {
        console.log(`[Automation] Processing task: "${taskConfig.title}" for position: "${taskConfig.assign_to_role}"`);
        
        // Use round-robin to get next team member
        const teamMemberId = await getNextTeamMemberRoundRobin(clientId, taskConfig.assign_to_role);

        if (!teamMemberId) {
          console.warn(`[Automation] No active team member found for position: ${taskConfig.assign_to_role}`);
          continue;
        }
        
        console.log(`[Automation] Creating task for team member: ${teamMemberId}`);

        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + (taskConfig.due_in_hours || 24));

        const task = await prisma.task.create({
          data: {
            clientId,
            leadId,
            assignedUserId: teamMemberId,
            createdByUserId: teamMemberId,
            createdByType: 'automation',
            title: taskConfig.title,
            description: taskConfig.description || '',
            dueDate,
            status: 'pending'
          }
        });

        console.log(`[Automation] Task created successfully: ${task.id}`);

        // Update lead assignment to this team member (for schedule visibility)
        await prisma.lead.update({
          where: { id: leadId },
          data: { assignedUserId: teamMemberId }
        });

        console.log(`[Automation] Lead assigned to team member: ${teamMemberId}`);

        // Create notification
        await prisma.notification.create({
          data: {
            recipientId: teamMemberId,
            type: 'task_assigned',
            title: 'New Task (Automated)',
            message: `Automated task created: ${taskConfig.title}`,
            entityType: 'task',
            entityId: task.id
          }
        });
        
        console.log(`[Automation] Notification created for team member: ${teamMemberId}`);

        // Log activity
        await prisma.activityLog.create({
          data: {
            clientId,
            userId: teamMemberId,
            userType: 'team_member',
            actionType: 'task_assigned',
            entityType: 'task',
            entityId: task.id,
            description: `Automated task created: ${taskConfig.title} for lead ${lead.serialNumber}`,
            metadata: {
              automationRuleId: rule.id,
              pipelineStage: newStage
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error executing pipeline automation:', error);
  }
}

export default router;
