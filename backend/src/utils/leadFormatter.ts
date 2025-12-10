/**
 * Lead Response Formatter
 * Ensures consistent lead data structure across all endpoints
 */

interface FormattedLead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email: string | null;
  addressText: string;
  marketValue: number | null;
  askingPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  propertyType: string | null;
  listingStatus: string | null;
  occupancy: string | null;
  mortgageYesNo: boolean | null;
  mortgageAmount: number | null;
  closingTimeline: string | null;
  motivationRating: number | null;
  conditionRating: number | null;
  temperature: string;
  pipelineStage: string | null;
  callRecordingUrl: string | null;
  additionalInfo: string | null;
  customFields: any;
  starred: boolean;
  clientReviewed: boolean;
  taskQualityIndicator: string | null;
  taskQualityStage: string | null;
  createdAt: Date;
  updatedAt: Date;
  campaign?: {
    id: string;
    name: string;
    formTemplateId: string | null;
    formTemplate?: any;
  };
  agent?: {
    id: string;
    fullName: string;
  } | null;
  clientNotes?: any[];
  schedules?: any[];
}

/**
 * Format a single lead with consistent structure
 * Ensures formTemplate is always nested in campaign if it exists
 */
export function formatLead(lead: any, includeRelations: boolean = true): FormattedLead {
  const formatted: FormattedLead = {
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
    propertyType: lead.propertyType,
    listingStatus: lead.listingStatus,
    occupancy: lead.occupancy,
    mortgageYesNo: lead.mortgageYesNo,
    mortgageAmount: lead.mortgageAmount,
    closingTimeline: lead.closingTimeline,
    motivationRating: lead.motivationRating,
    conditionRating: lead.conditionRating,
    temperature: lead.temperature,
    pipelineStage: lead.pipelineStage,
    callRecordingUrl: lead.callRecordingUrl,
    additionalInfo: lead.additionalInfo,
    customFields: lead.customFields,
    starred: lead.starred,
    clientReviewed: lead.clientReviewed,
    taskQualityIndicator: lead.taskQualityIndicator,
    taskQualityStage: lead.taskQualityStage,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt
  };

  // Include campaign with nested formTemplate if available
  if (includeRelations && lead.campaign) {
    formatted.campaign = {
      id: lead.campaign.id,
      name: lead.campaign.name,
      formTemplateId: lead.campaign.formTemplateId
    };

    // Nest formTemplate inside campaign for consistent access
    if (lead.campaign.formTemplate) {
      formatted.campaign.formTemplate = lead.campaign.formTemplate;
    }
  }

  // Include agent if available
  if (includeRelations && lead.agent) {
    formatted.agent = {
      id: lead.agent.id,
      fullName: lead.agent.fullName
    };
  }

  // Include notes if available
  if (includeRelations && lead.clientNotes) {
    formatted.clientNotes = lead.clientNotes;
  }

  // Include schedules if available
  if (includeRelations && lead.schedules) {
    formatted.schedules = lead.schedules;
  }

  return formatted;
}

/**
 * Format multiple leads
 */
export function formatLeads(leads: any[], includeRelations: boolean = true): FormattedLead[] {
  return leads.map(lead => formatLead(lead, includeRelations));
}

/**
 * Standard Prisma include for lead queries
 * Use this to ensure consistent data fetching
 */
export const standardLeadInclude = {
  campaign: {
    select: {
      id: true,
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
      id: true,
      fullName: true
    }
  }
};

/**
 * Standard Prisma include for detailed lead view
 */
export const detailedLeadInclude = {
  ...standardLeadInclude,
  clientNotes: {
    orderBy: { createdAt: 'desc' as const }
  },
  schedules: {
    orderBy: { scheduledDate: 'asc' as const }
  }
};
