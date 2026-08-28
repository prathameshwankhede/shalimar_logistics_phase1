// src/api/rateRequestApi.js
import { apiClient } from './client.js';

export async function getRateRequests(page = 1, limit = 20) {
  return apiClient(`/api/requirements?page=${page}&limit=${limit}`, { method: 'GET' });
}

export async function getRequirements() {
  return apiClient('/api/requirements', { method: 'GET' });
}

export async function createRateRequest(payload) {
  return apiClient('/api/requirements', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function createRequirement(payload) {
  return apiClient('/api/requirements', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateRequirement(id, payload) {
  return apiClient(`/api/requirements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function deleteRequirement(id) {
  return apiClient(`/api/requirements/${id}`, {
    method: 'DELETE'
  });
}
