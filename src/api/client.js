// src/api/client.js
// Centralized Enterprise HTTP Client for Shalimar Logistics 🛡️⚡

import { getAuthToken } from '../store/dbStore';

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export async function apiClient(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (options.method || 'GET').toUpperCase();
  let finalEndpoint = endpoint;
  if (options.bypassCache) {
    const separator = endpoint.includes('?') ? '&' : '?';
    finalEndpoint = `${endpoint}${separator}_t=${Date.now()}`;
  }

  // Setup abort controller with sensible timeout (15 seconds) if not provided
  let signal = options.signal;
  let timeoutId = null;
  if (!signal && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), 15000);
    signal = controller.signal;
  }

  const config = {
    ...options,
    headers,
    signal
  };

  try {
    const response = await fetch(`${getApiBaseUrl()}${finalEndpoint}`, config);

    if (timeoutId) clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        const errMsg = typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || `HTTP ${response.status}`;
        const err = new Error(errMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }
      return data;
    }

    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }

    return response;
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    // Don't re-throw aborted requests noisily
    if (err.name === 'AbortError') {
      throw err;
    }
    // Idempotent GET retry once on 5xx or network disconnect
    if (method === 'GET' && !options._isRetry && (!err.status || err.status >= 500)) {
      await new Promise(r => setTimeout(r, 1000));
      return apiClient(endpoint, { ...options, _isRetry: true });
    }
    throw err;
  }
}
