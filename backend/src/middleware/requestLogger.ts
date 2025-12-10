/**
 * Request Logging Middleware
 * Logs all API requests with timing and user context
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RequestWithUser extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const requestLogger = (req: RequestWithUser, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request
  logger.debug('Incoming Request', {
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.userId,
    ip: req.ip
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Request Completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.userId
    });

    // Log slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow Request Detected', {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        userId: req.user?.userId
      });
    }

    return originalSend.call(this, data);
  };

  next();
};
