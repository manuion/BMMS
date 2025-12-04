/**
 * Format file size to human readable
 * @param {number} bytes
 * @returns {string}
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Calculate number of chunks for file upload
 * @param {number} fileSize
 * @param {number} chunkSize
 * @returns {number}
 */
export const calculateChunks = (fileSize, chunkSize) => {
  return Math.ceil(fileSize / chunkSize);
};
