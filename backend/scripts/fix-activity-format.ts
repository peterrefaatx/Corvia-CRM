import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixActivityFormat() {
  const leadId = 'cmispxo3m001pqhddbj220ip7';
  
  console.log('Fixing activity format for lead:', leadId);
  
  // 1. Delete all "All X tasks completed" logs
  const deletedSummaries = await prisma.activityLog.deleteMany({
    where: {
      entityId: leadId,
      entityType: 'lead',
      actionType: 'task_completed',
      description: {
        startsWith: 'All'
      }
    }
  });
  
  console.log(`✓ Deleted ${deletedSummaries.count} summary logs\n`);
  
  // 2. Update individual task completion logs to new format
  const individualLogs = await prisma.activityLog.findMany({
    where: {
      entityId: leadId,
      entityType: 'lead',
      actionType: 'task_completed',
      description: {
        contains: 'completed task:'
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log(`Found ${individualLogs.length} individual task logs to update\n`);
  
  for (const log of individualLogs) {
    const metadata = log.metadata as any;
    const stage = metadata?.stage;
    const completedBy = metadata?.completedBy;
    
    if (!stage || !completedBy) {
      console.log(`Skipping log ${log.id} - missing data`);
      continue;
    }
    
    const newDescription = `Task completed for ${stage} stage by ${completedBy}`;
    
    await prisma.activityLog.update({
      where: { id: log.id },
      data: {
        description: newDescription
      }
    });
    
    console.log(`✓ Updated: ${log.createdAt.toISOString()}`);
    console.log(`  Old: ${log.description}`);
    console.log(`  New: ${newDescription}\n`);
  }
  
  console.log('Done!');
  await prisma.$disconnect();
}

fixActivityFormat().catch(console.error);
