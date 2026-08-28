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

export async function getCompanyUnits() {
  return apiClient('/api/company-units', { method: 'GET' });
}

export async function createCompanyUnit(unitPayload) {
  return apiClient('/api/company-units', {
    method: 'POST',
    body: JSON.stringify(unitPayload)
  });
}

export async function updateCompanyUnit(id, unitPayload) {
  return apiClient(`/api/company-units/${id}`, {
    method: 'PUT',
    body: JSON.stringify(unitPayload)
  });
}

export async function deleteCompanyUnit(id) {
  return apiClient(`/api/company-units/${id}`, {
    method: 'DELETE'
  });
}

export async function getCities() {
  return apiClient('/api/cities', { method: 'GET' });
}

export async function createCity(cityPayload) {
  return apiClient('/api/cities', {
    method: 'POST',
    body: JSON.stringify(cityPayload)
  });
}

export async function getTransportTitles() {
  return apiClient('/api/transport-titles', { method: 'GET' });
}

export async function createTransportTitle(titlePayload) {
  return apiClient('/api/transport-titles', {
    method: 'POST',
    body: JSON.stringify(titlePayload)
  });
}
