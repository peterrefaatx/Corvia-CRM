import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, requireRole } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all pipeline stages
router.get('/', auth, async (req, res) => {
  try {
    const stages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      include: {
        position: true // Include position data for filtering team members
      },
      orderBy: { order: 'asc' },
    });
    res.json(stages);
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

// Create new pipeline stage (Admin/Client only)
router.post('/', auth, requireRole(['Admin', 'Client']), async (req, res) => {
  try {
    const { name, displayName } = req.body;

    if (!name || !displayName) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }

    // Get the highest order number among active stages
    const maxOrder = await prisma.pipelineStage.findFirst({
      where: { isActive: true },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const newOrder = (maxOrder?.order || 0) + 1;

    const stage = await prisma.pipelineStage.create({
      data: {
        name,
        displayName,
        order: newOrder,
        isSystem: false,
      },
    });

    res.json(stage);
  } catch (error: any) {
    console.error('Error creating pipeline stage:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A stage with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create pipeline stage' });
  }
});

// Update pipeline stage
router.put('/:id', auth, requireRole(['Admin', 'Client']), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, order } = req.body;

    // Check if stage exists and is not a system stage
    const existingStage = await prisma.pipelineStage.findUnique({
      where: { id },
    });

    if (!existingStage) {
      return res.status(404).json({ error: 'Pipeline stage not found' });
    }

    if (existingStage.isSystem && displayName !== existingStage.displayName) {
      return res.status(400).json({ error: 'Cannot rename system stages' });
    }

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (order !== undefined) updateData.order = order;

    const stage = await prisma.pipelineStage.update({
      where: { id },
      data: updateData,
    });

    res.json(stage);
  } catch (error: any) {
    console.error('Error updating pipeline stage:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Order number already in use' });
    }
    res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
});

// Reorder pipeline stages
router.post('/reorder', auth, requireRole(['Admin', 'Client']), async (req, res) => {
  try {
    const { stages } = req.body; // Array of { id, order }

    if (!Array.isArray(stages)) {
      return res.status(400).json({ error: 'Stages must be an array' });
    }

    // Update all stages - no unique constraint anymore, so we can update directly
    for (const stage of stages) {
      await prisma.pipelineStage.update({
        where: { id: stage.id },
        data: { order: stage.order },
      });
    }

    const updatedStages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    res.json(updatedStages);
  } catch (error) {
    console.error('Error reordering pipeline stages:', error);
    res.status(500).json({ error: 'Failed to reorder pipeline stages' });
  }
});

// Delete pipeline stage (soft delete)
router.delete('/:id', auth, requireRole(['Admin', 'Client']), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if stage exists and is not a system stage
    const existingStage = await prisma.pipelineStage.findUnique({
      where: { id },
    });

    if (!existingStage) {
      return res.status(404).json({ error: 'Pipeline stage not found' });
    }

    if (existingStage.isSystem) {
      return res.status(400).json({ error: 'Cannot delete system stages' });
    }

    // Check if any leads are using this stage
    const leadsCount = await prisma.lead.count({
      where: { pipelineStage: existingStage.name },
    });

    if (leadsCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete stage. ${leadsCount} lead(s) are currently in this stage.` 
      });
    }

    // Soft delete
    await prisma.pipelineStage.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Pipeline stage deleted successfully' });
  } catch (error) {
    console.error('Error deleting pipeline stage:', error);
    res.status(500).json({ error: 'Failed to delete pipeline stage' });
  }
});

export default router;
