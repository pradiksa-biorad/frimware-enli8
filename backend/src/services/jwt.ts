import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { UserRole } from '@prisma/client';

export interface TokenPayload {
  id: number;
  email: string;
  role: UserRole;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  } as SignOptions);
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
}
