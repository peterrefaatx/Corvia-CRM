/**
 * Daily Top Agent Snapshot Job
 * Runs at 4 AM daily to calculate and save the top agent for each team
 * from the previous work day (yesterday 4 AM to today 4 AM)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function calculateDailyTopAgents() {
  console.log('[Daily Top Agent Snapshot] Starting job...');
  
  try {
    // Get yesterday's work day bounds (yesterday 4 AM to today 4 AM)
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(4, 0, 0, 0); // Today at 4 AM
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1); // Yesterday at 4 AM
    
    console.log(`[Daily Top Agent Snapshot] Calculating for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get all active teams
    const teams = await prisma.team.findMany({
      where: {
        users: {
          some: {
            isActive: true
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });
    
    console.log(`[Daily Top Agent Snapshot] Processing ${teams.length} teams`);
    
    for (const team of teams) {
      try {
        // Get all agents in this team with their leads for yesterday
        const agents = await prisma.user.findMany({
          where: {
            teamId: team.id,
            role: { in: ['Agent', 'SeniorAgent'] },
            isActive: true
          },
          include: {
            leads: {
              where: {
                createdAt: {
                  gte: startDate,
                  lt: endDate
                }
              },
              select: {
                status: true
              }
            }
          }
        });
        
        if (agents.length === 0) {
          console.log(`[Daily Top Agent Snapshot] No agents found for team ${team.name}`);
          continue;
        }
        
        // Calculate stats for each agent
        const agentStats = agents.map(agent => {
          const totalLeads = agent.leads.length;
          const qualified = agent.leads.filter(l => l.status === 'Qualified').length;
          const disqualified = agent.leads.filter(l => l.status === 'Disqualified').length;
          
          return {
            id: agent.id,
            fullName: agent.fullName,
            totalLeads,
            qualified,
            disqualified
          };
        });
        
        // Find top agent (most qualified leads)
        const topAgent = agentStats.reduce((prev, current) => 
          current.qualified > prev.qualified ? current : prev
        );
        
        if (topAgent.totalLeads === 0) {
          console.log(`[Daily Top Agent Snapshot] No leads for team ${team.name} on this day`);
          continue;
        }
        
        // Save to database (upsert to handle re-runs)
        await prisma.dailyTopAgent.upsert({
          where: {
            date_teamId: {
              date: startDate,
              teamId: team.id
            }
          },
          update: {
            topAgentId: topAgent.id,
            topAgentName: topAgent.fullName,
            totalLeads: topAgent.totalLeads,
            qualified: topAgent.qualified,
            disqualified: topAgent.disqualified
          },
          create: {
            date: startDate,
            teamId: team.id,
            topAgentId: topAgent.id,
            topAgentName: topAgent.fullName,
            totalLeads: topAgent.totalLeads,
            qualified: topAgent.qualified,
            disqualified: topAgent.disqualified
          }
        });
        
        console.log(`[Daily Top Agent Snapshot] Team ${team.name}: Top agent is ${topAgent.fullName} with ${topAgent.totalLeads} leads`);
        
      } catch (error) {
        console.error(`[Daily Top Agent Snapshot] Error processing team ${team.name}:`, error);
      }
    }
    
    console.log('[Daily Top Agent Snapshot] Job completed successfully');
    
  } catch (error) {
    console.error('[Daily Top Agent Snapshot] Job failed:', error);
    throw error;
  }
}

// Run immediately if called directly
if (require.main === module) {
  calculateDailyTopAgents()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}
