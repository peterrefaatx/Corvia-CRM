import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSchedules() {
  console.log('Checking schedules and lead assignments...\n');
  
  const schedules = await prisma.clientSchedule.findMany({
    include: {
      lead: {
        select: {
          id: true,
          serialNumber: true,
          assignedUserId: true,
          assignedTeamMember: {
            select: {
              name: true
            }
          }
        }
      }
    },
    take: 10
  });
  
  console.log(`Found ${schedules.length} schedules:\n`);
  
  schedules.forEach((schedule, index) => {
    console.log(`${index + 1}. Schedule ID: ${schedule.id}`);
    console.log(`   Lead: ${schedule.lead.serialNumber}`);
    console.log(`   Lead Assigned To: ${schedule.lead.assignedTeamMember?.name || 'Unassigned'} (${schedule.lead.assignedUserId || 'N/A'})`);
    console.log(`   Schedule Date: ${schedule.scheduledDate}`);
    console.log(`   Type: ${schedule.type}`);
    console.log(`   Status: ${schedule.status}\n`);
  });
  
  await prisma.$disconnect();
}

checkSchedules().catch(console.error);
