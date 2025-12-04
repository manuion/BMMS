require('dotenv').config();

// Determine storage mode: 'local' for development, 's3' for production
const getStorageMode = () => {
  // Explicitly set via env
  if (process.env.STORAGE_MODE) {
    return process.env.STORAGE_MODE;
  }
  // Auto-detect: use local if no S3/R2 credentials are configured
  const hasS3Credentials = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const hasBucket = process.env.R2_BUCKET_NAME || process.env.S3_BUCKET_NAME;

  if (hasS3Credentials && hasBucket) {
    return 's3';
  }
  return 'local';
};

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

  // Storage mode: 'local' or 's3'
  storageMode: getStorageMode(),

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
