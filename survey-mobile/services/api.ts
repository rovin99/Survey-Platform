import axios from 'axios';
import { getItem, deleteItem } from './storage';

// Change this to your server URL
// Local dev: use your computer's IP (not localhost — mobile can't reach it)
// Production: your domain
import { Platform } from 'react-native';

// Auto-detect the API URL based on the current hostname
// When running on phone via http://10.7.48.232:8081, window.location.hostname = "10.7.48.232"
// When running on Mac via http://localhost:8081, window.location.hostname = "localhost"
function getApiUrl(): string {
  if (!__DEV__) return 'https://your-production-domain.com';

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.hostname;
    return `http://${host}:3000`; // Same host as the Expo server, port 3000 for nginx
  }

  return 'http://10.7.48.232:3000'; // Native fallback
}

const API_BASE_URL = getApiUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await deleteItem('accessToken');
      await deleteItem('user');
    }
    return Promise.reject(error);
  }
);

export { API_BASE_URL };
export default api;
