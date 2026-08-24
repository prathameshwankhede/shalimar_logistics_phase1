// src/utils/dsaEngine.js
// Clean & Fast Lightweight Helper Engine for TransFlow ERP 🚀

/**
 * 1. HASH MAP INDEXER FOR BIDS (rate_submissions)
 * Fast O(1) Map lookup by request ID / requisition code
 */
export function buildBidIndexMap(submissions = []) {
  const map = new Map();
  if (!Array.isArray(submissions)) return map;

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    if (!sub) continue;

    const reqIdKey = sub.rate_request_id ? String(sub.rate_request_id) : null;
    if (reqIdKey) {
      if (!map.has(reqIdKey)) map.set(reqIdKey, []);
      map.get(reqIdKey).push(sub);
    }
  }
  return map;
}

/**
 * 2. HASH MAP INDEXER FOR TRANSPORTERS
 * Maps Transporters by ID, Code, and Username for fast lookup
 */
export function buildTransporterIndexMap(transporters = []) {
  const map = new Map();
  if (!Array.isArray(transporters)) return map;

  for (let i = 0; i < transporters.length; i++) {
    const t = transporters[i];
    if (!t) continue;
    if (t.id) map.set(String(t.id), t);
    if (t.code) map.set(String(t.code), t);
    if (t.username) map.set(String(t.username), t);
  }
  return map;
}

/**
 * 3. L1 LOWEST BID & BID STATS CALCULATOR
 */
export function calculateL1BidStats(bids = []) {
  if (!Array.isArray(bids) || bids.length === 0) {
    return { bidsCount: 0, lowestRate: null, validRates: [] };
  }

  let lowestRate = Infinity;
  let validCount = 0;
  const validRates = [];

  for (let i = 0; i < bids.length; i++) {
    const rate = parseFloat(bids[i]?.rate_per_unit);
    if (!isNaN(rate) && rate > 0) {
      validRates.push(rate);
      if (rate < lowestRate) {
        lowestRate = rate;
      }
      validCount++;
    }
  }

  return {
    bidsCount: bids.length,
    lowestRate: lowestRate === Infinity ? null : lowestRate,
    validRates
  };
}

/**
 * 4. SET-BASED DEDUPLICATION FOR DROPDOWN OPTIONS
 */
export function fastDeduplicateStrings(list = []) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item && typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed.length > 0 && !seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }
  }
  return result;
}
