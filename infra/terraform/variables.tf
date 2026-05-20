variable "aws_region" {
  description = "AWS region to deploy resources into"
  type        = string
  default     = "ap-south-2"
}

variable "aws_profile" {
  description = "AWS CLI profile to use (leave empty to use the default / env vars)"
  type        = string
  default     = ""
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for firmware binaries"
  type        = string
  # Example: "firmware-hub-183408292189-ap-south-2"
}

variable "app_name" {
  description = "Short name used as prefix for all resources"
  type        = string
  default     = "firmware-hub"
}

variable "environment" {
  description = "Deployment environment tag (e.g. production, staging)"
  type        = string
  default     = "production"
}

# SES is NOT yet available in ap-south-2.
# Set this to an SES-supported region (ap-south-1 = Mumbai is closest).
variable "ses_region" {
  description = "AWS region for SES (must be an SES-supported region)"
  type        = string
  default     = "ap-south-1"
}

variable "ses_from_email" {
  description = "Verified SES sender email address"
  type        = string
}

variable "app_url" {
  description = "Public URL of the app (used in CORS and SES email links)"
  type        = string
}
