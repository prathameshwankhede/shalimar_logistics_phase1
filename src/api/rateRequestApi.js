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

export async function deleteRequirementItem(parentId, itemId) {
  return apiClient(`/api/requirements/${parentId}/items/${itemId}`, {
    method: 'DELETE'
  });
}

export async function archiveRequirement(id) {
  return apiClient(`/api/requirements/${id}/archive`, {
    method: 'POST'
  });
}

export async function cancelRequirement(id, reason) {
  return apiClient(`/api/requirements/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function restoreRequirement(id) {
  return apiClient(`/api/requirements/${id}/restore`, {
    method: 'POST'
  });
}

export async function acceptFinalRate(requirementId, itemId, submissionId) {
  if (submissionId) {
    return apiClient(`/api/rate-submissions/${submissionId}/accept-final-rate`, {
      method: 'POST'
    });
  }
  return apiClient(`/api/requirements/${requirementId}/items/${itemId}/accept-final-rate`, {
    method: 'POST'
  });
}

export async function createTruckDispatch(requirementId, itemId, payload) {
  return apiClient(`/api/requirements/${requirementId}/items/${itemId}/dispatch`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getRequirementItemDispatches(requirementId, itemId) {
  return apiClient(`/api/requirements/${requirementId}/items/${itemId}/dispatches`, {
    method: 'GET'
  });
}

export async function getAllDispatches() {
  return apiClient('/api/dispatches', {
    method: 'GET'
  });
}

export async function getDispatchById(id) {
  return apiClient(`/api/dispatches/${id}`, {
    method: 'GET'
  });
}

