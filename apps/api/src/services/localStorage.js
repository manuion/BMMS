/**
 * Local File Storage Service for Development
 * Mimics S3/R2 behavior using local filesystem
 */
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Local storage directory
const STORAGE_DIR = path.join(__dirname, '../../uploads');
const TEMP_DIR = path.join(STORAGE_DIR, 'temp');

// Ensure directories exist
const ensureDir = async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};

// Initialize storage directories
(async () => {
  await ensureDir(STORAGE_DIR);
  await ensureDir(TEMP_DIR);
})();

// In-memory store for pending uploads and presigned URLs
const pendingUploads = new Map(); // uploadId -> { key, parts: Map<partNumber, Buffer> }
const presignedUrls = new Map(); // token -> { key, contentType, expiresAt, partNumber?, uploadId? }

/**
 * Generate a unique storage key for a file
 */
const generateStorageKey = (meetingId, fileName) => {
  const ext = fileName.split('.').pop();
  const uniqueId = uuidv4();
  return `meetings/${meetingId}/documents/${uniqueId}.${ext}`;
};

/**
 * Create a "presigned URL" token for local storage
 * Returns a URL that the frontend can PUT to
 */
const createPresignedToken = (key, contentType, options = {}) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (config.upload.presignedUrlExpiry * 1000);

  presignedUrls.set(token, {
    key,
    contentType,
    expiresAt,
    partNumber: options.partNumber,
    uploadId: options.uploadId,
  });

  // Auto-cleanup expired tokens
  setTimeout(() => presignedUrls.delete(token), config.upload.presignedUrlExpiry * 1000);

  return token;
};

/**
 * Get presigned URL for single file upload
 */
const getUploadPresignedUrl = async (storageKey, contentType) => {
  const token = createPresignedToken(storageKey, contentType);
  // Return a local URL that our upload endpoint will handle
  const baseUrl = `http://localhost:${config.port}`;
  return `${baseUrl}/api/storage/upload/${token}`;
};

/**
 * Get presigned URL for file download
 * @param {string} storageKey - The storage key of the file
 * @param {string} mimeType - The MIME type of the file (optional, defaults to application/octet-stream)
 * @param {string} fileName - The original file name (for Content-Disposition header)
 */
const getDownloadPresignedUrl = async (storageKey, mimeType = 'application/octet-stream', fileName = null) => {
  const token = createPresignedToken(storageKey, mimeType, { fileName });
  const baseUrl = `http://localhost:${config.port}`;
  return `${baseUrl}/api/storage/download/${token}`;
};

/**
 * Initialize multipart upload
 */
const initiateMultipartUpload = async (storageKey, contentType) => {
  const uploadId = uuidv4();
  pendingUploads.set(uploadId, {
    key: storageKey,
    contentType,
    parts: new Map(),
    createdAt: Date.now(),
  });
  return uploadId;
};

/**
 * Get presigned URLs for multipart upload parts
 */
const getMultipartPresignedUrls = async (storageKey, uploadId, totalParts) => {
  const presignedUrlsList = [];
  const baseUrl = `http://localhost:${config.port}`;

  for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
    const token = createPresignedToken(storageKey, 'application/octet-stream', {
      partNumber,
      uploadId,
    });
    presignedUrlsList.push({
      partNumber,
      presignedUrl: `${baseUrl}/api/storage/upload/${token}`,
    });
  }

  return presignedUrlsList;
};

/**
 * Store an uploaded part (called by upload route)
 */
const storePart = async (token, data) => {
  const urlInfo = presignedUrls.get(token);
  if (!urlInfo) {
    throw new Error('Invalid or expired upload token');
  }

  if (urlInfo.expiresAt < Date.now()) {
    presignedUrls.delete(token);
    throw new Error('Upload token expired');
  }

  const { key, uploadId, partNumber } = urlInfo;

  if (uploadId && partNumber) {
    // Multipart upload
    const upload = pendingUploads.get(uploadId);
    if (!upload) {
      throw new Error('Upload not found');
    }
    upload.parts.set(partNumber, data);

    // Generate ETag (MD5 hash)
    const etag = crypto.createHash('md5').update(data).digest('hex');
    presignedUrls.delete(token);
    return { etag };
  } else {
    // Single file upload
    const filePath = path.join(STORAGE_DIR, key);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, data);

    const etag = crypto.createHash('md5').update(data).digest('hex');
    presignedUrls.delete(token);
    return { etag };
  }
};

/**
 * Complete multipart upload - combine all parts
 */
const completeMultipartUpload = async (storageKey, uploadId, parts) => {
  const upload = pendingUploads.get(uploadId);
  if (!upload) {
    throw new Error('Upload not found');
  }

  // Sort parts by part number and combine
  const sortedParts = [...upload.parts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([_, data]) => data);

  const combinedData = Buffer.concat(sortedParts);

  const filePath = path.join(STORAGE_DIR, storageKey);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, combinedData);

  pendingUploads.delete(uploadId);
};

/**
 * Abort multipart upload
 */
const abortMultipartUpload = async (storageKey, uploadId) => {
  pendingUploads.delete(uploadId);
};

/**
 * Get file data for download
 * Returns the file data, content type, and fileName
 * Token is NOT deleted after use - it expires automatically via setTimeout
 * This allows the same URL to be used for iframe viewing + download button
 */
const getFileForDownload = async (token) => {
  const urlInfo = presignedUrls.get(token);
  if (!urlInfo) {
    throw new Error('Invalid or expired download token');
  }

  if (urlInfo.expiresAt < Date.now()) {
    presignedUrls.delete(token);
    throw new Error('Download token expired');
  }

  const filePath = path.join(STORAGE_DIR, urlInfo.key);
  const data = await fs.readFile(filePath);
  const contentType = urlInfo.contentType || 'application/octet-stream';
  const fileName = urlInfo.fileName || null;

  // Don't delete token here - let it expire naturally via setTimeout
  // This allows the URL to be used multiple times (e.g., iframe view + download)
  return { data, contentType, fileName };
};

/**
 * Delete a file from storage
 */
const deleteFile = async (storageKey) => {
  const filePath = path.join(STORAGE_DIR, storageKey);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
};

/**
 * Check if a token is valid (for route validation)
 */
const isValidToken = (token) => {
  const urlInfo = presignedUrls.get(token);
  return urlInfo && urlInfo.expiresAt > Date.now();
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
  // Local-specific exports
  storePart,
  getFileForDownload,
  isValidToken,
};
