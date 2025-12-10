import express from 'express';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { UserRole, LeadStatus } from '@prisma/client';
import prisma from '../lib/prisma';
import { getWorkDayBounds } from '../utils/workDay';
import { getCurrentMonthBounds } from '../utils/monthPeriod';
import { uploadRecording } from '../middleware/upload';

const router = express.Router();

// Get QC analytics
router.get('/analytics', [
  auth,
  requireRole([UserRole.QualityControl, UserRole.Manager])
], async (req: any, res: any) => {
  try {
    const qcUserId = req.user.userId;
    const isManager = req.user.role === UserRole.Manager;

    // Get assigned campaigns for this QC agent
    const assignedCampaigns = await prisma.campaignQC.findMany({
      where: { qcUserId },
      include: {
        campaign: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const campaignIds = assignedCampaigns.map(c => c.campaignId);

    // Base where clause for leads
    const baseWhere: any = isManager ? {} : {
      campaignId: { in: campaignIds }
    };

    // Get today's bounds (4 AM to 4 AM)
    const todayBounds = getWorkDayBounds();
    
    // Get month bounds
    const monthBounds = getCurrentMonthBounds();

    // Today's stats
    const [
      todayPending,
      todayReviewed,
      todayQualified,
      todayDisqualified,
      todayDuplicate,
      todayCallback,
      todayOverride
    ] = await Promise.all([
      prisma.lead.count({
        where: {
          ...baseWhere,
          status: LeadStatus.Pending
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: { in: [LeadStatus.Qualified, LeadStatus.Disqualified, LeadStatus.Duplicate, LeadStatus.Callback] },
          updatedAt: {
            gte: todayBounds.start,
            lt: todayBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Qualified,
          updatedAt: {
            gte: todayBounds.start,
            lt: todayBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Disqualified,
          overrideQualified: false,
          updatedAt: {
            gte: todayBounds.start,
            lt: todayBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Duplicate,
          updatedAt: {
            gte: todayBounds.start,
            lt: todayBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Callback,
          updatedAt: {
            gte: todayBounds.start,
            lt: todayBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          overrideQualified: true,
          updatedAt: {
            gte: todayBounds.start,
            lt: todayBounds.end
          }
        }
      })
    ]);

    // This month's stats
    const [
      monthPending,
      monthReviewed,
      monthQualified,
      monthDisqualified,
      monthDuplicate,
      monthCallback,
      monthOverride
    ] = await Promise.all([
      prisma.lead.count({
        where: {
          ...baseWhere,
          status: LeadStatus.Pending
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: { in: [LeadStatus.Qualified, LeadStatus.Disqualified, LeadStatus.Duplicate, LeadStatus.Callback] },
          updatedAt: {
            gte: monthBounds.start,
            lt: monthBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Qualified,
          updatedAt: {
            gte: monthBounds.start,
            lt: monthBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Disqualified,
          overrideQualified: false,
          updatedAt: {
            gte: monthBounds.start,
            lt: monthBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Duplicate,
          updatedAt: {
            gte: monthBounds.start,
            lt: monthBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          status: LeadStatus.Callback,
          updatedAt: {
            gte: monthBounds.start,
            lt: monthBounds.end
          }
        }
      }),
      prisma.lead.count({
        where: {
          ...baseWhere,
          qcUserId,
          overrideQualified: true,
          updatedAt: {
            gte: monthBounds.start,
            lt: monthBounds.end
          }
        }
      })
    ]);

    // Calculate quality metrics (this month)
    const totalReviewed = monthReviewed;
    const qualificationRate = totalReviewed > 0 
      ? Math.round((monthQualified / totalReviewed) * 100) 
      : 0;
    const overrideRate = totalReviewed > 0 
      ? Math.round((monthOverride / totalReviewed) * 100) 
      : 0;

    // Get campaign-specific stats
    const campaignStats = await Promise.all(
      assignedCampaigns.map(async (ac) => {
        const [pendingCount, reviewedToday] = await Promise.all([
          prisma.lead.count({
            where: {
              campaignId: ac.campaignId,
              status: LeadStatus.Pending
            }
          }),
          prisma.lead.count({
            where: {
              campaignId: ac.campaignId,
              qcUserId,
              status: { in: [LeadStatus.Qualified, LeadStatus.Disqualified, LeadStatus.Duplicate, LeadStatus.Callback] },
              updatedAt: {
                gte: todayBounds.start,
                lt: todayBounds.end
              }
            }
          })
        ]);

        return {
          id: ac.campaign.id,
          name: ac.campaign.name,
          pendingCount,
          reviewedToday
        };
      })
    );

    res.json({
      today: {
        pending: todayPending,
        reviewed: todayReviewed,
        qualified: todayQualified,
        disqualified: todayDisqualified,
        duplicate: todayDuplicate,
        callback: todayCallback,
        overrideQualified: todayOverride
      },
      thisMonth: {
        pending: monthPending,
        reviewed: monthReviewed,
        qualified: monthQualified,
        disqualified: monthDisqualified,
        duplicate: monthDuplicate,
        callback: monthCallback,
        overrideQualified: monthOverride
      },
      assignedCampaigns: campaignStats,
      qualityMetrics: {
        qualificationRate,
        overrideRate,
        avgReviewTime: 5 // Placeholder - would need to track actual review times
      }
    });
  } catch (error) {
    console.error('Get QC analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload call recording for a lead
router.post('/leads/:id/recording', [
  auth,
  requireRole([UserRole.QualityControl, UserRole.Manager]),
  uploadRecording.single('recording')
], async (req: any, res: any) => {
  try {
    const leadId = req.params.id;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No recording file uploaded' });
    }

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Generate URL for the recording
    const recordingUrl = `/uploads/recordings/${req.file.filename}`;

    // Update lead with recording URL
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        callRecordingUrl: recordingUrl
      }
    });

    res.json({
      success: true,
      recordingUrl,
      lead: updatedLead
    });
  } catch (error) {
    console.error('Upload recording error:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

export default router;
