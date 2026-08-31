// server/utils/logger.js
// Production-Safe Structured Logging & Deduplication Engine 🛡️

const isProduction = process.env.NODE_ENV === 'production';
const isDebug = process.env.DEBUG === 'true' || process.env.DEBUG_HTTP === 'true';

// In-memory throttling map to prevent log floods / disk exhaustion
const errorThrottleMap = new Map();
const THROTTLE_WINDOW_MS = 30000; // 30 seconds

function sanitize(data) {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  const sensitiveKeys = ['password', 'password_hash', 'token', 'jwt', 'secret', 'authorization'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

export const logger = {
  info(message, meta = null) {
    if (meta) {
      console.log(`[INFO ${new Date().toISOString()}] ${message}`, sanitize(meta));
    } else {
      console.log(`[INFO ${new Date().toISOString()}] ${message}`);
    }
  },

  warn(message, meta = null) {
    const key = `WARN:${message}`;
    const now = Date.now();
    const lastLogged = errorThrottleMap.get(key) || 0;

    if (now - lastLogged > THROTTLE_WINDOW_MS) {
      errorThrottleMap.set(key, now);
      if (meta) {
        console.warn(`[WARN ${new Date().toISOString()}] ${message}`, sanitize(meta));
      } else {
        console.warn(`[WARN ${new Date().toISOString()}] ${message}`);
      }
    }
  },

  error(message, error = null) {
    const errMsg = error?.message || String(error || '');
    const key = `ERR:${message}:${errMsg}`;
    const now = Date.now();
    const lastLogged = errorThrottleMap.get(key) || 0;

    if (now - lastLogged > THROTTLE_WINDOW_MS) {
      errorThrottleMap.set(key, now);
      const logPayload = {
        timestamp: new Date().toISOString(),
        message,
        code: error?.code || undefined,
        detail: errMsg || undefined
      };
      // Never print full stack trace in production unless explicitly debugging
      if (!isProduction && error?.stack) {
        logPayload.stack = error.stack;
      }
      console.error(`[ERROR ${new Date().toISOString()}] ${message}: ${errMsg}`);
    }
  },

  debug(message, meta = null) {
    if (isDebug && !isProduction) {
      if (meta) {
        console.log(`[DEBUG ${new Date().toISOString()}] ${message}`, sanitize(meta));
      } else {
        console.log(`[DEBUG ${new Date().toISOString()}] ${message}`);
      }
    }
  }
};

export default logger;
