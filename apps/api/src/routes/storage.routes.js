/**
 * Storage Routes for Local Development
 * These routes handle file upload/download when using local storage mode
 * In production, uploads go directly to S3/R2 via presigned URLs
 */
const express = require('express');
const config = require('../config');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// Only load localStorage functions when in local mode
let localStorage = null;
if (config.storageMode === 'local') {
  localStorage = require('../services/localStorage');
}

/**
 * PUT /api/storage/upload/:token
 * Handle file upload using local storage token
 * Mimics S3/R2 behavior by returning ETag in headers
 */
router.put(
  '/upload/:token',
  express.raw({ type: '*/*', limit: '60mb' }),
  asyncHandler(async (req, res) => {
    if (config.storageMode !== 'local') {
      throw new ApiError(400, 'INVALID_REQUEST', 'Local storage is not enabled');
    }

    const { token } = req.params;

    if (!localStorage.isValidToken(token)) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired upload token');
    }

    const result = await localStorage.storePart(token, req.body);

    // Return ETag in header like S3/R2 does
    res.set('ETag', `"${result.etag}"`);
    res.status(200).send();
  })
);

/**
 * GET /api/storage/download/:token
 * Handle file download using local storage token
 */
router.get(
  '/download/:token',
  asyncHandler(async (req, res) => {
    if (config.storageMode !== 'local') {
      throw new ApiError(400, 'INVALID_REQUEST', 'Local storage is not enabled');
    }

    const { token } = req.params;

    if (!localStorage.isValidToken(token)) {
      throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired download token');
    }

    const { data, contentType } = await localStorage.getFileForDownload(token);

    res.set('Content-Type', contentType);
    res.send(data);
  })
);

module.exports = router;
