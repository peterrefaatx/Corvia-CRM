import { CreateTeamDto } from '../types';
import { AppError } from '../middleware/errorHandler';
import prisma from '../lib/prisma';

export class TeamService {
  async getAllTeams() {
    return prisma.team.findMany({
      include: {
        teamLeader: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        _count: {
          select: {
            users: true,
            leads: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async createTeam(data: CreateTeamDto) {
    if (!data.name || !data.name.trim()) {
      throw new AppError(400, 'Team name is required');
    }

    // Check if team name already exists
    const existingTeam = await prisma.team.findFirst({
      where: {
        name: {
          equals: data.name.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existingTeam) {
      throw new AppError(400, 'Team name already exists');
    }

    // If team leader is provided, verify they exist and have the correct role
    if (data.teamLeaderUserId) {
      const user = await prisma.user.findUnique({
        where: { id: data.teamLeaderUserId }
      });

      if (!user) {
        throw new AppError(404, 'Team leader not found');
      }

      if (user.role !== 'TeamLeader') {
        throw new AppError(400, 'User must have TeamLeader role');
      }
    }

    // Create the team
    const team = await prisma.team.create({
      data: {
        name: data.name.trim(),
        teamLeaderUserId: data.teamLeaderUserId || null
      },
      include: {
        teamLeader: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });

    // If team leader was assigned, update their teamId
    if (data.teamLeaderUserId) {
      await prisma.user.update({
        where: { id: data.teamLeaderUserId },
        data: { teamId: team.id }
      });
    }

    return team;
  }

  async updateTeam(teamId: string, data: { name?: string; teamLeaderUserId?: string | null }) {
    const team = await prisma.team.findUnique({
      where: { id: teamId }
    });

    if (!team) {
      throw new AppError(404, 'Team not found');
    }

    // If updating name, check for duplicates
    if (data.name && data.name.trim() !== team.name) {
      const existingTeam = await prisma.team.findFirst({
        where: {
          name: {
            equals: data.name.trim(),
            mode: 'insensitive'
          },
          id: { not: teamId }
        }
      });

      if (existingTeam) {
        throw new AppError(400, 'Team name already exists');
      }
    }

    // If assigning team leader, verify user exists and is a TeamLeader
    if (data.teamLeaderUserId !== undefined) {
      if (data.teamLeaderUserId) {
        const user = await prisma.user.findUnique({
          where: { id: data.teamLeaderUserId }
        });

        if (!user) {
          throw new AppError(404, 'User not found');
        }

        if (user.role !== 'TeamLeader') {
          throw new AppError(400, 'User must have TeamLeader role');
        }

        // Remove user from any other team they're leading
        await prisma.team.updateMany({
          where: {
            teamLeaderUserId: data.teamLeaderUserId,
            id: { not: teamId }
          },
          data: { teamLeaderUserId: null }
        });

        // Ensure user is assigned to this team
        console.log(`Assigning team leader ${data.teamLeaderUserId} to team ${teamId}`);
        await prisma.user.update({
          where: { id: data.teamLeaderUserId },
          data: { teamId }
        });
        console.log(`Team leader assigned successfully`);
      } else {
        console.log('teamLeaderUserId is falsy, skipping assignment');
      }
    } else {
      console.log('teamLeaderUserId is undefined, skipping team leader logic');
    }

    return prisma.team.update({
      where: { id: teamId },
      data: {
        name: data.name ? data.name.trim() : undefined,
        teamLeaderUserId: data.teamLeaderUserId !== undefined ? data.teamLeaderUserId : undefined
      },
      include: {
        teamLeader: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        _count: {
          select: {
            users: true,
            leads: true
          }
        }
      }
    });
  }

  async deleteTeam(teamId: string) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        users: { select: { id: true } },
        leads: { select: { id: true } }
      }
    });

    if (!team) {
      throw new AppError(404, 'Team not found');
    }

    // Use transaction
    await prisma.$transaction(async (tx) => {
      // Disconnect users
      if (team.users.length > 0) {
        await tx.user.updateMany({
          where: { teamId: teamId },
          data: { teamId: null }
        });
      }

      // Disconnect leads
      if (team.leads.length > 0) {
        await tx.lead.updateMany({
          where: { teamId: teamId },
          data: { teamId: null }
        });
      }

      // Delete team
      await tx.team.delete({
        where: { id: teamId }
      });
    });

    return {
      message: `Team "${team.name}" deleted successfully`,
      usersAffected: team.users.length,
      leadsAffected: team.leads.length
    };
  }
}

export const teamService = new TeamService();











