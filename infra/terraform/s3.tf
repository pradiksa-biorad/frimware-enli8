# ─── S3 Bucket ───────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "firmware" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Application = var.app_name
    Environment = var.environment
  }
}

# Block ALL public access — firmware files are served via presigned URLs only
resource "aws_s3_bucket_public_access_block" "firmware" {
  bucket = aws_s3_bucket.firmware.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption at rest (AES-256 managed by S3)
resource "aws_s3_bucket_server_side_encryption_configuration" "firmware" {
  bucket = aws_s3_bucket.firmware.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Versioning — keeps previous firmware binaries on overwrite/delete
resource "aws_s3_bucket_versioning" "firmware" {
  bucket = aws_s3_bucket.firmware.id

  versioning_configuration {
    status = "Enabled"
  }
}

# CORS — required for browser-side presigned PUT uploads from the frontend
resource "aws_s3_bucket_cors_configuration" "firmware" {
  bucket = aws_s3_bucket.firmware.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = [var.app_url]
    expose_headers  = ["ETag"]   # needed for multipart upload ETag collection
    max_age_seconds = 3000
  }
}

# Lifecycle rule — clean up incomplete multipart uploads after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "firmware" {
  bucket = aws_s3_bucket.firmware.id

  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    filter {} # applies to all objects in the bucket

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
