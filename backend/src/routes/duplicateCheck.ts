import express, { Response } from 'express';
import { UserRole } from '@prisma/client';
import { auth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import prisma from '../lib/prisma';


const router = express.Router();

// Check for duplicate leads
router.post('/check', [
  auth,
  requireRole([UserRole.TeamLeader, UserRole.Manager, UserRole.QualityControl])
], async (req: any, res: Response) => {
  try {
    const { name, phone, address } = req.body;

    // Build search conditions
    const conditions: any[] = [];

    // Search by name (first and last name together)
    if (name && name.trim()) {
      const nameParts = name.trim().toLowerCase().split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        conditions.push({
          AND: [
            { homeownerFirst: { contains: firstName, mode: 'insensitive' } },
            { homeownerLast: { contains: lastName, mode: 'insensitive' } }
          ]
        });
      } else {
        // If only one name provided, search in both fields
        conditions.push({
          OR: [
            { homeownerFirst: { contains: name.trim(), mode: 'insensitive' } },
            { homeownerLast: { contains: name.trim(), mode: 'insensitive' } }
          ]
        });
      }
    }

    // Track phone search separately
    const phoneSearchDigits = phone && phone.trim() ? phone.trim().replace(/\D/g, '') : '';

    // Search by address (street number and street name)
    if (address && address.trim()) {
      // Extract street number and street name (e.g., "417 Jeffers Rd" from "417 Jeffers Rd, Oyster Creek, TX 77541")
      const addressParts = address.trim().split(',')[0]; // Get first part before comma
      conditions.push({
        addressText: { contains: addressParts.trim(), mode: 'insensitive' }
      });
    }

    // If no search criteria provided
    if (conditions.length === 0 && !phoneSearchDigits) {
      return res.json({ leads: [], message: 'Please provide at least one search criterion' });
    }

    // Search leads
    let leads: any[] = [];
    
    // If only phone search, fetch all leads and filter by phone
    if (phoneSearchDigits && conditions.length === 0) {
      const allLeads = await prisma.lead.findMany({
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          },
          agent: {
            select: {
              id: true,
              fullName: true
            }
          },
          team: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // Filter by phone digits
      const last10Digits = phoneSearchDigits.slice(-10);
      leads = allLeads.filter(lead => {
        const leadDigits = lead.phone.replace(/\D/g, '');
        return leadDigits.includes(last10Digits);
      });
    } else if (conditions.length > 0) {
      // Name or address search
      leads = await prisma.lead.findMany({
        where: {
          OR: conditions
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true
            }
          },
          agent: {
            select: {
              id: true,
              fullName: true
            }
          },
          team: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // If phone search was also requested, further filter by phone
      if (phoneSearchDigits && phoneSearchDigits.length >= 3) {
        const last10Digits = phoneSearchDigits.slice(-10);
        leads = leads.filter(lead => {
          const leadDigits = lead.phone.replace(/\D/g, '');
          return leadDigits.includes(last10Digits);
        });
      }
    }

    // Determine match type for each lead
    const results = leads.map(lead => {
      const matchTypes: string[] = [];

      // Check name match
      if (name && name.trim()) {
        const nameParts = name.trim().toLowerCase().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        
        if (lead.homeownerFirst.toLowerCase().includes(firstName) && 
            (lastName === '' || lead.homeownerLast.toLowerCase().includes(lastName))) {
          matchTypes.push('Name');
        }
      }

      // Check phone match
      if (phone && phone.trim()) {
        const phoneDigits = phone.trim().replace(/\D/g, '');
        const leadPhoneDigits = lead.phone.replace(/\D/g, '');
        if (phoneDigits.length >= 10) {
          const last10Digits = phoneDigits.slice(-10);
          if (leadPhoneDigits.includes(last10Digits)) {
            matchTypes.push('Phone');
          }
        } else if (phoneDigits.length > 0 && leadPhoneDigits.includes(phoneDigits)) {
          matchTypes.push('Phone');
        }
      }

      // Check address match
      if (address && address.trim()) {
        const addressParts = address.trim().split(',')[0];
        if (lead.addressText.toLowerCase().includes(addressParts.trim().toLowerCase())) {
          matchTypes.push('Address');
        }
      }

      return {
        id: lead.id,
        serialNumber: lead.serialNumber,
        fullName: `${lead.homeownerFirst} ${lead.homeownerLast}`,
        phone: lead.phone,
        address: lead.addressText,
        campaignName: lead.campaign?.name || 'N/A',
        agentName: lead.agent?.fullName || 'N/A',
        teamName: lead.team?.name || 'N/A',
        status: lead.status,
        sentToClient: lead.status === 'Qualified',
        createdAt: lead.createdAt,
        matchType: matchTypes.join(', ')
      };
    });

    res.json({ 
      leads: results,
      count: results.length,
      message: results.length === 0 ? 'No matching leads found' : `Found ${results.length} matching lead(s)`
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

export default router;
