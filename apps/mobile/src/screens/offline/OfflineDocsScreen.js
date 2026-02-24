import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { format } from 'date-fns';
import FileViewer from 'react-native-file-viewer';
import offlineStorage from '../../services/offlineStorage';
import { formatFileSize } from '../../utils/helpers';

export default function OfflineDocsScreen({ navigation }) {
  const [documents, setDocuments] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOfflineDocuments = useCallback(async () => {
    const docs = await offlineStorage.getOfflineDocuments();
    setDocuments(docs);

    const size = await offlineStorage.getOfflineStorageSize();
    setTotalSize(size);

    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchOfflineDocuments();
  }, [fetchOfflineDocuments]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchOfflineDocuments();
    });
    return unsubscribe;
  }, [navigation, fetchOfflineDocuments]);

  const handleDelete = (doc) => {
    Alert.alert(
      'Delete Document',
      `Remove "${doc.fileName}" from offline storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.deleteOfflineDocument(doc.id);
            fetchOfflineDocuments();
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All',
      'Remove all offline documents? This will free up storage space.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await offlineStorage.clearOfflineStorage();
            fetchOfflineDocuments();
          },
        },
      ]
    );
  };

  const handleViewDocument = async (doc) => {
    if (!doc.localPath) {
      Alert.alert('Error', 'Local file path not found');
      return;
    }

    try {
      await FileViewer.open(doc.localPath, {
        showOpenWithDialog: true,
        displayName: doc.fileName,
      });
    } catch (error) {
      console.error('Failed to open file:', error);
      Alert.alert(
        'Cannot Open File',
        'Unable to open this file type on your device. Try installing an app that supports this file format.'
      );
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return 'PDF';
    if (['doc', 'docx'].includes(ext)) return 'DOC';
    if (['xls', 'xlsx'].includes(ext)) return 'XLS';
    if (['ppt', 'pptx'].includes(ext)) return 'PPT';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return 'IMG';
    return 'FILE';
  };

  const getIconColor = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) return '#ef4444';
    if (['doc', 'docx'].includes(ext)) return '#2563eb';
    if (['xls', 'xlsx'].includes(ext)) return '#22c55e';
    if (['ppt', 'pptx'].includes(ext)) return '#f97316';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '#8b5cf6';
    return '#6b7280';
  };

  const renderDocument = ({ item }) => (
    <TouchableOpacity
      style={styles.documentCard}
      onPress={() => handleViewDocument(item)}
    >
      <View style={[styles.documentIcon, { backgroundColor: getIconColor(item.fileName) }]}>
        <Text style={styles.iconText}>{getFileIcon(item.fileName)}</Text>
      </View>

      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.fileName}
        </Text>
        <Text style={styles.documentMeta}>
          {formatFileSize(item.fileSize)} • Saved{' '}
          {item.savedAt ? format(new Date(item.savedAt), 'MMM d, yyyy') : 'N/A'}
        </Text>
        {item.downloadedAt && (
          <Text style={styles.downloadedAt}>
            Downloaded: {format(new Date(item.downloadedAt), 'h:mm a')}
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item)}
      >
        <Text style={styles.deleteText}>X</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Storage Info */}
      <View style={styles.storageInfo}>
        <View>
          <Text style={styles.storageText}>
            {documents.length} document{documents.length !== 1 ? 's' : ''} saved
          </Text>
          <Text style={styles.storageSizeText}>
            {formatFileSize(totalSize)} used
          </Text>
        </View>
        {documents.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Document List */}
      <FlatList
        data={documents}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOfflineDocuments();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📥</Text>
            <Text style={styles.emptyTitle}>No Offline Documents</Text>
            <Text style={styles.emptyText}>
              Documents you save for offline viewing will appear here.
              {'\n\n'}
              Open any document from a meeting and tap "Save for Offline" to access it without internet.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  storageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  storageText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  storageSizeText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  clearText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 14,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  downloadedAt: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  deleteButton: {
    padding: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
});
