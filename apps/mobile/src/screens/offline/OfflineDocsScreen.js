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

  const handleViewDocument = (doc) => {
    Alert.alert('Document', `Would open: ${doc.fileName}`);
  };

  const renderDocument = ({ item }) => (
    <TouchableOpacity
      style={styles.documentCard}
      onPress={() => handleViewDocument(item)}
    >
      <View style={styles.documentIcon}>
        <Text style={styles.iconText}>PDF</Text>
      </View>

      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.fileName}
        </Text>
        <Text style={styles.documentMeta}>
          {formatFileSize(item.fileSize)} - Saved{' '}
          {item.savedAt ? format(new Date(item.savedAt), 'MMM d, yyyy') : 'N/A'}
        </Text>
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
        <Text style={styles.storageText}>
          {documents.length} documents - {formatFileSize(totalSize)} used
        </Text>
        {documents.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
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
            <Text style={styles.emptyIcon}>No Docs</Text>
            <Text style={styles.emptyTitle}>No Offline Documents</Text>
            <Text style={styles.emptyText}>
              Documents you save for offline viewing will appear here
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
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  storageText: {
    fontSize: 14,
    color: '#6b7280',
  },
  clearText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
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
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#e0e7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4338ca',
  },
  documentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ef4444',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 18,
    marginBottom: 16,
    color: '#9ca3af',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
