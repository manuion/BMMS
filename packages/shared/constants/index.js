// User Roles
const USER_ROLES = {
  ADMIN: 'admin',
  ORGANISER: 'organiser',
  MEMBER: 'member',
};

// Committee Member Roles (role within a specific committee)
const COMMITTEE_ROLES = {
  ORGANISER: 'organiser',
  MEMBER: 'member',
};

// Meeting Status
const MEETING_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  RESCHEDULED: 'rescheduled',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
};

// Meeting Response Status (member's response to meeting invite)
const RESPONSE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

// Document Upload Status
const UPLOAD_STATUS = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

// File upload constants
const FILE_UPLOAD = {
  MAX_FILE_SIZE: 60 * 1024 * 1024, // 60 MB
  MAX_FILES_PER_MEETING: 60,
  CHUNK_SIZE: 5 * 1024 * 1024, // 5 MB chunks for multipart upload
  PRESIGNED_URL_EXPIRY: 60 * 60, // 1 hour in seconds
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
  ],
};

// API Response codes
const API_ERRORS = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UPLOAD_FAILED: 'UPLOAD_FAILED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  SERVER_ERROR: 'SERVER_ERROR',
};

// Notification Types
const NOTIFICATION_TYPES = {
  MEETING_INVITE: 'meeting_invite',
  MEETING_REMINDER: 'meeting_reminder',
  MEETING_CANCELLED: 'meeting_cancelled',
  MEETING_RESCHEDULED: 'meeting_rescheduled',
  DOCUMENT_ADDED: 'document_added',
  RESPONSE_RECEIVED: 'response_received',
};

module.exports = {
  USER_ROLES,
  COMMITTEE_ROLES,
  MEETING_STATUS,
  RESPONSE_STATUS,
  UPLOAD_STATUS,
  FILE_UPLOAD,
  API_ERRORS,
  NOTIFICATION_TYPES,
};
