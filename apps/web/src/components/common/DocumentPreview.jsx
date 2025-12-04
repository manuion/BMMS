import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Image, File } from 'lucide-react';
import { documentsApi } from '../../services/api';
import LoadingSpinner from './LoadingSpinner';

export default function DocumentPreview({ document, onClose }) {
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPreviewUrl();
  }, [document.id]);

  const fetchPreviewUrl = async () => {
    try {
      const res = await documentsApi.getDownloadUrl(document.id);
      setPreviewUrl(res.data.downloadUrl);
    } catch (error) {
      setError('Failed to load document preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (previewUrl) {
      // Add download=true query param to force download instead of inline view
      const downloadUrlWithParam = previewUrl.includes('?')
        ? `${previewUrl}&download=true`
        : `${previewUrl}?download=true`;

      // Create link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrlWithParam;
      link.download = document.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getFileType = (fileName, mimeType) => {
    const ext = fileName.split('.').pop().toLowerCase();

    if (['pdf'].includes(ext) || mimeType?.includes('pdf')) {
      return 'pdf';
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) || mimeType?.startsWith('image/')) {
      return 'image';
    }
    if (['doc', 'docx'].includes(ext) || mimeType?.includes('word')) {
      return 'word';
    }
    if (['xls', 'xlsx'].includes(ext) || mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) {
      return 'excel';
    }
    if (['ppt', 'pptx'].includes(ext) || mimeType?.includes('presentation')) {
      return 'powerpoint';
    }
    return 'other';
  };

  const fileType = getFileType(document.fileName, document.mimeType);

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <FileText size={48} className="mb-4 text-gray-300" />
          <p>{error}</p>
        </div>
      );
    }

    switch (fileType) {
      case 'pdf':
        return (
          <iframe
            src={`${previewUrl}#toolbar=0`}
            className="w-full h-[70vh] border-0"
            title={document.fileName}
          />
        );

      case 'image':
        return (
          <div className="flex justify-center items-center p-4 bg-gray-100">
            <img
              src={previewUrl}
              alt={document.fileName}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        );

      case 'word':
      case 'excel':
      case 'powerpoint':
        // Use Microsoft Office Online Viewer for Office documents
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`;
        return (
          <iframe
            src={officeViewerUrl}
            className="w-full h-[70vh] border-0"
            title={document.fileName}
          />
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <File size={64} className="mb-4 text-gray-300" />
            <p className="mb-2">Preview not available for this file type</p>
            <p className="text-sm text-gray-400">{document.fileName}</p>
            <button
              onClick={handleDownload}
              className="mt-4 btn btn-primary flex items-center gap-2"
            >
              <Download size={16} />
              Download to view
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {fileType === 'image' ? (
              <Image size={20} className="text-gray-500" />
            ) : (
              <FileText size={20} className="text-gray-500" />
            )}
            <div>
              <h3 className="font-medium truncate max-w-md">{document.fileName}</h3>
              <p className="text-sm text-gray-500">
                {(document.fileSize / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded hover:bg-gray-100"
              title="Download"
            >
              <Download size={20} className="text-gray-600" />
            </button>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded hover:bg-gray-100"
                title="Open in new tab"
              >
                <ExternalLink size={20} className="text-gray-600" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-100"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="overflow-auto">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}
