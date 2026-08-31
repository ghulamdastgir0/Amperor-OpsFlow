import axios, { AxiosError } from 'axios';

export const AUTH_TOKEN_KEY = 'opsflow_access_token';
// localStorage writes don't fire a 'storage' event in the same tab that made them,
// so useAuth() also listens for this to react to login/logout immediately.
export const AUTH_CHANGE_EVENT = 'opsflow-auth-change';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// JwtAuthGuard returns 403 (not 401) for a blocked account/tenant/admin — the
// token itself is still valid, access is just revoked — so a plain 401 check
// alone misses it, and it was falling through to whatever generic
// "could not load X" message the calling page happened to show, misattributing
// an auth rejection to a backend outage. Recognized here by exact message text
// (see JwtAuthGuard) since a 403 is also the legitimate, non-session-ending
// response for a normal RBAC restriction (e.g. an EMPLOYEE hitting a
// Finance-only route) — only these specific messages should log the user out.
const BLOCKED_ACCOUNT_MESSAGES = new Set([
  'This account has been blocked',
  'This tenant has been blocked',
  'This admin account has been blocked',
]);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    const isBlocked = status === 403 && typeof message === 'string' && BLOCKED_ACCOUNT_MESSAGES.has(message);
    // A 401 from a login call itself is just "wrong credentials" — the login
    // page shows that inline. Auto-logout + hard redirect here would reload the
    // page and wipe that error before the user ever sees it. Matches both
    // `/auth/login` and `/platform/auth/login`.
    const isLoginRequest = (error.config?.url ?? '').includes('auth/login');
    if ((status === 401 || isBlocked) && !isLoginRequest && typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
      // Hard redirect: this runs outside the React tree, so useRouter() isn't available here.
      window.location.href = isBlocked ? '/login?error=account_blocked' : '/login';
    }
    return Promise.reject(error);
  },
);

export function setAuthToken(token: string) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

export function clearAuthToken() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}
