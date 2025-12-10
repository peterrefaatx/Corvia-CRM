import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

// Define a more explicit JWT payload interface
export interface JwtPayload {
  userId: string;
  role: string;
  teamId?: string | null;
  clientId?: string; // For team members
  positionTitle?: string; // For team members
  iat?: number; // issued at
  exp?: number; // expiration
}

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

/**
 * Authentication middleware to verify JWT tokens
 */
export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        error: 'No token, authorization denied' 
      });
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format. Use Bearer token'
      });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'No token found in Authorization header' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    // Attach user to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      teamId: decoded.teamId,
      clientId: decoded.clientId,
      positionTitle: decoded.positionTitle
    };
    
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: 'Token has expired'
      });
    }

    if (error instanceof jwt.NotBeforeError) {
      return res.status(401).json({
        success: false,
        error: 'Token not active'
      });
    }

    // Generic error
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      error: 'Token is not valid' 
    });
  }
};

/**
 * Optional: Role-based authorization middleware
 * Use after auth middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Optional: Admin role checker
 */
export const requireAdmin = requireRole(['admin']);

/**
 * Optional: Optional authentication - doesn't fail if no token, but still populates user if valid token exists
 */
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      teamId: decoded.teamId,
      clientId: decoded.clientId,
      positionTitle: decoded.positionTitle
    };
    
    next();
  } catch (error) {
    // Continue without user if token is invalid
    next();
  }
};