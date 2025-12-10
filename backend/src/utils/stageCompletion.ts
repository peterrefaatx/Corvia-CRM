import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface StageCompletionStatus {
  isComplete: boolean;
  pendingCount: number;
  completedCount: number;
  totalCount: number;
}

/**
 * Check if all tasks for a lead's current stage are complete
 */
export async function getStageCompletionStatus(
  leadId: string,
  pipelineStage: string
): Promise<StageCompletionStatus> {
  const [pendingCount, completedCount] = await Promise.all([
    prisma.task.count({
      where: {
        leadId,
        lead: { pipelineStage },
        status: 'pending'
      }
    }),
    prisma.task.count({
      where: {
        leadId,
        lead: { pipelineStage },
        status: 'completed'
      }
    })
  ]);

  const totalCount = pendingCount + completedCount;
  const isComplete = totalCount > 0 && pendingCount === 0;

  return {
    isComplete,
    pendingCount,
    completedCount,
    totalCount
  };
}

/**
 * Notify client when stage is complete and ready to progress
 */
export async function notifyStageComplete(
  leadId: string,
  clientId: string,
  pipelineStage: string
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      serialNumber: true,
      homeownerFirst: true,
      homeownerLast: true
    }
  });

  if (!lead) return;

  // Find team members with full_access permission to notify
  const teamMembers = await prisma.clientTeamMember.findMany({
    where: {
      clientId,
      status: 'active',
      position: {
        isActive: true
      }
    },
    include: {
      position: {
        select: {
          permissionSet: true
        }
      }
    }
  });

  // Notify team members with full pipeline access
  for (const member of teamMembers) {
    const permissions = member.position?.permissionSet as any;
    if (permissions?.pipeline?.full_access === true) {
      await prisma.notification.create({
        data: {
          recipientId: member.id,
          type: 'task_completed',
          title: '✓ Lead Ready to Progress',
          message: `${lead.homeownerFirst} ${lead.homeownerLast} (#${lead.serialNumber}) - All tasks complete for "${pipelineStage}" stage`,
          entityType: 'lead',
          entityId: leadId
        }
      });
    }
  }

  // Don't log a summary - individual task completions are already logged
}
