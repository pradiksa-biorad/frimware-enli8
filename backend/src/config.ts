import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  aws: {
    region: required('AWS_REGION'),
    accessKeyId: required('AWS_ACCESS_KEY_ID'),
    secretAccessKey: required('AWS_SECRET_ACCESS_KEY'),
    s3Bucket: required('S3_BUCKET_NAME'),
    sesFromEmail: required('SES_FROM_EMAIL'),
  },

  app: {
    url: required('APP_URL'),
    inviteTokenExpiresHours: parseInt(process.env.INVITE_TOKEN_EXPIRES_HOURS ?? '48', 10),
    resetTokenExpiresHours: parseInt(process.env.RESET_TOKEN_EXPIRES_HOURS ?? '2', 10),
  },
};
