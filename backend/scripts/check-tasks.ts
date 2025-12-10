import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTasks() {
  const leadId = 'cmispxo3m001pqhddbj220ip7';
  
  console.log('Fetching tasks for lead:', leadId);
  
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { 
      pipelineStage: true,
      serialNumber: true,
      homeownerFirst: true,
      homeownerLast: true
    }
  });
  
  console.log('\nLead Info:');
  console.log(`  Serial: ${lead?.serialNumber}`);
  console.log(`  Name: ${lead?.homeownerFirst} ${lead?.homeownerLast}`);
  console.log(`  Current Stage: ${lead?.pipelineStage}`);
  
  const tasks = await prisma.task.findMany({
    where: {
      leadId
    },
    include: {
      assignedUser: {
        select: {
          name: true
        }
      },
      lead: {
        select: {
          pipelineStage: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('\n\nAll Tasks:');
  console.log('='.repeat(80));
  
  tasks.forEach((task, index) => {
    console.log(`\n${index + 1}. ${task.title}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Assigned to: ${task.assignedUser.name}`);
    console.log(`   Completed: ${task.completedAt?.toISOString() || 'Not completed'}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`Total tasks: ${tasks.length}`);
  
  // Check stage completion
  console.log(`\nCurrent stage: ${lead?.pipelineStage}`);
  console.log(`  Completed: ${tasks.filter(t => t.status === 'completed').length}`);
  console.log(`  Pending: ${tasks.filter(t => t.status === 'pending').length}`);
  
  await prisma.$disconnect();
}

checkTasks().catch(console.error);
