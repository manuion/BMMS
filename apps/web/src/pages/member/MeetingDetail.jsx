import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Eye,
  Loader2,
} from 'lucide-react';
import { meetingsApi, documentsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import DocumentTree from '../../components/documents/DocumentTree';
import DocumentPreview from '../../components/common/DocumentPreview';
import Modal from '../../components/common/Modal';
import { formatDate, formatTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

export default function MemberMeetingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [documents, setDocuments] = useState({ folders: [], documents: [] });
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    fetchMeeting();
    fetchDocuments();
  }, [id]);

  const fetchMeeting = async () => {
    try {
      const response = await meetingsApi.getById(id);
      setMeeting(response.data);
    } catch (error) {
      console.error('Failed to fetch meeting:', error);
      toast.error('Failed to load meeting');
      navigate('/member/meetings');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await documentsApi.getByMeeting(id);
      setDocuments(response.data || { folders: [], documents: [] });
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const handleRespond = async (status) => {
    setResponding(true);
    try {
      await meetingsApi.respond(id, { status });
      toast.success(`Response submitted: ${status}`);
      fetchMeeting(); // Refresh to get updated response
    } catch (error) {
      toast.error(error.message || 'Failed to submit response');
    } finally {
      setResponding(false);
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await documentsApi.getDownloadUrl(doc.id);
      const { downloadUrl, fileName } = response.data;

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
      toast.error('Failed to download document');
    }
  };

  const handlePreview = (doc) => {
    setPreviewDoc(doc);
  };

  const getMyResponse = () => {
    if (!meeting?.responses || !user) return null;
    return meeting.responses.find(r => r.userId === user.id);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700">
            <CheckCircle size={18} />
            You have accepted this meeting
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700">
            <XCircle size={18} />
            You have declined this meeting
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-yellow-100 text-yellow-700">
            <AlertCircle size={18} />
            Response pending
          </span>
        );
    }
  };

  const getMeetingStatusBadge = (status) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-700',
      rescheduled: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-red-100 text-red-700',
      completed: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.scheduled}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!meeting) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Meeting not found</p>
        <Link to="/member/meetings" className="btn btn-primary mt-4">
          Back to Meetings
        </Link>
      </div>
    );
  }

  const myResponse = getMyResponse();
  const myStatus = myResponse?.status || 'pending';
  const isUpcoming = new Date(meeting.scheduledAt) > new Date();
  const canRespond = isUpcoming && meeting.status === 'scheduled';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/member/meetings"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Meetings
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="page-title mb-0">{meeting.title}</h1>
              {getMeetingStatusBadge(meeting.status)}
            </div>
            <p className="text-gray-500">{meeting.committee?.name}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Response Status & Actions */}
          <div className="card">
            <h2 className="font-semibold mb-4">Your Response</h2>

            {getStatusBadge(myStatus)}

            {canRespond && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleRespond('accepted')}
                  disabled={responding}
                  className={`btn flex items-center gap-2 ${
                    myStatus === 'accepted'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'btn-secondary'
                  }`}
                >
                  {responding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle size={16} />
                  )}
                  Accept
                </button>
                <button
                  onClick={() => handleRespond('declined')}
                  disabled={responding}
                  className={`btn flex items-center gap-2 ${
                    myStatus === 'declined'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'btn-secondary'
                  }`}
                >
                  {responding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <XCircle size={16} />
                  )}
                  Decline
                </button>
              </div>
            )}

            {myResponse?.respondedAt && (
              <p className="text-xs text-gray-400 mt-3">
                Responded on {formatDate(myResponse.respondedAt)} at {formatTime(myResponse.respondedAt)}
              </p>
            )}
          </div>

          {/* Meeting Description */}
          {meeting.description && (
            <div className="card">
              <h2 className="font-semibold mb-3">Description</h2>
              <p className="text-gray-600 whitespace-pre-wrap">{meeting.description}</p>
            </div>
          )}

          {/* Documents */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Agenda Documents</h2>
              <span className="text-sm text-gray-500">
                {documents.documents?.length || 0} files
              </span>
            </div>

            <DocumentTree
              folders={documents.folders || []}
              documents={documents.documents || []}
              onPreview={handlePreview}
              onDownload={handleDownload}
              readOnly={true}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Meeting Details */}
          <div className="card">
            <h2 className="font-semibold mb-4">Meeting Details</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Calendar size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{formatDate(meeting.scheduledAt)}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="font-medium">{formatTime(meeting.scheduledAt)}</p>
                  {meeting.endTime && (
                    <p className="text-sm text-gray-500">
                      to {formatTime(meeting.endTime)}
                    </p>
                  )}
                </div>
              </div>

              {meeting.location && (
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium">{meeting.location}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Users size={18} className="text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-500">Organizer</p>
                  <p className="font-medium">{meeting.creator?.name || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Attendees Summary */}
          <div className="card">
            <h2 className="font-semibold mb-4">Attendees</h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className="text-green-500" />
                  Accepted
                </span>
                <span className="font-medium">
                  {meeting.responses?.filter(r => r.status === 'accepted').length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <XCircle size={16} className="text-red-500" />
                  Declined
                </span>
                <span className="font-medium">
                  {meeting.responses?.filter(r => r.status === 'declined').length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <AlertCircle size={16} className="text-yellow-500" />
                  Pending
                </span>
                <span className="font-medium">
                  {meeting.responses?.filter(r => r.status === 'pending').length || 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreview
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onDownload={() => handleDownload(previewDoc)}
        />
      )}
    </div>
  );
}
