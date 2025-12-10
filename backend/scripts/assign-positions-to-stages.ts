import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function assignPositionsToStages() {
  try {
    console.log('Fetching stages and positions...\n');
    
    const stages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });
    
    const positions = await prisma.position.findMany({
      where: { isActive: true }
    });
    
    console.log('Current Stages:');
    stages.forEach(stage => {
      console.log(`  - ${stage.displayName} (${stage.name}) - Position: ${stage.positionId || 'Not assigned'}`);
    });
    
    console.log('\nAvailable Positions:');
    positions.forEach(pos => {
      console.log(`  - ${pos.title} (ID: ${pos.id})`);
    });
    
    console.log('\n===========================================');
    console.log('To assign a position to a stage, run:');
    console.log('npx ts-node scripts/assign-positions-to-stages.ts <stageId> <positionId>');
    console.log('===========================================\n');
    
    // If arguments provided, do the assignment
    const stageId = process.argv[2];
    const positionId = process.argv[3];
    
    if (stageId && positionId) {
      const stage = await prisma.pipelineStage.update({
        where: { id: stageId },
        data: { positionId },
        include: { position: true }
      });
      
      console.log(`✓ Assigned position "${stage.position?.title}" to stage "${stage.displayName}"`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignPositionsToStages();
