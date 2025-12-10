import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { teamService } from '../services/teamService';
import { AppError } from '../middleware/errorHandler';

export class TeamController {
  async getAllTeams(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const teams = await teamService.getAllTeams();
      res.json(teams);
    } catch (error) {
      next(error);
    }
  }

  async createTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const team = await teamService.createTeam(req.body);
      res.status(201).json(team);
    } catch (error) {
      next(error);
    }
  }

  async updateTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const team = await teamService.updateTeam(req.params.id, req.body);
      res.json(team);
    } catch (error) {
      next(error);
    }
  }

  async deleteTeam(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const result = await teamService.deleteTeam(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const teamController = new TeamController();










