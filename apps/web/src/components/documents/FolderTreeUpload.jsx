import { useState, useRef } from 'react';
import {
  Upload,
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { formatFileSize } from '../../utils/helpers';
import { documentsApi } from '../../services/api';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

/**
 * FolderTreeUpload Component
 *
 * Allows uploading folders with nested structure.
 * Supports chunked/multipart uploads for large files using presigned URLs.
 * Shows tree preview before upload with progress tracking.
 */
export default function FolderTreeUpload({ meetingId, onUploadComplete, onCancel }) {
  const [treeData, setTreeData] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    currentFile: '',
    fileProgress: 0, // Progress within current file (for chunked uploads)
    status: 'idle', // idle, uploading, completed, error
  });
  const [fileStatuses, setFileStatuses] = useState({}); // Track individual file statuses
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Build tree structure from FileList
  const buildTreeFromFiles = (files) => {
    const root = { name: 'Root', type: 'folder', children: {}, files: [] };

    Array.from(files).forEach((file) => {
      const pathParts = file.webkitRelativePath.split('/');
      let current = root;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        if (!current.children[folderName]) {
          current.children[folderName] = {
            name: folderName,
            type: 'folder',
            path: pathParts.slice(0, i + 1).join('/'),
            children: {},
            files: [],
          };
        }
        current = current.children[folderName];
      }

      current.files.push({
        name: pathParts[pathParts.length - 1],
        type: 'file',
        path: file.webkitRelativePath,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        file: file,
      });
    });

    return root;
  };

  // Convert tree to flat structure for display
  const treeToList = (node, depth = 0, parentPath = '') => {
    const items = [];

    Object.values(node.children || {}).forEach((folder) => {
      const folderPath = parentPath ? `${parentPath}/${folder.name}` : folder.name;
      items.push({
        ...folder,
        depth,
        isExpanded: expandedFolders.has(folderPath),
        fullPath: folderPath,
      });

      if (expandedFolders.has(folderPath)) {
        items.push(...treeToList(folder, depth + 1, folderPath));
      }
    });

    (node.files || []).forEach((file) => {
      items.push({
        ...file,
        depth,
        fullPath: file.path,
        status: fileStatuses[file.path],
      });
    });

    return items;
  };

  // Count total files and folders
  const countItems = (node) => {
    let folders = Object.keys(node.children || {}).length;
    let files = (node.files || []).length;
    let totalSize = (node.files || []).reduce((sum, f) => sum + f.size, 0);

    Object.values(node.children || {}).forEach((child) => {
      const childCount = countItems(child);
      folders += childCount.folders;
      files += childCount.files;
      totalSize += childCount.totalSize;
    });

    return { folders, files, totalSize };
  };

  const handleFolderSelect = (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    const tree = buildTreeFromFiles(files);
    setTreeData(tree);
    setError(null);
    setFileStatuses({});

    const firstLevelFolders = Object.keys(tree.children);
    setExpandedFolders(new Set(firstLevelFolders));
  };

  const handleFilesSelect = (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    const root = {
      name: 'Root',
      type: 'folder',
      children: {},
      files: Array.from(files).map((file) => ({
        name: file.name,
        type: 'file',
        path: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        file: file,
      })),
    };

    setTreeData(root);
    setError(null);
    setFileStatuses({});
  };

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allFolderPaths = [];
    const collectPaths = (node, parentPath = '') => {
      Object.entries(node.children || {}).forEach(([name, child]) => {
        const path = parentPath ? `${parentPath}/${name}` : name;
        allFolderPaths.push(path);
        collectPaths(child, path);
      });
    };
    if (treeData) {
      collectPaths(treeData);
      setExpandedFolders(new Set(allFolderPaths));
    }
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const removeItem = (path, isFolder) => {
    const newTree = JSON.parse(JSON.stringify(treeData));
    const pathParts = path.split('/');
    let current = newTree;

    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current.children[pathParts[i]];
    }

    const itemName = pathParts[pathParts.length - 1];

    if (isFolder) {
      delete current.children[itemName];
    } else {
      current.files = current.files.filter((f) => f.name !== itemName);
    }

    // Update tree (need to reconstruct File references)
    setTreeData(newTree);
  };

  /**
   * Upload a single file using presigned URLs (handles both single and multipart)
   */
  const uploadFile = async (file, folderId, filePath) => {
    const fileName = file.name;
    const fileSize = file.size;
    const mimeType = file.type || 'application/octet-stream';

    // Initiate upload
    const initResponse = await documentsApi.initiateUpload({
      meetingId,
      folderId,
      fileName,
      fileSize,
      mimeType,
      path: filePath,
    });

    const { documentId, presignedUrls, isMultipart, totalChunks } = initResponse.data;

    if (isMultipart && totalChunks > 1) {
      // Chunked multipart upload
      const parts = [];

      for (let i = 0; i < presignedUrls.length; i++) {
        const { partNumber, presignedUrl } = presignedUrls[i];
        const start = (partNumber - 1) * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = file.slice(start, end);

        // Upload chunk to presigned URL
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': mimeType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload chunk ${partNumber}`);
        }

        // Get ETag from response
        const etag = uploadResponse.headers.get('ETag') || `"part-${partNumber}"`;
        parts.push({ partNumber, etag: etag.replace(/"/g, '') });

        // Report progress to API
        await documentsApi.updateProgress(documentId, {
          partNumber,
          etag: etag.replace(/"/g, ''),
        });

        // Update file progress
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress((prev) => ({ ...prev, fileProgress: progress }));
      }

      // Complete multipart upload
      await documentsApi.completeUpload(documentId, { parts });
    } else {
      // Single part upload
      const { presignedUrl } = presignedUrls[0];

      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': mimeType,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file`);
      }

      // Get ETag and complete
      const etag = uploadResponse.headers.get('ETag') || '"single-part"';

      await documentsApi.updateProgress(documentId, {
        partNumber: 1,
        etag: etag.replace(/"/g, ''),
      });

      await documentsApi.completeUpload(documentId, { parts: [] });
    }

    return documentId;
  };

  const handleUpload = async () => {
    if (!treeData) return;

    setUploading(true);
    setError(null);
    abortControllerRef.current = new AbortController();

    try {
      // Collect all files with their paths
      const allFiles = [];
      const collectFiles = (node, parentPath = '') => {
        Object.entries(node.children || {}).forEach(([name, child]) => {
          const path = parentPath ? `${parentPath}/${name}` : name;
          collectFiles(child, path);
        });

        (node.files || []).forEach((fileItem) => {
          allFiles.push({
            file: fileItem.file,
            path: fileItem.path,
            folderPath: parentPath,
          });
        });
      };
      collectFiles(treeData);

      setUploadProgress({
        current: 0,
        total: allFiles.length,
        currentFile: '',
        fileProgress: 0,
        status: 'uploading',
      });

      // Collect folder structure
      const folders = [];
      const collectFolders = (node, parentPath = '') => {
        Object.entries(node.children || {}).forEach(([name, child]) => {
          const path = parentPath ? `${parentPath}/${name}` : name;
          folders.push({ name, path, parentPath: parentPath || null });
          collectFolders(child, path);
        });
      };
      collectFolders(treeData);

      // Create folder structure first (if any folders exist)
      // Sort by depth (parents first) and create sequentially
      let folderMap = {};
      if (folders.length > 0) {
        const sortedFolders = [...folders].sort((a, b) => {
          const depthA = (a.path.match(/\//g) || []).length;
          const depthB = (b.path.match(/\//g) || []).length;
          return depthA - depthB;
        });

        for (const folder of sortedFolders) {
          try {
            const parentId = folder.parentPath ? folderMap[folder.parentPath] : null;
            const response = await documentsApi.createFolder({
              meetingId,
              name: folder.name,
              parentId,
            });
            folderMap[folder.path] = response.data.id;
          } catch (err) {
            console.error(`Failed to create folder ${folder.path}:`, err);
          }
        }
      }

      // Upload each file
      for (let i = 0; i < allFiles.length; i++) {
        const { file, path, folderPath } = allFiles[i];

        setUploadProgress((prev) => ({
          ...prev,
          current: i,
          currentFile: file.name,
          fileProgress: 0,
        }));

        setFileStatuses((prev) => ({ ...prev, [path]: 'uploading' }));

        try {
          const folderId = folderPath ? folderMap[folderPath] : null;
          await uploadFile(file, folderId, path);
          setFileStatuses((prev) => ({ ...prev, [path]: 'completed' }));
        } catch (fileError) {
          console.error(`Failed to upload ${file.name}:`, fileError);
          setFileStatuses((prev) => ({ ...prev, [path]: 'error' }));
          // Continue with next file instead of stopping
        }
      }

      setUploadProgress((prev) => ({
        ...prev,
        current: allFiles.length,
        status: 'completed',
      }));
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
      setUploadProgress((prev) => ({ ...prev, status: 'error' }));
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setUploading(false);
    onCancel?.();
  };

  const stats = treeData ? countItems(treeData) : null;
  const treeList = treeData ? treeToList(treeData) : [];

  const getFileStatusIcon = (status, isUploadComplete) => {
    // If overall upload is complete and no specific error, show green check
    if (isUploadComplete && status !== 'error') {
      return <Check size={14} className="text-green-500" />;
    }
    switch (status) {
      case 'uploading':
        return <Loader2 size={14} className="text-blue-500 animate-spin" />;
      case 'completed':
        return <Check size={14} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={14} className="text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">Upload Agenda Documents</h3>
        <p className="text-sm text-gray-500 mt-1">
          Upload a folder or multiple files. Supports files up to 60MB each.
        </p>
      </div>

      {/* Selection Buttons */}
      {!treeData && (
        <div className="p-6">
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <Folder size={40} className="text-primary-500" />
              <span className="font-medium">Upload Folder</span>
              <span className="text-xs text-gray-500">with subfolders & files</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <FileText size={40} className="text-primary-500" />
              <span className="font-medium">Upload Files</span>
              <span className="text-xs text-gray-500">select multiple files</span>
            </button>
          </div>

          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolderSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif"
          />
        </div>
      )}

      {/* Tree Preview */}
      {treeData && (
        <>
          {/* Stats bar */}
          <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{stats.folders}</span> folders,{' '}
              <span className="font-medium">{stats.files}</span> files ({formatFileSize(stats.totalSize)})
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-primary-600 hover:text-primary-700"
                disabled={uploading}
              >
                Expand all
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={collapseAll}
                className="text-xs text-primary-600 hover:text-primary-700"
                disabled={uploading}
              >
                Collapse all
              </button>
            </div>
          </div>

          {/* Tree view */}
          <div className="max-h-80 overflow-y-auto p-2">
            {treeList.map((item, index) => (
              <div
                key={item.fullPath + index}
                className={`flex items-center gap-2 py-1.5 px-2 rounded group ${
                  item.status === 'uploading' ? 'bg-blue-50' :
                  item.status === 'completed' ? 'bg-green-50' :
                  item.status === 'error' ? 'bg-red-50' :
                  'hover:bg-gray-50'
                }`}
                style={{ paddingLeft: `${item.depth * 20 + 8}px` }}
              >
                {item.type === 'folder' ? (
                  <>
                    <button
                      onClick={() => toggleFolder(item.fullPath)}
                      className="p-0.5 hover:bg-gray-200 rounded"
                      disabled={uploading}
                    >
                      {item.isExpanded ? (
                        <ChevronDown size={14} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-400" />
                      )}
                    </button>
                    {item.isExpanded ? (
                      <FolderOpen size={16} className="text-yellow-500" />
                    ) : (
                      <Folder size={16} className="text-yellow-500" />
                    )}
                    <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
                    {!uploading && (
                      <button
                        onClick={() => removeItem(item.fullPath, true)}
                        className="p-1 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="w-5" />
                    <FileText size={16} className="text-gray-400" />
                    <span className="flex-1 text-sm truncate">{item.name}</span>
                    {getFileStatusIcon(item.status, uploadProgress.status === 'completed')}
                    <span className="text-xs text-gray-400">{formatFileSize(item.size)}</span>
                    {!uploading && (
                      <button
                        onClick={() => removeItem(item.fullPath, false)}
                        className="p-1 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="p-4 bg-blue-50 border-t">
              <div className="flex justify-between text-sm mb-2">
                <span className="truncate flex-1">Uploading: {uploadProgress.currentFile}</span>
                <span className="ml-2 whitespace-nowrap">
                  {uploadProgress.current + 1} / {uploadProgress.total}
                </span>
              </div>
              {/* Overall progress */}
              <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${((uploadProgress.current + (uploadProgress.fileProgress / 100)) / uploadProgress.total) * 100}%`,
                  }}
                />
              </div>
              {/* File progress (for chunked uploads) */}
              {uploadProgress.fileProgress > 0 && uploadProgress.fileProgress < 100 && (
                <div className="text-xs text-blue-600">
                  Current file: {uploadProgress.fileProgress}%
                </div>
              )}
            </div>
          )}

          {/* Completion Status */}
          {uploadProgress.status === 'completed' && (
            <div className="p-4 bg-green-50 border-t flex items-center gap-2 text-green-700">
              <Check size={16} />
              <span className="text-sm font-medium">All files uploaded successfully!</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border-t flex items-center gap-2 text-red-700">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 border-t flex justify-between">
            <button
              onClick={() => {
                setTreeData(null);
                setError(null);
                setFileStatuses({});
                setUploadProgress({ current: 0, total: 0, currentFile: '', fileProgress: 0, status: 'idle' });
              }}
              className="btn btn-secondary"
              disabled={uploading}
            >
              Clear & Reselect
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="btn btn-secondary"
              >
                {uploading ? 'Cancel' : 'Close'}
              </button>
              {uploadProgress.status !== 'completed' && (
                <button
                  onClick={handleUpload}
                  className="btn btn-primary flex items-center gap-2"
                  disabled={uploading || stats.files === 0}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={16} />
                      Upload {stats.files} files
                    </>
                  )}
                </button>
              )}
              {uploadProgress.status === 'completed' && (
                <button
                  onClick={() => onUploadComplete?.()}
                  className="btn btn-primary"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
