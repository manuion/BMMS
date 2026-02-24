import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

/**
 * Global Offline Banner Component
 *
 * Shows a banner at the top of the screen when the device loses internet connection.
 * Auto-hides when connection is restored.
 */
export default function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  useEffect(() => {
    if (!isConnected) {
      // Lost connection - show banner
      setShowBanner(true);
      setWasOffline(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (wasOffline) {
      // Connection restored - hide banner after brief delay
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowBanner(false);
          setWasOffline(false);
        });
      }, 2000); // Show "Back online" for 2 seconds
    }
  }, [isConnected, wasOffline, slideAnim]);

  if (!showBanner) {
    return null;
  }

  const bannerColor = isConnected ? '#22c55e' : '#ef4444';
  const bannerText = isConnected ? 'Back online' : 'No internet connection';

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: bannerColor,
          paddingTop: Platform.OS === 'ios' ? insets.top : 8,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{isConnected ? '✓' : '!'}</Text>
        <Text style={styles.text}>{bannerText}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  icon: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
