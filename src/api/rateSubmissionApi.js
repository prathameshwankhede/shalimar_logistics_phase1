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

export async function sendAdminCounter(submissionId, counterPayload) {
  return apiClient(`/api/rate-submissions/${submissionId}/admin-counter`, {
    method: 'POST',
    body: JSON.stringify(counterPayload)
  });
}

export async function submitTransporterResponse(submissionId, responsePayload) {
  return apiClient(`/api/rate-submissions/${submissionId}/transporter-response`, {
    method: 'POST',
    body: JSON.stringify(responsePayload)
  });
}

export async function finalizeBid(submissionId, finalizePayload = {}) {
  return apiClient(`/api/rate-submissions/${submissionId}/finalize`, {
    method: 'POST',
    body: JSON.stringify(finalizePayload)
  });
}

export async function getSubmissionHistory(submissionId) {
  return apiClient(`/api/rate-submissions/${submissionId}/history`, {
    method: 'GET'
  });
}
