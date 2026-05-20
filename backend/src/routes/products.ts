import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
router.use(authenticate);

// GET /api/products
router.get('/', async (_req, res: Response, next) => {
  try {
    const products = await prisma.product.findMany({
      include: { environments: { orderBy: { name: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(products);
  } catch (err) {
    return next(err);
  }
});

// POST /api/products — admin only
router.post('/', requireAdmin, async (req, res: Response, next) => {
  try {
    const { name, slug } = z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    }).parse(req.body);

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) return next(new AppError(409, 'A product with this slug already exists'));

    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({ data: { name, slug } });
      // Seed the three standard environments
      await tx.environment.createMany({
        data: [
          { productId: p.id, name: 'dev' },
          { productId: p.id, name: 'qa' },
          { productId: p.id, name: 'production' },
        ],
      });
      return tx.product.findUnique({
        where: { id: p.id },
        include: { environments: true },
      });
    });

    return res.status(201).json(product);
  } catch (err) {
    return next(err);
  }
});

export default router;
