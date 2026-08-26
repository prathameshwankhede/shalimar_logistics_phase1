// src/api/auditLogApi.js
import { apiClient } from './client.js';

export async function getAuditLogs() {
  return apiClient('/api/security/audit-logs', { method: 'GET' });
}
