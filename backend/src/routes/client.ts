import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, requireRole, AuthRequest } from '../middleware/auth';
import { executePipelineAutomation } from './automationRules';

const router = express.Router();
const prisma = new PrismaClient();

// Get pipeline stages
router.get('/pipeline-stages', auth, requireRole(['Client']), async (req, res) => {
  try {
    const stages = await prisma.pipelineStage.findMany({
      where: { isActive: true }, // Only return active stages
      include: {
        position: true // Include position data for filtering team members
      },
      orderBy: { order: 'asc' }
    });
    res.json(stages);
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline stages' });
  }
});

// Get lead activity history
router.get('/leads/:id/activity', auth, requireRole(['Client']), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const leadId = req.params.id;

    // Verify lead belongs to client
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId: userId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Fetch activity logs for this lead
    const activities = await prisma.activityLog.findMany({
      where: {
        entityType: 'lead',
        entityId: leadId
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(activities);
  } catch (error) {
    console.error('Error fetching lead activity:', error);
    res.status(500).json({ error: 'Failed to fetch lead activity' });
  }
});

// Get campaigns for client or team member with view_all permission
router.get('/campaigns', auth, requireRole(['Client', 'TeamMember']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }
    
    const campaigns = await prisma.campaign.findMany({
      where: { clientId },
      include: {
        leads: {
          where: { status: 'Qualified' }
        }
      }
    });

    const campaignStats = campaigns.map(campaign => {
      const qualified = campaign.leads.length;
      const hot = campaign.leads.filter(l => l.temperature === 'Hot').length;
      const warm = campaign.leads.filter(l => l.temperature === 'Warm').length;
      const cold = campaign.leads.filter(l => l.temperature === 'Cold').length;
      const noAskingPrice = campaign.leads.filter(l => l.temperature === 'NoAskingPrice').length;
      
      return {
        id: campaign.id,
        name: campaign.name,
        leadsTarget: campaign.leadsTarget || 0,
        achieved: qualified,
        hot,
        warm,
        cold,
        noAskingPrice,
        progress: campaign.leadsTarget ? (qualified / campaign.leadsTarget) * 100 : 0
      };
    });

    res.json(campaignStats);
  } catch (error) {
    console.error('Error fetching client campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Get daily performance data
router.get('/daily-performance', auth, requireRole(['Client']), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query;

    // Get all campaigns for this client
    const campaigns = await prisma.campaign.findMany({
      where: { clientId: userId },
      select: { id: true, leadsTarget: true }
    });

    const totalDailyTarget = campaigns.reduce((sum, c) => sum + (c.leadsTarget || 0), 0);
    const campaignIds = campaigns.map(c => c.id);

    // Get date range (default to last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get qualified leads grouped by date
    const leads = await prisma.lead.findMany({
      where: {
        campaignId: { in: campaignIds },
        status: 'Qualified',
        createdAt: {
          gte: start,
          lte: end
        }
      },
      select: {
        createdAt: true
      }
    });

    // Group by date
    const dailyData: { [key: string]: number } = {};
    leads.forEach(lead => {
      const date = lead.createdAt.toISOString().split('T')[0];
      dailyData[date] = (dailyData[date] || 0) + 1;
    });

    // Create array of daily performance
    const performanceData = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      performanceData.push({
        date: dateStr,
        achieved: dailyData[dateStr] || 0,
        target: totalDailyTarget
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(performanceData);
  } catch (error) {
    console.error('Error fetching daily performance:', error);
    res.status(500).json({ error: 'Failed to fetch daily performance' });
  }
});

// Get agent performance analytics for client's campaigns
router.get('/agent-analytics', auth, requireRole(['Client']), async (req, res) => {
  try {
    const userId = req.user!.userId;
    
    // Get all campaigns for this client
    const campaigns = await prisma.campaign.findMany({
      where: { clientId: userId },
      select: { id: true, name: true }
    });

    const campaignIds = campaigns.map(c => c.id);

    // Get leads with agent information
    const leads = await prisma.lead.findMany({
      where: {
        campaignId: { in: campaignIds },
        status: 'Qualified'
      },
      include: {
        agent: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        campaign: {
          select: {
            name: true
          }
        }
      }
    });

    // Aggregate agent performance
    const agentStats: any = {};
    
    leads.forEach(lead => {
      if (!lead.agent) return;
      
      const agentId = lead.agent.id;
      if (!agentStats[agentId]) {
        agentStats[agentId] = {
          agentId,
          agentName: lead.agent.fullName,
          totalLeads: 0,
          hot: 0,
          warm: 0,
          cold: 0,
          campaigns: new Set()
        };
      }
      
      agentStats[agentId].totalLeads++;
      agentStats[agentId].campaigns.add(lead.campaign.name);
      
      if (lead.temperature === 'Hot') agentStats[agentId].hot++;
      else if (lead.temperature === 'Warm') agentStats[agentId].warm++;
      else if (lead.temperature === 'Cold') agentStats[agentId].cold++;
    });

    // Convert to array and format
    const agentPerformance = Object.values(agentStats).map((agent: any) => ({
      agentId: agent.agentId,
      agentName: agent.agentName,
      totalLeads: agent.totalLeads,
      hot: agent.hot,
      warm: agent.warm,
      cold: agent.cold,
      campaigns: Array.from(agent.campaigns)
    }));

    // Sort by total leads descending
    agentPerformance.sort((a: any, b: any) => b.totalLeads - a.totalLeads);

    res.json(agentPerformance);
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    res.status(500).json({ error: 'Failed to fetch agent analytics' });
  }
});

// Get qualified leads for client or team member with view_all permission
router.get('/leads', auth, requireRole(['Client', 'TeamMember']), async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    
    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }
    
    const leads = await prisma.lead.findMany({
      where: {
        campaign: { clientId },
        status: 'Qualified'
      },
      include: {
        campaign: true,
        clientNotes: {
          where: { clientId: userId },
          orderBy: { createdAt: 'desc' }
        },
        stageQualities: {
          orderBy: { ratedAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedLeads = leads.map(lead => ({
      id: lead.id,
      serialNumber: lead.serialNumber,
      homeownerFirst: lead.homeownerFirst,
      homeownerLast: lead.homeownerLast,
      phone: lead.phone,
      email: lead.email,
      addressText: lead.addressText,
      marketValue: lead.marketValue,
      askingPrice: lead.askingPrice,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      motivationRating: lead.motivationRating,
      conditionRating: lead.conditionRating,
      temperature: lead.temperature,
      campaign: {
        name: lead.campaign.name,
        formTemplateId: lead.campaign.formTemplateId
      },
      campaignName: lead.campaign.name,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      callRecordingUrl: lead.callRecordingUrl,
      starred: lead.starred,
      clientReviewed: lead.clientReviewed,
      pipelineStage: lead.pipelineStage,
      negotiable: lead.negotiable,
      license: lead.license,
      propertyType: lead.propertyType,
      sellingReason: lead.sellingReason,
      ownershipTimelineValue: lead.ownershipTimelineValue,
      ownershipTimelineUnit: lead.ownershipTimelineUnit,
      listingStatus: lead.listingStatus,
      occupancy: lead.occupancy,
      mortgageYesNo: lead.mortgageYesNo,
      mortgageAmount: lead.mortgageAmount,
      closingTimeline: lead.closingTimeline,
      additionalInfo: lead.additionalInfo,
      customFields: lead.customFields,
      clientNotes: lead.clientNotes,
      taskQualityIndicator: lead.taskQualityIndicator,
      taskQualityStage: lead.taskQualityStage,
      stageQualities: lead.stageQualities
    }));

    res.json(formattedLeads);
  } catch (error) {
    console.error('Error fetching client leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead by ID (accessible by Client or Team Members with tasks)
router.get('/leads/:leadId', auth, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const clientId = (req.user as any).clientId; // Team members have clientId in their token

    let lead;

    if (userRole === 'Client') {
      // Client can access any lead in their campaigns
      lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          campaign: { clientId: userId }
        },
        include: {
          campaign: {
            select: {
              name: true,
              formTemplateId: true,
              formTemplate: {
                select: {
                  id: true,
                  name: true,
                  fields: true
                }
              }
            }
          },
          agent: {
            select: {
              fullName: true,
              id: true
            }
          },
          stageQualities: {
            orderBy: {
              ratedAt: 'desc'
            }
          }
        }
      });
    } else if (userRole === 'TeamMember') {
      // Team members can access leads from their client's campaigns
      lead = await prisma.lead.findFirst({
        where: {
          id: leadId,
          campaign: { clientId }
        },
        include: {
          campaign: {
            select: {
              name: true,
              formTemplateId: true,
              formTemplate: {
                select: {
                  id: true,
                  name: true,
                  fields: true
                }
              }
            }
          },
          agent: {
            select: {
              fullName: true,
              id: true
            }
          },
          stageQualities: {
            orderBy: {
              ratedAt: 'desc'
            }
          }
        }
      });
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Toggle star on lead
router.patch('/leads/:leadId/star', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }

    // Verify lead belongs to client's campaign
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { starred: !lead.starred }
    });

    res.json({ starred: updatedLead.starred });
  } catch (error) {
    console.error('Error toggling star:', error);
    res.status(500).json({ error: 'Failed to toggle star' });
  }
});

// Get lead notes
router.get('/leads/:leadId/notes', auth, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const clientId = userRole === 'TeamMember' ? (req.user as any).clientId : userId;

    // Verify lead belongs to client's campaign
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const notes = await prisma.clientNote.findMany({
      where: {
        leadId,
        clientId
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Add client note
router.post('/leads/:leadId/notes', auth, requireRole(['Client']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { content, recordingUrl } = req.body;
    const userId = req.user!.userId;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Verify lead belongs to client's campaign
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: { clientId: userId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get client name
    const client = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true }
    });

    const note = await prisma.clientNote.create({
      data: {
        leadId,
        clientId: userId,
        content: content.trim(),
        recordingUrl: recordingUrl || null,
        authorName: client?.fullName || 'Client',
        authorType: 'client'
      }
    });

    res.json(note);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Update client note
router.put('/notes/:noteId', auth, requireRole(['Client']), async (req, res) => {
  try {
    const { noteId } = req.params;
    const { content, recordingUrl } = req.body;
    const userId = req.user!.userId;

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Note content is required' });
    }

    // Verify note belongs to client
    const note = await prisma.clientNote.findFirst({
      where: {
        id: noteId,
        clientId: userId
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const updatedNote = await prisma.clientNote.update({
      where: { id: noteId },
      data: { 
        content: content.trim(),
        recordingUrl: recordingUrl || null
      }
    });

    res.json(updatedNote);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete client note
router.delete('/notes/:noteId', auth, requireRole(['Client']), async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user!.userId;

    // Verify note belongs to client
    const note = await prisma.clientNote.findFirst({
      where: {
        id: noteId,
        clientId: userId
      }
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await prisma.clientNote.delete({
      where: { id: noteId }
    });

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// Mark lead as reviewed
router.patch('/leads/:leadId/review', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }

    // Verify the lead belongs to this client's campaign
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { 
        clientReviewed: true,
        pipelineStage: 'Attempting Contact',
        updatedAt: new Date()
      }
    });

    // Execute pipeline automation for the initial stage
    console.log(`[Review Lead] Executing automation for lead ${leadId}, stage: Attempting Contact, client: ${userId}`);
    await executePipelineAutomation(leadId, 'Attempting Contact', userId);
    console.log(`[Review Lead] Automation execution completed`);

    res.json(updatedLead);
  } catch (error) {
    console.error('Error marking lead as reviewed:', error);
    res.status(500).json({ error: 'Failed to mark lead as reviewed' });
  }
});

// Update lead pipeline stage
router.patch('/leads/:leadId/pipeline-stage', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const { stage } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }

    // Verify the lead belongs to this client's campaign
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId
        }
      },
      select: {
        id: true,
        pipelineStage: true
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get stage orders to prevent backward movement
    if (lead.pipelineStage) {
      const [currentStage, newStage] = await Promise.all([
        prisma.pipelineStage.findFirst({
          where: { name: lead.pipelineStage },
          select: { order: true }
        }),
        prisma.pipelineStage.findFirst({
          where: { name: stage },
          select: { order: true }
        })
      ]);

      // Prevent moving backwards in the pipeline
      if (currentStage && newStage && newStage.order < currentStage.order) {
        return res.status(400).json({ 
          error: 'Cannot move lead backwards in the pipeline. Leads can only progress forward.' 
        });
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: { 
        pipelineStage: stage,
        updatedAt: new Date(),
        // Clear quality rating when moving to new stage
        taskQualityIndicator: null,
        taskQualityStage: null
      }
    });

    // Execute pipeline automation
    await executePipelineAutomation(leadId, stage, userId);

    res.json(updatedLead);
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    res.status(500).json({ error: 'Failed to update pipeline stage' });
  }
});

// Create schedule for a lead
router.post('/leads/:leadId/schedules', auth, requireRole(['Client']), async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user!.userId;
    const { scheduledDate, type, notes } = req.body;

    // Verify lead belongs to client's campaign
    const lead = await prisma.lead.findFirst({
      where: { 
        id: leadId,
        campaign: { clientId: userId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const schedule = await prisma.clientSchedule.create({
      data: {
        leadId,
        clientId: userId,
        scheduledDate: new Date(scheduledDate),
        type,
        notes: notes || null,
        status: 'SCHEDULED'
      }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Get schedules for a lead
router.get('/leads/:leadId/schedules', auth, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const clientId = userRole === 'TeamMember' ? (req.user as any).clientId : userId;

    // Verify lead belongs to client's campaign
    const lead = await prisma.lead.findFirst({
      where: { 
        id: leadId,
        campaign: { clientId }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const schedules = await prisma.clientSchedule.findMany({
      where: { leadId },
      orderBy: { scheduledDate: 'asc' }
    });

    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Get all schedules for client
router.get('/schedules', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { status } = req.query;

    let clientId: string;
    let leadIds: string[] | undefined;

    if (userRole === 'TeamMember') {
      // Team member - get schedules for leads assigned to them
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId },
        select: { clientId: true }
      });
      
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      clientId = teamMember.clientId;
      
      // Get leads assigned to this team member
      const assignedLeads = await prisma.lead.findMany({
        where: {
          assignedUserId: userId,
          campaign: {
            clientId
          }
        },
        select: { id: true }
      });
      
      leadIds = assignedLeads.map(lead => lead.id);
      
      console.log(`[Schedules] Team member ${userId} has ${leadIds.length} assigned leads:`, leadIds);
      
      // If no leads assigned, return empty array
      if (leadIds.length === 0) {
        console.log(`[Schedules] No leads assigned to team member ${userId}, returning empty array`);
        return res.json([]);
      }
    } else {
      // Client - get all schedules
      clientId = userId;
    }

    const where: any = { clientId };
    if (leadIds) {
      where.leadId = { in: leadIds };
    }
    if (status) {
      where.status = status;
    }

    const schedules = await prisma.clientSchedule.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            serialNumber: true,
            homeownerFirst: true,
            homeownerLast: true,
            phone: true,
            addressText: true,
            pipelineStage: true
          }
        }
      },
      orderBy: { scheduledDate: 'asc' }
    });

    // Filter out schedules for closed/dead leads
    const activeSchedules = schedules.filter(schedule => 
      schedule.lead.pipelineStage !== 'Closed' && 
      schedule.lead.pipelineStage !== 'Dead'
    );

    res.json(activeSchedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Update schedule status
router.patch('/schedules/:scheduleId', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const { status, scheduledDate, notes } = req.body;

    let clientId: string;

    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId },
        select: { clientId: true }
      });
      
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      
      clientId = teamMember.clientId;
    } else {
      clientId = userId;
    }

    // Verify schedule belongs to client
    const existingSchedule = await prisma.clientSchedule.findFirst({
      where: { 
        id: scheduleId,
        clientId
      }
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // If team member, verify the schedule is for a lead assigned to them
    if (userRole === 'TeamMember') {
      const lead = await prisma.lead.findFirst({
        where: {
          id: existingSchedule.leadId,
          assignedUserId: userId
        }
      });

      if (!lead) {
        return res.status(403).json({ error: 'You can only update schedules for leads assigned to you' });
      }
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (scheduledDate) updateData.scheduledDate = new Date(scheduledDate);
    if (notes !== undefined) updateData.notes = notes;

    const updatedSchedule = await prisma.clientSchedule.update({
      where: { id: scheduleId },
      data: updateData
    });

    res.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Delete schedule
router.delete('/schedules/:scheduleId', auth, requireRole(['Client']), async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const userId = req.user!.userId;

    // Verify schedule belongs to client
    const existingSchedule = await prisma.clientSchedule.findFirst({
      where: { 
        id: scheduleId,
        clientId: userId
      }
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    await prisma.clientSchedule.delete({
      where: { id: scheduleId }
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Mark lead as Closed or Dead (archive)
router.patch('/leads/:id/archive', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const leadId = req.params.id;
    const { pipelineStage } = req.body;

    // Validate stage
    if (!['Closed', 'Dead'].includes(pipelineStage)) {
      return res.status(400).json({ error: 'Invalid pipeline stage. Must be "Closed" or "Dead"' });
    }

    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }

    // Get the lead and verify ownership
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId
        }
      },
      include: {
        campaign: true
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Update the lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStage,
        clientReviewed: true
      }
    });

    // Auto-complete all pending tasks for this lead when marked as Closed or Dead
    await prisma.task.updateMany({
      where: {
        leadId,
        status: 'pending'
      },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });

    console.log(`[Archive Lead] Auto-completed all pending tasks for lead ${leadId} (marked as ${pipelineStage})`);

    // Delete all schedules for this lead when marked as Closed or Dead
    const deletedSchedules = await prisma.clientSchedule.deleteMany({
      where: {
        leadId
      }
    });

    console.log(`[Archive Lead] Deleted ${deletedSchedules.count} schedules for lead ${leadId} (marked as ${pipelineStage})`);

    res.json(updatedLead);
  } catch (error) {
    console.error('Error archiving lead:', error);
    res.status(500).json({ error: 'Failed to archive lead' });
  }
});

// Re-assign lead to a stage (for rework)
router.post('/leads/:id/reassign-stage', auth, requireRole(['Client', 'TeamMember']), async (req, res) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const leadId = req.params.id;
    const { stage, assignToMemberId } = req.body;

    if (!stage) {
      return res.status(400).json({ error: 'Stage is required' });
    }

    // Prevent reassigning to Closed or Dead
    if (['Closed', 'Dead'].includes(stage)) {
      return res.status(400).json({ error: 'Cannot reassign to Closed or Dead stages' });
    }

    // Get clientId based on role
    let clientId = userId;
    if (userRole === 'TeamMember') {
      const teamMember = await prisma.clientTeamMember.findUnique({
        where: { id: userId }
      });
      if (!teamMember) {
        return res.status(404).json({ error: 'Team member not found' });
      }
      clientId = teamMember.clientId;
    }

    // Get the lead and verify ownership
    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        campaign: {
          clientId
        }
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Delete all pending tasks for this lead (since it's being reassigned for rework)
    await prisma.task.deleteMany({
      where: {
        leadId,
        status: 'pending'
      }
    });

    // Clear ALL quality ratings for this lead (complete reset)
    await prisma.leadStageQuality.deleteMany({
      where: {
        leadId
      }
    });

    // Clear ALL stage visit history to allow automation to run again for all stages
    await prisma.activityLog.deleteMany({
      where: {
        entityId: leadId,
        entityType: 'lead',
        actionType: 'pipeline_changed'
      }
    });

    // Update lead to new stage
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStage: stage,
        taskQualityIndicator: null,
        taskQualityStage: null,
        updatedAt: new Date()
      }
    });

    // Log the reassignment
    await prisma.activityLog.create({
      data: {
        clientId: userId,
        userId: null,
        userType: 'client',
        actionType: 'pipeline_changed',
        entityType: 'lead',
        entityId: leadId,
        description: `Lead reassigned to stage: ${stage}`,
        metadata: {
          stage,
          reassignment: true,
          assignToMemberId: assignToMemberId || null,
          timestamp: new Date().toISOString()
        }
      }
    });

    console.log(`[Reassign Lead] Lead ${leadId} reassigned to stage: ${stage}`);

    // Execute automation (will create tasks)
    await executePipelineAutomation(leadId, stage, userId);

    // If specific member requested, reassign the task
    if (assignToMemberId) {
      // Find the most recent task created for this lead and stage
      const recentTask = await prisma.task.findFirst({
        where: {
          leadId,
          lead: { pipelineStage: stage }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentTask) {
        await prisma.task.update({
          where: { id: recentTask.id },
          data: { assignedUserId: assignToMemberId }
        });
        console.log(`[Reassign Lead] Task reassigned to specific member: ${assignToMemberId}`);
      }
    }

    res.json(updatedLead);
  } catch (error) {
    console.error('Error reassigning lead:', error);
    res.status(500).json({ error: 'Failed to reassign lead' });
  }
});

// Toggle team member availability (for day-off management)
router.patch('/team-members/:memberId/availability', auth, requireRole(['Client']), async (req, res) => {
  try {
    const { memberId } = req.params;
    const { isAvailable } = req.body;
    const userId = req.user!.userId;

    // Verify the team member belongs to this client
    const teamMember = await prisma.clientTeamMember.findFirst({
      where: {
        id: memberId,
        clientId: userId
      }
    });

    if (!teamMember) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Update availability
    const updatedMember = await prisma.clientTeamMember.update({
      where: { id: memberId },
      data: { isAvailable }
    });

    console.log(`[Availability] Team member ${updatedMember.name} availability set to: ${isAvailable}`);

    res.json(updatedMember);
  } catch (error) {
    console.error('Error updating team member availability:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

export default router;
