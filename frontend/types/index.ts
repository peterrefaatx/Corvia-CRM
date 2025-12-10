// types/index.ts
export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  team?: Team;
  isActive?: boolean;
}

export interface Team {
  id: string;
  name: string;
  teamLeader?: User;
}

export interface Lead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email?: string;
  status: string;
  createdAt: string;
  campaign: Campaign;
  agent: User;
  team: Team;
  // ... other lead fields
}

export interface Campaign {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  manager: User;
  _count?: {
    leads: number;
  };
}