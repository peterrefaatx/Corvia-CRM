import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { auth as authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Middleware to check Manager role
const requireManager = (req: AuthRequest, res: Response, next: any) => {
  if (req.user?.role !== 'Manager') {
    return res.status(403).json({ error: 'Only Managers can manage IT assignments' });
  }
  next();
};

// Get all IT assignments
router.get('/', authenticateToken, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const assignments = await prisma.iTAssignment.findMany({
      include: {
        itUser: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true
          }
        },
        accountManager: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Group by Account Manager
    const groupedByAM: Record<string, any> = {};
    
    assignments.forEach(assignment => {
      const amId = assignment.accountManagerId;
      if (!groupedByAM[amId]) {
        groupedByAM[amId] = {
          accountManager: assignment.accountManager,
          itUsers: []
        };
      }
      groupedByAM[amId].itUsers.push(assignment.itUser);
    });
    
    res.json({
      assignments,
      groupedByAccountManager: Object.values(groupedByAM)
    });
  } catch (error) {
    console.error('Error fetching IT assignments:', error);
    res.status(500).json({ error: 'Failed to fetch IT assignments' });
  }
});

// Assign IT personnel to Account Manager
router.post('/', authenticateToken, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const { itUserIds, accountManagerId } = req.body;
    
    // Validation
    if (!itUserIds || !Array.isArray(itUserIds) || itUserIds.length === 0) {
      return res.status(400).json({ error: 'itUserIds must be a non-empty array' });
    }
    
    if (!accountManagerId) {
      return res.status(400).json({ error: 'accountManagerId is required' });
    }
    
    // Verify Account Manager exists and has correct role
    const accountManager = await prisma.user.findUnique({
      where: { id: accountManagerId },
      select: { role: true }
    });
    
    if (!accountManager) {
      return res.status(404).json({ error: 'Account Manager not found' });
    }
    
    if (accountManager.role !== 'AccountManager') {
      return res.status(400).json({ error: 'User is not an Account Manager' });
    }
    
    // Verify all IT users exist and have correct role
    const itUsers = await prisma.user.findMany({
      where: {
        id: { in: itUserIds },
        role: 'IT'
      },
      select: { id: true }
    });
    
    if (itUsers.length !== itUserIds.length) {
      return res.status(400).json({ error: 'One or more IT users not found or do not have IT role' });
    }
    
    // First, remove existing assignments for these IT users
    await prisma.iTAssignment.deleteMany({
      where: {
        itUserId: { in: itUserIds }
      }
    });
    
    // Create new assignments and update User.accountManagerId
    const createdAssignments = [];
    
    for (const itUserId of itUserIds) {
      try {
        // Create ITAssignment record
        const assignment = await prisma.iTAssignment.create({
          data: {
            itUserId,
            accountManagerId
          },
          include: {
            itUser: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            },
            accountManager: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            }
          }
        });
        
        // Also update the User.accountManagerId field for consistency
        await prisma.user.update({
          where: { id: itUserId },
          data: { accountManagerId }
        });
        
        createdAssignments.push(assignment);
      } catch (error: any) {
        console.error(`Error creating assignment for IT user ${itUserId}:`, error);
        throw error;
      }
    }
    
    res.status(201).json({
      message: 'IT assignments created successfully',
      assignments: createdAssignments,
      created: createdAssignments.length,
      skipped: itUserIds.length - createdAssignments.length
    });
  } catch (error) {
    console.error('Error creating IT assignments:', error);
    res.status(500).json({ error: 'Failed to create IT assignments' });
  }
});

// Get IT personnel assigned to specific Account Manager
router.get('/account-manager/:accountManagerId', authenticateToken, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const { accountManagerId } = req.params;
    
    const assignments = await prisma.iTAssignment.findMany({
      where: { accountManagerId },
      include: {
        itUser: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            isActive: true
          }
        }
      }
    });
    
    const itUsers = assignments.map(a => a.itUser);
    
    res.json({
      accountManagerId,
      itUsers,
      count: itUsers.length
    });
  } catch (error) {
    console.error('Error fetching IT assignments for Account Manager:', error);
    res.status(500).json({ error: 'Failed to fetch IT assignments' });
  }
});

// Remove IT assignment
router.delete('/:id', authenticateToken, requireManager, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if assignment exists
    const assignment = await prisma.iTAssignment.findUnique({
      where: { id }
    });
    
    if (!assignment) {
      return res.status(404).json({ error: 'IT assignment not found' });
    }
    
    // Delete assignment and clear User.accountManagerId
    await prisma.$transaction(async (tx) => {
      // Delete ITAssignment record
      await tx.iTAssignment.delete({
        where: { id }
      });
      
      // Clear the User.accountManagerId field
      await tx.user.update({
        where: { id: assignment.itUserId },
        data: { accountManagerId: null }
      });
    });
    
    res.json({ message: 'IT assignment removed successfully' });
  } catch (error) {
    console.error('Error removing IT assignment:', error);
    res.status(500).json({ error: 'Failed to remove IT assignment' });
  }
});

// Get Account Managers assigned to specific IT user
router.get('/it-user/:itUserId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { itUserId } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.userId;
    
    // Check authorization (Manager or the IT user themselves)
    if (userRole !== 'Manager' && userId !== itUserId) {
      return res.status(403).json({ error: 'You do not have permission to view these assignments' });
    }
    
    const assignments = await prisma.iTAssignment.findMany({
      where: { itUserId },
      include: {
        accountManager: {
          select: {
            id: true,
            fullName: true,
            username: true,
            email: true,
            isActive: true
          }
        }
      }
    });
    
    const accountManagers = assignments.map(a => a.accountManager);
    
    res.json({
      itUserId,
      accountManagers,
      count: accountManagers.length
    });
  } catch (error) {
    console.error('Error fetching Account Managers for IT user:', error);
    res.status(500).json({ error: 'Failed to fetch Account Managers' });
  }
});

export default router;
