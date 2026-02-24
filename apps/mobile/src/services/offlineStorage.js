import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const OFFLINE_DOCS_KEY = 'offline_documents';
const OFFLINE_MEETINGS_KEY = 'offline_meetings';
const OFFLINE_DOCS_DIR = `${RNFS.DocumentDirectoryPath}/offline_documents`;

/**
 * Initialize offline storage directory
 */
const ensureOfflineDir = async () => {
  try {
    const exists = await RNFS.exists(OFFLINE_DOCS_DIR);
    if (!exists) {
      await RNFS.mkdir(OFFLINE_DOCS_DIR);
    }
  } catch (error) {
    console.error('Failed to create offline directory:', error);
  }
};

// Initialize on import
ensureOfflineDir();

/**
 * Get local file path for a document
 */
const getLocalFilePath = (documentId, fileName) => {
  const ext = fileName.split('.').pop();
  return `${OFFLINE_DOCS_DIR}/${documentId}.${ext}`;
};

/**
 * Save document metadata for offline access
 */
export const saveDocumentMetadata = async (document) => {
  try {
    const existing = await getOfflineDocuments();
    const updated = existing.filter((d) => d.id !== document.id);
    updated.push({
      ...document,
      savedAt: new Date().toISOString(),
    });
    await AsyncStorage.setItem(OFFLINE_DOCS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save document metadata:', error);
    throw error;
  }
};

/**
 * Get all offline document metadata
 */
export const getOfflineDocuments = async () => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_DOCS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get offline documents:', error);
    return [];
  }
};

/**
 * Download document for offline viewing using react-native-fs
 * Downloads the actual file to device storage
 */
export const downloadDocument = async (document, downloadUrl, onProgress = null) => {
  try {
    await ensureOfflineDir();

    const localPath = getLocalFilePath(document.id, document.fileName);

    // Download the file
    const downloadOptions = {
      fromUrl: downloadUrl,
      toFile: localPath,
      background: true,
      discretionary: true,
      progress: (res) => {
        if (onProgress) {
          const progress = (res.bytesWritten / res.contentLength) * 100;
          onProgress(progress);
        }
      },
    };

    const result = await RNFS.downloadFile(downloadOptions).promise;

    if (result.statusCode === 200) {
      // Save metadata with local path
      await saveDocumentMetadata({
        ...document,
        localPath,
        isOffline: true,
        downloadedAt: new Date().toISOString(),
      });
      return true;
    } else {
      throw new Error(`Download failed with status: ${result.statusCode}`);
    }
  } catch (error) {
    console.error('Failed to download document:', error);
    throw error;
  }
};

/**
 * Delete offline document and its file
 */
export const deleteOfflineDocument = async (documentId) => {
  try {
    // Get document info first
    const documents = await getOfflineDocuments();
    const doc = documents.find((d) => d.id === documentId);

    // Delete the file if it exists
    if (doc?.localPath) {
      const exists = await RNFS.exists(doc.localPath);
      if (exists) {
        await RNFS.unlink(doc.localPath);
      }
    }

    // Remove from metadata
    const updated = documents.filter((d) => d.id !== documentId);
    await AsyncStorage.setItem(OFFLINE_DOCS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete offline document:', error);
    throw error;
  }
};

/**
 * Check if document is available offline
 */
export const isDocumentOffline = async (documentId) => {
  try {
    const documents = await getOfflineDocuments();
    const doc = documents.find((d) => d.id === documentId);
    if (!doc || !doc.localPath) return false;

    // Also verify the file actually exists
    const exists = await RNFS.exists(doc.localPath);
    return exists;
  } catch (error) {
    return false;
  }
};

/**
 * Get local path for offline document
 */
export const getOfflineDocumentPath = async (documentId) => {
  try {
    const documents = await getOfflineDocuments();
    const doc = documents.find((d) => d.id === documentId);
    if (!doc?.localPath) return null;

    // Verify file exists
    const exists = await RNFS.exists(doc.localPath);
    return exists ? doc.localPath : null;
  } catch (error) {
    return null;
  }
};

/**
 * Get total size of offline documents
 */
export const getOfflineStorageSize = async () => {
  try {
    const documents = await getOfflineDocuments();
    let totalSize = 0;

    for (const doc of documents) {
      if (doc.localPath) {
        try {
          const stat = await RNFS.stat(doc.localPath);
          totalSize += parseInt(stat.size, 10);
        } catch {
          // File might not exist, use metadata size
          totalSize += doc.fileSize || 0;
        }
      } else {
        totalSize += doc.fileSize || 0;
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Failed to get storage size:', error);
    return 0;
  }
};

/**
 * Clear all offline documents and files
 */
export const clearOfflineStorage = async () => {
  try {
    // Delete all files in the directory
    const exists = await RNFS.exists(OFFLINE_DOCS_DIR);
    if (exists) {
      const files = await RNFS.readDir(OFFLINE_DOCS_DIR);
      for (const file of files) {
        await RNFS.unlink(file.path);
      }
    }

    // Clear metadata
    await AsyncStorage.removeItem(OFFLINE_DOCS_KEY);
  } catch (error) {
    console.error('Failed to clear offline storage:', error);
    throw error;
  }
};

// ============================================
// MEETING CACHING FOR OFFLINE VIEW
// ============================================

/**
 * Save meetings data for offline access
 * Called on every app load when online
 */
export const saveMeetingsOffline = async (meetings) => {
  try {
    const data = {
      meetings,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(OFFLINE_MEETINGS_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save meetings offline:', error);
  }
};

/**
 * Get cached meetings for offline viewing
 */
export const getOfflineMeetings = async () => {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_MEETINGS_KEY);
    if (!data) return { meetings: [], cachedAt: null };
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get offline meetings:', error);
    return { meetings: [], cachedAt: null };
  }
};

/**
 * Save single meeting detail for offline viewing
 */
export const saveMeetingDetailOffline = async (meetingId, meetingData, folders, documents) => {
  try {
    const key = `offline_meeting_${meetingId}`;
    const data = {
      meeting: meetingData,
      folders,
      documents,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save meeting detail offline:', error);
  }
};

/**
 * Get cached meeting detail for offline viewing
 */
export const getOfflineMeetingDetail = async (meetingId) => {
  try {
    const key = `offline_meeting_${meetingId}`;
    const data = await AsyncStorage.getItem(key);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to get offline meeting detail:', error);
    return null;
  }
};

/**
 * Clear all meeting cache
 */
export const clearMeetingCache = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_MEETINGS_KEY);
    // Also clear individual meeting details
    const keys = await AsyncStorage.getAllKeys();
    const meetingKeys = keys.filter((k) => k.startsWith('offline_meeting_'));
    if (meetingKeys.length > 0) {
      await AsyncStorage.multiRemove(meetingKeys);
    }
  } catch (error) {
    console.error('Failed to clear meeting cache:', error);
  }
};

export default {
  // Document offline storage
  saveDocumentMetadata,
  getOfflineDocuments,
  downloadDocument,
  deleteOfflineDocument,
  isDocumentOffline,
  getOfflineDocumentPath,
  getOfflineStorageSize,
  clearOfflineStorage,
  // Meeting cache
  saveMeetingsOffline,
  getOfflineMeetings,
  saveMeetingDetailOffline,
  getOfflineMeetingDetail,
  clearMeetingCache,
};
