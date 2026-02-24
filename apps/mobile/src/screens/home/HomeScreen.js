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
import offlineStorage from '../../services/offlineStorage';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export default function HomeScreen({ navigation }) {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' or 'past'
  const { isConnected } = useNetworkStatus();

  const fetchMeetings = useCallback(async () => {
    try {
      if (isConnected) {
        // Online: fetch from API
        const params = filter === 'upcoming' ? { upcoming: 'true' } : { past: 'true' };
        const res = await meetingsApi.getAll(params);
        const meetingsData = res.data || [];
        setMeetings(meetingsData);

        // Cache upcoming meetings for offline viewing
        if (filter === 'upcoming') {
          await offlineStorage.saveMeetingsOffline(meetingsData);
          setCachedAt(new Date().toISOString());
        }
      } else {
        // Offline: load from cache (only upcoming are cached)
        const cached = await offlineStorage.getOfflineMeetings();
        setMeetings(cached.meetings || []);
        setCachedAt(cached.cachedAt);
      }
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
      // If online fetch fails, try to load from cache
      if (isConnected) {
        const cached = await offlineStorage.getOfflineMeetings();
        if (cached.meetings.length > 0) {
          setMeetings(cached.meetings);
          setCachedAt(cached.cachedAt);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConnected, filter]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Refresh when coming back online
  useEffect(() => {
    if (isConnected && !loading) {
      fetchMeetings();
    }
  }, [isConnected]);

  const onRefresh = useCallback(() => {
    if (!isConnected) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    fetchMeetings();
  }, [fetchMeetings, isConnected]);

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

  const handleFilterChange = (newFilter) => {
    if (newFilter === filter) return;
    if (newFilter === 'past' && !isConnected) {
      // Can't fetch past meetings when offline
      return;
    }
    setFilter(newFilter);
    setLoading(true);
  };

  const renderMeetingItem = ({ item }) => {
    const responseStatus = getResponseStatus(item);
    const isPast = filter === 'past';

    return (
      <TouchableOpacity
        style={[styles.meetingCard, isPast && styles.pastMeetingCard]}
        onPress={() => navigation.navigate('MeetingDetail', { meetingId: item.id })}
      >
        <View style={styles.meetingHeader}>
          <View style={styles.meetingInfo}>
            <Text style={[styles.meetingTitle, isPast && styles.pastText]}>{item.title}</Text>
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
          <Text style={[styles.detailText, isPast && styles.pastText]}>
            {format(new Date(item.scheduledAt), 'PPP')}
          </Text>
          <Text style={[styles.detailText, isPast && styles.pastText]}>
            {format(new Date(item.scheduledAt), 'p')}
          </Text>
          <Text style={[styles.detailText, isPast && styles.pastText]}>{item.location}</Text>
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
      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'upcoming' && styles.filterTabActive]}
          onPress={() => handleFilterChange('upcoming')}
        >
          <Text style={[styles.filterTabText, filter === 'upcoming' && styles.filterTabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterTab,
            filter === 'past' && styles.filterTabActive,
            !isConnected && styles.filterTabDisabled,
          ]}
          onPress={() => handleFilterChange('past')}
          disabled={!isConnected}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === 'past' && styles.filterTabTextActive,
              !isConnected && styles.filterTabTextDisabled,
            ]}
          >
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offline Banner - only show when viewing cached upcoming */}
      {!isConnected && filter === 'upcoming' && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            You're offline. Viewing cached data.
            {cachedAt && (
              <Text style={styles.cachedTime}>
                {'\n'}Last synced: {format(new Date(cachedAt), 'PPp')}
              </Text>
            )}
          </Text>
        </View>
      )}

      <FlatList
        data={meetings}
        renderItem={renderMeetingItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={isConnected}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {!isConnected
                ? 'No cached meetings available. Connect to the internet to sync.'
                : filter === 'upcoming'
                ? 'No upcoming meetings'
                : 'No past meetings'}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  filterTabActive: {
    backgroundColor: '#2563eb',
  },
  filterTabDisabled: {
    opacity: 0.5,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  filterTabTextDisabled: {
    color: '#9ca3af',
  },
  offlineBanner: {
    backgroundColor: '#fef3c7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  offlineBannerText: {
    color: '#92400e',
    fontSize: 13,
    textAlign: 'center',
  },
  cachedTime: {
    fontSize: 11,
    color: '#b45309',
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
  pastMeetingCard: {
    backgroundColor: '#f9fafb',
    opacity: 0.85,
  },
  pastText: {
    color: '#6b7280',
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
