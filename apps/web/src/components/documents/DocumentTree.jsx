import { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Download,
  Eye,
  Trash2,
  File,
  FileImage,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import { formatFileSize } from '../../utils/helpers';

/**
 * DocumentTree Component
 *
 * Displays uploaded documents in a hierarchical tree structure.
 * Supports expand/collapse, preview, download, and delete actions.
 */
export default function DocumentTree({
  folders = [],
  documents = [],
  onPreview,
  onDownload,
  onDelete,
  readOnly = false,
}) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  // Build nested structure from flat data
  const buildTree = () => {
    // Create folder map
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

    // Get root folders (no parent)
    const rootFolders = folders
      .filter((f) => !f.parentId)
      .map((f) => folderMap[f.id]);

    // Get root files (no folder)
    const rootFiles = documents.filter((d) => !d.folderId);

    // Add files to their folders
    documents
      .filter((d) => d.folderId)
      .forEach((doc) => {
        if (folderMap[doc.folderId]) {
          folderMap[doc.folderId].files.push(doc);
        }
      });

    // Sort folders and files by sortOrder, then by name
    const sortItems = (items) => {
      return items.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return (a.name || a.fileName || '').localeCompare(b.name || b.fileName || '');
      });
    };

    // Sort all levels
    const sortTree = (folder) => {
      folder.children = sortItems(folder.children);
      folder.files = sortItems(folder.files);
      folder.children.forEach(sortTree);
    };
    rootFolders.forEach(sortTree);

    return {
      folders: sortItems(rootFolders),
      files: sortItems(rootFiles),
    };
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

  const expandAll = () => {
    setExpandedFolders(new Set(folders.map((f) => f.id)));
  };

  const collapseAll = () => {
    setExpandedFolders(new Set());
  };

  const getFileIcon = (fileName, mimeType) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <FileImage size={16} className="text-green-500" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return <FileSpreadsheet size={16} className="text-emerald-600" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText size={16} className="text-red-500" />;
    }
    if (['doc', 'docx'].includes(ext)) {
      return <FileText size={16} className="text-blue-600" />;
    }
    if (['ppt', 'pptx'].includes(ext)) {
      return <FileText size={16} className="text-orange-500" />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileCode size={16} className="text-purple-500" />;
    }

    return <File size={16} className="text-gray-400" />;
  };

  const renderFolder = (folder, depth = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = folder.children.length > 0 || folder.files.length > 0;

    return (
      <div key={folder.id}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded group cursor-pointer"
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => toggleFolder(folder.id)}
        >
          <button className="p-0.5">
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} className="text-gray-400" />
              ) : (
                <ChevronRight size={14} className="text-gray-400" />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </button>

          {isExpanded ? (
            <FolderOpen size={18} className="text-yellow-500" />
          ) : (
            <Folder size={18} className="text-yellow-500" />
          )}

          <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>

          <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">
            {folder.files.length + folder.children.length} items
          </span>
        </div>

        {isExpanded && (
          <>
            {folder.children.map((child) => renderFolder(child, depth + 1))}
            {folder.files.map((file) => renderFile(file, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderFile = (doc, depth = 0) => {
    return (
      <div
        key={doc.id}
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded group"
        style={{ paddingLeft: `${depth * 20 + 28}px` }}
      >
        {getFileIcon(doc.fileName, doc.mimeType)}

        <span className="flex-1 text-sm truncate" title={doc.fileName}>
          {doc.fileName}
        </span>

        <span className="text-xs text-gray-400 mr-2">{formatFileSize(doc.fileSize)}</span>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPreview && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview(doc);
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="Preview"
            >
              <Eye size={14} className="text-gray-500" />
            </button>
          )}

          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload(doc);
              }}
              className="p-1 hover:bg-gray-200 rounded"
              title="Download"
            >
              <Download size={14} className="text-gray-500" />
            </button>
          )}

          {onDelete && !readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(doc);
              }}
              className="p-1 hover:bg-red-50 rounded"
              title="Delete"
            >
              <Trash2 size={14} className="text-red-400" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const tree = buildTree();
  const totalItems = folders.length + documents.length;

  if (totalItems === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Folder size={40} className="mx-auto mb-3 text-gray-300" />
        <p>No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      {folders.length > 0 && (
        <div className="flex justify-end gap-2 mb-2 text-xs">
          <button
            onClick={expandAll}
            className="text-primary-600 hover:text-primary-700"
          >
            Expand all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-primary-600 hover:text-primary-700"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Tree */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto p-1">
          {tree.folders.map((folder) => renderFolder(folder))}
          {tree.files.map((file) => renderFile(file))}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-2 text-xs text-gray-500 text-right">
        {folders.length} folders, {documents.length} files
      </div>
    </div>
  );
}
