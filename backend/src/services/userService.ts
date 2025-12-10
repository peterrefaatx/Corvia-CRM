import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CreateUserDto, UpdateUserDto } from '../types';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';

export class UserService {
  async createUser(data: CreateUserDto) {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email }
        ]
      }
    });

    if (existingUser) {
      throw new AppError(400, 'Username or email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        role: data.role,
        fullName: data.fullName,
        teamId: data.teamId || null,
        isActive: true
      },
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
        },
        managedTeam: true
      }
    });

    // If TeamLeader, update team
    if (data.role === 'TeamLeader' && data.teamId) {
      await prisma.team.update({
        where: { id: data.teamId },
        data: { teamLeaderUserId: user.id }
      });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateUser(userId: string, data: UpdateUserDto) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new AppError(404, 'User not found');
    }

    // Check for duplicate username/email if updating
    if (data.username || data.email) {
      const duplicate = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: userId } },
            {
              OR: [
                ...(data.username ? [{ username: data.username }] : []),
                ...(data.email ? [{ email: data.email }] : [])
              ]
            }
          ]
        }
      });

      if (duplicate) {
        throw new AppError(400, 'Username or email already exists');
      }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.username && { username: data.username }),
        ...(data.email && { email: data.email }),
        ...(data.role && { role: data.role }),
        ...(data.fullName && { fullName: data.fullName }),
        ...(data.teamId !== undefined && { teamId: data.teamId }),
        ...(data.isActive !== undefined && { isActive: data.isActive })
      },
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
        },
        managedTeam: true
      }
    });

    // Handle team leader assignment
    if (data.role === 'TeamLeader' && data.teamId) {
      await prisma.team.updateMany({
        where: { teamLeaderUserId: userId },
        data: { teamLeaderUserId: null }
      });
      await prisma.team.update({
        where: { id: data.teamId },
        data: { teamLeaderUserId: userId }
      });
    } else if (data.role && data.role !== 'TeamLeader') {
      await prisma.team.updateMany({
        where: { teamLeaderUserId: userId },
        data: { teamLeaderUserId: null }
      });
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    // Get counts
    const [leadsCount, qcLeadsCount, campaignsCount, managedTeamCount] = await Promise.all([
      prisma.lead.count({ where: { agentId: userId } }),
      prisma.lead.count({ where: { qcUserId: userId } }),
      prisma.campaign.count({ where: { managerId: userId } }),
      prisma.team.count({ where: { teamLeaderUserId: userId } })
    ]);

    // Use transaction to handle all deletions
    await prisma.$transaction(async (tx) => {
      // Handle QC leads
      if (qcLeadsCount > 0) {
        await tx.lead.updateMany({
          where: { qcUserId: userId },
          data: { qcUserId: null }
        });
      }

      // Handle managed campaigns
      if (campaignsCount > 0) {
        await tx.campaign.deleteMany({
          where: { managerId: userId }
        });
      }

      // Handle managed team
      if (managedTeamCount > 0) {
        await tx.team.updateMany({
          where: { teamLeaderUserId: userId },
          data: { teamLeaderUserId: null }
        });
      }

      // Handle leave requests where user is manager
      await tx.leaveRequest.updateMany({
        where: { managerId: userId },
        data: { managerId: null }
      });

      // Delete user (leads will cascade delete)
      await tx.user.delete({
        where: { id: userId }
      });
    });

    return {
      message: `User "${user.fullName}" deleted successfully`,
      leadsDeleted: leadsCount,
      qcLeadsDisassociated: qcLeadsCount,
      campaignsDeleted: campaignsCount
    };
  }

  async getAllUsers() {
    const users = await prisma.user.findMany({
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
        },
        managedTeam: true,
        _count: {
          select: {
            leads: true,
            qcLeads: true,
            managedCampaigns: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Remove passwordHash from all users
    return users.map(({ passwordHash, ...user }) => user);
  }

  async getUserById(userId: string) {
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
        },
        managedTeam: true
      }
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async resetPassword(userId: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    return { message: 'Password reset successfully' };
  }
}

export const userService = new UserService();










