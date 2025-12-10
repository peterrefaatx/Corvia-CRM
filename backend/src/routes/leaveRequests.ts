import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import prisma from '../lib/prisma';
import { AuthRequest } from '../types';
import { io } from '../app';

class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

const router = Router();

router.use(auth);

// Get all leave requests (for managers/account managers) or user's own requests
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    let where: any = {};

    if (req.user?.role === 'Manager') {
      // Managers see all requests
    } else if (req.user?.role === 'AccountManager') {
      // Account Managers see requests from their assigned Team Leaders and IT users
      const teamLeaders = await prisma.user.findMany({
        where: { accountManagerId: req.user.userId },
        select: { id: true }
      });
      
      const itAssignments = await prisma.iTAssignment.findMany({
        where: { accountManagerId: req.user.userId },
        select: { itUserId: true }
      });
      
      const assignedUserIds = [
        ...teamLeaders.map(tl => tl.id),
        ...itAssignments.map(it => it.itUserId)
      ];
      
      where.userId = { in: assignedUserIds };
    } else {
      // Other users see only their own requests
      where.userId = req.user?.userId;
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true
          }
        },
        manager: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leaveRequests);
  } catch (error) {
    next(error);
  }
});

// Create leave request
router.post(
  '/',
  validate([
    body('startDate').notEmpty().isISO8601().withMessage('Valid start date is required'),
    body('endDate').notEmpty().isISO8601().withMessage('Valid end date is required'),
    body('type').isIn(['Vacation', 'Sick', 'Other']).withMessage('Valid leave type is required'),
    body('reason').notEmpty().withMessage('Reason is required')
  ]),
  async (req: AuthRequest, res, next) => {
    try {
      const { startDate, endDate, type, reason } = req.body;

      // Validate dates
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        throw new AppError(400, 'End date must be after start date');
      }

      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          userId: req.user!.userId,
          startDate: start,
          endDate: end,
          type,
          reason,
          status: 'Pending'
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true
            }
          }
        }
      });

      res.status(201).json(leaveRequest);
    } catch (error) {
      next(error);
    }
  }
);

// Update leave request status (managers and account managers)
router.patch(
  '/:id/status',
  validate([
    body('status').isIn(['Approved', 'Declined']).withMessage('Status must be Approved or Declined')
  ]),
  async (req: AuthRequest, res, next) => {
    try {
      if (req.user?.role !== 'Manager' && req.user?.role !== 'AccountManager') {
        throw new AppError(403, 'Only managers and account managers can approve/decline leave requests');
      }

      const { status } = req.body;

      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: req.params.id },
        include: {
          user: true
        }
      });

      if (!leaveRequest) {
        throw new AppError(404, 'Leave request not found');
      }

      // If Account Manager, verify they manage this user
      if (req.user.role === 'AccountManager') {
        const requestingUser = leaveRequest.user;
        
        // Check if the requesting user is a Team Leader assigned to this Account Manager
        const isAssignedTeamLeader = requestingUser.accountManagerId === req.user.userId;
        
        // Check if the requesting user is an IT user assigned to this Account Manager
        let isAssignedIT = false;
        if (requestingUser.role === 'IT') {
          const itAssignment = await prisma.iTAssignment.findFirst({
            where: {
              itUserId: requestingUser.id,
              accountManagerId: req.user.userId
            }
          });
          isAssignedIT = !!itAssignment;
        }
        
        if (!isAssignedTeamLeader && !isAssignedIT) {
          throw new AppError(403, 'You can only approve/decline leave requests from your assigned users');
        }
      }

      const updatedRequest = await prisma.leaveRequest.update({
        where: { id: req.params.id },
        data: {
          status,
          managerId: req.user.userId
        },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              username: true,
              role: true
            }
          },
          manager: {
            select: {
              id: true,
              fullName: true,
              username: true
            }
          }
        }
      });

      res.json(updatedRequest);
    } catch (error) {
      next(error);
    }
  }
);

// Delete leave request (own requests only, and only if pending)
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!leaveRequest) {
      throw new AppError(404, 'Leave request not found');
    }

    // Only allow deletion of own requests
    if (leaveRequest.userId !== req.user?.userId && req.user?.role !== 'Manager') {
      throw new AppError(403, 'You can only delete your own leave requests');
    }

    // Only allow deletion of pending requests
    if (leaveRequest.status !== 'Pending') {
      throw new AppError(400, 'Cannot delete approved or declined requests');
    }

    await prisma.leaveRequest.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
