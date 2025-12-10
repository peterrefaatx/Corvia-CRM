import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixActivityLogs() {
  const leadId = 'cmispxo3m001pqhddbj220ip7';
  
  console.log('Fixing activity logs for lead:', leadId);
  
  // Get all "task_completed" logs that need fixing
  const logs = await prisma.activityLog.findMany({
    where: {
      entityId: leadId,
      entityType: 'lead',
      actionType: 'task_completed',
      description: {
        startsWith: 'All tasks completed'
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${logs.length} logs to fix\n`);
  
  for (const log of logs) {
    const metadata = log.metadata as any;
    const stage = metadata?.pipelineStage;
    
    if (!stage) {
      console.log(`Skipping log ${log.id} - no stage in metadata`);
      continue;
    }
    
    // Get tasks that were completed for this stage around this time
    const tasks = await prisma.task.findMany({
      where: {
        leadId,
        status: 'completed',
        completedAt: {
          lte: log.createdAt
        }
      },
      include: {
        assignedUser: {
          select: {
            name: true
          }
        }
      },
      orderBy: { completedAt: 'desc' }
    });
    
    const completedCount = tasks.length;
    const completers = [...new Set(tasks.map(t => t.assignedUser.name))];
    const completerText = completers.length > 0 ? ` by ${completers.join(', ')}` : '';
    
    const newDescription = `All ${completedCount} ${completedCount === 1 ? 'task' : 'tasks'} completed for ${stage} stage${completerText}`;
    
    await prisma.activityLog.update({
      where: { id: log.id },
      data: {
        description: newDescription,
        metadata: {
          ...metadata,
          taskCount: completedCount,
          completedBy: completers
        }
      }
    });
    
    console.log(`✓ Updated: ${log.createdAt.toISOString()}`);
    console.log(`  Old: ${log.description}`);
    console.log(`  New: ${newDescription}\n`);
  }
  
  console.log('Done!');
  await prisma.$disconnect();
}

fixActivityLogs().catch(console.error);
