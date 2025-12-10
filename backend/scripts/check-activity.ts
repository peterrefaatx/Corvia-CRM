import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkActivity() {
  const leadId = 'cmispxo3m001pqhddbj220ip7';
  
  console.log('Fetching activity logs for lead:', leadId);
  
  const logs = await prisma.activityLog.findMany({
    where: {
      entityId: leadId,
      entityType: 'lead'
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  console.log('\nActivity Logs:');
  console.log('='.repeat(80));
  
  logs.forEach((log, index) => {
    console.log(`\n${index + 1}. ${log.actionType} - ${log.createdAt.toISOString()}`);
    console.log(`   Description: ${log.description}`);
    console.log(`   User: ${log.userId || 'N/A'} (${log.userType})`);
    console.log(`   Metadata:`, log.metadata);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log(`Total logs: ${logs.length}`);
  
  await prisma.$disconnect();
}

checkActivity().catch(console.error);
