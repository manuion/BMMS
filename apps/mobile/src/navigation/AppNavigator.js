import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, TouchableOpacity, Alert } from 'react-native';

import { useAuth } from '../context/AuthContext';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import HomeScreen from '../screens/home/HomeScreen';
import MeetingDetailScreen from '../screens/meeting/MeetingDetailScreen';
import DocumentViewerScreen from '../screens/meeting/DocumentViewerScreen';
import OfflineDocsScreen from '../screens/offline/OfflineDocsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Bar Icon Component
function TabIcon({ name, focused }) {
  const icons = {
    Meetings: 'M',
    Offline: 'O',
    Profile: 'P',
  };

  return (
    <View style={{
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: focused ? '#2563eb' : '#e5e7eb',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <Text style={{
        fontSize: 14,
        fontWeight: '600',
        color: focused ? '#fff' : '#6b7280',
      }}>
        {icons[name] || '?'}
      </Text>
    </View>
  );
}

// Profile Screen (placeholder)
function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={{ backgroundColor: '#fff', padding: 20, marginBottom: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 4 }}>
          {user?.name}
        </Text>
        <Text style={{ fontSize: 16, color: '#6b7280' }}>{user?.email}</Text>
      </View>

      <View style={{ backgroundColor: '#fff', padding: 20 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 16 }}>
          Committees
        </Text>
        {user?.committeeMemberships?.map((membership) => (
          <View
            key={membership.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}
          >
            <Text style={{ fontSize: 14, color: '#4b5563' }}>
              {membership.committee?.name}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: membership.role === 'organiser' ? '#2563eb' : '#6b7280',
                fontWeight: membership.role === 'organiser' ? '600' : '400',
              }}
            >
              {membership.role}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={{
          marginTop: 'auto',
          marginHorizontal: 16,
          marginBottom: 32,
          backgroundColor: '#ef4444',
          paddingVertical: 14,
          borderRadius: 8,
          alignItems: 'center',
        }}
        onPress={handleLogout}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Main Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        headerStyle: {
          backgroundColor: '#fff',
        },
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen
        name="Meetings"
        component={HomeScreen}
        options={{ title: 'Upcoming Meetings' }}
      />
      <Tab.Screen
        name="Offline"
        component={OfflineDocsScreen}
        options={{ title: 'Offline Documents' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'My Profile' }}
      />
    </Tab.Navigator>
  );
}

// Auth Navigator
function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

// Main App Navigator
function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MeetingDetail"
        component={MeetingDetailScreen}
        options={{ title: 'Meeting Details' }}
      />
      <Stack.Screen
        name="DocumentViewer"
        component={DocumentViewerScreen}
        options={{ title: 'Document' }}
      />
    </Stack.Navigator>
  );
}

// Root Navigator
export default function AppNavigator({ navigationRef }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
