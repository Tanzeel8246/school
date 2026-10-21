/**
 * Tiny typed fetch client. Holds the access token in memory (never localStorage,
 * to keep it out of XSS reach — blueprint §3). On 401 it transparently refreshes
 * using the HttpOnly refresh cookie and retries once.
 */
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => (accessToken = t);
/** Read the in-memory access token (e.g. for download utility). */
export const getAccessToken = () => accessToken;

interface Envelope<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<Envelope<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && retry) {
    const ok = await refresh();
    if (ok) return request<T>(path, init, false);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error);
  return json as Envelope<T>;
}

async function refresh(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
  const { data } = await res.json();
  setAccessToken(data.accessToken);
  return true;
}

export class ApiError extends Error {
  constructor(public status: number, public payload: unknown) {
    super('API error');
  }
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body: unknown) =>
    request<T>(p, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) =>
    request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(p: string, body: unknown) =>
    request<T>(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),

  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new ApiError(res.status, json?.error);
    return json as { url: string };
  },

  /**
   * Authenticated file download. Fetches BASE+path, reads the response as a
   * Blob, extracts the filename from Content-Disposition (falls back to
   * 'report'), then triggers a browser download via a temporary <a> element.
   */
  async download(path: string): Promise<void> {
    const res = await fetch(`${BASE}${path}`, {
      credentials: 'include',
      headers: {
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!res.ok) throw new ApiError(res.status, {});

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') ?? '';
    const match = /filename[^;=\n]*=(['"]?)([^'";\n]+)\1/.exec(disposition);
    const filename = match?.[2]?.trim() ?? 'report';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
