import { UserRole, LeadStatus } from '@prisma/client';
import { Request } from 'express';

// Request types
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: UserRole;
    teamId?: string | null;
  };
}

// User types
export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  teamId?: string | null;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  role?: UserRole;
  fullName?: string;
  teamId?: string | null;
  isActive?: boolean;
}

// Team types
export interface CreateTeamDto {
  name: string;
  teamLeaderUserId?: string | null;
}

// Campaign types
export interface CreateCampaignDto {
  name: string;
}

// Lead types
export interface CreateLeadDto {
  campaignId: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email?: string;
  bedrooms: number;
  bathrooms: number;
  marketValue: number;
  askingPrice?: number;
  listingStatus: string;
  occupancy: string;
  mortgageYesNo: boolean;
  mortgageAmount?: number;
  closingTimeline: string;
  addressText: string;
  motivationRating: number;
  conditionRating: number;
  additionalInfo?: string;
}

export interface UpdateLeadStatusDto {
  status: LeadStatus;
  comment?: string;
}

// Auth types
export interface LoginDto {
  username: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    fullName: string;
    team?: {
      id: string;
      name: string;
      teamLeader?: {
        id: string;
        username: string;
        fullName: string;
      } | null;
    } | null;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}









