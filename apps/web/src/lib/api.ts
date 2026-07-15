/**
 * Typed API client with auth (credentials), error handling, and optional toast.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  code?: string;
}

let onError: ((message: string) => void) | null = null;
export function setApiErrorHandler(handler: (message: string) => void) {
  onError = handler;
}

/** Per-call options that aren't part of the fetch RequestInit. */
export interface ApiOptions {
  /** Skip the global error handler (toast) for this call — handle the error locally. */
  silent?: boolean;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  { silent = false }: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error ?? res.statusText ?? 'Request failed';
    if (!silent) onError?.(msg);
    return {
      success: false,
      error: msg,
      status: res.status,
      code: json?.code,
    };
  }
  return { success: true, data: json.data ?? json };
}

export const api = {
  get<T>(path: string, opts?: ApiOptions): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'GET' }, opts);
  },
  post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  },
  put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  },
  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: 'DELETE' });
  },
  /** For PDF/CSV: returns blob, path is full path e.g. /orders/xxx/pdf */
  blob(path: string): Promise<Blob> {
    const url = path.startsWith('http') ? path : `${BASE}${path}`;
    return fetch(url, { credentials: 'include' }).then((r) => {
      if (!r.ok) throw new Error('Download failed');
      return r.blob();
    });
  },
};
