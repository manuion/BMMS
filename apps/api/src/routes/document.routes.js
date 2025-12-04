const express = require('express');
const { body, validationResult } = require('express-validator');
const prisma = require('../services/prisma');
const storage = require('../services/storage');
const config = require('../config');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const { API_ERRORS, UPLOAD_STATUS, FILE_UPLOAD } = require('@bmms/shared');
const { calculateChunks } = require('@bmms/shared');
const pushNotification = require('../services/pushNotification');

const router = express.Router();

/**
 * POST /api/documents/upload-tree
 * Initialize folder tree structure for batch upload
 */
router.post(
  '/upload-tree',
  authenticate,
  [
    body('meetingId').notEmpty().withMessage('Meeting ID is required'),
    body('folders').isArray().withMessage('Folders must be an array'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { meetingId, folders } = req.body;

    // Check meeting exists and user is organiser
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can upload documents');
    }

    // Create folders in order (parents first)
    const folderMap = {}; // path -> id mapping

    // Sort folders by depth (number of slashes in path)
    const sortedFolders = [...folders].sort((a, b) => {
      const depthA = (a.path.match(/\//g) || []).length;
      const depthB = (b.path.match(/\//g) || []).length;
      return depthA - depthB;
    });

    for (const folder of sortedFolders) {
      const parentId = folder.parentPath ? folderMap[folder.parentPath] : null;

      const createdFolder = await prisma.documentFolder.create({
        data: {
          meetingId,
          name: folder.name,
          path: folder.path,
          parentId,
          sortOrder: 0,
        },
      });

      folderMap[folder.path] = createdFolder.id;
    }

    res.status(201).json({
      success: true,
      folderMap,
    });
  })
);

/**
 * POST /api/documents/initiate-upload
 * Initiate a file upload (single or multipart)
 */
router.post(
  '/initiate-upload',
  authenticate,
  [
    body('meetingId').notEmpty().withMessage('Meeting ID is required'),
    body('fileName').notEmpty().withMessage('File name is required'),
    body('fileSize').isInt({ min: 1 }).withMessage('File size must be a positive integer'),
    body('mimeType').notEmpty().withMessage('MIME type is required'),
    body('folderId').optional(),
    body('path').optional(),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { meetingId, fileName, fileSize, mimeType, folderId, path } = req.body;

    // Validate file size
    if (fileSize > FILE_UPLOAD.MAX_FILE_SIZE) {
      throw new ApiError(400, API_ERRORS.FILE_TOO_LARGE, `File size exceeds ${FILE_UPLOAD.MAX_FILE_SIZE / (1024 * 1024)}MB limit`);
    }

    // Validate MIME type
    if (!FILE_UPLOAD.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new ApiError(400, API_ERRORS.INVALID_FILE_TYPE, 'File type not allowed');
    }

    // Check meeting exists and user is organiser
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can upload documents');
    }

    // Check file count limit
    const existingDocs = await prisma.document.count({ where: { meetingId } });
    if (existingDocs >= FILE_UPLOAD.MAX_FILES_PER_MEETING) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, `Maximum ${FILE_UPLOAD.MAX_FILES_PER_MEETING} files per meeting`);
    }

    // Generate storage key
    const storageKey = storage.generateStorageKey(meetingId, fileName);

    // Calculate chunks
    const totalChunks = calculateChunks(fileSize, FILE_UPLOAD.CHUNK_SIZE);
    const isMultipart = totalChunks > 1;

    let uploadData;
    let presignedUrls;

    if (isMultipart) {
      // Multipart upload for large files
      const multipartUploadId = await storage.initiateMultipartUpload(storageKey, mimeType);
      presignedUrls = await storage.getMultipartPresignedUrls(storageKey, multipartUploadId, totalChunks);

      uploadData = {
        multipartUploadId,
        totalChunks,
        isMultipart: true,
      };
    } else {
      // Single upload for small files
      const presignedUrl = await storage.getUploadPresignedUrl(storageKey, mimeType);
      presignedUrls = [{ partNumber: 1, presignedUrl }];

      uploadData = {
        totalChunks: 1,
        isMultipart: false,
      };
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        meetingId,
        folderId: folderId || null,
        name: fileName.replace(/\.[^/.]+$/, ''), // Name without extension
        fileName,
        fileSize,
        mimeType,
        storageKey,
        path: path || fileName, // Full path including folder structure
        uploadedBy: req.user.id,
        uploadProgress: {
          create: {
            totalChunks,
            uploadedChunks: 0,
            chunkDetails: {},
            multipartUploadId: uploadData.multipartUploadId || null,
            status: UPLOAD_STATUS.PENDING,
            expiresAt: new Date(Date.now() + config.upload.presignedUrlExpiry * 1000),
          },
        },
      },
      include: {
        uploadProgress: true,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        documentId: document.id,
        storageKey,
        presignedUrls,
        ...uploadData,
        expiresAt: document.uploadProgress.expiresAt,
      },
    });
  })
);

/**
 * PUT /api/documents/:id/progress
 * Update upload progress (chunk completed)
 */
router.put(
  '/:id/progress',
  authenticate,
  [
    body('partNumber').isInt({ min: 1 }).withMessage('Part number is required'),
    body('etag').notEmpty().withMessage('ETag is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { partNumber, etag } = req.body;
    const documentId = req.params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { uploadProgress: true },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    if (document.uploadedBy !== req.user.id && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    const uploadProgress = document.uploadProgress;
    if (!uploadProgress) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'No upload in progress');
    }

    // Update chunk details
    const chunkDetails = uploadProgress.chunkDetails || {};
    chunkDetails[partNumber] = { etag, completedAt: new Date().toISOString() };
    const uploadedChunks = Object.keys(chunkDetails).length;

    const updatedProgress = await prisma.documentUpload.update({
      where: { documentId },
      data: {
        chunkDetails,
        uploadedChunks,
        status: UPLOAD_STATUS.UPLOADING,
      },
    });

    res.json({
      success: true,
      data: {
        uploadedChunks,
        totalChunks: uploadProgress.totalChunks,
        progress: Math.round((uploadedChunks / uploadProgress.totalChunks) * 100),
      },
    });
  })
);

/**
 * POST /api/documents/:id/complete
 * Complete file upload
 */
router.post(
  '/:id/complete',
  authenticate,
  [body('parts').optional().isArray()],
  asyncHandler(async (req, res) => {
    const documentId = req.params.id;
    const { parts } = req.body;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { uploadProgress: true },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    if (document.uploadedBy !== req.user.id && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    const uploadProgress = document.uploadProgress;
    if (!uploadProgress) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'No upload in progress');
    }

    // For multipart uploads, complete the upload
    if (uploadProgress.multipartUploadId && parts) {
      await storage.completeMultipartUpload(
        document.storageKey,
        uploadProgress.multipartUploadId,
        parts
      );
    }

    // Mark upload as completed
    await prisma.documentUpload.update({
      where: { documentId },
      data: {
        status: UPLOAD_STATUS.COMPLETED,
        uploadedChunks: uploadProgress.totalChunks,
      },
    });

    // Get full document info with meeting to send notification
    const fullDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        meeting: {
          include: {
            committee: true,
          },
        },
      },
    });

    // Notify meeting attendees about new document
    if (fullDocument?.meeting) {
      pushNotification.notifyMeetingAttendees(
        fullDocument.meetingId,
        {
          type: 'document_added',
          title: 'New Document Added',
          body: `"${document.fileName}" added to ${fullDocument.meeting.title}`,
          senderId: req.user.id,
          data: { meetingId: fullDocument.meetingId, type: 'document_added' },
        },
        { excludeUserId: req.user.id }
      ).catch(console.error);
    }

    res.json({
      success: true,
      data: {
        documentId,
        status: UPLOAD_STATUS.COMPLETED,
      },
    });
  })
);

/**
 * POST /api/documents/:id/abort
 * Abort/cancel file upload
 */
router.post(
  '/:id/abort',
  authenticate,
  asyncHandler(async (req, res) => {
    const documentId = req.params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { uploadProgress: true },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    if (document.uploadedBy !== req.user.id && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    // Abort multipart upload if exists
    if (document.uploadProgress?.multipartUploadId) {
      await storage.abortMultipartUpload(
        document.storageKey,
        document.uploadProgress.multipartUploadId
      );
    }

    // Delete document record
    await prisma.document.delete({ where: { id: documentId } });

    res.json({
      success: true,
      message: 'Upload aborted and document deleted',
    });
  })
);

/**
 * POST /api/documents/:id/resume
 * Resume a failed/partial upload
 */
router.post(
  '/:id/resume',
  authenticate,
  asyncHandler(async (req, res) => {
    const documentId = req.params.id;

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { uploadProgress: true },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    if (document.uploadedBy !== req.user.id && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    const uploadProgress = document.uploadProgress;
    if (!uploadProgress || uploadProgress.status === UPLOAD_STATUS.COMPLETED) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'No incomplete upload to resume');
    }

    // Get remaining chunks
    const completedChunks = Object.keys(uploadProgress.chunkDetails || {}).map(Number);
    const remainingChunks = [];

    for (let i = 1; i <= uploadProgress.totalChunks; i++) {
      if (!completedChunks.includes(i)) {
        remainingChunks.push(i);
      }
    }

    // Generate new presigned URLs for remaining chunks
    let presignedUrls;
    if (uploadProgress.multipartUploadId) {
      presignedUrls = await storage.getMultipartPresignedUrls(
        document.storageKey,
        uploadProgress.multipartUploadId,
        uploadProgress.totalChunks
      );
      // Filter to only remaining chunks
      presignedUrls = presignedUrls.filter((p) => remainingChunks.includes(p.partNumber));
    } else {
      const presignedUrl = await storage.getUploadPresignedUrl(
        document.storageKey,
        document.mimeType
      );
      presignedUrls = [{ partNumber: 1, presignedUrl }];
    }

    // Update expiry
    await prisma.documentUpload.update({
      where: { documentId },
      data: {
        expiresAt: new Date(Date.now() + config.upload.presignedUrlExpiry * 1000),
        status: UPLOAD_STATUS.UPLOADING,
      },
    });

    res.json({
      success: true,
      data: {
        documentId,
        storageKey: document.storageKey,
        presignedUrls,
        completedChunks,
        remainingChunks,
        totalChunks: uploadProgress.totalChunks,
      },
    });
  })
);

/**
 * GET /api/documents/:id/download
 * Get presigned download URL
 */
router.get(
  '/:id/download',
  authenticate,
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: {
        meeting: true,
        uploadProgress: true,
      },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    // Check if upload is complete
    if (document.uploadProgress?.status !== UPLOAD_STATUS.COMPLETED) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Document upload is not complete');
    }

    // Check access (user must be member of the committee)
    const isMember = req.user.committeeMemberships.some(
      (m) => m.committeeId === document.meeting.committeeId
    );

    if (!isMember && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    const downloadUrl = await storage.getDownloadPresignedUrl(document.storageKey, document.mimeType, document.fileName);

    res.json({
      success: true,
      data: {
        downloadUrl,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        expiresIn: config.upload.presignedUrlExpiry,
      },
    });
  })
);

/**
 * GET /api/documents/meeting/:meetingId
 * Get all documents and folders for a meeting
 */
router.get(
  '/meeting/:meetingId',
  authenticate,
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.meetingId },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    // Check access
    const isMember = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId
    );

    if (!isMember && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    // Get folders
    const folders = await prisma.documentFolder.findMany({
      where: { meetingId: req.params.meetingId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Get documents
    const documents = await prisma.document.findMany({
      where: { meetingId: req.params.meetingId },
      include: {
        uploadProgress: {
          select: {
            status: true,
            uploadedChunks: true,
            totalChunks: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({
      success: true,
      data: {
        folders,
        documents,
      },
    });
  })
);

/**
 * DELETE /api/documents/:id
 * Delete document (Organiser only)
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { meeting: true, uploadProgress: true },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    // Check if user is organiser
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === document.meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can delete documents');
    }

    // Delete from storage
    try {
      await storage.deleteFile(document.storageKey);
    } catch (err) {
      console.error('Failed to delete file from storage:', err);
    }

    // Delete from database
    await prisma.document.delete({ where: { id: req.params.id } });

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  })
);

// ============================================
// FOLDER MANAGEMENT ENDPOINTS
// ============================================

/**
 * POST /api/documents/folders
 * Create a new folder (supports unlimited nesting)
 */
router.post(
  '/folders',
  authenticate,
  [
    body('meetingId').notEmpty().withMessage('Meeting ID is required'),
    body('name').notEmpty().trim().withMessage('Folder name is required'),
    body('parentId').optional({ nullable: true }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const { meetingId, name, parentId } = req.body;

    // Check meeting exists and user is organiser
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can create folders');
    }

    // If parentId provided, validate it exists and belongs to same meeting
    let parentPath = '';
    if (parentId) {
      const parentFolder = await prisma.documentFolder.findUnique({
        where: { id: parentId },
      });

      if (!parentFolder) {
        throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Parent folder not found');
      }

      if (parentFolder.meetingId !== meetingId) {
        throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Parent folder belongs to a different meeting');
      }

      parentPath = parentFolder.path;
    }

    // Build full path
    const folderPath = parentPath ? `${parentPath}/${name}` : name;

    // Check for duplicate folder name at same level
    const existingFolder = await prisma.documentFolder.findFirst({
      where: {
        meetingId,
        parentId: parentId || null,
        name,
      },
    });

    if (existingFolder) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'A folder with this name already exists at this level');
    }

    // Get max sortOrder for this level
    const maxSortOrder = await prisma.documentFolder.aggregate({
      where: { meetingId, parentId: parentId || null },
      _max: { sortOrder: true },
    });

    const folder = await prisma.documentFolder.create({
      data: {
        meetingId,
        name,
        path: folderPath,
        parentId: parentId || null,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
      },
      include: {
        children: true,
        documents: true,
      },
    });

    res.status(201).json({
      success: true,
      data: folder,
    });
  })
);

/**
 * PUT /api/documents/folders/:id
 * Rename a folder
 */
router.put(
  '/folders/:id',
  authenticate,
  [
    body('name').notEmpty().trim().withMessage('Folder name is required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, errors.array()[0].msg);
    }

    const folderId = req.params.id;
    const { name } = req.body;

    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: { meeting: true },
    });

    if (!folder) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Folder not found');
    }

    // Check if user is organiser
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === folder.meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can rename folders');
    }

    // Check for duplicate name at same level
    const existingFolder = await prisma.documentFolder.findFirst({
      where: {
        meetingId: folder.meetingId,
        parentId: folder.parentId,
        name,
        id: { not: folderId },
      },
    });

    if (existingFolder) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'A folder with this name already exists at this level');
    }

    // Calculate old and new path prefixes
    const oldPath = folder.path;
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = name;
    const newPath = pathParts.join('/');

    // Update folder and all descendants' paths
    await prisma.$transaction(async (tx) => {
      // Update the folder itself
      await tx.documentFolder.update({
        where: { id: folderId },
        data: { name, path: newPath },
      });

      // Update all descendant folders' paths
      const descendants = await tx.documentFolder.findMany({
        where: {
          meetingId: folder.meetingId,
          path: { startsWith: oldPath + '/' },
        },
      });

      for (const descendant of descendants) {
        const updatedPath = descendant.path.replace(oldPath, newPath);
        await tx.documentFolder.update({
          where: { id: descendant.id },
          data: { path: updatedPath },
        });
      }

      // Update all documents' paths within this folder tree
      const documents = await tx.document.findMany({
        where: {
          meetingId: folder.meetingId,
          path: { startsWith: oldPath },
        },
      });

      for (const doc of documents) {
        const updatedPath = doc.path.replace(oldPath, newPath);
        await tx.document.update({
          where: { id: doc.id },
          data: { path: updatedPath },
        });
      }
    });

    const updatedFolder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: { children: true, documents: true },
    });

    res.json({
      success: true,
      data: updatedFolder,
    });
  })
);

/**
 * DELETE /api/documents/folders/:id
 * Delete a folder and all its contents (subfolders + documents)
 */
router.delete(
  '/folders/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const folderId = req.params.id;

    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: { meeting: true },
    });

    if (!folder) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Folder not found');
    }

    // Check if user is organiser
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === folder.meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can delete folders');
    }

    // Get all documents in this folder and descendants to delete from storage
    const documentsToDelete = await prisma.document.findMany({
      where: {
        meetingId: folder.meetingId,
        OR: [
          { folderId: folderId },
          { path: { startsWith: folder.path + '/' } },
        ],
      },
      select: { storageKey: true },
    });

    // Delete files from storage
    for (const doc of documentsToDelete) {
      try {
        await storage.deleteFile(doc.storageKey);
      } catch (err) {
        console.error('Failed to delete file from storage:', err);
      }
    }

    // Delete folder (cascade will delete children folders and documents due to onDelete: Cascade)
    await prisma.documentFolder.delete({ where: { id: folderId } });

    res.json({
      success: true,
      message: 'Folder and all contents deleted successfully',
    });
  })
);

/**
 * PUT /api/documents/:id/move
 * Move a document to a different folder
 */
router.put(
  '/:id/move',
  authenticate,
  [
    body('folderId').optional({ nullable: true }),
  ],
  asyncHandler(async (req, res) => {
    const documentId = req.params.id;
    const { folderId } = req.body; // null means move to root

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { meeting: true },
    });

    if (!document) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Document not found');
    }

    // Check if user is organiser
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === document.meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can move documents');
    }

    // If moving to a folder, validate it
    let newPath = document.fileName;
    if (folderId) {
      const targetFolder = await prisma.documentFolder.findUnique({
        where: { id: folderId },
      });

      if (!targetFolder) {
        throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Target folder not found');
      }

      if (targetFolder.meetingId !== document.meetingId) {
        throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Cannot move document to a folder in a different meeting');
      }

      newPath = `${targetFolder.path}/${document.fileName}`;
    }

    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        folderId: folderId || null,
        path: newPath,
      },
      include: {
        folder: true,
        uploadProgress: {
          select: { status: true },
        },
      },
    });

    res.json({
      success: true,
      data: updatedDocument,
    });
  })
);

/**
 * PUT /api/documents/folders/:id/move
 * Move a folder to a different parent (supports unlimited nesting)
 */
router.put(
  '/folders/:id/move',
  authenticate,
  [
    body('parentId').optional({ nullable: true }),
  ],
  asyncHandler(async (req, res) => {
    const folderId = req.params.id;
    const { parentId } = req.body; // null means move to root

    const folder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: { meeting: true },
    });

    if (!folder) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Folder not found');
    }

    // Check if user is organiser
    const isOrganiser = req.user.committeeMemberships.some(
      (m) => m.committeeId === folder.meeting.committeeId && m.role === 'organiser'
    );

    if (!isOrganiser && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Only organiser can move folders');
    }

    // Cannot move folder into itself
    if (parentId === folderId) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Cannot move folder into itself');
    }

    // Build new path
    let newParentPath = '';
    if (parentId) {
      const targetParent = await prisma.documentFolder.findUnique({
        where: { id: parentId },
      });

      if (!targetParent) {
        throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Target parent folder not found');
      }

      if (targetParent.meetingId !== folder.meetingId) {
        throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Cannot move folder to a different meeting');
      }

      // Cannot move folder into its own descendant
      if (targetParent.path.startsWith(folder.path + '/')) {
        throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'Cannot move folder into its own subfolder');
      }

      newParentPath = targetParent.path;
    }

    const oldPath = folder.path;
    const newPath = newParentPath ? `${newParentPath}/${folder.name}` : folder.name;

    // Check for duplicate name at target level
    const existingFolder = await prisma.documentFolder.findFirst({
      where: {
        meetingId: folder.meetingId,
        parentId: parentId || null,
        name: folder.name,
        id: { not: folderId },
      },
    });

    if (existingFolder) {
      throw new ApiError(400, API_ERRORS.VALIDATION_ERROR, 'A folder with this name already exists at the target location');
    }

    // Update folder and all descendants' paths
    await prisma.$transaction(async (tx) => {
      // Update the folder itself
      await tx.documentFolder.update({
        where: { id: folderId },
        data: { parentId: parentId || null, path: newPath },
      });

      // Update all descendant folders' paths
      const descendants = await tx.documentFolder.findMany({
        where: {
          meetingId: folder.meetingId,
          path: { startsWith: oldPath + '/' },
        },
      });

      for (const descendant of descendants) {
        const updatedPath = descendant.path.replace(oldPath, newPath);
        await tx.documentFolder.update({
          where: { id: descendant.id },
          data: { path: updatedPath },
        });
      }

      // Update all documents' paths within this folder tree
      const documents = await tx.document.findMany({
        where: {
          meetingId: folder.meetingId,
          path: { startsWith: oldPath },
        },
      });

      for (const doc of documents) {
        const updatedPath = doc.path.replace(oldPath, newPath);
        await tx.document.update({
          where: { id: doc.id },
          data: { path: updatedPath },
        });
      }
    });

    const updatedFolder = await prisma.documentFolder.findUnique({
      where: { id: folderId },
      include: { children: true, documents: true },
    });

    res.json({
      success: true,
      data: updatedFolder,
    });
  })
);

/**
 * GET /api/documents/meeting/:meetingId/tree
 * Get complete folder/document tree structure for a meeting
 */
router.get(
  '/meeting/:meetingId/tree',
  authenticate,
  asyncHandler(async (req, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.meetingId },
    });

    if (!meeting) {
      throw new ApiError(404, API_ERRORS.NOT_FOUND, 'Meeting not found');
    }

    // Check access
    const isMember = req.user.committeeMemberships.some(
      (m) => m.committeeId === meeting.committeeId
    );

    if (!isMember && !req.user.isAdmin) {
      throw new ApiError(403, API_ERRORS.FORBIDDEN, 'Access denied');
    }

    // Get all folders
    const folders = await prisma.documentFolder.findMany({
      where: { meetingId: req.params.meetingId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    // Get all documents
    const documents = await prisma.document.findMany({
      where: { meetingId: req.params.meetingId },
      include: {
        uploadProgress: {
          select: { status: true, uploadedChunks: true, totalChunks: true },
        },
        uploader: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    // Build tree structure
    const buildTree = (parentId = null) => {
      const children = [];

      // Add folders at this level
      const levelFolders = folders.filter((f) => f.parentId === parentId);
      for (const folder of levelFolders) {
        children.push({
          id: folder.id,
          type: 'folder',
          name: folder.name,
          path: folder.path,
          sortOrder: folder.sortOrder,
          createdAt: folder.createdAt,
          children: buildTree(folder.id),
        });
      }

      // Add documents at this level
      const levelDocuments = documents.filter((d) => d.folderId === parentId);
      for (const doc of levelDocuments) {
        children.push({
          id: doc.id,
          type: 'file',
          name: doc.name,
          fileName: doc.fileName,
          path: doc.path,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          sortOrder: doc.sortOrder,
          createdAt: doc.createdAt,
          uploadStatus: doc.uploadProgress?.status,
          uploadProgress: doc.uploadProgress
            ? Math.round((doc.uploadProgress.uploadedChunks / doc.uploadProgress.totalChunks) * 100)
            : null,
          uploader: doc.uploader,
        });
      }

      return children;
    };

    const tree = buildTree(null);

    res.json({
      success: true,
      data: {
        meetingId: req.params.meetingId,
        tree,
        stats: {
          totalFolders: folders.length,
          totalDocuments: documents.length,
        },
      },
    });
  })
);

module.exports = router;
