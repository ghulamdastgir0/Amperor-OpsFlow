import axios, { AxiosError } from 'axios';

// Deliberately separate from AUTH_TOKEN_KEY in client.ts — a platform-admin
// session and a tenant-user session must never share or collide in the same
// browser (see backend JwtAuthGuard's kind-separation check).
export const PLATFORM_TOKEN_KEY = 'opsflow_platform_token';
export const PLATFORM_AUTH_CHANGE_EVENT = 'opsflow-platform-auth-change';

export const platformApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

platformApiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(PLATFORM_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

platformApiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem(PLATFORM_TOKEN_KEY);
      window.dispatchEvent(new Event(PLATFORM_AUTH_CHANGE_EVENT));
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/platform/login';
    }
    return Promise.reject(error);
  },
);

export function setPlatformToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(PLATFORM_TOKEN_KEY, token);
    window.dispatchEvent(new Event(PLATFORM_AUTH_CHANGE_EVENT));
  }
}

export function clearPlatformToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(PLATFORM_TOKEN_KEY);
    window.dispatchEvent(new Event(PLATFORM_AUTH_CHANGE_EVENT));
  }
}
