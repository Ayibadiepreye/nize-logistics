import axios from 'axios';
import { clearSession, getToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:10000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 means the stored token is dead — drop it and send the user to login,
    // but never bounce someone who is already on a public page mid-request.
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const onAuthPage = window.location.pathname.startsWith('/login');
      clearSession();
      if (!onAuthPage) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    }
    return Promise.reject(error);
  }
);

/** Pulls a human-readable message out of an axios error. */
export function apiError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as {
    response?: { data?: { error?: string; details?: Array<{ message?: string }> } };
    code?: string;
  };
  const details = err?.response?.data?.details;
  if (details?.length) {
    const msgs = details.map((d) => d.message).filter(Boolean);
    if (msgs.length) return msgs.join(', ');
  }
  if (err?.response?.data?.error) return err.response.data.error;
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Check your connection and try again.';
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

export default api;
