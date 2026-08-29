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
  // Only add cache buster if explicitly requested via options.bypassCache
  if (options.bypassCache) {
    const separator = endpoint.includes('?') ? '&' : '?';
    finalEndpoint = `${endpoint}${separator}_t=${Date.now()}`;
  }

  const config = {
    ...options,
    headers
  };

  const response = await fetch(`${getApiBaseUrl()}${finalEndpoint}`, config);

  if (response.status === 401) {
    console.warn('⚠️ Authentication session expired or invalid (HTTP 401)');
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      const errMsg = typeof data.error === 'string'
        ? data.error
        : data.error?.message || data.message || `HTTP ${response.status}`;
      const err = new Error(errMsg);
      err.data = data;
      throw err;
    }
    return data;
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response;
}
