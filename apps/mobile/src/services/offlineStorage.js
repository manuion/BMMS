import AsyncStorage from '@react-native-async-storage/async-storage';

const OFFLINE_DOCS_KEY = 'offline_documents';

// Note: For full offline file storage, you would need to install react-native-fs
// For now, we'll just store metadata about documents

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
 * Download document for offline viewing (simplified - just saves metadata)
 */
export const downloadDocument = async (document, downloadUrl) => {
  try {
    // In a full implementation, we would use react-native-fs to download the file
    // For now, just save metadata
    await saveDocumentMetadata({
      ...document,
      downloadUrl,
      isOffline: true,
    });
    return true;
  } catch (error) {
    console.error('Failed to download document:', error);
    throw error;
  }
};

/**
 * Delete offline document
 */
export const deleteOfflineDocument = async (documentId) => {
  try {
    const documents = await getOfflineDocuments();
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
    return documents.some((d) => d.id === documentId);
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
    return doc?.localPath || doc?.downloadUrl || null;
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
    return documents.reduce((total, doc) => total + (doc.fileSize || 0), 0);
  } catch (error) {
    console.error('Failed to get storage size:', error);
    return 0;
  }
};

/**
 * Clear all offline documents
 */
export const clearOfflineStorage = async () => {
  try {
    await AsyncStorage.removeItem(OFFLINE_DOCS_KEY);
  } catch (error) {
    console.error('Failed to clear offline storage:', error);
    throw error;
  }
};

export default {
  saveDocumentMetadata,
  getOfflineDocuments,
  downloadDocument,
  deleteOfflineDocument,
  isDocumentOffline,
  getOfflineDocumentPath,
  getOfflineStorageSize,
  clearOfflineStorage,
};
