import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to access host machine's localhost
// iOS simulator uses localhost directly
const getBaseUrl = () => {
  if (__DEV__) {
    // For Android emulator, use 10.0.2.2 to access host machine
    // For iOS simulator, use localhost
    // For real device, replace with your computer's IP address
    if (Platform.OS === 'android') {
      return 'http://10.0.2.2:3001/api';
    }
    return 'http://localhost:3001/api';
  }
  return 'https://your-production-api.com/api';
};

const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const message = error.response?.data?.message || 'Something went wrong';

    // Handle 401 - clear storage
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }

    return Promise.reject({ message, status: error.response?.status });
  }
);

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Meetings API
export const meetingsApi = {
  getAll: (params) => api.get('/meetings', { params }),
  getById: (id) => api.get(`/meetings/${id}`),
  respond: (id, data) => api.post(`/meetings/${id}/respond`, data),
};

// Documents API
export const documentsApi = {
  getByMeeting: (meetingId) => api.get(`/documents/meeting/${meetingId}`),
  getDownloadUrl: (id) => api.get(`/documents/${id}/download`),
};

// Notifications API
export const notificationsApi = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  registerDeviceToken: (data) => api.post('/notifications/device-token', data),
  unregisterDeviceToken: (token) =>
    api.delete('/notifications/device-token', { data: { token } }),
  testPush: () => api.post('/notifications/test-push'),
};

export default api;
