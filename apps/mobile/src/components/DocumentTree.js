import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { formatFileSize } from '../utils/helpers';

/**
 * DocumentTree Component for Mobile
 *
 * Displays uploaded documents in a hierarchical tree structure.
 * Supports expand/collapse folders and file actions.
 */
export default function DocumentTree({
  folders = [],
  documents = [],
  onViewDocument,
  onDownloadOffline,
  offlineDocIds = [],
}) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Build nested structure from flat data
  const buildTree = () => {
    const folderMap = {};
    folders.forEach((f) => {
      folderMap[f.id] = { ...f, children: [], files: [] };
    });

    // Link folders to parents
    folders.forEach((f) => {
      if (f.parentId && folderMap[f.parentId]) {
        folderMap[f.parentId].children.push(folderMap[f.id]);
      }
    });

    // Get root folders
    const rootFolders = folders
      .filter((f) => !f.parentId)
      .map((f) => folderMap[f.id]);

    // Get root files
    const rootFiles = documents.filter((d) => !d.folderId);

    // Add files to their folders
    documents
      .filter((d) => d.folderId)
      .forEach((doc) => {
        if (folderMap[doc.folderId]) {
          folderMap[doc.folderId].files.push(doc);
        }
      });

    return { folders: rootFolders, files: rootFiles };
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
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

  const renderFolder = (folder, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children.length > 0 || folder.files.length > 0;

    return (
      <View key={folder.id}>
        <TouchableOpacity
          style={[styles.itemRow, { paddingLeft: depth * 16 + 12 }]}
          onPress={() => toggleFolder(folder.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.folderIcon}>
            {isExpanded ? '📂' : '📁'}
          </Text>
          <Text style={styles.folderName}>{folder.name}</Text>
          {hasChildren && (
            <Text style={styles.chevron}>
              {isExpanded ? '▼' : '▶'}
            </Text>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View>
            {folder.children.map((child) => renderFolder(child, depth + 1))}
            {folder.files.map((file) => renderFile(file, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const renderFile = (doc, depth = 0) => {
    const isOffline = offlineDocIds.includes(doc.id);

    return (
      <TouchableOpacity
        key={doc.id}
        style={[styles.itemRow, styles.fileRow, { paddingLeft: depth * 16 + 28 }]}
        onPress={() => onViewDocument?.(doc)}
        activeOpacity={0.7}
      >
        <View style={[styles.fileIcon, { backgroundColor: getIconColor(doc.fileName) }]}>
          <Text style={styles.fileIconText}>{getFileIcon(doc.fileName)}</Text>
        </View>

        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {doc.fileName}
          </Text>
          <Text style={styles.fileMeta}>
            {formatFileSize(doc.fileSize)}
            {isOffline && ' • Offline'}
          </Text>
        </View>

        {isOffline ? (
          <View style={styles.offlineBadge}>
            <Text style={styles.offlineBadgeText}>✓</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.downloadBtn}
            onPress={() => onDownloadOffline?.(doc)}
          >
            <Text style={styles.downloadBtnText}>↓</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
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

  const tree = buildTree();
  const totalItems = folders.length + documents.length;

  if (totalItems === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={styles.emptyText}>No documents uploaded yet</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {tree.folders.map((folder) => renderFolder(folder))}
      {tree.files.map((file) => renderFile(file))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  fileRow: {
    backgroundColor: '#fafafa',
  },
  folderIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  folderName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  chevron: {
    fontSize: 10,
    color: '#9ca3af',
    marginLeft: 8,
  },
  fileIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  fileIconText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  offlineBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  downloadBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
});
