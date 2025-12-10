import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types/express';

const router = express.Router();
const prisma = new PrismaClient();

// Get all positions for client
router.get('/', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;

    const positions = await prisma.position.findMany({
      where: { clientId },
      include: {
        _count: {
          select: { teamMembers: true }
        }
      },
      orderBy: { title: 'asc' }
    });

    res.json(positions);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Get single position
router.get('/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    const position = await prisma.position.findFirst({
      where: {
        id,
        clientId
      },
      include: {
        _count: {
          select: { teamMembers: true }
        }
      }
    });

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    res.json(position);
  } catch (error) {
    console.error('Error fetching position:', error);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

// Create position
router.post('/', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { title, description, permissionSet } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Position title is required' });
    }

    if (!permissionSet) {
      return res.status(400).json({ error: 'Permission set is required' });
    }

    // Check if position with same title already exists
    const existing = await prisma.position.findFirst({
      where: {
        clientId,
        title: title.trim()
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'A position with this title already exists' });
    }

    const position = await prisma.position.create({
      data: {
        clientId,
        title: title.trim(),
        description: description?.trim() || null,
        permissionSet
      }
    });

    res.status(201).json(position);
  } catch (error) {
    console.error('Error creating position:', error);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

// Update position
router.put('/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;
    const { title, description, isActive, permissionSet } = req.body;

    // Verify position belongs to client
    const existing = await prisma.position.findFirst({
      where: { id, clientId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // If updating title, check for duplicates
    if (title && title.trim() !== existing.title) {
      const duplicate = await prisma.position.findFirst({
        where: {
          clientId,
          title: title.trim(),
          id: { not: id }
        }
      });

      if (duplicate) {
        return res.status(400).json({ error: 'A position with this title already exists' });
      }
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (permissionSet !== undefined) updateData.permissionSet = permissionSet;

    const position = await prisma.position.update({
      where: { id },
      data: updateData
    });

    // If title changed, update all team members with this position
    if (title && title.trim() !== existing.title) {
      await prisma.clientTeamMember.updateMany({
        where: { positionId: id },
        data: { positionTitle: title.trim() }
      });
    }

    res.json(position);
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// Delete position
router.delete('/:id', auth, requireRole(['Client']), async (req: AuthRequest, res) => {
  try {
    const clientId = req.user!.userId;
    const { id } = req.params;

    // Verify position belongs to client
    const existing = await prisma.position.findFirst({
      where: { id, clientId },
      include: {
        _count: {
          select: { teamMembers: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Position not found' });
    }

    // Check if position has team members
    if (existing._count.teamMembers > 0) {
      return res.status(400).json({ 
        error: `Cannot delete position. ${existing._count.teamMembers} team member(s) are assigned to this position.` 
      });
    }

    await prisma.position.delete({
      where: { id }
    });

    res.json({ message: 'Position deleted successfully' });
  } catch (error) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

export default router;
