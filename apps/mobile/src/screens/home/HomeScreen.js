import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { format } from 'date-fns';
import { meetingsApi } from '../../services/api';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function HomeScreen({ navigation }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { isConnected } = useNetworkStatus();

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await meetingsApi.getAll({ upcoming: 'true' });
      setMeetings(res.data || []);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMeetings();
  }, [fetchMeetings]);

  const getResponseStatus = (meeting) => {
    const response = meeting.responses?.[0];
    return response?.status || 'pending';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return '#22c55e';
      case 'declined':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  const renderMeetingItem = ({ item }) => {
    const responseStatus = getResponseStatus(item);

    return (
      <TouchableOpacity
        style={styles.meetingCard}
        onPress={() => navigation.navigate('MeetingDetail', { meetingId: item.id })}
      >
        <View style={styles.meetingHeader}>
          <View style={styles.meetingInfo}>
            <Text style={styles.meetingTitle}>{item.title}</Text>
            <Text style={styles.committeeName}>{item.committee?.name}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(responseStatus) + '20' },
            ]}
          >
            <Text
              style={[styles.statusText, { color: getStatusColor(responseStatus) }]}
            >
              {responseStatus.charAt(0).toUpperCase() + responseStatus.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.meetingDetails}>
          <Text style={styles.detailText}>
            {format(new Date(item.scheduledAt), 'PPP')}
          </Text>
          <Text style={styles.detailText}>
            {format(new Date(item.scheduledAt), 'p')}
          </Text>
          <Text style={styles.detailText}>{item.location}</Text>
        </View>

        <View style={styles.meetingFooter}>
          <Text style={styles.footerText}>
            {item._count?.documents || 0} documents
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            You're offline. Some features may be limited.
          </Text>
        </View>
      )}

      <FlatList
        data={meetings}
        renderItem={renderMeetingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No upcoming meetings</Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineBannerText: {
    color: '#92400e',
    fontSize: 12,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  meetingCard: {
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
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  committeeName: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  meetingDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  meetingFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
