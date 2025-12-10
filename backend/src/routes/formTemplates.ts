import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

router.use(auth);

// Get all form templates
router.get('/', async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.formTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        fields: true,
        createdAt: true,
        _count: {
          select: { campaigns: true }
        }
      }
    });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching form templates:', error);
    res.status(500).json({ error: 'Failed to fetch form templates' });
  }
});

// Get single form template
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const template = await prisma.formTemplate.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { campaigns: true }
        }
      }
    });

    if (!template) {
      return res.status(404).json({ error: 'Form template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching form template:', error);
    res.status(500).json({ error: 'Failed to fetch form template' });
  }
});

// Create form template
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, fields } = req.body;

    if (!name || !fields) {
      return res.status(400).json({ error: 'Name and fields are required' });
    }

    const template = await prisma.formTemplate.create({
      data: {
        name,
        description,
        fields,
        createdBy: req.user!.userId
      }
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating form template:', error);
    res.status(500).json({ error: 'Failed to create form template' });
  }
});

// Update form template
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { name, description, fields } = req.body;

    const template = await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: {
        name,
        description,
        fields
      }
    });

    res.json(template);
  } catch (error) {
    console.error('Error updating form template:', error);
    res.status(500).json({ error: 'Failed to update form template' });
  }
});

// Delete form template (soft delete)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    // Check if template is being used by any campaigns
    const campaignCount = await prisma.campaign.count({
      where: { formTemplateId: req.params.id }
    });

    if (campaignCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete template. It is being used by ${campaignCount} campaign(s)` 
      });
    }

    await prisma.formTemplate.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });

    res.json({ message: 'Form template deleted successfully' });
  } catch (error) {
    console.error('Error deleting form template:', error);
    res.status(500).json({ error: 'Failed to delete form template' });
  }
});

export default router;
