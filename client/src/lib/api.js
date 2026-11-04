import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Request failed');
    this.status = status;
    this.code = body?.error || 'ERROR';
    this.issues = body?.issues || [];
  }
}

async function request(method, url, { body, params, form, signal } = {}) {
  const qs = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))}`
    : '';
  const headers = {};
  if (method !== 'GET') headers['X-Requested-By'] = 'ainwan-web'; // the server rejects writes without it (CSRF defence)
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${url}${qs === '?' ? '' : qs}`, { method, headers, body: payload, signal, credentials: 'same-origin' });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, { error: 'NETWORK', message: 'No connection' });
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // A session that ran out (or was ended by the Mukhiya) must send the admin back to sign-in.
    if (res.status === 401 && !url.startsWith('/auth/login')) window.dispatchEvent(new Event('ainwan:signed-out'));
    throw new ApiError(res.status, data);
  }
  return data;
}

export const api = {
  get: (url, params, signal) => request('GET', url, { params, signal }),
  post: (url, body) => request('POST', url, { body }),
  put: (url, body) => request('PUT', url, { body }),
  patch: (url, body) => request('PATCH', url, { body }),
  del: (url) => request('DELETE', url, {}),
  upload: (url, file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', url, { form });
  },
};

/**
 * Loads data when `url` / `params` change. Pass url = null to wait (e.g. until an id is known).
 * `loading` is derived rather than stored, so there is never a flash of the previous page's data.
 */
export function useFetch(url, params) {
  const key = url == null ? null : `${url}?${JSON.stringify(params ?? {})}`;
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ key: null, tick: 0, data: null, error: null });

  useEffect(() => {
    if (key == null) return undefined;
    const ctrl = new AbortController();
    api.get(url, params, ctrl.signal).then(
      (data) => setState({ key, tick, data, error: null }),
      (error) => {
        if (error.name !== 'AbortError') setState({ key, tick, data: null, error });
      },
    );
    return () => ctrl.abort();
    // `key` already encodes url + params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const current = state.key === key && state.tick === tick;
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: key != null && !current,
    reload,
  };
}
