import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncStagePositions() {
  try {
    console.log('Syncing stage positions from automation rules...\n');
    
    // Get all automation rules
    const rules = await prisma.pipelineAutomationRule.findMany({
      where: { isActive: true }
    });
    
    console.log(`Found ${rules.length} automation rules\n`);
    
    for (const rule of rules) {
      const config = rule.ruleConfig as any;
      
      // Extract position title from tasks
      if (config.tasks && config.tasks.length > 0) {
        const positionTitle = config.tasks[0].assign_to_role;
        
        if (positionTitle) {
          console.log(`Stage: ${rule.pipelineStage} → Position: ${positionTitle}`);
          
          // Find the position by title
          const position = await prisma.position.findFirst({
            where: { 
              title: positionTitle,
              clientId: rule.clientId
            }
          });
          
          if (position) {
            // Update the stage with the position
            await prisma.pipelineStage.updateMany({
              where: { name: rule.pipelineStage },
              data: { positionId: position.id }
            });
            
            console.log(`  ✓ Updated stage ${rule.pipelineStage} with position ${position.title}`);
          } else {
            console.log(`  ✗ Position "${positionTitle}" not found`);
          }
        }
      }
    }
    
    console.log('\n✓ Sync complete!');
    
    // Show updated stages
    const stages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      include: { position: true },
      orderBy: { order: 'asc' }
    });
    
    console.log('\nUpdated Stages:');
    stages.forEach(stage => {
      console.log(`  - ${stage.displayName}: ${stage.position?.title || 'No position assigned'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncStagePositions();
