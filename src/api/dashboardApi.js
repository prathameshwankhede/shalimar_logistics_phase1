// src/api/dashboardApi.js
import { apiClient } from './client.js';

export async function getDashboardMetrics() {
  return apiClient('/api/dashboard', { method: 'GET' });
}
