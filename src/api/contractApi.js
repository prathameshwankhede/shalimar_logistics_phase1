// src/api/contractApi.js
import { apiClient } from './client.js';

export async function createContract(payload) {
  return apiClient('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}
