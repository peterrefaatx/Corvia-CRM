import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // For auth endpoints, return simple error format
    if (req.path?.includes('/auth/')) {
      return res.status(400).json({
        error: errors.array()[0]?.msg || 'Validation failed'
      });
    }
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array()
    });
  };
};

