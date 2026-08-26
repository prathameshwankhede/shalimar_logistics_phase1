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
