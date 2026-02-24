import React, { useEffect, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert, View, StyleSheet } from 'react-native';
import { AuthProvider } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import OfflineBanner from './components/OfflineBanner';
import {
  setupNotificationHandlers,
  parseNotificationData,
} from './services/pushNotifications';

// Navigation reference for deep linking from notifications
export const navigationRef = React.createRef();

export function navigate(name, params) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  }
}

export default function App() {
  const notificationCleanupRef = useRef(null);

  useEffect(() => {
    // Set up push notification handlers
    const setupNotifications = async () => {
      notificationCleanupRef.current = await setupNotificationHandlers(
        // Foreground notification handler
        (remoteMessage) => {
          const { title, body, meetingId } = parseNotificationData(remoteMessage);

          Alert.alert(
            title || 'New Notification',
            body || '',
            meetingId
              ? [
                  { text: 'Dismiss', style: 'cancel' },
                  {
                    text: 'View Meeting',
                    onPress: () => navigate('MeetingDetail', { meetingId }),
                  },
                ]
              : [{ text: 'OK' }]
          );
        },
        // Notification opened handler (from background/killed)
        (remoteMessage) => {
          const { meetingId } = parseNotificationData(remoteMessage);

          if (meetingId) {
            // Small delay to ensure navigation is ready
            setTimeout(() => {
              navigate('MeetingDetail', { meetingId });
            }, 500);
          }
        }
      );
    };

    setupNotifications();

    // Cleanup on unmount
    return () => {
      if (notificationCleanupRef.current) {
        notificationCleanupRef.current();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <View style={styles.container}>
          <AppNavigator navigationRef={navigationRef} />
          <OfflineBanner />
        </View>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
