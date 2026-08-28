// src/api/rateSubmissionApi.js
import { apiClient } from './client.js';

export async function getRateSubmissions() {
  return apiClient('/api/rate-submissions', { method: 'GET' });
}

export async function getRequirementRates(requirementId) {
  return apiClient(`/api/requirements/${requirementId}/rates`, { method: 'GET' });
}

export async function submitBid(bidPayload) {
  return apiClient('/api/rate-submissions', {
    method: 'POST',
    body: JSON.stringify(bidPayload)
  });
}

export async function submitRateQuote(quotePayload) {
  return apiClient('/api/rate-submissions', {
    method: 'POST',
    body: JSON.stringify(quotePayload)
  });
}

export async function awardRequirementRate(requirementId, awardPayload) {
  return apiClient(`/api/requirements/${requirementId}/award`, {
    method: 'POST',
    body: JSON.stringify(awardPayload)
  });
}
