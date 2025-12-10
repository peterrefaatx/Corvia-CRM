import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole } from '@prisma/client';
import { LoginDto, AuthResponse } from '../types';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';
import { config } from '../config';

export class AuthService {
  async login(data: LoginDto): Promise<AuthResponse> {
    const { username, password } = data;

    if (!username || !password) {
      throw new AppError(401, 'Username and password required');
    }

    let user = await prisma.user.findUnique({
      where: { username },
      include: {
        team: {
          include: {
            teamLeader: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            }
          }
        }
      }
    });

    // User must exist in database
    if (!user) {
      throw new AppError(401, 'Invalid credentials');
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!validPassword) {
      throw new AppError(401, 'Invalid credentials');
    }

    if (!user.isActive) {
      throw new AppError(401, 'Account is deactivated');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role, teamId: user.teamId },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    return {
      accessToken: token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        team: user.team ? {
          id: user.team.id,
          name: user.team.name,
          teamLeader: user.team.teamLeader
        } : null
      }
    };
  }

  async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        team: {
          include: {
            teamLeader: {
              select: {
                id: true,
                fullName: true,
                username: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      team: user.team ? {
        id: user.team.id,
        name: user.team.name,
        teamLeader: user.team.teamLeader
      } : null
    };
  }
}

export const authService = new AuthService();









