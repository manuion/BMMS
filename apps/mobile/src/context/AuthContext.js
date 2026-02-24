import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../services/api';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '../services/pushNotifications';
import { syncMeetingsForOffline } from '../services/offlineSync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const savedUser = await AsyncStorage.getItem('user');

      if (token && savedUser) {
        setUser(JSON.parse(savedUser));

        // Verify token is still valid
        try {
          const res = await authApi.getMe();
          setUser(res.data);
          await AsyncStorage.setItem('user', JSON.stringify(res.data));

          // Register for push notifications for returning user
          registerForPushNotifications().catch(console.error);

          // Sync meetings for offline access (runs in background)
          syncMeetingsForOffline().catch(console.error);
        } catch (error) {
          // Token invalid
          await AsyncStorage.multiRemove(['token', 'user']);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const { user: userData, token } = res.data;

    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    // Register for push notifications after login
    registerForPushNotifications().catch(console.error);

    // Sync meetings for offline access (runs in background)
    syncMeetingsForOffline().catch(console.error);

    return userData;
  };

  const logout = async () => {
    // Unregister push notifications before logout
    await unregisterPushNotifications().catch(console.error);

    await AsyncStorage.multiRemove(['token', 'user']);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
