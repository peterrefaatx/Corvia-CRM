import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { auth, requireRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

interface AuthRequest extends express.Request {
  user?: {
    userId: string;
    role: string;
    clientId?: string;
  };
}

// Get all team members for a client
router.get('/team-members', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    
    const teamMembers = await prisma.clientTeamMember.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        positionId: true,
        positionTitle: true,
        status: true,
        isAvailable: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedLeads: true,
            assignedTasks: true
          }
        }
      }
    });

    res.json(teamMembers);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get single team member
router.get('/team-members/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    
    const teamMember = await prisma.clientTeamMember.findFirst({
      where: { 
        id,
        clientId 
      },
      select: {
        id: true,
        name: true,
        email: true,
        positionTitle: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    res.json(teamMember);
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ error: 'Failed to fetch team member' });
  }
});

// Create team member
router.post('/team-members', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { name, email, password, positionId, positionTitle } = req.body;

    // Validate required fields
    if (!name || !email || !password || !positionId) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email already exists
    const existingMember = await prisma.clientTeamMember.findUnique({
      where: { email }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create team member
    const teamMember = await prisma.clientTeamMember.create({
      data: {
        clientId,
        name,
        email,
        passwordHash,
        positionId,
        positionTitle,
        status: 'active'
      },
      select: {
        id: true,
        name: true,
        email: true,
        positionTitle: true,
        status: true,
        createdAt: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'team_member_created',
        entityType: 'team_member',
        entityId: teamMember.id,
        description: `Created team member: ${name}`,
        metadata: { email, positionTitle }
      }
    });

    res.status(201).json(teamMember);
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({ error: 'Failed to create team member' });
  }
});

// Update team member
router.put('/team-members/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { name, email, positionId, positionTitle, password } = req.body;

    // Verify team member belongs to client
    const existingMember = await prisma.clientTeamMember.findFirst({
      where: { id, clientId }
    });

    if (!existingMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingMember.email) {
      const emailTaken = await prisma.clientTeamMember.findUnique({
        where: { email }
      });

      if (emailTaken) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }

    // Prepare update data
    const updateData: any = {
      ...(name && { name }),
      ...(email && { email }),
      ...(positionId && { positionId }),
      ...(positionTitle && { positionTitle })
    };

    // Hash password if provided
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update team member
    const teamMember = await prisma.clientTeamMember.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        positionTitle: true,
        status: true,
        updatedAt: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'team_member_updated',
        entityType: 'team_member',
        entityId: id,
        description: `Updated team member: ${teamMember.name}${password ? ' (password changed)' : ''}`,
        metadata: { changes: { ...req.body, password: password ? '[REDACTED]' : undefined } }
      }
    });

    res.json(teamMember);
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Note: Permissions are now managed at the Position level
// See /api/positions endpoints for permission management

// Toggle team member status
router.patch('/team-members/:id/status', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    // Verify team member belongs to client
    const existingMember = await prisma.clientTeamMember.findFirst({
      where: { id, clientId }
    });

    if (!existingMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Toggle status
    const newStatus = existingMember.status === 'active' ? 'inactive' : 'active';
    
    const teamMember = await prisma.clientTeamMember.update({
      where: { id },
      data: { status: newStatus },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'team_member_updated',
        entityType: 'team_member',
        entityId: id,
        description: `${newStatus === 'active' ? 'Activated' : 'Deactivated'} team member: ${teamMember.name}`,
        metadata: { status: newStatus }
      }
    });

    res.json(teamMember);
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ error: 'Failed to toggle status' });
  }
});

// Reset team member password
router.post('/team-members/:id/reset-password', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    // Verify team member belongs to client
    const existingMember = await prisma.clientTeamMember.findFirst({
      where: { id, clientId }
    });

    if (!existingMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.clientTeamMember.update({
      where: { id },
      data: { passwordHash }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'team_member_updated',
        entityType: 'team_member',
        entityId: id,
        description: `Reset password for: ${existingMember.name}`,
        metadata: {}
      }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Delete team member
router.delete('/team-members/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    // Verify team member belongs to client
    const existingMember = await prisma.clientTeamMember.findFirst({
      where: { id, clientId }
    });

    if (!existingMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Delete team member
    await prisma.clientTeamMember.delete({
      where: { id }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        clientId,
        userId: null,
        userType: 'client',
        actionType: 'team_member_deleted',
        entityType: 'team_member',
        entityId: id,
        description: `Deleted team member: ${existingMember.name}`,
        metadata: { email: existingMember.email }
      }
    });

    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

export default router;
