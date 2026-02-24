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
import { meetingsApi } from '../../services/api';
import offlineStorage from '../../services/offlineStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useAuth } from '../../context/AuthContext';
import DocumentTree from '../../components/DocumentTree';

export default function MeetingDetailScreen({ route, navigation }) {
  const { meetingId } = route.params;
  const { isConnected } = useNetworkStatus();
  const { user } = useAuth();

  const [meeting, setMeeting] = useState(null);
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [offlineDocIds, setOfflineDocIds] = useState([]);
  const [cachedAt, setCachedAt] = useState(null);

  useEffect(() => {
    loadMeetingData();
    checkOfflineDocuments();
  }, [meetingId, isConnected]);

  const loadMeetingData = async () => {
    setLoading(true);

    if (isConnected) {
      // Online: fetch from API and cache
      await fetchMeetingFromApi();
    } else {
      // Offline: load from cache
      await loadFromCache();
    }

    setLoading(false);
  };

  const fetchMeetingFromApi = async () => {
    try {
      // Fetch meeting details
      const meetingRes = await meetingsApi.getById(meetingId);
      setMeeting(meetingRes.data);

      // Fetch documents
      const docsRes = await documentsApi.getByMeeting(meetingId);
      let foldersData = [];
      let documentsData = [];

      if (docsRes.data && docsRes.data.folders !== undefined) {
        foldersData = docsRes.data.folders || [];
        documentsData = docsRes.data.documents || [];
      } else if (docsRes.data) {
        documentsData = docsRes.data || [];
      }

      setFolders(foldersData);
      setDocuments(documentsData);

      // Cache for offline viewing
      await offlineStorage.saveMeetingDetailOffline(
        meetingId,
        meetingRes.data,
        foldersData,
        documentsData
      );
      setCachedAt(new Date().toISOString());
    } catch (error) {
      console.error('Failed to fetch meeting:', error);
      // Try loading from cache as fallback
      await loadFromCache();
      if (!meeting) {
        Alert.alert('Error', 'Failed to load meeting details');
        navigation.goBack();
      }
    }
  };

  const loadFromCache = async () => {
    try {
      const cached = await offlineStorage.getOfflineMeetingDetail(meetingId);
      if (cached) {
        setMeeting(cached.meeting);
        setFolders(cached.folders || []);
        setDocuments(cached.documents || []);
        setCachedAt(cached.cachedAt);
      } else {
        Alert.alert(
          'Not Available Offline',
          'This meeting has not been cached. Please connect to the internet to view it.'
        );
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to load from cache:', error);
    }
  };

  const checkOfflineDocuments = async () => {
    const offlineDocs = await offlineStorage.getOfflineDocuments();
    const ids = offlineDocs.map((d) => d.id);
    setOfflineDocIds(ids);
  };

  const handleRespond = async (status) => {
    if (!isConnected) {
      Alert.alert(
        'Offline Mode',
        'You cannot accept or decline meetings while offline. Please connect to the internet to respond.'
      );
      return;
    }

    setResponding(true);
    try {
      await meetingsApi.respond(meetingId, { status });
      // Refresh meeting data to update UI
      await fetchMeetingFromApi();
    } catch (error) {
      Alert.alert('Error', 'Failed to respond to meeting');
    } finally {
      setResponding(false);
    }
  };

  // Handle document tap - navigate to document viewer
  const handleViewDocument = (doc) => {
    const isOffline = offlineDocIds.includes(doc.id);

    // If offline and document not saved, show message
    if (!isConnected && !isOffline) {
      Alert.alert(
        'Not Available Offline',
        'This document is not saved for offline viewing. Save it while online to view offline.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to document viewer screen
    navigation.navigate('DocumentViewer', {
      document: doc,
      isOffline: isOffline,
      meetingId: meetingId,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!meeting) return null;

  // Find current user's response from the responses array
  const currentResponse = meeting.responses?.find((r) => r.userId === user?.id || r.user?.id === user?.id);
  const currentStatus = currentResponse?.status || 'pending';

  // Filter to only completed uploads
  const completedDocs = documents.filter(
    (d) => d.uploadProgress?.status === 'completed' || !d.uploadProgress
  );

  return (
    <ScrollView style={styles.container}>
      {/* Offline Banner */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            Offline Mode - View Only
            {cachedAt && (
              <Text style={styles.cachedTime}>
                {'\n'}Last synced: {format(new Date(cachedAt), 'PPp')}
              </Text>
            )}
          </Text>
        </View>
      )}

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

        {/* Response Buttons - Disabled when offline or already selected */}
        <View style={styles.responseButtons}>
          <TouchableOpacity
            style={[
              styles.responseButton,
              styles.acceptButton,
              currentStatus === 'accepted' && styles.acceptedSelected,
              (currentStatus === 'accepted' || !isConnected) && styles.buttonDisabledStyle,
            ]}
            onPress={() => handleRespond('accepted')}
            disabled={responding || currentStatus === 'accepted' || !isConnected}
          >
            <Text style={styles.responseButtonText}>
              {currentStatus === 'accepted' ? '✓ Accept' : 'Accept'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.responseButton,
              styles.declineButton,
              currentStatus === 'declined' && styles.declinedSelected,
              (currentStatus === 'declined' || !isConnected) && styles.buttonDisabledStyle,
            ]}
            onPress={() => handleRespond('declined')}
            disabled={responding || currentStatus === 'declined' || !isConnected}
          >
            <Text style={styles.responseButtonText}>
              {currentStatus === 'declined' ? '✕ Decline' : 'Decline'}
            </Text>
          </TouchableOpacity>
        </View>

        {!isConnected && (
          <Text style={styles.offlineNote}>
            Connect to the internet to accept or decline this meeting
          </Text>
        )}
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
          offlineDocIds={offlineDocIds}
          isConnected={isConnected}
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
  offlineBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  offlineBannerText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  cachedTime: {
    fontSize: 11,
    fontWeight: '400',
    color: '#b45309',
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
  acceptedSelected: {
    backgroundColor: '#16a34a',
  },
  declinedSelected: {
    backgroundColor: '#dc2626',
  },
  buttonDisabledStyle: {
    opacity: 0.6,
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  responseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#9ca3af',
  },
  offlineNote: {
    marginTop: 12,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 40,
  },
});
