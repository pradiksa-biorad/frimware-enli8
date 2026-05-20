import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { sendInviteEmail } from '../services/ses';
import { generateSecureToken, hashToken } from '../utils/crypto';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// GET /api/users — admin only
router.get('/', requireAdmin, async (_req, res: Response, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(users);
  } catch (err) {
    return next(err);
  }
});

// POST /api/users/invite — admin only
router.post('/invite', requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const { email, role } = z.object({
      email: z.string().email(),
      role: z.nativeEnum(UserRole).default(UserRole.VIEWER),
    }).parse(req.body);

    const lowerEmail = email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: lowerEmail } });
    if (existing) return next(new AppError(409, 'A user with this email already exists'));

    const inviter = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!inviter) return next(new AppError(404, 'Inviter not found'));

    const token = generateSecureToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.app.inviteTokenExpiresHours * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.create({
        data: { email: lowerEmail, name: '', role, status: 'PENDING', invitedById: req.user!.id },
      }),
      prisma.invitation.create({
        data: { email: lowerEmail, tokenHash, invitedById: req.user!.id, expiresAt },
      }),
    ]);

    await sendInviteEmail(lowerEmail, inviter.name, token);
    return res.status(201).json({ message: `Invite sent to ${lowerEmail}` });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/users/:id/role — admin only
router.patch('/:id/role', requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { role } = z.object({ role: z.nativeEnum(UserRole) }).parse(req.body);

    if (id === req.user!.id) return next(new AppError(400, 'Cannot change your own role'));

    const user = await prisma.user.update({ where: { id }, data: { role } });
    return res.json({ id: user.id, role: user.role });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/users/:id — admin only
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (id === req.user!.id) return next(new AppError(400, 'Cannot delete your own account'));

    await prisma.user.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

export default router;
