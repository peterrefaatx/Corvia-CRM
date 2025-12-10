/**
 * Daily IT Ticket Snapshot Job
 * Runs at 4 AM to capture daily IT ticket statistics
 */

import { PrismaClient } from '@prisma/client';
import { getWorkDayBounds } from '../utils/workDay';

const prisma = new PrismaClient();

export async function saveDailyITTicketSnapshot() {
  console.log('[Daily IT Ticket Snapshot] Starting daily IT ticket snapshot job...');
  
  try {
    const { start, end } = getWorkDayBounds();
    
    console.log(`[Daily IT Ticket Snapshot] Capturing tickets from ${start.toISOString()} to ${end.toISOString()}`);
    
    // Get all tickets created in the work day
    const tickets = await prisma.iTTicket.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end
        }
      },
      include: {
        submitter: {
          select: {
            id: true,
            fullName: true,
            role: true,
            accountManagerId: true
          }
        },
        assignedIT: {
          select: {
            id: true,
            fullName: true
          }
        }
      }
    });
    
    console.log(`[Daily IT Ticket Snapshot] Found ${tickets.length} tickets for the work day`);
    
    // Calculate statistics by submitter
    const submitterStats = new Map<string, {
      userId: string;
      fullName: string;
      role: string;
      accountManagerId: string | null;
      totalTickets: number;
      pending: number;
      underReview: number;
      solved: number;
      notSolved: number;
    }>();
    
    tickets.forEach(ticket => {
      const key = ticket.submitterId;
      if (!submitterStats.has(key)) {
        submitterStats.set(key, {
          userId: ticket.submitter.id,
          fullName: ticket.submitter.fullName,
          role: ticket.submitter.role,
          accountManagerId: ticket.submitter.accountManagerId,
          totalTickets: 0,
          pending: 0,
          underReview: 0,
          solved: 0,
          notSolved: 0
        });
      }
      
      const stats = submitterStats.get(key)!;
      stats.totalTickets++;
      
      switch (ticket.status) {
        case 'Pending':
          stats.pending++;
          break;
        case 'UnderReview':
          stats.underReview++;
          break;
        case 'Solved':
          stats.solved++;
          break;
        case 'NotSolved':
          stats.notSolved++;
          break;
      }
    });
    
    // Calculate statistics by IT assignee
    const itStats = new Map<string, {
      userId: string;
      fullName: string;
      totalAssigned: number;
      pending: number;
      underReview: number;
      solved: number;
      notSolved: number;
    }>();
    
    tickets.forEach(ticket => {
      if (ticket.assignedITId) {
        const key = ticket.assignedITId;
        if (!itStats.has(key)) {
          itStats.set(key, {
            userId: ticket.assignedIT!.id,
            fullName: ticket.assignedIT!.fullName,
            totalAssigned: 0,
            pending: 0,
            underReview: 0,
            solved: 0,
            notSolved: 0
          });
        }
        
        const stats = itStats.get(key)!;
        stats.totalAssigned++;
        
        switch (ticket.status) {
          case 'Pending':
            stats.pending++;
            break;
          case 'UnderReview':
            stats.underReview++;
            break;
          case 'Solved':
            stats.solved++;
            break;
          case 'NotSolved':
            stats.notSolved++;
            break;
        }
      }
    });
    
    // Save snapshot to database (you can create a new model for this if needed)
    // For now, we'll just log the statistics
    console.log('[Daily IT Ticket Snapshot] Submitter Statistics:');
    submitterStats.forEach((stats, userId) => {
      console.log(`  ${stats.fullName} (${stats.role}): ${stats.totalTickets} tickets - Pending: ${stats.pending}, Under Review: ${stats.underReview}, Solved: ${stats.solved}, Not Solved: ${stats.notSolved}`);
    });
    
    console.log('[Daily IT Ticket Snapshot] IT Assignee Statistics:');
    itStats.forEach((stats, userId) => {
      console.log(`  ${stats.fullName}: ${stats.totalAssigned} tickets - Pending: ${stats.pending}, Under Review: ${stats.underReview}, Solved: ${stats.solved}, Not Solved: ${stats.notSolved}`);
    });
    
    console.log('[Daily IT Ticket Snapshot] Daily IT ticket snapshot completed successfully');
  } catch (error) {
    console.error('[Daily IT Ticket Snapshot] Error saving daily IT ticket snapshot:', error);
    throw error;
  }
}
