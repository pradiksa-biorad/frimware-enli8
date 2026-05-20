output "s3_bucket_name" {
  description = "Name of the firmware S3 bucket"
  value       = aws_s3_bucket.firmware.id
}

output "s3_bucket_arn" {
  description = "ARN of the firmware S3 bucket"
  value       = aws_s3_bucket.firmware.arn
}

output "s3_bucket_region" {
  description = "Region the bucket was created in"
  value       = aws_s3_bucket.firmware.region
}

output "iam_user_name" {
  description = "IAM user name for the firmware-hub app"
  value       = aws_iam_user.firmware_app.name
}

output "iam_user_arn" {
  description = "ARN of the firmware-hub app IAM user"
  value       = aws_iam_user.firmware_app.arn
}

# ─── Sensitive — copy these into your .env ────────────────────────────────────
# Run:  terraform output -raw aws_access_key_id
#       terraform output -raw aws_secret_access_key

output "aws_access_key_id" {
  description = "AWS Access Key ID — set as AWS_ACCESS_KEY_ID in .env"
  value       = aws_iam_access_key.firmware_app.id
  sensitive   = true
}

output "aws_secret_access_key" {
  description = "AWS Secret Access Key — set as AWS_SECRET_ACCESS_KEY in .env"
  value       = aws_iam_access_key.firmware_app.secret
  sensitive   = true
}
