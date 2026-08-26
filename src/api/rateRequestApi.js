// src/api/rateRequestApi.js
import { apiClient } from './client.js';

export async function getRateRequests(page = 1, limit = 20) {
  return apiClient(`/api/rate-requests?page=${page}&limit=${limit}`, { method: 'GET' });
}
