// src/api/backupApi.js
// Dedicated MySQL Backup, Cloud Restore & Database Operations Service 🛡️⚡

import { apiClient } from './client.js';

export async function downloadFullBackupApi() {
  return apiClient('/api/backup/full', { method: 'GET' });
}

export async function restoreBackupApi(backupPayload) {
  return apiClient('/api/backup/restore', {
    method: 'POST',
    body: JSON.stringify(backupPayload)
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
