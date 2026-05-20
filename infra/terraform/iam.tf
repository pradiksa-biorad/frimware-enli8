# ─── IAM User for the firmware-hub application ───────────────────────────────

resource "aws_iam_user" "firmware_app" {
  name = "${var.app_name}-app"
  path = "/applications/"

  tags = {
    Application = var.app_name
    Environment = var.environment
  }
}

# ─── S3 Policy — least-privilege access to the firmware bucket only ──────────

data "aws_iam_policy_document" "firmware_s3" {
  # Single-part & multipart upload operations
  statement {
    sid    = "AllowObjectOperations"
    effect = "Allow"

    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
      "s3:AbortMultipartUpload",
      "s3:ListMultipartUploadParts",
    ]

    resources = ["${aws_s3_bucket.firmware.arn}/*"]
  }

  # Required to verify object existence after upload (HeadObject)
  statement {
    sid    = "AllowHeadObject"
    effect = "Allow"

    actions   = ["s3:HeadObject"]
    resources = ["${aws_s3_bucket.firmware.arn}/*"]
  }

  # Required for multipart upload initiation & completion
  statement {
    sid    = "AllowMultipartBucketLevel"
    effect = "Allow"

    actions = [
      "s3:ListBucketMultipartUploads",
    ]

    resources = [aws_s3_bucket.firmware.arn]
  }
}

resource "aws_iam_policy" "firmware_s3" {
  name        = "${var.app_name}-s3-policy"
  description = "Least-privilege S3 access for the ${var.app_name} backend"
  policy      = data.aws_iam_policy_document.firmware_s3.json

  tags = {
    Application = var.app_name
    Environment = var.environment
  }
}

resource "aws_iam_user_policy_attachment" "firmware_s3" {
  user       = aws_iam_user.firmware_app.name
  policy_arn = aws_iam_policy.firmware_s3.arn
}

# ─── SES Policy — send email only, no admin access ───────────────────────────

data "aws_iam_policy_document" "firmware_ses" {
  statement {
    sid    = "AllowSendEmail"
    effect = "Allow"

    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]

    # Restrict to the verified sender identity only
    resources = [
      "arn:aws:ses:${var.ses_region}:${data.aws_caller_identity.current.account_id}:identity/${var.ses_from_email}",
    ]
  }
}

resource "aws_iam_policy" "firmware_ses" {
  name        = "${var.app_name}-ses-policy"
  description = "Allow ${var.app_name} backend to send email via SES"
  policy      = data.aws_iam_policy_document.firmware_ses.json

  tags = {
    Application = var.app_name
    Environment = var.environment
  }
}

resource "aws_iam_user_policy_attachment" "firmware_ses" {
  user       = aws_iam_user.firmware_app.name
  policy_arn = aws_iam_policy.firmware_ses.arn
}

# ─── Access Key (stored in Terraform state — see outputs) ────────────────────

resource "aws_iam_access_key" "firmware_app" {
  user = aws_iam_user.firmware_app.name
}

# ─── Data source: current account ID ─────────────────────────────────────────

data "aws_caller_identity" "current" {}
