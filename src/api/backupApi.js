// src/api/backupApi.js
// Dedicated Native MySQL Backup (.sql), Cloud Restore & Database Operations Service 🛡️⚡

import { apiClient } from './client.js';
import { getAuthToken } from '../store/dbStore';

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export async function downloadFullBackupApi() {
  const token = getAuthToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/backup/full`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: Failed to generate .sql backup`);
  }

  const sqlText = await response.text();
  return sqlText;
}

export async function restoreBackupApi(sqlContent) {
  return apiClient('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify({ sql_content: sqlContent })
  });
}

export async function downloadReportApi() {
  return apiClient('/api/backup/report', { method: 'GET' });
}

export async function clearAllDataApi() {
  return apiClient('/api/backup/clear', {
    method: 'POST',
    body: JSON.stringify({ confirm: true })
  });
}
