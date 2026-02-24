import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import FileViewer from 'react-native-file-viewer';
import RNFS from 'react-native-fs';
import { documentsApi } from '../../services/api';
import offlineStorage from '../../services/offlineStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function DocumentViewerScreen({ route, navigation }) {
  const { document: doc, isOffline: isOfflineDoc } = route.params;
  const { isConnected } = useNetworkStatus();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [isAvailableOffline, setIsAvailableOffline] = useState(isOfflineDoc);
  const [error, setError] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      title: doc.fileName,
      headerTitleStyle: { fontSize: 14 },
    });
    openDocument();
  }, []);

  const openDocument = async () => {
    setLoading(true);
    setError(null);

    try {
      if (isOfflineDoc) {
        // Open from offline storage
        await openOfflineDocument();
      } else {
        // Download and open online document
        await openOnlineDocument();
      }
    } catch (err) {
      console.error('Failed to open document:', err);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const openOfflineDocument = async () => {
    const localPath = await offlineStorage.getOfflineDocumentPath(doc.id);
    if (localPath) {
      await openWithFileViewer(localPath);
    } else {
      setError('File not found in local storage');
    }
  };

  const openOnlineDocument = async () => {
    const res = await documentsApi.getDownloadUrl(doc.id);
    let url = res.data?.downloadUrl;

    if (!url) {
      setError('Document URL not available');
      return;
    }

    // Replace localhost with Android emulator host IP
    if (Platform.OS === 'android' && url.includes('localhost')) {
      url = url.replace('localhost', '10.0.2.2');
    }

    // Download to temp directory
    const ext = doc.fileName.split('.').pop();
    const tempPath = `${RNFS.CachesDirectoryPath}/${doc.id}.${ext}`;

    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: tempPath,
    }).promise;

    if (downloadResult.statusCode === 200) {
      await openWithFileViewer(tempPath);
    } else {
      setError('Failed to download document');
    }
  };

  const openWithFileViewer = async (filePath) => {
    try {
      await FileViewer.open(filePath, {
        showOpenWithDialog: true,
        displayName: doc.fileName,
      });
    } catch (err) {
      console.error('FileViewer error:', err);
      // Check if it's a "no app" error
      if (err.message?.includes('No app associated') || err.message?.includes('No Activity found')) {
        Alert.alert(
          'No Viewer App',
          'No app is installed to view this file type. Would you like to install a PDF viewer?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Store',
              onPress: () => {
                const storeUrl = Platform.OS === 'android'
                  ? 'market://search?q=pdf+viewer'
                  : 'https://apps.apple.com/search?term=pdf+viewer';
                Linking.openURL(storeUrl);
              },
            },
          ]
        );
      }
    }
  };

  const handleSaveForOffline = async () => {
    if (!isConnected) {
      Alert.alert('Offline', 'You need to be online to save documents for offline viewing');
      return;
    }

    try {
      setSaving(true);
      setSaveProgress(0);

      const res = await documentsApi.getDownloadUrl(doc.id);
      let downloadUrl = res.data?.downloadUrl;

      if (!downloadUrl) {
        Alert.alert('Error', 'Document URL not available');
        return;
      }

      // Replace localhost with Android emulator host IP
      if (Platform.OS === 'android' && downloadUrl.includes('localhost')) {
        downloadUrl = downloadUrl.replace('localhost', '10.0.2.2');
      }

      // Download to sandbox with progress
      await offlineStorage.downloadDocument(doc, downloadUrl, (progress) => {
        setSaveProgress(Math.round(progress));
      });

      setIsAvailableOffline(true);
      Alert.alert('Saved', `"${doc.fileName}" is now available offline`);
    } catch (err) {
      console.error('Save offline error:', err);
      Alert.alert('Error', 'Failed to save document for offline viewing');
    } finally {
      setSaving(false);
      setSaveProgress(0);
    }
  };

  const handleRetry = () => {
    openDocument();
  };

  const handleOpenAgain = () => {
    openDocument();
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorIcon}>!</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.docInfo}>
            <View style={styles.docIconContainer}>
              <Text style={styles.docIcon}>
                {doc.fileName.endsWith('.pdf') ? 'PDF' : 'DOC'}
              </Text>
            </View>
            <View style={styles.docDetails}>
              <Text style={styles.docName}>{doc.fileName}</Text>
              <Text style={styles.docMeta}>
                {isAvailableOffline ? 'Available offline' : 'Online only'}
              </Text>
            </View>
          </View>

          {/* Open Document Button */}
          <TouchableOpacity style={styles.openButton} onPress={handleOpenAgain}>
            <Text style={styles.openButtonText}>Open Document</Text>
          </TouchableOpacity>

          {/* Save for Offline Button - Only show if not already saved and connected */}
          {!isAvailableOffline && isConnected && (
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSaveForOffline}
              disabled={saving}
            >
              {saving ? (
                <View style={styles.savingContainer}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={styles.saveButtonText}>
                    Saving... {saveProgress}%
                  </Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>Save for Offline</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Already saved indicator */}
          {isAvailableOffline && (
            <View style={styles.savedIndicator}>
              <Text style={styles.savedIcon}>✓</Text>
              <Text style={styles.savedText}>Saved for offline viewing</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorIcon: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  docInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  docIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  docIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  docDetails: {
    flex: 1,
  },
  docName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 14,
    color: '#6b7280',
  },
  openButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  savedIcon: {
    fontSize: 20,
    color: '#22c55e',
    fontWeight: 'bold',
  },
  savedText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
});
