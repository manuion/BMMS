import { meetingsApi, documentsApi } from './api';
import offlineStorage from './offlineStorage';

/**
 * Sync all scheduled meetings data for offline access.
 * Called on app load when internet is available.
 */
export const syncMeetingsForOffline = async () => {
  try {
    console.log('[OfflineSync] Starting meetings sync...');

    // Fetch all upcoming meetings
    const upcomingRes = await meetingsApi.getAll({ upcoming: 'true' });
    const meetings = upcomingRes.data || [];

    // Save meetings list for offline access
    await offlineStorage.saveMeetingsOffline(meetings);
    console.log(`[OfflineSync] Saved ${meetings.length} upcoming meetings`);

    // For each meeting, fetch and cache the full details + documents
    for (const meeting of meetings) {
      try {
        // Fetch full meeting details
        const detailRes = await meetingsApi.getById(meeting.id);

        // Fetch documents for this meeting
        const docsRes = await documentsApi.getByMeeting(meeting.id);
        let folders = [];
        let documents = [];

        if (docsRes.data && docsRes.data.folders !== undefined) {
          folders = docsRes.data.folders || [];
          documents = docsRes.data.documents || [];
        } else if (docsRes.data) {
          documents = docsRes.data || [];
        }

        // Save meeting detail with documents for offline
        await offlineStorage.saveMeetingDetailOffline(
          meeting.id,
          detailRes.data,
          folders,
          documents
        );

        console.log(`[OfflineSync] Cached meeting: ${meeting.title}`);
      } catch (err) {
        console.warn(`[OfflineSync] Failed to cache meeting ${meeting.id}:`, err.message);
      }
    }

    console.log('[OfflineSync] Meetings sync completed');
    return { success: true, count: meetings.length };
  } catch (error) {
    console.error('[OfflineSync] Sync failed:', error);
    return { success: false, error: error.message };
  }
};

export default {
  syncMeetingsForOffline,
};
