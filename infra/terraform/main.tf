terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Primary provider — ap-south-2 (Hyderabad) for S3 + IAM
provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}

# Secondary provider alias — used only for SES (not available in ap-south-2)
provider "aws" {
  alias   = "ses"
  region  = var.ses_region
  profile = var.aws_profile != "" ? var.aws_profile : null
}
