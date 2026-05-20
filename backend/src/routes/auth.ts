import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/jwt';
import { sendInviteEmail, sendPasswordResetEmail } from '../services/ses';
import { generateSecureToken, hashToken } from '../utils/crypto';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { UserStatus } from '@prisma/client';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please try again later.' },
});

const REFRESH_COOKIE = 'refresh_token';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res: Response, next) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.status !== UserStatus.ACTIVE) {
      return res.status(403).json({ error: 'Account not yet activated' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { id: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    return res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res: Response, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const newPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);
    return res.json({ accessToken });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req: AuthRequest, res: Response) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  return res.json({ message: 'Logged out' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res: Response, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return 200 to prevent email enumeration
    if (!user || user.status !== UserStatus.ACTIVE) {
      return res.json({ message: 'If that email exists, a reset link was sent.' });
    }

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.app.resetTokenExpiresHours * 60 * 60 * 1000);

    await prisma.passwordReset.create({ data: { userId: user.id, tokenHash, expiresAt } });
    await sendPasswordResetEmail(user.email, token);

    return res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res: Response, next) => {
  try {
    const { token, password } = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).parse(req.body);

    const tokenHash = hashToken(token);
    const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return next(err);
  }
});

// GET /api/auth/invite/:token — validate invite token
router.get('/invite/:token', async (req, res: Response, next) => {
  try {
    const tokenHash = hashToken(req.params.token);
    const invite = await prisma.invitation.findUnique({ where: { tokenHash } });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invite link' });
    }
    return res.json({ email: invite.email });
  } catch (err) {
    return next(err);
  }
});

// POST /api/auth/invite/accept — set password + activate
router.post('/invite/accept', authLimiter, async (req, res: Response, next) => {
  try {
    const { token, name, password } = z.object({
      token: z.string().min(1),
      name: z.string().min(1).max(100),
      password: z.string().min(8),
    }).parse(req.body);

    const tokenHash = hashToken(token);
    const invite = await prisma.invitation.findUnique({ where: { tokenHash } });

    if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired invite link' });
    }

    const user = await prisma.user.findUnique({ where: { email: invite.email } });
    if (!user) return next(new AppError(404, 'User not found'));

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { name, passwordHash, status: UserStatus.ACTIVE },
      }),
      prisma.invitation.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    ]);

    return res.json({ message: 'Account activated. You can now log in.' });
  } catch (err) {
    return next(err);
  }
});

export default router;
