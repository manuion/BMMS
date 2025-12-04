require('dotenv').config();

const config = {
  // Server
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Database (handled by Prisma via DATABASE_URL)

  // Cloud Storage (R2/S3)
  storage: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
    region: process.env.AWS_REGION || 'auto',
    // R2 endpoint format
    endpoint: process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined,
  },

  // Email
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'noreply@boardmate.com',
  },

  // Push Notifications
  fcm: {
    serverKey: process.env.FCM_SERVER_KEY,
  },

  // Upload settings
  upload: {
    maxFileSize: 60 * 1024 * 1024, // 60 MB
    maxFilesPerMeeting: 60,
    chunkSize: 5 * 1024 * 1024, // 5 MB
    presignedUrlExpiry: 60 * 60, // 1 hour
  },
};

module.exports = config;
