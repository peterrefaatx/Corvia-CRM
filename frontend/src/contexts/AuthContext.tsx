import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  username?: string;
  email: string;
  role: string;
  fullName?: string;
  name?: string; // For team members
  positionTitle?: string; // For team members
  permissions?: any; // For team members
  clientId?: string; // For team members
  clientName?: string; // For team members
  team?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, isTeamMember?: boolean) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    const isTeamMember = localStorage.getItem('isTeamMember') === 'true';
    
    if (token) {
      try {
        const endpoint = isTeamMember ? '/auth/team-member/me' : '/auth/me';
        const response = await api.get(endpoint);
        setUser(response.data);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('isTeamMember');
      }
    }
    setLoading(false);
  };

  const login = async (username: string, password: string, isTeamMember: boolean = false): Promise<User> => {
    if (isTeamMember) {
      // Team member login
      const response = await api.post('/auth/team-member/login', { email: username, password });
      const { accessToken, user: userData } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('isTeamMember', 'true');
      setUser(userData);
      return userData;
    } else {
      // Regular user login
      const response = await api.post('/auth/login', { username, password });
      const { accessToken, refreshToken, user: userData } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.removeItem('isTeamMember');
      setUser(userData);
      return userData;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('isTeamMember');
    setUser(null);
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('accessToken');
    const isTeamMember = localStorage.getItem('isTeamMember') === 'true';
    
    if (token) {
      try {
        const endpoint = isTeamMember ? '/auth/team-member/me' : '/auth/me';
        const response = await api.get(endpoint);
        setUser(response.data);
      } catch (error) {
        console.error('Refresh user failed:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};