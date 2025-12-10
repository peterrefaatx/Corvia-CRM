import express from 'express';
import { body, validationResult, param, query } from 'express-validator';
import { LeadStatus, UserRole } from '@prisma/client';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { generateSerialNumber } from '../utils/serialNumber';
import { io } from '../app';
import prisma from '../lib/prisma';
import { getCurrentMonthBounds } from '../utils/monthPeriod';
import { getWorkDayBounds } from '../utils/workDay';
import { normalizePhone, normalizeAddress } from '../utils/phoneNormalizer';

const router = express.Router();

// Check for duplicate phone or address
router.get('/check-duplicate', [
  auth,
  query('phone').optional(),
  query('address').optional()
], async (req: any, res: any) => {
  try {
    const { phone, address } = req.query;
    
    if (!phone && !address) {
      return res.json({ isDuplicate: false, matches: [] });
    }

    const matches: any[] = [];
    const matchedIds = new Set<string>();

    // Check phone duplicates - OPTIMIZED: Only fetch recent leads (last 2 years)
    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone) {
        // Fetch only leads from last 2 years for performance
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        
        const recentLeads = await prisma.lead.findMany({
          where: {
            createdAt: {
              gte: twoYearsAgo
            }
          },
          select: {
            id: true,
            serialNumber: true,
            phone: true,
            status: true,
            createdAt: true,
            homeownerFirst: true,
            homeownerLast: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1000 // Limit to most recent 1000 leads
        });

        // Filter by normalized phone
        const phoneMatches = recentLeads.filter(lead => 
          normalizePhone(lead.phone) === normalizedPhone
        );

        phoneMatches.forEach(lead => {
          matchedIds.add(lead.id);
          matches.push({
            id: lead.id,
            serialNumber: lead.serialNumber,
            status: lead.status,
            createdAt: lead.createdAt,
            matchType: 'phone',
            homeownerName: `${lead.homeownerFirst} ${lead.homeownerLast}`
          });
        });
      }
    }

    // Check address duplicates - OPTIMIZED: Only fetch recent leads
    // Skip if address is N/A (used for custom campaigns without address field)
    if (address && address.trim().toLowerCase() !== 'n/a') {
      const normalizedAddress = normalizeAddress(address);
      if (normalizedAddress) {
        // Fetch only leads from last 2 years for performance
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        
        const recentLeads = await prisma.lead.findMany({
          where: {
            createdAt: {
              gte: twoYearsAgo
            }
          },
          select: {
            id: true,
            serialNumber: true,
            addressText: true,
            status: true,
            createdAt: true,
            homeownerFirst: true,
            homeownerLast: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1000 // Limit to most recent 1000 leads
        });

        // Filter by normalized address, excluding N/A addresses
        const addressMatches = recentLeads.filter(lead => {
          const leadAddress = lead.addressText.trim().toLowerCase();
          return leadAddress !== 'n/a' && 
                 normalizeAddress(lead.addressText) === normalizedAddress;
        });

        addressMatches.forEach(lead => {
          // Check if already added by phone match
          if (!matchedIds.has(lead.id)) {
            matchedIds.add(lead.id);
            matches.push({
              id: lead.id,
              serialNumber: lead.serialNumber,
              status: lead.status,
              createdAt: lead.createdAt,
              matchType: 'address',
              homeownerName: `${lead.homeownerFirst} ${lead.homeownerLast}`
            });
          }
        });
      }
    }

    res.json({
      isDuplicate: matches.length > 0,
      matches: matches.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    });
  } catch (error) {
    console.error('Check duplicate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create lead (Agent and SeniorAgent)
router.post('/', [
  auth,
  requireRole([UserRole.Agent, UserRole.SeniorAgent]),
  body('campaignId').notEmpty().withMessage('Campaign is required'),
  body('homeownerFirst').notEmpty().withMessage('First name is required'),
  body('homeownerLast').notEmpty().withMessage('Last name is required'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('bedrooms').isInt({ min: 0 }).withMessage('Valid bedrooms count required'),
  body('bathrooms').isInt({ min: 0 }).withMessage('Valid bathrooms count required'),
  body('marketValue').isFloat({ min: 0 }).withMessage('Valid market value required'),
  body('askingPrice').optional().isFloat({ min: 0 }),
  body('listingStatus').optional().isIn(['ListedByOwner', 'ListedByRealtor', 'NotListed']),
  body('occupancy').optional().isIn(['OwnerOccupied', 'RentedMTM', 'RentedAnnually', 'Vacant']),
  body('mortgageYesNo').optional().isBoolean(),
  body('mortgageAmount').optional().isFloat({ min: 0 }),
  body('closingTimeline').optional().isIn(['Asap', 'Anytime', 'ThirtyDays', 'SixtyDays', 'NinetyDays', 'SixMonths']),
  body('addressText').notEmpty().withMessage('Address is required'),
  body('motivationRating').isInt({ min: 1, max: 10 }).withMessage('Motivation rating must be 1-10'),
  body('conditionRating').isInt({ min: 1, max: 10 }).withMessage('Condition rating must be 1-10'),
  body('submitCheckboxFlag').custom((value) => {
    if (value === true || value === 'true') return true;
    throw new Error('Submit checkbox must be checked');
  })
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { team: true }
    });

    if (!user || !user.teamId) {
      return res.status(400).json({ error: 'Agent must be assigned to a team' });
    }

    const serialNumber = await generateSerialNumber();

    // Get campaign to check for assigned QC agent
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.body.campaignId },
      include: {
        qcAgents: {
          take: 1,
          select: { qcUserId: true }
        }
      }
    });

    // Auto-assign QC agent from campaign if available
    const qcUserId = campaign?.qcAgents?.[0]?.qcUserId || null;

    // Check if custom fields contain an address field
    let addressForDuplicateCheck = req.body.addressText;
    if (req.body.customFields && campaign?.formTemplateId) {
      // Fetch the template to find address field
      const template = await prisma.formTemplate.findUnique({
        where: { id: campaign.formTemplateId }
      });
      
      if (template && template.fields) {
        const fields = template.fields as any[];
        const addressField = fields.find((f: any) => f.fieldType === 'address');
        if (addressField && req.body.customFields[addressField.id]) {
          addressForDuplicateCheck = req.body.customFields[addressField.id];
        }
      }
    }

    // Extract only the fields that exist in the Lead model
    const leadData = {
      campaignId: req.body.campaignId,
      homeownerFirst: req.body.homeownerFirst,
      homeownerLast: req.body.homeownerLast,
      phone: req.body.phone,
      email: req.body.email || null,
      bedrooms: parseInt(req.body.bedrooms) || 0,
      bathrooms: parseInt(req.body.bathrooms) || 0,
      marketValue: parseFloat(req.body.marketValue) || 0,
      askingPrice: req.body.askingPrice ? parseFloat(req.body.askingPrice) : null,
      negotiable: req.body.negotiable || null,
      license: req.body.license || null,
      propertyType: req.body.propertyType || null,
      sellingReason: req.body.sellingReason || null,
      ownershipTimelineValue: req.body.ownershipTimelineValue ? parseInt(req.body.ownershipTimelineValue) : null,
      ownershipTimelineUnit: req.body.ownershipTimelineUnit || null,
      listingStatus: req.body.listingStatus,
      occupancy: req.body.occupancy,
      mortgageYesNo: req.body.mortgageYesNo === true || req.body.mortgageYesNo === 'true',
      mortgageAmount: req.body.mortgageAmount ? parseFloat(req.body.mortgageAmount) : null,
      closingTimeline: req.body.closingTimeline,
      addressText: addressForDuplicateCheck,
      motivationRating: parseInt(req.body.motivationRating),
      conditionRating: parseInt(req.body.conditionRating),
      additionalInfo: req.body.additionalInfo || null,
      customFields: req.body.customFields || null,
      submitCheckboxFlag: true,
      serialNumber,
      agentId: req.user.userId,
      teamId: user.teamId,
      qcUserId,
      status: LeadStatus.Pending
    };

    const lead = await prisma.lead.create({
      data: leadData,
      include: {
        campaign: true,
        agent: { select: { fullName: true, team: true } },
        team: true
      }
    });

    // Create audit trail
    await prisma.leadAudit.create({
      data: {
        leadId: lead.id,
        userId: req.user.userId,
        action: 'Create',
        payload: { ...req.body, serialNumber }
      }
    });

    // Emit real-time update
    io.emit('lead_created', lead);
    io.emit(`team_${user.teamId}_lead_created`, lead);

    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leads with filters
router.get('/', auth, async (req: any, res: any) => {
  try {
    const {
      agentId,
      teamId,
      status,
      campaignId,
      from,
      to,
      page = 1,
      limit = 20
    } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Role-based filtering
    let where: any = {};

    if (user.role === 'Agent' || user.role === 'SeniorAgent') {
      where.agentId = req.user.userId;
    } else if (user.role === 'TeamLeader' && user.teamId) {
      where.teamId = user.teamId;
    } else if (user.role === 'AccountManager') {
      // Account Managers only see leads from teams they manage (through their Team Leaders)
      const managedTeamLeaders = await prisma.user.findMany({
        where: {
          accountManagerId: req.user.userId,
          role: 'TeamLeader',
          isActive: true
        },
        select: { teamId: true }
      });
      
      const managedTeamIds = managedTeamLeaders
        .map(tl => tl.teamId)
        .filter((id): id is string => id !== null);
      
      if (managedTeamIds.length > 0) {
        where.teamId = { in: managedTeamIds };
      } else {
        // Account Manager has no assigned teams, return empty result
        where.id = 'no-teams-assigned';
      }
    } else if (user.role === 'Client') {
      where.status = { in: ['Qualified', 'Callback'] };
    } else if (user.role === 'QualityControl') {
      // QC agents only see leads from campaigns assigned to them
      const assignedCampaigns = await prisma.campaignQC.findMany({
        where: { qcUserId: req.user.userId },
        select: { campaignId: true }
      });
      
      if (assignedCampaigns.length > 0) {
        where.campaignId = {
          in: assignedCampaigns.map(c => c.campaignId)
        };
      } else {
        // QC agent has no assigned campaigns, return empty result
        where.id = 'no-campaigns-assigned';
      }
    }
    // Manager role has no restrictions - sees all leads

    // Apply filters
    if (agentId && (user.role === UserRole.Manager || user.role === UserRole.QualityControl || user.role === UserRole.AccountManager)) {
      where.agentId = agentId;
    }
    if (teamId && (user.role === UserRole.Manager || user.role === UserRole.QualityControl || user.role === UserRole.AccountManager)) {
      // For Account Managers, ensure they can only filter by teams they manage
      if (user.role === UserRole.AccountManager) {
        const managedTeamLeaders = await prisma.user.findMany({
          where: {
            accountManagerId: req.user.userId,
            role: UserRole.TeamLeader,
            isActive: true
          },
          select: { teamId: true }
        });
        
        const managedTeamIds = managedTeamLeaders
          .map(tl => tl.teamId)
          .filter((id): id is string => id !== null);
        
        if (managedTeamIds.includes(teamId)) {
          where.teamId = teamId;
        }
      } else {
        where.teamId = teamId;
      }
    }
    if (status) {
      where.status = status;
    }
    if (campaignId) {
      where.campaignId = campaignId;
    }
    
    // Date filtering: if specific dates provided, use them; otherwise show today + persistent statuses
    if (from || to) {
      where.createdAt = {};
      if (from) {
        const fromDate = new Date(from);
        // Ensure we're using the start of the range
        where.createdAt.gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        // Use less than (not less than or equal) for exclusive end
        where.createdAt.lt = toDate;
      }
    } else {
      // No date filter specified - show TODAY's leads (4 AM to 4 AM) + old Pending/Callback
      // Pending and Callback leads persist until qualified/disqualified
      // Other statuses (Qualified, Disqualified, Duplicate) only show if from TODAY
      const todayBounds = getWorkDayBounds();
      
      if (status) {
        // Specific status filter provided
        if (!['Pending', 'Callback'].includes(status)) {
          // For Qualified/Disqualified/Duplicate, apply today's filter
          where.createdAt = {
            gte: todayBounds.start,
            lt: todayBounds.end
          };
        }
        // For Pending/Callback, no date filter (show all historical)
      } else {
        // No status filter - need to show mixed results
        // Use OR condition: (Pending/Callback from any time) OR (other statuses from TODAY)
        where.OR = [
          {
            status: { in: ['Pending', 'Callback'] }
            // No date filter for Pending/Callback - they persist until resolved
          },
          {
            status: { in: ['Qualified', 'Disqualified', 'Duplicate'] },
            createdAt: {
              gte: todayBounds.start,
              lt: todayBounds.end
            }
          }
        ];
      }
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              formTemplateId: true
            }
          },
          agent: { select: { fullName: true, team: true } },
          team: true,
          qcAgent: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.lead.count({ where })
    ]);

    // Check for duplicate phone numbers across ALL leads in the database
    const phoneNumbers = leads.map(lead => lead.phone);
    const normalizedPhones = phoneNumbers.map(phone => normalizePhone(phone));
    
    // Find all leads with matching phone numbers
    const duplicateLeads = await prisma.lead.findMany({
      where: {
        phone: {
          in: phoneNumbers
        }
      },
      select: {
        id: true,
        phone: true
      }
    });

    // Create a map of phone numbers that have duplicates
    const phoneCountMap = new Map<string, number>();
    duplicateLeads.forEach(lead => {
      const normalized = normalizePhone(lead.phone);
      phoneCountMap.set(normalized, (phoneCountMap.get(normalized) || 0) + 1);
    });

    // Add isDuplicate flag to each lead
    const leadsWithDuplicateFlag = leads.map(lead => ({
      ...lead,
      isDuplicate: (phoneCountMap.get(normalizePhone(lead.phone)) || 0) > 1
    }));

    res.json({
      leads: leadsWithDuplicateFlag,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single lead
router.get('/:id', [
  auth,
  param('id').notEmpty()
], async (req: any, res: any) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        campaign: true,
        agent: { select: { fullName: true, team: true } },
        team: true,
        qcAgent: { select: { fullName: true } },
        auditTrails: {
          include: {
            user: { select: { fullName: true, role: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        notes: {
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if ((user?.role === UserRole.Agent || user?.role === UserRole.SeniorAgent) && lead.agentId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (user?.role === UserRole.TeamLeader && lead.teamId !== user.teamId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (user?.role === UserRole.AccountManager) {
      // Check if lead belongs to a team managed by this Account Manager
      const managedTeamLeaders = await prisma.user.findMany({
        where: {
          accountManagerId: req.user.userId,
          role: UserRole.TeamLeader,
          isActive: true
        },
        select: { teamId: true }
      });
      
      const managedTeamIds = managedTeamLeaders
        .map(tl => tl.teamId)
        .filter((id): id is string => id !== null);
      
      if (!lead.teamId || !managedTeamIds.includes(lead.teamId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update lead status (QC, Manager, Team Leader, Account Manager)
router.patch('/:id/status', [
  auth,
  requireRole([UserRole.QualityControl, UserRole.Manager, UserRole.TeamLeader, UserRole.AccountManager]),
  param('id').notEmpty(),
  body('status').isIn(['Pending', 'Qualified', 'Disqualified', 'Duplicate', 'Callback']).withMessage('Invalid status')
], async (req: any, res: any) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { status, comment, overrideQualified, overrideReason } = req.body;

    // Prepare update data
    const updateData: any = {
      status: status as LeadStatus,
      qcUserId: req.user.userId,
      qcComment: comment || null
    };

    // Clear call recording when returning to Pending
    // This ensures fresh recordings on re-qualification
    if (status === 'Pending') {
      updateData.callRecordingUrl = null;
    }

    // Handle override fields
    if (overrideQualified === true) {
      // Setting override qualified (only when explicitly true)
      updateData.overrideQualified = true;
      updateData.overrideReason = overrideReason || null;
    } else {
      // For any other status change, clear the override flags
      // This prevents duplicate leads in client dashboard
      updateData.overrideQualified = false;
      updateData.overrideReason = null;
    }

    // Update lead status
    const updatedLead = await prisma.lead.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        campaign: true,
        agent: { select: { fullName: true, team: true } },
        team: true,
        qcAgent: { select: { fullName: true } }
      }
    });

    // Create audit trail
    await prisma.leadAudit.create({
      data: {
        leadId: req.params.id,
        userId: req.user.userId,
        action: 'Update',
        payload: { 
          status, 
          comment, 
          previousStatus: lead.status,
          overrideQualified: updateData.overrideQualified,
          overrideReason: updateData.overrideReason,
          previousOverride: (lead as any).overrideQualified || false
        }
      }
    });

    // Emit real-time update
    io.emit('lead_status_updated', updatedLead);
    io.emit(`lead_${req.params.id}_status_updated`, updatedLead);
    if (lead.teamId) {
      io.emit(`team_${lead.teamId}_lead_updated`, updatedLead);
    }

    res.json(updatedLead);
  } catch (error) {
    console.error('Update lead status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add note to lead
router.post('/:id/notes', [
  auth,
  param('id').notEmpty(),
  body('content').notEmpty().withMessage('Note content is required')
], async (req: any, res: any) => {
  try {
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
        content: req.body.content
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as leadRoutes };