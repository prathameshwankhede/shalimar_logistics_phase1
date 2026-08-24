// src/tursoClient.js
// ⚡ Enterprise Turso / libSQL SQLite Database Adapter
import { createClient } from '@libsql/client/web';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : {};

const tursoUrl = env.VITE_TURSO_DATABASE_URL || env.VITE_SUPABASE_TURSO_DATABASE_URL || env.TURSO_DATABASE_URL || '';
const tursoToken = env.VITE_TURSO_AUTH_TOKEN || env.VITE_SUPABASE_TURSO_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || '';

export const isTursoConfigured = Boolean(tursoUrl && tursoToken);

export const tursoClient = isTursoConfigured
  ? createClient({
      url: tursoUrl,
      authToken: tursoToken
    })
  : null;

/**
 * Initialize Turso table if missing
 */
export async function initTursoSchema() {
  if (!tursoClient) return false;
  try {
    await tursoClient.execute(`
      CREATE TABLE IF NOT EXISTS app_database (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    return true;
  } catch (err) {
    console.error('Turso Schema Init Error:', err);
    return false;
  }
}
