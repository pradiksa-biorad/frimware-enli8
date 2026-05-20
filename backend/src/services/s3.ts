import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';

const s3 = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

const BUCKET = config.aws.s3Bucket;
const UPLOAD_URL_EXPIRES = 15 * 60;      // 15 minutes per part
const DOWNLOAD_URL_EXPIRES = 5 * 60;    // 5 minutes

export function buildS3Key(productSlug: string, env: string, version: string, fileName: string): string {
  return `${productSlug}/${env}/${version}/${fileName}`;
}

/** For small files (<= 100 MB): single presigned PUT URL */
export async function getPresignedUploadUrl(s3Key: string, contentType: string): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  }), { expiresIn: UPLOAD_URL_EXPIRES });
}

/** Initiate a multipart upload — returns uploadId */
export async function initiateMultipartUpload(s3Key: string, contentType: string): Promise<string> {
  const res = await s3.send(new CreateMultipartUploadCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  }));
  if (!res.UploadId) throw new Error('Failed to initiate multipart upload');
  return res.UploadId;
}

/** Get presigned URL for a single part */
export async function getPresignedPartUrl(s3Key: string, uploadId: string, partNumber: number): Promise<string> {
  return getSignedUrl(s3, new UploadPartCommand({
    Bucket: BUCKET,
    Key: s3Key,
    UploadId: uploadId,
    PartNumber: partNumber,
  }), { expiresIn: UPLOAD_URL_EXPIRES });
}

/** Complete multipart upload */
export async function completeMultipartUpload(
  s3Key: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[],
): Promise<void> {
  await s3.send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET,
    Key: s3Key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  }));
}

/** Abort a multipart upload (cleanup on error) */
export async function abortMultipartUpload(s3Key: string, uploadId: string): Promise<void> {
  await s3.send(new AbortMultipartUploadCommand({
    Bucket: BUCKET,
    Key: s3Key,
    UploadId: uploadId,
  }));
}

/** Generate a presigned download URL */
export async function getPresignedDownloadUrl(s3Key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  }), { expiresIn: DOWNLOAD_URL_EXPIRES });
}

/** Verify the object exists in S3 (used on confirm) */
export async function verifyObjectExists(s3Key: string): Promise<boolean> {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    return !!res.ContentLength;
  } catch {
    return false;
  }
}
