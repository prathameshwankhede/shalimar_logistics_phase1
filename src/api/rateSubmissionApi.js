// src/api/rateSubmissionApi.js
import { apiClient } from './client.js';

export async function getRateSubmissions() {
  return apiClient('/api/rate-submissions', { method: 'GET' });
}

export async function submitBid(bidPayload) {
  return apiClient('/api/bids', {
    method: 'POST',
    body: JSON.stringify(bidPayload)
  });
}
