import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || 'Something went wrong';

    // Handle 401 - redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject({ message, status: error.response?.status });
  }
);

// Auth API
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// Users API
export const usersApi = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Committees API
export const committeesApi = {
  getAll: () => api.get('/committees'),
  getOrganiserCommittees: () => api.get('/committees/organiser'),
  getById: (id) => api.get(`/committees/${id}`),
  create: (data) => api.post('/committees', data),
  update: (id, data) => api.put(`/committees/${id}`, data),
  delete: (id) => api.delete(`/committees/${id}`),
  addMember: (committeeId, data) => api.post(`/committees/${committeeId}/members`, data),
  updateMember: (committeeId, userId, data) =>
    api.put(`/committees/${committeeId}/members/${userId}`, data),
  removeMember: (committeeId, userId) =>
    api.delete(`/committees/${committeeId}/members/${userId}`),
};

// Meetings API
export const meetingsApi = {
  getAll: (params) => api.get('/meetings', { params }),
  getById: (id) => api.get(`/meetings/${id}`),
  create: (data) => api.post('/meetings', data),
  update: (id, data) => api.put(`/meetings/${id}`, data),
  delete: (id) => api.delete(`/meetings/${id}`),
  respond: (id, data) => api.post(`/meetings/${id}/respond`, data),
  getResponses: (id) => api.get(`/meetings/${id}/responses`),
};

// Documents API
export const documentsApi = {
  getByMeeting: (meetingId) => api.get(`/documents/meeting/${meetingId}`),
  getTree: (meetingId) => api.get(`/documents/meeting/${meetingId}/tree`),
  uploadTree: (data) => api.post('/documents/upload-tree', data),
  initiateUpload: (data) => api.post('/documents/initiate-upload', data),
  updateProgress: (id, data) => api.put(`/documents/${id}/progress`, data),
  completeUpload: (id, data) => api.post(`/documents/${id}/complete`, data),
  abortUpload: (id) => api.post(`/documents/${id}/abort`),
  resumeUpload: (id) => api.post(`/documents/${id}/resume`),
  getDownloadUrl: (id) => api.get(`/documents/${id}/download`),
  delete: (id) => api.delete(`/documents/${id}`),
  move: (id, data) => api.put(`/documents/${id}/move`, data),
  // Folder operations
  createFolder: (data) => api.post('/documents/folders', data),
  renameFolder: (id, data) => api.put(`/documents/folders/${id}`, data),
  deleteFolder: (id) => api.delete(`/documents/folders/${id}`),
  moveFolder: (id, data) => api.put(`/documents/folders/${id}/move`, data),
};

// Notifications API
export const notificationsApi = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;
