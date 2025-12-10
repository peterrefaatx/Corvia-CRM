import { Router } from 'express';
import { auth } from '../middleware/auth';
import { AuthRequest } from '../types';
import prisma from '../lib/prisma';

const router = Router();

// Get all users (admin only)
router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    // Check if user is Manager
    if (req.user?.role !== 'Manager') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Get role filter from query params
    const { role } = req.query;

    const users = await prisma.user.findMany({
      where: role ? { role: role as any } : undefined,
      select: {
        id: true,
        serialNumber: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        team: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Create user (admin only)
router.post('/', auth, async (req: AuthRequest, res) => {
  try {
    const currentUser = req.user;

    // Check permissions
    if (currentUser?.role !== 'Manager') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const { username, email, password, role, fullName, teamId } = req.body;

    // Validate required fields
    if (!username || !email || !password || !role || !fullName) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: username, email, password, role, fullName'
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Check if username or email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate serial number
    const lastUser = await prisma.user.findFirst({
      where: {
        serialNumber: {
          not: null
        }
      },
      orderBy: {
        serialNumber: 'desc'
      }
    });

    let serialNumber = 'USR-0001';
    if (lastUser?.serialNumber) {
      const match = lastUser.serialNumber.match(/USR-(\d+)/);
      if (match) {
        const nextNumber = parseInt(match[1]) + 1;
        serialNumber = `USR-${String(nextNumber).padStart(4, '0')}`;
      }
    }

    // Create user
    const newUser = await prisma.user.create({
      data: {
        serialNumber,
        username,
        email,
        passwordHash,
        role,
        fullName,
        teamId: teamId || null,
        isActive: true
      },
      select: {
        id: true,
        serialNumber: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        team: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // If user is TeamLeader, update the team
    if (role === 'TeamLeader' && teamId) {
      await prisma.team.update({
        where: { id: teamId },
        data: { teamLeaderUserId: newUser.id }
      });
    }

    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Create user error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('P2002')) {
        return res.status(400).json({
          success: false,
          error: 'Username or email already exists'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// Delete user (admin only)
router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // Check if user is Manager
    if (currentUser?.role !== 'Manager') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Check if user exists
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      include: {
        team: true,
        managedTeam: true,
        managedCampaigns: true
      }
    });

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent users from deleting themselves
    if (currentUser.userId === id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Use transaction to handle all related data
    await prisma.$transaction(async (tx) => {
      // 1. Handle team leadership - set team leader to null if this user is a team leader
      if (userToDelete.managedTeam) {
        await tx.team.update({
          where: { id: userToDelete.managedTeam.id },
          data: { teamLeaderUserId: null }
        });
      }

      // 2. Handle managed campaigns - reassign or delete campaigns
      if (userToDelete.managedCampaigns.length > 0) {
        // Option 1: Reassign campaigns to another manager (e.g., current user)
        // Option 2: Delete campaigns (choose based on your business logic)
        
        // For now, let's reassign to current user
        await tx.campaign.updateMany({
          where: { managerId: id },
          data: { managerId: currentUser.userId }
        });
      }

      // 3. Handle leave requests where user is manager
      await tx.leaveRequest.updateMany({
        where: { managerId: id },
        data: { managerId: null }
      });

      // 4. Finally delete the user (this will cascade delete related records due to onDelete: Cascade)
      await tx.user.delete({
        where: { id }
      });
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      // Foreign key constraint violation
      if (error.message.includes('P2003') || error.message.includes('foreign key constraint')) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete user due to existing related records. Please reassign their data first.'
        });
      }
      
      // Record not found
      if (error.message.includes('P2025')) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

// Get user by ID
router.get('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const requestingUserId = req.user?.userId;
    const requestingUserRole = req.user?.role;
    const targetUserId = req.params.id;
    
    // Allow Manager to view any user
    // Allow QC agents to view their account manager
    // Allow users to view themselves
    const isManager = requestingUserRole === 'Manager';
    const isSelf = requestingUserId === targetUserId;
    
    // Check if QC is trying to view their account manager
    let isViewingOwnAccountManager = false;
    if (requestingUserRole === 'QualityControl') {
      const requestingUser = await prisma.user.findUnique({
        where: { id: requestingUserId },
        select: { accountManagerId: true }
      });
      isViewingOwnAccountManager = requestingUser?.accountManagerId === targetUserId;
    }
    
    if (!isManager && !isSelf && !isViewingOwnAccountManager) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        serialNumber: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLogin: true,
        team: {
          select: {
            id: true,
            name: true
          }
        },
        managedTeam: {
          select: {
            id: true,
            name: true
          }
        },
        managedCampaigns: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// Update user (admin only)
router.put('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const { role, teamId, isActive, fullName, email } = req.body;

    // Check permissions
    if (currentUser?.role !== 'Manager') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Prevent users from modifying their own role/status
    if (currentUser.userId === id && (role || isActive !== undefined)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify your own role or status'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(role && { role }),
        ...(teamId !== undefined && { teamId }),
        ...(isActive !== undefined && { isActive }),
        ...(fullName && { fullName }),
        ...(email && { email })
      },
      select: {
        id: true,
        serialNumber: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        team: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('P2002')) { // Unique constraint
        return res.status(400).json({
          success: false,
          error: 'Email already exists'
        });
      }
      if (error.message.includes('P2025')) { // Not found
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// Reset user password (admin only)
router.post('/:id/reset-password', auth, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    const { newPassword } = req.body;

    // Check permissions
    if (currentUser?.role !== 'Manager') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('P2025')) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
});

export default router;