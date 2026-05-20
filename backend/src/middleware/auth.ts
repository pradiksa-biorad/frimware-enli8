import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/jwt';
import { AppError } from './errorHandler';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: UserRole };
}

export function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError(401, 'No token provided'));
  }
  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(new AppError(401, 'Invalid or expired token'));
  }
}

export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.role !== UserRole.ADMIN) {
    return next(new AppError(403, 'Admin access required'));
  }
  return next();
}
