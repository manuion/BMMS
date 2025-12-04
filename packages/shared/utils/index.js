/**
 * Format date to readable string
 * @param {Date|string} date
 * @returns {string}
 */
const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Format time to readable string
 * @param {Date|string} date
 * @returns {string}
 */
const formatTime = (date) => {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Format file size to human readable
 * @param {number} bytes
 * @returns {string}
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Generate a random string
 * @param {number} length
 * @returns {string}
 */
const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Calculate number of chunks for file upload
 * @param {number} fileSize
 * @param {number} chunkSize
 * @returns {number}
 */
const calculateChunks = (fileSize, chunkSize) => {
  return Math.ceil(fileSize / chunkSize);
};

/**
 * Check if user has organiser role in any committee
 * @param {Array} memberships - Array of committee memberships
 * @returns {boolean}
 */
const isOrganiserInAnyCommittee = (memberships) => {
  return memberships.some((m) => m.role === 'organiser');
};

/**
 * Get committees where user is organiser
 * @param {Array} memberships - Array of committee memberships
 * @returns {Array}
 */
const getOrganiserCommittees = (memberships) => {
  return memberships.filter((m) => m.role === 'organiser').map((m) => m.committee);
};

/**
 * Validate email format
 * @param {string} email
 * @returns {boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Truncate string with ellipsis
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
const truncate = (str, maxLength = 50) => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

module.exports = {
  formatDate,
  formatTime,
  formatFileSize,
  generateRandomString,
  calculateChunks,
  isOrganiserInAnyCommittee,
  getOrganiserCommittees,
  isValidEmail,
  truncate,
};
