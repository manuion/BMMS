import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Upload,
  CheckCircle,
  XCircle,
  Clock,
  FolderUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingsApi, documentsApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';
import FolderTreeUpload from '../../components/documents/FolderTreeUpload';
import DocumentTree from '../../components/documents/DocumentTree';
import DocumentPreview from '../../components/common/DocumentPreview';

export default function MeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDocument, setPreviewDocument] = useState(null);

  useEffect(() => {
    fetchMeeting();
    fetchDocuments();
  }, [id]);

  const fetchMeeting = async () => {
    try {
      const res = await meetingsApi.getById(id);
      setMeeting(res.data);
    } catch (error) {
      toast.error('Failed to load meeting');
      navigate('/organiser/meetings');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await documentsApi.getByMeeting(id);
      // API returns { folders, documents }
      if (res.data.folders !== undefined) {
        setFolders(res.data.folders || []);
        setDocuments(res.data.documents || []);
      } else {
        // Backwards compatibility - old API returns just documents array
        setDocuments(res.data || []);
        setFolders([]);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const res = await documentsApi.getDownloadUrl(doc.id);
      const { downloadUrl, fileName } = res.data;

      // Add download=true query param to force download instead of inline view
      const downloadUrlWithParam = downloadUrl.includes('?')
        ? `${downloadUrl}&download=true`
        : `${downloadUrl}?download=true`;

      // Create link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrlWithParam;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      toast.error('Failed to get download URL');
    }
  };

  const handlePreview = (doc) => {
    setPreviewDocument(doc);
  };

  const handleDeleteDocument = async (doc) => {
    if (!window.confirm(`Delete "${doc.fileName}"?`)) return;

    try {
      await documentsApi.delete(doc.id);
      toast.success('Document deleted');
      fetchDocuments();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    fetchDocuments();
    toast.success('Documents uploaded successfully');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!meeting) return null;

  const responseSummary = {
    accepted: meeting.responses?.filter((r) => r.status === 'accepted').length || 0,
    declined: meeting.responses?.filter((r) => r.status === 'declined').length || 0,
    pending: meeting.responses?.filter((r) => r.status === 'pending').length || 0,
  };

  // Count only completed uploads
  const completedDocs = documents.filter(
    (d) => d.uploadProgress?.status === 'completed' || !d.uploadProgress
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/organiser/meetings')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{meeting.title}</h1>
            <span
              className={`px-2 py-1 text-xs rounded-full ${
                meeting.status === 'scheduled'
                  ? 'bg-green-100 text-green-800'
                  : meeting.status === 'rescheduled'
                  ? 'bg-yellow-100 text-yellow-800'
                  : meeting.status === 'cancelled'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {meeting.status}
            </span>
          </div>
          <p className="text-gray-500">{meeting.committee?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Meeting Info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Meeting Details</h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600">
                <Calendar size={20} />
                <span>
                  {new Date(meeting.scheduledAt).toLocaleString()}
                  {meeting.endTime && ` - ${new Date(meeting.endTime).toLocaleTimeString()}`}
                </span>
              </div>

              <div className="flex items-center gap-3 text-gray-600">
                <MapPin size={20} />
                <span>{meeting.location}</span>
              </div>

              {meeting.description && (
                <p className="text-gray-600 mt-4">{meeting.description}</p>
              )}
            </div>
          </div>

          {/* Documents with Folder Tree */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Agenda Documents ({completedDocs.length})
              </h2>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <FolderUp size={18} />
                Upload Documents
              </button>
            </div>

            {/* Document Tree View */}
            <DocumentTree
              folders={folders}
              documents={completedDocs}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onDelete={handleDeleteDocument}
            />
          </div>
        </div>

        {/* Sidebar - Responses */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Responses</h2>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-green-50 rounded">
                <p className="text-xl font-bold text-green-600">
                  {responseSummary.accepted}
                </p>
                <p className="text-xs text-green-600">Accepted</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded">
                <p className="text-xl font-bold text-red-600">
                  {responseSummary.declined}
                </p>
                <p className="text-xs text-red-600">Declined</p>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <p className="text-xl font-bold text-gray-600">
                  {responseSummary.pending}
                </p>
                <p className="text-xs text-gray-600">Pending</p>
              </div>
            </div>

            {/* Member List */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {meeting.responses?.map((response) => (
                <div
                  key={response.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <span className="text-sm">{response.user?.name}</span>
                  {response.status === 'accepted' && (
                    <CheckCircle size={18} className="text-green-500" />
                  )}
                  {response.status === 'declined' && (
                    <XCircle size={18} className="text-red-500" />
                  )}
                  {response.status === 'pending' && (
                    <Clock size={18} className="text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => navigate(`/organiser/meetings/${id}/edit`)}
                className="w-full btn btn-secondary"
              >
                Edit Meeting
              </button>
              <button
                onClick={async () => {
                  if (window.confirm('Cancel this meeting?')) {
                    await meetingsApi.delete(id);
                    toast.success('Meeting cancelled');
                    navigate('/organiser/meetings');
                  }
                }}
                className="w-full btn btn-danger"
              >
                Cancel Meeting
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Agenda Documents"
        size="lg"
      >
        <FolderTreeUpload
          meetingId={id}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setShowUploadModal(false)}
        />
      </Modal>

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreview
          document={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      )}
    </div>
  );
}
