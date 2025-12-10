import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error with context
  logger.error('Request Error', error, {
    method: req.method,
    path: req.path,
    body: req.body,
    query: req.query,
    userId: (req as any).user?.userId
  });

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({ 
      error: error.message,
      type: 'validation_error'
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'Invalid token',
      type: 'auth_error'
    });
  }

  // Prisma errors
  if (error.code === 'P2002') {
    return res.status(409).json({ 
      error: 'A record with this value already exists',
      type: 'duplicate_error'
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Record not found',
      type: 'not_found_error'
    });
  }

  // Multer file upload errors
  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 50MB',
        type: 'file_error'
      });
    }
    return res.status(400).json({ 
      error: error.message,
      type: 'file_error'
    });
  }

  // Default error response
  res.status(error.status || 500).json({ 
    error: error.message || 'Internal server error',
    type: 'server_error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      details: error 
    })
  });
};