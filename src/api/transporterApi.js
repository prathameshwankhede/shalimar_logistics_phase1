// src/api/transporterApi.js
import { apiClient } from './client.js';

export async function getTransporters() {
  return apiClient('/api/transporters', { method: 'GET' });
}

export async function createTransporter(payload) {
  return apiClient('/api/transporters', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateTransporterStatus(id, status) {
  return apiClient('/api/transporters/status', {
    method: 'POST',
    body: JSON.stringify({ id, status })
  });
}

export async function resetTransporterPassword(id, password = null) {
  return apiClient('/api/transporters/reset-password', {
    method: 'POST',
    body: JSON.stringify({ id, password })
  });
}
