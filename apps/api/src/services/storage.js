const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

// Initialize S3 client (works with both AWS S3 and Cloudflare R2)
const s3Client = new S3Client({
  region: config.storage.region,
  endpoint: config.storage.endpoint,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
});

/**
 * Generate a unique storage key for a file
 */
const generateStorageKey = (meetingId, fileName) => {
  const ext = fileName.split('.').pop();
  const uniqueId = uuidv4();
  return `meetings/${meetingId}/documents/${uniqueId}.${ext}`;
};

/**
 * Get presigned URL for single file upload (small files < 5MB)
 */
const getUploadPresignedUrl = async (storageKey, contentType, expiresIn = config.upload.presignedUrlExpiry) => {
  const command = new PutObjectCommand({
    Bucket: config.storage.bucketName,
    Key: storageKey,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return presignedUrl;
};

/**
 * Get presigned URL for file download
 */
const getDownloadPresignedUrl = async (storageKey, expiresIn = config.upload.presignedUrlExpiry) => {
  const command = new GetObjectCommand({
    Bucket: config.storage.bucketName,
    Key: storageKey,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
  return presignedUrl;
};

/**
 * Initialize multipart upload for large files
 */
const initiateMultipartUpload = async (storageKey, contentType) => {
  const command = new CreateMultipartUploadCommand({
    Bucket: config.storage.bucketName,
    Key: storageKey,
    ContentType: contentType,
  });

  const response = await s3Client.send(command);
  return response.UploadId;
};

/**
 * Get presigned URLs for all parts of a multipart upload
 */
const getMultipartPresignedUrls = async (storageKey, uploadId, totalParts, expiresIn = config.upload.presignedUrlExpiry) => {
  const presignedUrls = [];

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const command = new UploadPartCommand({
      Bucket: config.storage.bucketName,
      Key: storageKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
    presignedUrls.push({
      partNumber,
      presignedUrl,
    });
  }

  return presignedUrls;
};

/**
 * Complete multipart upload
 */
const completeMultipartUpload = async (storageKey, uploadId, parts) => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: config.storage.bucketName,
    Key: storageKey,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts.map((part) => ({
        ETag: part.etag,
        PartNumber: part.partNumber,
      })),
    },
  });

  await s3Client.send(command);
};

/**
 * Abort multipart upload (cleanup on failure)
 */
const abortMultipartUpload = async (storageKey, uploadId) => {
  const command = new AbortMultipartUploadCommand({
    Bucket: config.storage.bucketName,
    Key: storageKey,
    UploadId: uploadId,
  });

  await s3Client.send(command);
};

/**
 * Delete a file from storage
 */
const deleteFile = async (storageKey) => {
  const command = new DeleteObjectCommand({
    Bucket: config.storage.bucketName,
    Key: storageKey,
  });

  await s3Client.send(command);
};

module.exports = {
  generateStorageKey,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  initiateMultipartUpload,
  getMultipartPresignedUrls,
  completeMultipartUpload,
  abortMultipartUpload,
  deleteFile,
};
