import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignLeadsToMembers() {
  console.log('Assigning leads to team members based on pending tasks...\n');
  
  // Get all leads with pending tasks but no assigned user
  const leads = await prisma.lead.findMany({
    where: {
      assignedUserId: null,
      tasks: {
        some: {
          status: 'pending'
        }
      }
    },
    include: {
      tasks: {
        where: {
          status: 'pending'
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1,
        include: {
          assignedUser: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  console.log(`Found ${leads.length} leads to assign\n`);
  
  for (const lead of leads) {
    if (lead.tasks.length > 0) {
      const latestTask = lead.tasks[0];
      
      await prisma.lead.update({
        where: { id: lead.id },
        data: { assignedUserId: latestTask.assignedUserId }
      });
      
      console.log(`✓ Assigned lead ${lead.serialNumber} to ${latestTask.assignedUser.name}`);
    }
  }
  
  console.log(`\nDone! Assigned ${leads.length} leads`);
  await prisma.$disconnect();
}

assignLeadsToMembers().catch(console.error);
