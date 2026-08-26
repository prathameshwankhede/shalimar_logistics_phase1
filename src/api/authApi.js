// src/api/authApi.js
import { apiClient } from './client.js';

export async function loginUser(username, password) {
  return apiClient('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
}

export async function fetchCurrentUser() {
  return apiClient('/api/auth/me', { method: 'GET' });
}
