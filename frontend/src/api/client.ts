import axios from 'axios';
import { useAuthStore } from '../store/auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !refreshing) {
      original._retry = true;
      refreshing = true;
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        useAuthStore.getState().setAccessToken(data.accessToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        refreshing = false;
        return api(original);
      } catch {
        refreshing = false;
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
