import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import { auth } from '../middleware/auth';
import { config } from '../config';
import prisma from '../lib/prisma';
import { getNowInTimezone, getWorkDayDate } from '../utils/timezone';
import { recordLoginHistory } from '../utils/loginHistory';

const router = express.Router();

// Rate limiter for login endpoint - 5 failed attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per window
  message: 'Too many failed login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed login attempts
});

// Login
router.post('/login', loginLimiter, [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    const user = await prisma.user.findUnique({
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Calculate login time properly using Cairo timezone
    // This works regardless of server timezone
    const nowCairo = getNowInTimezone(); // Get current time in Cairo timezone
    const loginHour = nowCairo.getHours();
    const loginMinute = nowCairo.getMinutes();
    
    // Calculate "today" based on 4 AM cutoff in Cairo time
    const today = getWorkDayDate(); // Handles 4 AM cutoff automatically
    
    // Store actual time for database (will be in server's local timezone)
    const now = new Date();
    
    // Check if this is the first login of the day (based on 4 AM cutoff)
    const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    let isFirstLoginToday = true;
    
    if (lastLoginDate) {
      const lastLoginDay = new Date(lastLoginDate);
      lastLoginDay.setHours(0, 0, 0, 0);
      isFirstLoginToday = lastLoginDay.getTime() !== today.getTime();
    }
    
    let todayLoginTime = user.todayLoginTime;
    let todayLatenessMinutes = user.todayLatenessMinutes || 0;
    
    // Track attendance for: Agent, SeniorAgent, QualityControl, TeamLeader, AccountManager, IT
    // Exclude: Manager, Client
    const trackedRoles = ['Agent', 'SeniorAgent', 'QualityControl', 'TeamLeader', 'AccountManager', 'IT'];
    const shouldTrackAttendance = trackedRoles.includes(user.role) && isFirstLoginToday;
    
    console.log(`[Login] User: ${user.username}, Role: ${user.role}, Should Track: ${shouldTrackAttendance}, First Login Today: ${isFirstLoginToday}`);
    
    if (shouldTrackAttendance) {
      // If user logs in before 4:45 PM Cairo time, set login time to 4:45 PM
      if (loginHour < 16 || (loginHour === 16 && loginMinute < 45)) {
        // Set to 4:45 PM Cairo time (convert to server timezone)
        const loginTime = new Date(nowCairo);
        loginTime.setHours(16, 45, 0, 0);
        todayLoginTime = loginTime;
      } else {
        // Use actual login time
        todayLoginTime = new Date(nowCairo);
      }
      
      todayLatenessMinutes = 0;
      
      // Work day starts at 4:00 PM, on-time window is 4:00 PM - 5:00 PM
      // If logged in after 5:00 PM, calculate lateness from 5:00 PM
      if (loginHour > 17 || (loginHour === 17 && loginMinute > 0)) {
        // Calculate lateness from 5:00 PM
        const lateMinutes = (loginHour - 17) * 60 + loginMinute;
        todayLatenessMinutes = lateMinutes;
      }
    }
    
    // Update last login and login tracking (only update login time on first login of the day)
    const updateData: any = { 
      lastLogin: now,
      lastLoginDate: today
    };
    
    // Only update login time fields if this is the first login of the day
    if (shouldTrackAttendance) {
      updateData.todayLoginTime = todayLoginTime;
      updateData.todayLatenessMinutes = todayLatenessMinutes;
      
      console.log(`[Login] Recording attendance for ${user.username} - Login Time: ${todayLoginTime}, Lateness: ${todayLatenessMinutes}min`);
      
      // 🎯 IMMEDIATELY record login history for accurate attendance
      // This ensures data is never lost, even if daily job fails
      const recorded = await recordLoginHistory({
        userId: user.id,
        loginTime: todayLoginTime!,
        latenessMinutes: todayLatenessMinutes
      });
      
      console.log(`[Login] Attendance recorded: ${recorded ? 'YES (new record)' : 'NO (already exists)'}`);
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role, teamId: user.teamId },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      config.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    res.json({
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
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Team Member Login
router.post('/team-member/login', loginLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { email },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            email: true
          }
        },
        position: {
          select: {
            id: true,
            title: true,
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (teamMember.status !== 'active') {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, teamMember.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token for team member
    const token = jwt.sign(
      { 
        userId: teamMember.id, 
        role: 'TeamMember',
        clientId: teamMember.clientId,
        positionTitle: teamMember.positionTitle
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      { userId: teamMember.id, type: 'team-member' },
      config.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    res.json({
      accessToken: token,
      refreshToken,
      user: {
        id: teamMember.id,
        email: teamMember.email,
        role: 'TeamMember',
        fullName: teamMember.name,
        positionTitle: teamMember.positionTitle,
        permissions: teamMember.position?.permissionSet || null,
        clientId: teamMember.clientId,
        clientName: teamMember.client.fullName
      }
    });
  } catch (error) {
    console.error('Team member login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, config.jwtRefreshSecret) as any;
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { team: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = jwt.sign(
      { userId: user.id, role: user.role },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({ accessToken: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.userId },
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
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if we need to reset login tracking for a new day (based on 4 AM Cairo cutoff)
    const today = getWorkDayDate(); // Get today's work day in Cairo timezone
    
    const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    
    if (lastLoginDate) {
      const lastLoginDay = new Date(lastLoginDate);
      lastLoginDay.setHours(0, 0, 0, 0);
      
      if (lastLoginDay.getTime() !== today.getTime()) {
        // Reset login tracking for new day
        await prisma.user.update({
          where: { id: user.id },
          data: {
            todayLoginTime: null,
            todayLatenessMinutes: 0
          }
        });
        user.todayLoginTime = null;
        user.todayLatenessMinutes = 0;
      }
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      todayLoginTime: user.todayLoginTime,
      todayLatenessMinutes: user.todayLatenessMinutes,
      accountManagerId: user.accountManagerId,
      team: user.team ? {
        id: user.team.id,
        name: user.team.name,
        teamLeader: user.team.teamLeader
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get login tracking data for current user
router.get('/login-tracking', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.userId },
      select: {
        todayLoginTime: true,
        todayLatenessMinutes: true,
        lastLoginDate: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if we need to reset login tracking for a new day (based on 4 AM Cairo cutoff)
    const today = getWorkDayDate(); // Get today's work day in Cairo timezone
    
    const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    
    // If it's a new day, return null values
    if (lastLoginDate) {
      const lastLoginDay = new Date(lastLoginDate);
      lastLoginDay.setHours(0, 0, 0, 0);
      
      if (lastLoginDay.getTime() !== today.getTime()) {
        return res.json({
          loginTime: null,
          latenessMinutes: 0
        });
      }
    }

    // Format login time as 12-hour format with AM/PM
    let loginTimeFormatted = null;
    if (user.todayLoginTime) {
      const loginTime = new Date(user.todayLoginTime);
      
      // Format in 12-hour format
      const hours24 = loginTime.getHours();
      const minutes = loginTime.getMinutes().toString().padStart(2, '0');
      const period = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      loginTimeFormatted = `${hours12.toString().padStart(2, '0')}:${minutes} ${period}`;
    }

    res.json({
      loginTime: loginTimeFormatted,
      latenessMinutes: user.todayLatenessMinutes || 0
    });
  } catch (error) {
    console.error('Login tracking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Team Member Login
router.post('/team-member/login', loginLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { email },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        position: {
          select: {
            id: true,
            title: true,
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (teamMember.status !== 'active') {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const isValidPassword = await bcrypt.compare(password, teamMember.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token for team member
    const token = jwt.sign(
      { 
        userId: teamMember.id, 
        role: 'TeamMember',
        clientId: teamMember.clientId,
        email: teamMember.email,
        name: teamMember.name
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      accessToken: token,
      user: {
        id: teamMember.id,
        name: teamMember.name,
        email: teamMember.email,
        role: 'TeamMember',
        positionTitle: teamMember.positionTitle,
        permissions: teamMember.position?.permissionSet || null,
        clientId: teamMember.clientId,
        clientName: teamMember.client.fullName
      }
    });
  } catch (error) {
    console.error('Team member login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current team member
router.get('/team-member/me', auth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      include: {
        client: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        position: {
          select: {
            id: true,
            title: true,
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const permissions = teamMember.position?.permissionSet || null;
    console.log('[DEBUG] Team member permissions:', JSON.stringify(permissions, null, 2));
    
    res.json({
      id: teamMember.id,
      name: teamMember.name,
      email: teamMember.email,
      role: 'TeamMember',
      positionTitle: teamMember.positionTitle,
      permissions,
      clientId: teamMember.clientId,
      clientName: teamMember.client.fullName
    });
  } catch (error) {
    console.error('Get team member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all qualified leads for team member (requires view_all permission)
router.get('/team-member/all-leads', auth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: {
        clientId: true,
        position: {
          select: {
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if team member has view_all permission
    const permissions = teamMember.position?.permissionSet as any;
    if (!permissions?.leads?.view_all) {
      return res.status(403).json({ error: 'You do not have permission to view all leads' });
    }

    // Fetch all qualified leads for the client that are NOT yet reviewed (not in pipeline)
    const leads = await prisma.lead.findMany({
      where: {
        campaign: {
          clientId: teamMember.clientId
        },
        status: 'Qualified',
        clientReviewed: false  // Only show leads NOT yet moved to pipeline
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            formTemplateId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leads);
  } catch (error) {
    console.error('Get all leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pipeline stages for team member
router.get('/team-member/pipeline-stages', auth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: {
        position: {
          select: {
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if team member has view_pipeline permission
    const permissions = teamMember.position?.permissionSet as any;
    if (!permissions?.pipeline?.view_pipeline) {
      return res.status(403).json({ error: 'You do not have permission to view pipeline' });
    }

    // Fetch pipeline stages
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' }
    });

    res.json(stages);
  } catch (error) {
    console.error('Get pipeline stages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pipeline leads for team member
router.get('/team-member/pipeline-leads', auth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: {
        clientId: true,
        position: {
          select: {
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if team member has view_pipeline permission
    const permissions = teamMember.position?.permissionSet as any;
    if (!permissions?.pipeline?.view_pipeline) {
      return res.status(403).json({ error: 'You do not have permission to view pipeline' });
    }

    // Fetch pipeline leads for the client
    const leads = await prisma.lead.findMany({
      where: {
        campaign: {
          clientId: teamMember.clientId
        },
        clientReviewed: true,
        pipelineStage: {
          not: null
        },
        archived: false
      },
      select: {
        id: true,
        serialNumber: true,
        homeownerFirst: true,
        homeownerLast: true,
        phone: true,
        addressText: true,
        pipelineStage: true,
        temperature: true,
        marketValue: true,
        askingPrice: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json(leads);
  } catch (error) {
    console.error('Get pipeline leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move lead in pipeline for team member
router.patch('/team-member/leads/:id/move', auth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;
    const { id: leadId } = req.params;
    const { pipelineStage } = req.body;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: {
        clientId: true,
        position: {
          select: {
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if team member has full_access permission
    const permissions = teamMember.position?.permissionSet as any;
    if (!permissions?.pipeline?.full_access) {
      return res.status(403).json({ error: 'You do not have permission to move leads' });
    }

    // Verify lead belongs to the client
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId: teamMember.clientId
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Update lead pipeline stage
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { pipelineStage }
    });

    // Execute pipeline automation
    const { executePipelineAutomation } = await import('./automationRules');
    await executePipelineAutomation(leadId, pipelineStage, teamMember.clientId);

    res.json(updatedLead);
  } catch (error) {
    console.error('Move lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle star on lead for team member
router.patch('/team-member/leads/:id/star', auth, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;
    const { id: leadId } = req.params;

    if (role !== 'TeamMember') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const teamMember = await prisma.clientTeamMember.findUnique({
      where: { id: userId },
      select: {
        clientId: true,
        position: {
          select: {
            permissionSet: true
          }
        }
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check if team member has view_all permission
    const permissions = teamMember.position?.permissionSet as any;
    if (!permissions?.leads?.view_all) {
      return res.status(403).json({ error: 'You do not have permission to star leads' });
    }

    // Verify lead belongs to the client
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId: teamMember.clientId
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Toggle starred status
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { starred: !lead.starred },
      select: { id: true, starred: true }
    });

    res.json(updatedLead);
  } catch (error) {
    console.error('Toggle star error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password (stub)
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email required')
], async (req: any, res: any) => {
  // In production, this would send a password reset email
  res.json({ message: 'If an account with that email exists, a reset link has been sent' });
});

export { router as authRoutes };
