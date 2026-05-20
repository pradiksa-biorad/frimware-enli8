import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  buildS3Key,
  initiateMultipartUpload,
  getPresignedPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  verifyObjectExists,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
} from '../services/s3';
import { ReleaseStatus } from '@prisma/client';

const router = Router();
router.use(authenticate);

const MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB

async function getEnvironment(productId: number, envName: string) {
  const env = await prisma.environment.findFirst({
    where: { productId, name: envName },
  });
  return env;
}

// GET /api/products/:productId/environments/:env/releases
router.get('/:productId/environments/:env/releases', async (req, res: Response, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const env = await getEnvironment(productId, req.params.env);
    if (!env) return next(new AppError(404, 'Environment not found'));

    const releases = await prisma.release.findMany({
      where: { environmentId: env.id, status: ReleaseStatus.CONFIRMED },
      include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(releases.map(r => ({ ...r, fileSize: r.fileSize?.toString() })));
  } catch (err) {
    return next(err);
  }
});

// POST /api/products/:productId/environments/:env/releases — admin only
// Body: { version, releaseNotes, fileName, fileSize, contentType, partCount? }
// Returns: for small files: { releaseId, uploadUrl }
//          for large files: { releaseId, uploadId, parts: [{ partNumber, url }] }
router.post('/:productId/environments/:env/releases', requireAdmin, async (req: AuthRequest, res: Response, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const env = await getEnvironment(productId, req.params.env);
    if (!env) return next(new AppError(404, 'Environment not found'));

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return next(new AppError(404, 'Product not found'));

    const { version, releaseNotes, fileName, fileSize, contentType } = z.object({
      version: z.string().min(1).max(50),
      releaseNotes: z.string().min(1),
      fileName: z.string().min(1).max(255),
      fileSize: z.number().int().positive(),
      contentType: z.string().default('application/octet-stream'),
    }).parse(req.body);

    const existing = await prisma.release.findFirst({
      where: { environmentId: env.id, version },
    });
    if (existing) return next(new AppError(409, `Version ${version} already exists in this environment`));

    const s3Key = buildS3Key(product.slug, env.name, version, fileName);

    const release = await prisma.release.create({
      data: {
        environmentId: env.id,
        version,
        releaseNotes,
        s3Key,
        fileName,
        fileSize: BigInt(fileSize),
        uploadedById: req.user!.id,
        status: ReleaseStatus.PENDING,
      },
    });

    // Multipart for files > 100 MB
    if (fileSize > MULTIPART_THRESHOLD_BYTES) {
      const partSize = 100 * 1024 * 1024; // 100 MB parts
      const partCount = Math.ceil(fileSize / partSize);
      const uploadId = await initiateMultipartUpload(s3Key, contentType);

      const parts = await Promise.all(
        Array.from({ length: partCount }, (_, i) => i + 1).map(async (partNumber) => ({
          partNumber,
          url: await getPresignedPartUrl(s3Key, uploadId, partNumber),
        }))
      );

      return res.status(201).json({
        releaseId: release.id,
        uploadType: 'multipart',
        uploadId,
        s3Key,
        parts,
      });
    }

    // Single presigned PUT for small files
    const uploadUrl = await getPresignedUploadUrl(s3Key, contentType);
    return res.status(201).json({
      releaseId: release.id,
      uploadType: 'single',
      uploadUrl,
      s3Key,
    });
  } catch (err) {
    return next(err);
  }
});

// POST /api/products/:productId/environments/:env/releases/:releaseId/confirm — admin only
// Body for multipart: { uploadId, parts: [{ ETag, PartNumber }] }
// Body for single: {}
router.post('/:productId/environments/:env/releases/:releaseId/confirm', requireAdmin, async (req, res: Response, next) => {
  try {
    const releaseId = parseInt(req.params.releaseId, 10);
    const release = await prisma.release.findUnique({ where: { id: releaseId } });
    if (!release) return next(new AppError(404, 'Release not found'));
    if (release.status === ReleaseStatus.CONFIRMED) {
      return next(new AppError(409, 'Release already confirmed'));
    }

    const body = req.body as { uploadId?: string; parts?: { ETag: string; PartNumber: number }[] };

    if (body.uploadId && body.parts?.length) {
      await completeMultipartUpload(release.s3Key, body.uploadId, body.parts);
    }

    const exists = await verifyObjectExists(release.s3Key);
    if (!exists) return next(new AppError(400, 'File not found in S3 — upload may have failed'));

    await prisma.release.update({
      where: { id: releaseId },
      data: { status: ReleaseStatus.CONFIRMED },
    });

    return res.json({ message: 'Release confirmed', releaseId });
  } catch (err) {
    return next(err);
  }
});

// POST /api/products/:productId/environments/:env/releases/:releaseId/abort — admin only
router.post('/:productId/environments/:env/releases/:releaseId/abort', requireAdmin, async (req, res: Response, next) => {
  try {
    const releaseId = parseInt(req.params.releaseId, 10);
    const release = await prisma.release.findUnique({ where: { id: releaseId } });
    if (!release) return next(new AppError(404, 'Release not found'));

    const { uploadId } = z.object({ uploadId: z.string() }).parse(req.body);
    await abortMultipartUpload(release.s3Key, uploadId);
    await prisma.release.delete({ where: { id: releaseId } });

    return res.json({ message: 'Upload aborted' });
  } catch (err) {
    return next(err);
  }
});

// GET /api/products/:productId/environments/:env/releases/latest/download
router.get('/:productId/environments/:env/releases/latest/download', async (req, res: Response, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const env = await getEnvironment(productId, req.params.env);
    if (!env) return next(new AppError(404, 'Environment not found'));

    const release = await prisma.release.findFirst({
      where: { environmentId: env.id, status: ReleaseStatus.CONFIRMED },
      orderBy: { createdAt: 'desc' },
    });
    if (!release) return next(new AppError(404, 'No confirmed release found'));

    const url = await getPresignedDownloadUrl(release.s3Key);
    return res.json({ url, fileName: release.fileName, version: release.version });
  } catch (err) {
    return next(err);
  }
});

// GET /api/products/:productId/environments/:env/releases/:releaseId/download
router.get('/:productId/environments/:env/releases/:releaseId/download', async (req, res: Response, next) => {
  try {
    const releaseId = parseInt(req.params.releaseId, 10);
    const release = await prisma.release.findUnique({ where: { id: releaseId } });
    if (!release || release.status !== ReleaseStatus.CONFIRMED) {
      return next(new AppError(404, 'Release not found'));
    }

    const url = await getPresignedDownloadUrl(release.s3Key);
    return res.json({ url, fileName: release.fileName, version: release.version });
  } catch (err) {
    return next(err);
  }
});

export default router;
