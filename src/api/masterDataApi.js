// src/api/masterDataApi.js
import { apiClient } from './client.js';

export async function getMasterData() {
  return apiClient('/api/master-data', { method: 'GET' });
}

export async function getProducts() {
  return apiClient('/api/products', { method: 'GET' });
}

export async function createProduct(productPayload) {
  return apiClient('/api/products', {
    method: 'POST',
    body: JSON.stringify(productPayload)
  });
}
