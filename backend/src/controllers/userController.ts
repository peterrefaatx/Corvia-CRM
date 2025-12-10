import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { userService } from '../services/userService';
import { AppError } from '../middleware/errorHandler';

export class UserController {
  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const users = await userService.getAllUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const user = await userService.getUserById(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const user = await userService.createUser(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      if (req.params.id === req.user.id) {
        throw new AppError(400, 'Cannot modify your own account');
      }

      const user = await userService.updateUser(req.params.id, req.body);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      if (req.params.id === req.user.id) {
        throw new AppError(400, 'Cannot delete your own account');
      }

      const result = await userService.deleteUser(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.role !== 'Manager') {
        throw new AppError(403, 'Insufficient permissions');
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 8) {
        throw new AppError(400, 'Password must be at least 8 characters');
      }

      const result = await userService.resetPassword(req.params.id, newPassword);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();










