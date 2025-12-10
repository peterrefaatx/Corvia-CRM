import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkStages() {
  try {
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' }
    });
    
    console.log('Current Pipeline Stages:');
    console.log(JSON.stringify(stages, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStages();
