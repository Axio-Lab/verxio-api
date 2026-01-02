import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { validateApiKey } from '../services/apiKeyService';

/**
 * API Key Authentication Middleware
 * 
 * Verifies API key from request header.
 * Checks both:
 * 1. Environment variable API keys (for admin/system use)
 * 2. Database-stored API keys (for user-generated keys)
 * 
 * Frontend/Client should send:
 * - X-API-Key: Your API key (required)
 * 
 * To generate an API key:
 * 1. Create a user account via POST /user
 * 2. Generate an API key via POST /api-key with your email
 * 3. Use the generated key in the X-API-Key header for all requests
 */
export const apiKeyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError('API key is required. Send X-API-Key header.', 401);
    }

    // First, check environment variable API keys (for admin/system use)
    const validApiKeys = process.env.API_KEYS?.split(',').map(k => k.trim()) || [];
    
    // Also check single API_KEY for backward compatibility
    if (process.env.API_KEY) {
      validApiKeys.push(process.env.API_KEY.trim());
    }

    // Check if it's an environment API key (case-sensitive comparison)
    if (validApiKeys.includes(apiKey)) {
      return next();
    }

    // If not an environment key, check database for user-generated API keys
    const user = await validateApiKey(apiKey);
    
    if (!user) {
      throw new AppError('Invalid API key', 401);
    }

    // Attach user info to request for use in routes
    (req as any).user = user;

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    next(new AppError('Authentication failed', 401));
  }
};
