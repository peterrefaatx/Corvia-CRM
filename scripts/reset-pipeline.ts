// Reset Pipeline for Testing
// Run with: npx ts-node scripts/reset-pipeline.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetPipeline() {
  console.log('🧹 Resetting Pipeline for Testing...\n');

  try {
    // Option 1: Clear all pending tasks
    const deletedTasks = await prisma.task.deleteMany({
      where: {
        status: 'pending'
      }
    });
    console.log(`✅ Deleted ${deletedTasks.count} pending tasks`);

    // Option 2: Clear completed tasks
    const deletedCompletedTasks = await prisma.task.deleteMany({
      where: {
        status: 'completed'
      }
    });
    console.log(`✅ Deleted ${deletedCompletedTasks.count} completed tasks`);

    // Option 3: Clear stage completion notifications
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        type: {
          in: ['task_assigned', 'stage_complete']
        }
      }
    });
    console.log(`✅ Deleted ${deletedNotifications.count} notifications`);

    // Option 4: Move leads back to "Attempting Contact"
    const updatedLeads = await prisma.lead.updateMany({
      where: {
        pipelineStage: {
          notIn: ['Closed', 'Dead']
        }
      },
      data: {
        pipelineStage: 'Attempting Contact',
        lastUpdated: new Date()
      }
    });
    console.log(`✅ Moved ${updatedLeads.count} leads to 'Attempting Contact'`);

    // Show current state
    console.log('\n📊 Current Pipeline State:');
    const pipelineStats = await prisma.lead.groupBy({
      by: ['pipelineStage'],
      _count: true,
      where: {
        pipelineStage: {
          not: null
        }
      }
    });

    pipelineStats.forEach(stat => {
      console.log(`   ${stat.pipelineStage}: ${stat._count} leads`);
    });

    // Show automation rules
    console.log('\n⚙️  Active Automation Rules:');
    const rules = await prisma.pipelineAutomationRule.findMany({
      where: { isActive: true },
      select: {
        pipelineStage: true,
        ruleConfig: true
      }
    });

    rules.forEach(rule => {
      const config = rule.ruleConfig as any;
      const taskCount = config.tasks?.length || 0;
      console.log(`   ${rule.pipelineStage}: ${taskCount} task(s)`);
    });

    // Show team members
    console.log('\n👥 Active Team Members:');
    const teamMembers = await prisma.clientTeamMember.findMany({
      where: { status: 'active' },
      select: {
        name: true,
        positionTitle: true
      },
      take: 5
    });

    teamMembers.forEach(member => {
      console.log(`   ${member.name} - ${member.positionTitle}`);
    });

    console.log('\n✨ Pipeline reset complete!');
    console.log('\n📝 Next steps:');
    console.log('1. Go to your pipeline view');
    console.log('2. Move a lead to "Contacted" stage');
    console.log('3. Watch automation create task');
    console.log('4. Team member completes task');
    console.log('5. See green checkmark & notification! 🎉\n');

  } catch (error) {
    console.error('❌ Error resetting pipeline:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPipeline();
