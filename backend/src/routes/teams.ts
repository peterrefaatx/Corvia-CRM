import { Router } from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { teamController } from '../controllers/teamController';

const router = Router();

// All routes require authentication
router.use(auth);

// Get all teams
router.get('/', (req, res, next) => {
  teamController.getAllTeams(req as any, res, next);
});

// Create team
router.post(
  '/',
  validate([
    body('name').notEmpty().withMessage('Team name is required')
  ]),
  (req, res, next) => {
    teamController.createTeam(req as any, res, next);
  }
);

// Update team
router.put(
  '/:id',
  validate([
    body('name').optional().notEmpty().withMessage('Team name cannot be empty'),
    body('teamLeaderUserId').optional().isString()
  ]),
  (req, res, next) => {
    teamController.updateTeam(req as any, res, next);
  }
);

// Delete team
router.delete('/:id', (req, res, next) => {
  teamController.deleteTeam(req as any, res, next);
});

export default router;










