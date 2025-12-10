import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:3000", methods: ['GET', 'POST'] }
});
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000", credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes

// Auth middleware
const auth = (req: any, res: any, next: any) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log('Login attempt for:', username);

    if (!username || !password) {
      return res.status(401).json({ error: 'Username and password required' });
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

    // Create demo user if doesn't exist
    if (!user) {
      console.log('Creating demo user for:', username);
      const passwordHash = await bcrypt.hash('demo123', 12);
      
      // Determine role based on username
      let role = 'Agent';
      if (username.toLowerCase().includes('manager')) role = 'Manager';
      if (username.toLowerCase().includes('qc')) role = 'QualityControl';
      if (username.toLowerCase().includes('client')) role = 'Client';
      if (username.toLowerCase().includes('leader')) role = 'TeamLeader';

      user = await prisma.user.create({
        data: {
          username,
          email: `${username}@corvia.com`,
          passwordHash,
          role,
          fullName: username.charAt(0).toUpperCase() + username.slice(1),
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
          }
        }
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, teamId: user.teamId },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '24h' }
    );

    console.log('Login successful for:', username, 'role:', user.role);

    res.json({
      accessToken: token,
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
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user data
app.get('/api/auth/me', auth, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
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

    res.json({
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
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// CAMPAIGN ROUTES
app.get('/api/campaigns', auth, async (req: any, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      include: {
        manager: {
          select: { fullName: true }
        }
      }
    });
    res.json(campaigns);
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

app.get('/api/campaigns/all', auth, async (req: any, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: {
        manager: {
          select: { fullName: true }
        },
        _count: {
          select: { leads: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    console.error('Get all campaigns error:', error);
    res.status(500).json({ error: 'Failed to get campaigns' });
  }
});

// FIXED CAMPAIGN CREATION - Around line 200 in your server.ts
app.post('/api/campaigns', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    const existingCampaign = await prisma.campaign.findFirst({
      where: { 
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        }
      }
    });

    if (existingCampaign) {
      return res.status(400).json({ error: 'Campaign name already exists' });
    }

    // FIX: Use managerId (matches your schema) and req.user.id (from JWT)
    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        isActive: true,
        managerId: req.user.id // CHANGED: managerId (not managerUserId)
      },
      include: {
        manager: {
          select: { fullName: true }
        }
      }
    });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Campaign creation error:', error);
    res.status(500).json({ error: 'Failed to create campaign: ' + error.message });
  }
});


app.post('/api/campaigns', auth, async (req: any, res) => {
  try {
    console.log('🔍 DEBUG - req.user:', JSON.stringify(req.user, null, 2));
    console.log('🔍 DEBUG - User ID from token:', req.user.id, 'Role:', req.user.role);
    
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name } = req.body;
    console.log('🔍 DEBUG - Campaign name:', name);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Campaign name is required' });
    }

    // Try to create campaign with debug info
    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        isActive: true,
        managerId: req.user.id
      },
      include: {
        manager: {
          select: { fullName: true }
        }
      }
    });

    console.log('✅ DEBUG - Campaign created successfully:', campaign.id);
    res.status(201).json(campaign);
    
  } catch (error) {
    console.error('❌ DEBUG - Campaign creation error:', error);
    console.error('❌ DEBUG - Error details:', error.message);
    res.status(500).json({ error: 'Failed to create campaign: ' + error.message });
  }
});

app.patch('/api/campaigns/:id/status', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { isActive } = req.body;

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: { isActive },
      include: {
        manager: {
          select: { fullName: true }
        },
        _count: {
          select: { leads: true }
        }
      }
    });

    res.json(campaign);
  } catch (error) {
    console.error('Campaign update error:', error);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// FIXED CAMPAIGN DELETION - WORKING VERSION
app.delete('/api/campaigns/:id', auth, async (req: any, res) => {
  try {
    console.log('=== CAMPAIGN DELETE REQUEST ===');
    console.log('User:', req.user);
    console.log('Campaign ID:', req.params.id);

    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const campaignId = req.params.id;

    // Check if campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        leads: {
          select: { id: true }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    console.log('Campaign leads count:', campaign.leads.length);

    // Disconnect leads from this campaign - USE THE CORRECT FIELD NAME
    if (campaign.leads.length > 0) {
      console.log('Disconnecting leads from campaign...');
      
      // Update each lead individually to remove campaign association
      // Use the relation name 'campaign' instead of 'campaignId'
      for (const lead of campaign.leads) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: { 
            campaign: {
              disconnect: true  // This disconnects the relation
            }
          }
        });
      }
      console.log('Leads disconnected successfully');
    }

    // Delete the campaign
    console.log('Deleting campaign...');
    await prisma.campaign.delete({
      where: { id: campaignId }
    });
    console.log('Campaign deleted successfully');

    res.json({ 
      message: `Campaign "${campaign.name}" deleted successfully`,
      leadsAffected: campaign.leads.length,
      leadsAction: 'disassociated_from_campaign'
    });
  } catch (error: any) {
    console.error('=== CAMPAIGN DELETION ERROR ===');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.status(500).json({ error: 'Failed to delete campaign: ' + error.message });
  }
});

// LEAD ROUTES
app.post('/api/leads', auth, async (req: any, res) => {
  try {
    console.log('Lead submission received from user:', req.user.userId);
    console.log('Lead data:', JSON.stringify(req.body, null, 2));

    const leadData = req.body;
    
    // Validate required fields
    if (!leadData.campaignId) {
      return res.status(400).json({ error: 'Campaign is required' });
    }
    if (!leadData.homeownerFirst || !leadData.homeownerLast) {
      return res.status(400).json({ error: 'Homeowner name is required' });
    }
    if (!leadData.phone) {
      return res.status(400).json({ error: 'Phone is required' });
    }
    if (!leadData.addressText) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Check if user is an agent and has a team
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { team: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role !== 'Agent') {
      return res.status(403).json({ error: 'Only agents can submit leads' });
    }

    if (!user.teamId) {
      return res.status(400).json({ error: 'Agent must be assigned to a team' });
    }

    // Generate serial number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const latestLead = await prisma.lead.findFirst({
      where: { serialNumber: { startsWith: `CORV-${today}` } },
      orderBy: { serialNumber: 'desc' }
    });
    
    let sequence = 1;
    if (latestLead) {
      const lastSequence = parseInt(latestLead.serialNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }
    
    const serialNumber = `CORV-${today}-${sequence.toString().padStart(4, '0')}`;

    console.log('Creating lead with serial:', serialNumber);

    // Create the lead
    const lead = await prisma.lead.create({
      data: {
        serialNumber,
        campaignId: leadData.campaignId,
        homeownerFirst: leadData.homeownerFirst,
        homeownerLast: leadData.homeownerLast,
        phone: leadData.phone,
        email: leadData.email || '',
        bedrooms: leadData.bedrooms || 0,
        bathrooms: leadData.bathrooms || 0,
        marketValue: leadData.marketValue || 0,
        askingPrice: leadData.askingPrice || 0,
        listingStatus: leadData.listingStatus,
        occupancy: leadData.occupancy,
        mortgageYesNo: leadData.mortgageYesNo || false,
        mortgageAmount: leadData.mortgageAmount || 0,
        closingTimeline: leadData.closingTimeline,
        addressText: leadData.addressText,
        motivationRating: leadData.motivationRating || 5,
        conditionRating: leadData.conditionRating || 5,
        additionalInfo: leadData.additionalInfo || '',
        submitCheckboxFlag: true,
        status: 'Pending',
        agentId: req.user.userId,
        teamId: user.teamId
      },
      include: {
        campaign: true,
        agent: { select: { fullName: true } },
        team: true
      }
    });

    // Create audit trail
    await prisma.leadAudit.create({
      data: {
        leadId: lead.id,
        userId: req.user.userId,
        action: 'Create',
        payload: leadData
      }
    });

    console.log('Lead created successfully:', lead.id);

    // Real-time update - emit to all connected clients
    io.emit('lead_created', lead);
    // Also emit specifically to the agent who submitted the lead
    io.emit(`user_${req.user.userId}_lead_created`, lead);
    // Emit to all dashboard listeners
    io.emit('dashboard_update', { type: 'lead_created', lead });

    res.status(201).json(lead);
  } catch (error) {
    console.error('Lead creation error:', error);
    res.status(500).json({ error: 'Failed to create lead: ' + error.message });
  }
});

// Get leads with filters
app.get('/api/leads', auth, async (req: any, res) => {
  try {
    const { status, campaignId, from, to, page = 1, limit = 20 } = req.query;
    
    let where: any = {};
    
    // Role-based filtering
    if (req.user.role === 'Agent') {
      where.agentId = req.user.userId;
    } else if (req.user.role === 'TeamLeader' && req.user.teamId) {
      where.teamId = req.user.teamId;
    } else if (req.user.role === 'QualityControl') {
      // QC can see all pending leads by default
      if (!status) {
        where.status = 'Pending';
      }
    }
    // Manager can see all leads
    
    if (campaignId) where.campaignId = campaignId;
    if (status) where.status = status;

    // Date filtering
    if (from) {
      where.createdAt = {
        gte: new Date(from)
      };
    }
    if (to) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(to)
      };
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          campaign: true,
          agent: { select: { fullName: true } },
          team: true,
          qcAgent: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.lead.count({ where })
    ]);

    console.log(`Returning ${leads.length} leads for user ${req.user.userId} with role ${req.user.role}`);
    
    res.json({ leads, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to get leads' });
  }
});

// Get single lead
app.get('/api/leads/:id', auth, async (req: any, res) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: true,
        agent: { select: { fullName: true } },
        team: true,
        qcAgent: { select: { fullName: true } },
        auditTrails: {
          include: {
            user: { select: { fullName: true, role: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Authorization check
    if (req.user.role === 'Agent' && lead.agentId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to get lead' });
  }
});

// Update lead status
app.patch('/api/leads/:id/status', auth, async (req: any, res) => {
  try {
    // Allow QualityControl, Manager, and TeamLeader
    if (req.user.role !== 'QualityControl' && req.user.role !== 'Manager' && req.user.role !== 'TeamLeader') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { status, comment } = req.body;
    
    // Validate status
    const validStatuses = ['Pending', 'Qualified', 'Disqualified', 'Duplicate', 'Callback'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    console.log(`Updating lead ${req.params.id} to status: ${status} by user ${req.user.userId}`);

    // Get the lead first to know the agent and team
    const existingLead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        agent: true,
        team: true
      }
    });

    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Team Leader restrictions: can only change Callback → Pending
    if (req.user.role === 'TeamLeader') {
      if (existingLead.status !== 'Callback') {
        return res.status(403).json({ error: 'Team Leaders can only return Callback leads to Pending' });
      }
      if (status !== 'Pending') {
        return res.status(403).json({ error: 'Team Leaders can only change Callback leads to Pending' });
      }
      // Verify the lead belongs to the Team Leader's team
      const teamLeader = await prisma.user.findUnique({
        where: { id: req.user.userId }
      });
      if (teamLeader?.teamId !== existingLead.teamId) {
        return res.status(403).json({ error: 'Lead does not belong to your team' });
      }
    }

    // Prepare update data
    const updateData: any = {
      status,
      qcComment: comment,
      updatedAt: new Date()
    };

    // Set qcUserId based on role and status
    if (req.user.role === 'QualityControl' || req.user.role === 'Manager') {
      // QC and Manager set qcUserId when updating status
      updateData.qcUserId = req.user.userId;
    } else if (req.user.role === 'TeamLeader' && status === 'Pending') {
      // Team Leader returning to Pending should clear qcUserId
      updateData.qcUserId = null;
    }

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        campaign: true,
        agent: { select: { fullName: true, id: true } },
        team: true
      }
    });

    // Audit trail
    await prisma.leadAudit.create({
      data: {
        leadId: lead.id,
        userId: req.user.userId,
        action: 'StatusChange',
        payload: { from: existingLead.status, to: status, comment }
      }
    });

    console.log(`Lead ${lead.id} status updated from ${existingLead.status} to: ${status}`);

    // Real-time updates - emit to all relevant parties
    io.emit('lead_status_changed', lead);
    // Emit to the original agent
    if (lead.agent && lead.agent.id) {
      io.emit(`user_${lead.agent.id}_lead_updated`, lead);
    }
    // Emit dashboard updates
    io.emit('dashboard_update', { type: 'lead_status_changed', lead });
    // Emit to leaderboard listeners
    io.emit('leaderboard_update', { type: 'lead_qualified', lead });

    res.json(lead);
  } catch (error) {
    console.error('Update lead status error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Add note to lead
app.post('/api/leads/:id/notes', auth, async (req: any, res) => {
  try {
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Note content is required' });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const note = await prisma.leadNote.create({
      data: {
        leadId: req.params.id,
        userId: req.user.userId,
        content: content.trim()
      },
      include: {
        user: { select: { fullName: true, role: true } }
      }
    });

    // Emit real-time update
    io.emit(`lead_${req.params.id}_note_added`, note);

    res.status(201).json(note);
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// DASHBOARD ROUTES
app.get('/api/dashboard/stats', auth, async (req: any, res) => {
  try {
    let where: any = {};
    
    if (req.user.role === 'Agent') {
      where.agentId = req.user.userId;
    } else if (req.user.role === 'TeamLeader' && req.user.teamId) {
      where.teamId = req.user.teamId;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysLeads = await prisma.lead.count({
      where: { ...where, createdAt: { gte: today } }
    });

    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { _all: true }
    });

    const stats: any = {
      total: 0,
      qualified: 0,
      disqualified: 0,
      duplicate: 0,
      pending: 0,
      callback: 0,
      todaysLeads
    };

    leadsByStatus.forEach(item => {
      stats.total += item._count._all;
      stats[item.status.toLowerCase()] = item._count._all;
    });

    console.log(`Dashboard stats for user ${req.user.userId}:`, stats);
    
    res.json(stats);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// LEADERBOARD ROUTES
app.get('/api/leaderboard/agents', auth, async (req: any, res) => {
  try {
    const { timeRange = 'monthly' } = req.query;
    
    const startDate = new Date();
    if (timeRange === 'monthly') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }

    const agentStats = await prisma.user.findMany({
      where: {
        role: 'Agent',
        isActive: true
      },
      include: {
        team: {
          select: { name: true }
        },
        leads: {
          where: {
            createdAt: {
              gte: startDate
            }
          },
          select: {
            status: true
          }
        }
      }
    });

    const leaderboardData = agentStats.map(agent => {
      const leads = agent.leads;
      const total = leads.length;
      const qualified = leads.filter(lead => lead.status === 'Qualified').length;
      const disqualified = leads.filter(lead => lead.status === 'Disqualified').length;
      const duplicate = leads.filter(lead => lead.status === 'Duplicate').length;
      const qualifiedPercent = total > 0 ? Math.round((qualified / total) * 100) : 0;

      return {
        id: agent.id,
        fullName: agent.fullName,
        team: agent.team || { name: 'No Team' },
        total,
        qualified,
        disqualified,
        duplicate,
        qualifiedPercent
      };
    });

    const sortedAgents = leaderboardData
      .filter(agent => agent.total > 0) // Only show agents with leads
      .sort((a, b) => b.qualified - a.qualified)
      .slice(0, 10);

    console.log(`Leaderboard: Returning ${sortedAgents.length} agents`);
    
    res.json(sortedAgents);
  } catch (error) {
    console.error('Leaderboard agents error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard data' });
  }
});

app.get('/api/leaderboard/teams', auth, async (req: any, res) => {
  try {
    const { timeRange = 'monthly' } = req.query;
    
    const startDate = new Date();
    if (timeRange === 'monthly') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      startDate.setDate(startDate.getDate() - 7);
    }

    const teamStats = await prisma.team.findMany({
      include: {
        _count: {
          select: {
            users: {
              where: {
                role: 'Agent',
                isActive: true
              }
            }
          }
        },
        leads: {
          where: {
            createdAt: {
              gte: startDate
            }
          },
          select: {
            status: true
          }
        }
      }
    });

    const leaderboardData = teamStats.map(team => {
      const leads = team.leads;
      const total = leads.length;
      const qualified = leads.filter(lead => lead.status === 'Qualified').length;
      const disqualified = leads.filter(lead => lead.status === 'Disqualified').length;
      const duplicate = leads.filter(lead => lead.status === 'Duplicate').length;
      const qualifiedPercent = total > 0 ? Math.round((qualified / total) * 100) : 0;

      return {
        id: team.id,
        name: team.name,
        total,
        qualified,
        disqualified,
        duplicate,
        qualifiedPercent,
        agentCount: team._count.users
      };
    });

    const sortedTeams = leaderboardData
      .filter(team => team.total > 0) // Only show teams with leads
      .sort((a, b) => b.qualified - a.qualified);

    console.log(`Leaderboard: Returning ${sortedTeams.length} teams`);
    
    res.json(sortedTeams);
  } catch (error) {
    console.error('Leaderboard teams error:', error);
    res.status(500).json({ error: 'Failed to load team leaderboard data' });
  }
});

// USER MANAGEMENT ROUTES
app.get('/api/users', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

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
            qcLeads: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

app.post('/api/users', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { username, email, password, role, fullName, teamId } = req.body;

    if (!username || !email || !password || !role || !fullName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role,
        fullName,
        teamId: teamId || null,
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

    if (role === 'TeamLeader' && teamId) {
      await prisma.team.update({
        where: { id: teamId },
        data: { teamLeaderUserId: user.id }
      });
    }

    res.status(201).json({
      ...user,
      passwordHash: undefined
    });
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/users/:id', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { username, email, role, fullName, teamId, isActive } = req.body;
    const userId = req.params.id;

    if (isActive) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            {
              OR: [
                { username },
                { email }
              ]
            },
            { id: { not: userId } },
            { isActive: true }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
    }

    const updateData: any = {
      username,
      email,
      role,
      fullName,
      teamId: teamId || null,
      isActive
    };

    if (role === 'TeamLeader' && teamId) {
      await prisma.team.updateMany({
        where: { teamLeaderUserId: userId },
        data: { teamLeaderUserId: null }
      });
      
      await prisma.team.update({
        where: { id: teamId },
        data: { teamLeaderUserId: userId }
      });
    } else if (role !== 'TeamLeader') {
      await prisma.team.updateMany({
        where: { teamLeaderUserId: userId },
        data: { teamLeaderUserId: null }
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
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

    res.json({
      ...user,
      passwordHash: undefined
    });
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/api/users/:id/reset-password', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { newPassword } = req.body;
    const userId = req.params.id;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.delete('/api/users/:id', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const userId = req.params.id;

    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: { 
            leads: true,
            qcLeads: true,
            managedCampaigns: true,
            managedTeam: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User deletion - counts:', {
      leads: user._count.leads,
      qcLeads: user._count.qcLeads,
      campaigns: user._count.managedCampaigns,
      managedTeam: user._count.managedTeam
    });

    // Handle user's leads (as agent)
    if (user._count.leads > 0) {
      console.log('Disconnecting user from leads as agent...');
      await prisma.lead.updateMany({
        where: { agentId: userId },
        data: { agentId: null }
      });
    }

    // Handle user's QC leads
    if (user._count.qcLeads > 0) {
      console.log('Disconnecting user from QC leads...');
      await prisma.lead.updateMany({
        where: { qcUserId: userId },
        data: { qcUserId: null }
      });
    }

    // Handle managed campaigns
    if (user._count.managedCampaigns > 0) {
      console.log('Deleting user\'s managed campaigns...');
      await prisma.campaign.deleteMany({
        where: { managerId: userId }
      });
    }

    // Handle managed team
    if (user._count.managedTeam > 0) {
      console.log('Removing user as team leader...');
      await prisma.team.updateMany({
        where: { teamLeaderUserId: userId },
        data: { teamLeaderUserId: null }
      });
    }

    // Delete the user
    console.log('Deleting user...');
    await prisma.user.delete({
      where: { id: userId }
    });

    res.json({ 
      message: `User "${user.fullName}" deleted successfully`,
      leadsAffected: user._count.leads + user._count.qcLeads,
      campaignsDeleted: user._count.managedCampaigns,
      leadsAction: 'disassociated_from_user'
    });
  } catch (error: any) {
    console.error('=== USER DELETION ERROR ===');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(500).json({ error: 'Failed to delete user: ' + error.message });
  }
});

// TEAM ROUTES
app.get('/api/teams', auth, async (req: any, res) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        teamLeader: {
          select: { 
            id: true, 
            fullName: true,
            username: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to get teams' });
  }
});

app.post('/api/teams', auth, async (req: any, res) => {
  try {
    if (req.user.role !== 'Manager') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { name, teamLeaderUserId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        teamLeaderUserId: teamLeaderUserId || null
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

    res.status(201).json(team);
  } catch (error) {
    console.error('Team creation error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Production Server running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
  console.log(`🔑 API Ready for work!`);
  console.log(`📊 All endpoints use consistent /api/ prefix`);
  console.log(`   POST /api/auth/login`);
  console.log(`   GET  /api/auth/me`);
  console.log(`   GET  /api/campaigns`);
  console.log(`   POST /api/campaigns`);
  console.log(`   GET  /api/leads`);
  console.log(`   POST /api/leads`);
  console.log(`   PATCH /api/leads/:id/status`);
  console.log(`   GET  /api/dashboard/stats`);
  console.log(`   GET  /api/leaderboard/agents`);
  console.log(`   GET  /api/leaderboard/teams`);
  console.log(`   GET  /api/users`);
  console.log(`   POST /api/users`);
  console.log(`   GET  /api/teams`);
});