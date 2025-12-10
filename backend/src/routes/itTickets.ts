import { Router, Request, Response } from 'express';
import { PrismaClient, ITTicketStatus } from '@prisma/client';
import { auth as authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper function to get Account Manager ID for a user
async function getAccountManagerId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountManagerId: true, role: true }
  });
  
  if (user?.role === 'AccountManager') {
    return userId;
  }
  
  return user?.accountManagerId || null;
}

// Helper function to find IT user with fewest active tickets for load balancing
async function findBestITUser(accountManagerId: string): Promise<string | null> {
  // Get all IT users assigned to this Account Manager
  const assignments = await prisma.iTAssignment.findMany({
    where: { accountManagerId },
    select: { itUserId: true }
  });
  
  if (assignments.length === 0) {
    return null;
  }
  
  // Count active tickets (Pending or UnderReview) for each IT user
  const itUserIds = assignments.map(a => a.itUserId);
  const ticketCounts = await Promise.all(
    itUserIds.map(async (itUserId) => {
      const count = await prisma.iTTicket.count({
        where: {
          assignedITId: itUserId,
          status: {
            in: ['Pending', 'UnderReview']
          }
        }
      });
      return { itUserId, count };
    })
  );
  
  // Find IT user with minimum active tickets
  const bestIT = ticketCounts.reduce((min, current) => 
    current.count < min.count ? current : min
  );
  
  return bestIT.itUserId;
}

// Submit a new IT ticket
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { agentName, telegramUsername, problemDescription } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    // Check authorization
    if (!['TeamLeader', 'AccountManager'].includes(userRole)) {
      return res.status(403).json({ error: 'Only Team Leaders and Account Managers can submit IT tickets' });
    }
    
    // Validation
    if (!agentName || !telegramUsername || !problemDescription) {
      return res.status(400).json({
        error: 'Validation failed',
        details: {
          agentName: !agentName ? 'Agent name is required' : undefined,
          telegramUsername: !telegramUsername ? 'Telegram username is required' : undefined,
          problemDescription: !problemDescription ? 'Problem description is required' : undefined
        }
      });
    }
    
    if (agentName.length < 2) {
      return res.status(400).json({ error: 'Agent name must be at least 2 characters' });
    }
    
    if (!telegramUsername.startsWith('@')) {
      return res.status(400).json({ error: 'Telegram username must start with @' });
    }
    
    if (problemDescription.length < 10) {
      return res.status(400).json({ error: 'Problem description must be at least 10 characters' });
    }
    
    // Get Account Manager ID
    const accountManagerId = await getAccountManagerId(userId);
    
    // Find best IT user for load balancing
    let assignedITId = null;
    if (accountManagerId) {
      assignedITId = await findBestITUser(accountManagerId);
    }
    
    // Create ticket
    const ticket = await prisma.iTTicket.create({
      data: {
        agentName,
        telegramUsername,
        problemDescription,
        submitterId: userId,
        assignedITId,
        status: 'Pending'
      },
      include: {
        submitter: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        },
        assignedIT: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });
    
    // Create initial status history
    await prisma.iTTicketStatusHistory.create({
      data: {
        ticketId: ticket.id,
        userId,
        toStatus: 'Pending'
      }
    });
    
    res.status(201).json({
      message: 'IT ticket submitted successfully',
      ticket
    });
  } catch (error) {
    console.error('Error submitting IT ticket:', error);
    res.status(500).json({ error: 'Failed to submit IT ticket' });
  }
});

// Get all tickets (filtered by IT assignment if IT role)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { status, page = '1', limit = '20', search = '', date } = req.query;
    
    // Check authorization
    if (!['IT', 'Manager'].includes(userRole)) {
      return res.status(403).json({ error: 'Only IT personnel and Managers can view all tickets' });
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;
    
    // Build where clause
    const where: any = {};
    
    // Filter by IT assignment if IT role
    if (userRole === 'IT') {
      where.assignedITId = userId;
    }
    
    // Filter by status (can be comma-separated)
    if (status && status !== 'All') {
      const statusArray = (status as string).split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        where.status = statusArray[0];
      } else {
        where.status = { in: statusArray };
      }
    }
    
    // Date filter with 4 AM cutoff
    if (date) {
      const selectedDate = new Date(date as string);
      // Start at 4 AM of selected date
      const start = new Date(selectedDate);
      start.setHours(4, 0, 0, 0);
      // End at 4 AM of next date
      const end = new Date(selectedDate);
      end.setDate(end.getDate() + 1);
      end.setHours(4, 0, 0, 0);
      
      where.resolvedAt = {
        gte: start,
        lt: end
      };
    }
    
    // Search filter
    if (search) {
      where.OR = [
        { agentName: { contains: search, mode: 'insensitive' } },
        { telegramUsername: { contains: search, mode: 'insensitive' } },
        { problemDescription: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get tickets with pagination
    const [tickets, total] = await Promise.all([
      prisma.iTTicket.findMany({
        where,
        include: {
          submitter: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true
            }
          },
          assignedIT: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          },
          responses: {
            select: {
              id: true,
              createdAt: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.iTTicket.count({ where })
    ]);
    
    res.json({
      tickets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching IT tickets:', error);
    res.status(500).json({ error: 'Failed to fetch IT tickets' });
  }
});

// Get tickets submitted by current user
router.get('/my-tickets', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { status, date } = req.query;
    
    // Check authorization
    if (!['TeamLeader', 'AccountManager'].includes(userRole)) {
      return res.status(403).json({ error: 'Only Team Leaders and Account Managers can view their tickets' });
    }
    
    // Build where clause
    const where: any = {
      submitterId: userId
    };
    
    if (status && status !== 'All') {
      where.status = status;
    }
    
    // Date filtering with 4 AM cutoff
    if (date) {
      const selectedDate = new Date(date as string);
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(4, 0, 0, 0);
      
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      where.createdAt = {
        gte: startOfDay,
        lt: endOfDay
      };
    }
    
    const tickets = await prisma.iTTicket.findMany({
      where,
      include: {
        assignedIT: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching my tickets:', error);
    res.status(500).json({ error: 'Failed to fetch your tickets' });
  }
});

// Get specific ticket details
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    const ticket = await prisma.iTTicket.findUnique({
      where: { id },
      include: {
        submitter: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        },
        assignedIT: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        statusHistory: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'IT ticket not found' });
    }
    
    // Check access permissions
    const hasAccess = 
      userRole === 'Manager' ||
      userRole === 'IT' ||
      ticket.submitterId === userId;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to view this ticket' });
    }
    
    res.json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).json({ error: 'Failed to fetch ticket details' });
  }
});

// Update ticket status
router.put('/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    // Check authorization
    if (userRole !== 'IT') {
      return res.status(403).json({ error: 'Only IT personnel can update ticket status' });
    }
    
    // Validate status
    const validStatuses: ITTicketStatus[] = ['Pending', 'UnderReview', 'Solved', 'NotSolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Get current ticket
    const ticket = await prisma.iTTicket.findUnique({
      where: { id },
      select: { status: true, assignedITId: true }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'IT ticket not found' });
    }
    
    // Validate status transition
    const currentStatus = ticket.status;
    
    // Cannot revert from Solved or NotSolved
    if (['Solved', 'NotSolved'].includes(currentStatus)) {
      return res.status(400).json({
        error: 'Invalid status transition',
        message: 'Cannot change status from Solved or Not Solved'
      });
    }
    
    // Valid transitions
    const validTransitions: Record<string, string[]> = {
      'Pending': ['UnderReview'],
      'UnderReview': ['Solved', 'NotSolved']
    };
    
    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status transition',
        message: `Cannot change status from ${currentStatus} to ${status}`
      });
    }
    
    // Update ticket
    const updateData: any = {
      status,
      updatedAt: new Date()
    };
    
    // Set assignedITId if not already set
    if (!ticket.assignedITId) {
      updateData.assignedITId = userId;
    }
    
    // Set resolvedAt if status is Solved or NotSolved
    if (['Solved', 'NotSolved'].includes(status)) {
      updateData.resolvedAt = new Date();
    }
    
    const updatedTicket = await prisma.iTTicket.update({
      where: { id },
      data: updateData,
      include: {
        submitter: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        assignedIT: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });
    
    // Create status history record
    await prisma.iTTicketStatusHistory.create({
      data: {
        ticketId: id,
        userId,
        fromStatus: currentStatus,
        toStatus: status
      }
    });
    
    res.json({
      message: 'Ticket status updated successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// Add response to ticket
router.post('/:id/responses', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { responseText } = req.body;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    // Check authorization
    if (userRole !== 'IT') {
      return res.status(403).json({ error: 'Only IT personnel can add responses' });
    }
    
    // Validation
    if (!responseText || responseText.trim().length < 5) {
      return res.status(400).json({ error: 'Response text must be at least 5 characters' });
    }
    
    // Check if ticket exists
    const ticket = await prisma.iTTicket.findUnique({
      where: { id },
      select: { id: true }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'IT ticket not found' });
    }
    
    // Create response
    const response = await prisma.iTTicketResponse.create({
      data: {
        ticketId: id,
        userId,
        responseText: responseText.trim()
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });
    
    // Update ticket's updatedAt
    await prisma.iTTicket.update({
      where: { id },
      data: { updatedAt: new Date() }
    });
    
    res.status(201).json({
      message: 'Response added successfully',
      response
    });
  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ error: 'Failed to add response' });
  }
});

// Get ticket status history
router.get('/:id/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    
    // Check if ticket exists and user has access
    const ticket = await prisma.iTTicket.findUnique({
      where: { id },
      select: { submitterId: true }
    });
    
    if (!ticket) {
      return res.status(404).json({ error: 'IT ticket not found' });
    }
    
    // Check access permissions
    const hasAccess = 
      userRole === 'Manager' ||
      userRole === 'IT' ||
      ticket.submitterId === userId;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to view this ticket history' });
    }
    
    // Get status history
    const history = await prisma.iTTicketStatusHistory.findMany({
      where: { ticketId: id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json({ history });
  } catch (error) {
    console.error('Error fetching ticket history:', error);
    res.status(500).json({ error: 'Failed to fetch ticket history' });
  }
});

export default router;
