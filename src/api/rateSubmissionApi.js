// src/api/rateSubmissionApi.js
import { apiClient } from './client.js';

export async function getRateSubmissions() {
  return apiClient('/api/rate-submissions', { method: 'GET' });
}

export async function getRequirementRates(requirementId, itemId) {
  const url = itemId ? `/api/requirements/${requirementId}/rates?item_id=${encodeURIComponent(itemId)}` : `/api/requirements/${requirementId}/rates`;
  return apiClient(url, { method: 'GET' });
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
