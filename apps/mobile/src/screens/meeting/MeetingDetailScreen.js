import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { meetingsApi, documentsApi } from '../../services/api';
import offlineStorage from '../../services/offlineStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import DocumentTree from '../../components/DocumentTree';

export default function MeetingDetailScreen({ route, navigation }) {
  const { meetingId } = route.params;
  const { isConnected } = useNetworkStatus();

  const [meeting, setMeeting] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [offlineDocIds, setOfflineDocIds] = useState([]);

  useEffect(() => {
    fetchMeeting();
    fetchDocuments();
    checkOfflineDocuments();
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      const res = await meetingsApi.getById(meetingId);
      setMeeting(res.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load meeting details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await documentsApi.getByMeeting(meetingId);
      // API returns { folders, documents }
      if (res.data && res.data.folders !== undefined) {
        setFolders(res.data.folders || []);
        setDocuments(res.data.documents || []);
      } else if (res.data) {
        // Backwards compatibility
        setDocuments(res.data || []);
        setFolders([]);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    }
  };

  const checkOfflineDocuments = async () => {
    const offlineDocs = await offlineStorage.getOfflineDocuments();
    const ids = offlineDocs.map((d) => d.id);
    setOfflineDocIds(ids);
  };

  const handleRespond = async (status) => {
    if (!isConnected) {
      Alert.alert('Offline', 'You need to be online to respond to meetings');
      return;
    }

    setResponding(true);
    try {
      await meetingsApi.respond(meetingId, { status });
      Alert.alert('Success', `You have ${status} the meeting`);
      fetchMeeting();
    } catch (error) {
      Alert.alert('Error', 'Failed to respond to meeting');
    } finally {
      setResponding(false);
    }
  };

  const handleDownloadForOffline = async (doc) => {
    if (!isConnected) {
      Alert.alert('Offline', 'You need to be online to download documents');
      return;
    }

    try {
      const res = await documentsApi.getDownloadUrl(doc.id);
      await offlineStorage.downloadDocument(doc, res.data.downloadUrl);
      Alert.alert('Success', 'Document saved for offline viewing');
      checkOfflineDocuments();
    } catch (error) {
      Alert.alert('Error', 'Failed to download document');
    }
  };

  const handleViewDocument = async (doc) => {
    const isOffline = offlineDocIds.includes(doc.id);

    if (isOffline) {
      const localPath = await offlineStorage.getOfflineDocumentPath(doc.id);
      Alert.alert('Document', `Opening: ${doc.fileName}\n\nThis document is available offline.`);
      // In a full implementation, you would open the document viewer here
    } else if (isConnected) {
      try {
        const res = await documentsApi.getDownloadUrl(doc.id);
        Alert.alert('Document', `Opening: ${doc.fileName}\n\nStreaming from server...`);
        // In a full implementation, you would open the document viewer here
      } catch (error) {
        Alert.alert('Error', 'Failed to get document URL');
      }
    } else {
      Alert.alert(
        'Offline',
        'This document is not available offline. Save it first while online.'
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!meeting) return null;

  const currentResponse = meeting.responses?.find((r) => true);
  const currentStatus = currentResponse?.status || 'pending';

  // Filter to only completed uploads
  const completedDocs = documents.filter(
    (d) => d.uploadProgress?.status === 'completed' || !d.uploadProgress
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{meeting.title}</Text>
        <Text style={styles.committee}>{meeting.committee?.name}</Text>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                meeting.status === 'scheduled' ? '#dcfce7' : '#fef3c7',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: meeting.status === 'scheduled' ? '#166534' : '#92400e',
              },
            ]}
          >
            {meeting.status}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meeting Details</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>
            {format(new Date(meeting.scheduledAt), 'PPPP')}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time</Text>
          <Text style={styles.detailValue}>
            {format(new Date(meeting.scheduledAt), 'p')}
            {meeting.endTime && ` - ${format(new Date(meeting.endTime), 'p')}`}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location</Text>
          <Text style={styles.detailValue}>{meeting.location}</Text>
        </View>

        {meeting.description && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Description</Text>
            <Text style={styles.detailValue}>{meeting.description}</Text>
          </View>
        )}
      </View>

      {/* Response Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Response</Text>

        <View style={styles.responseStatus}>
          <Text style={styles.currentStatus}>
            Current Status:{' '}
            <Text
              style={{
                color:
                  currentStatus === 'accepted'
                    ? '#22c55e'
                    : currentStatus === 'declined'
                    ? '#ef4444'
                    : '#f59e0b',
                fontWeight: '600',
              }}
            >
              {currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}
            </Text>
          </Text>
        </View>

        <View style={styles.responseButtons}>
          <TouchableOpacity
            style={[
              styles.responseButton,
              styles.acceptButton,
              currentStatus === 'accepted' && styles.buttonSelected,
            ]}
            onPress={() => handleRespond('accepted')}
            disabled={responding || currentStatus === 'accepted'}
          >
            <Text style={styles.responseButtonText}>Accept</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.responseButton,
              styles.declineButton,
              currentStatus === 'declined' && styles.buttonSelected,
            ]}
            onPress={() => handleRespond('declined')}
            disabled={responding || currentStatus === 'declined'}
          >
            <Text style={styles.responseButtonText}>Decline</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Documents with Tree Structure */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Agenda Documents ({completedDocs.length})
        </Text>

        <DocumentTree
          folders={folders}
          documents={completedDocs}
          onViewDocument={handleViewDocument}
          onDownloadOffline={handleDownloadForOffline}
          offlineDocIds={offlineDocIds}
        />
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  committee: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  responseStatus: {
    marginBottom: 16,
  },
  currentStatus: {
    fontSize: 16,
    color: '#4b5563',
  },
  responseButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  responseButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#22c55e',
  },
  declineButton: {
    backgroundColor: '#ef4444',
  },
  buttonSelected: {
    opacity: 0.6,
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});
