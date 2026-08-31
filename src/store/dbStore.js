// src/store/dbStore.js
// Enterprise Hostinger Node.js API + MySQL Database Store Engine 🛡️⚡

export const EMPTY_STATE = {
  _updatedAt: Date.now(),
  company: {
    name: 'Shalimar Nutrients Pvt Ltd',
    short_name: 'Shalimar Nutrients',
    tagline: 'Agri-Commodities, Edible Oils & Bulk Transport Procurement Portal',
    gstin: '27AAPCS1419M1ZV',
    logo: '/shalimar_logo.png',
    reg_office: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028',
    contact_email: 'logistics@shalimarnutrients.com',
    contact_phone: '+91 712 2567890'
  },
  do_master_settings: {
    hsn_code: '23040010',
    igst_rate: 5,
    do_prefix: 'DOR-SNPL-',
    state_name: 'MAHARASHTRA',
    state_code: '27 (MAHARASHTRA)',
    dispatch_plant_name: 'Shalimar Nutrients MIDC Processing Unit',
    dispatch_plant_address: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028',
    terms_conditions: '1. Food-grade tarpaulin covering mandatory for dry cargo.\n2. Automated 24x7 weighbridge tare and gross recorded at Shalimar Plant.'
  },
  company_masters: [],
  product_masters: [],
  cargo_masters: [],
  title_masters: [],
  city_masters: [],
  company_units: [],
  products: [],
  cities: [],
  transport_titles: [],
  transporters: [],
  users: [],
  rate_requests: [],
  rate_submissions: [],
  contracts: [],
  dispatches: [],
  security_audit_logs: [],
  whatsapp_notifications: []
};

export const INITIAL_SEED_DATA = EMPTY_STATE;

const LOCAL_STORAGE_KEY = 'transflow_live_db';
const AUTH_TOKEN_KEY = 'transflow_auth_token';

function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function getAuthToken() {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch (e) {}
}

function getAuthHeaders() {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * ☁️ Robust HTTP Fetch with Transient Retry (Exponential Backoff)
 * Retries network failures & 5xx server errors safely.
 * Does NOT retry 401 (Unauthorized), 403 (Forbidden), or 404.
 */
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 800) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          ...getAuthHeaders(),
          ...(options.headers || {})
        }
      });

      // Never retry client authentication errors
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        return res;
      }

      // Retry on 5xx or server hiccups
      if (res.status >= 500 && attempt < retries) {
        console.warn(`⚠️ [API] ${url} returned ${res.status}, retrying in ${delayMs * Math.pow(2, attempt)}ms (attempt ${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') {
        throw err;
      }
      if (attempt < retries) {
        console.warn(`⚠️ [API] Network error fetching ${url}, retrying in ${delayMs * Math.pow(2, attempt)}ms (attempt ${attempt + 1}/${retries}):`, err.message);
        await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
}

/**
 * ☁️ Modular Targeted API Fetch Functions (Minimal Data Footprint & Zero Stale Cache)
 */
export async function fetchDashboardMetrics() {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/dashboard?_t=${Date.now()}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.dashboard || null;
  } catch (e) {
    return null;
  }
}

export async function fetchRateRequests(page = 1, limit = 20, options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/rate-requests?page=${page}&limit=${limit}`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.rate_requests || [];
  } catch (e) {
    return [];
  }
}

export async function fetchRateSubmissions(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/rate-submissions`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.rate_submissions || json.data || [];
  } catch (e) {
    return [];
  }
}

export async function fetchTransportersList(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/transporters`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.transporters || json.data || [];
  } catch (e) {
    return [];
  }
}

export async function fetchCompanyUnitsList(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/company-units`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.company_units || [];
  } catch (e) {
    return [];
  }
}

export async function fetchProductsList(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/products`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.products || json.product_masters || [];
  } catch (e) {
    return [];
  }
}

export async function fetchRequirementsList(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/requirements`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.requirements || json.rate_requests || [];
  } catch (e) {
    return [];
  }
}

export async function fetchMasterData(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/master-data`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.master_records || [];
  } catch (e) {
    return [];
  }
}

export async function fetchTruckDispatchesList(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/dispatches`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.dispatches || json.truck_dispatches || [];
  } catch (e) {
    return [];
  }
}

export async function fetchAuditLogs(options = {}) {
  try {
    const res = await fetchWithRetry(`${getApiBaseUrl()}/api/security/audit-logs`, options);
    if (!res.ok) return [];
    const json = await res.json();
    return json.audit_logs || [];
  } catch (e) {
    return [];
  }
}

/**
 * ☁️ Save Database to Node.js API / Hostinger MySQL Server (Authenticated)
 */
export async function saveDB(data) {
  const dataToSave = {
    ...data,
    _updatedAt: Date.now()
  };

  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('transflow_db');
    localStorage.removeItem('transflow_live_db');
  } catch (e) {}

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/state`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dataToSave)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    if (result && result.data) {
      return result.data;
    }
  } catch (err) {
    console.error('API State save error:', err.message);
  }

  return dataToSave;
}

/**
 * ☁️ Direct API Database Connection (No LocalStorage Cache)
 */
export function loadDB() {
  return { ...EMPTY_STATE, _hasLoaded: false };
}

/**
 * ☁️ Reset Operational Data
 */
export function resetDB() {
  const cleanData = {
    ...INITIAL_SEED_DATA,
    _updatedAt: Date.now(),
    _hasLoaded: true
  };
  saveDB(cleanData);
  return cleanData;
}

// In-flight Promise deduplication variable to prevent concurrent request storms
let inFlightLoadPromise = null;

export async function loadDBFromSupabase(options = {}) {
  // If a request is already in-flight, return the same promise to prevent duplicate API hammering
  if (inFlightLoadPromise) {
    return inFlightLoadPromise;
  }

  inFlightLoadPromise = (async () => {
    try {
      console.log('📡 [API] Loading requirements');
      const reqRes = await fetchWithRetry(`${getApiBaseUrl()}/api/requirements`, options);
      console.log(`📡 [API] Requirements response: ${reqRes.status}`);

      console.log('📡 [API] Loading products');
      const prodRes = await fetchWithRetry(`${getApiBaseUrl()}/api/products`, options);
      console.log(`📡 [API] Products response: ${prodRes.status}`);

      console.log('📡 [API] Loading locations');
      const compRes = await fetchWithRetry(`${getApiBaseUrl()}/api/company-units`, options);
      console.log(`📡 [API] Locations response: ${compRes.status}`);

      const [transRes, subRes, dispRes] = await Promise.all([
        fetchWithRetry(`${getApiBaseUrl()}/api/transporters`, options).catch(() => null),
        fetchWithRetry(`${getApiBaseUrl()}/api/rate-submissions`, options).catch(() => null),
        fetchWithRetry(`${getApiBaseUrl()}/api/dispatches`, options).catch(() => null)
      ]);

      const reqJson = reqRes.ok ? await reqRes.json() : null;
      const prodJson = prodRes.ok ? await prodRes.json() : null;
      const compJson = compRes.ok ? await compRes.json() : null;
      const transJson = transRes && transRes.ok ? await transRes.json() : null;
      const subJson = subRes && subRes.ok ? await subRes.json() : null;
      const dispJson = dispRes && dispRes.ok ? await dispRes.json() : null;

      const requirements = reqJson ? (reqJson.data || reqJson.requirements || reqJson.rate_requests || []) : [];
      const products = prodJson ? (prodJson.data || prodJson.products || prodJson.product_masters || []) : [];
      const companyUnits = compJson ? (compJson.data || compJson.company_units || []) : [];
      const transporters = transJson ? (transJson.transporters || transJson.data || []) : [];
      const rateSubmissions = subJson ? (subJson.rate_submissions || subJson.data || []) : [];
      const dispatches = dispJson ? (dispJson.dispatches || dispJson.truck_dispatches || []) : [];

      const data = {
        ...EMPTY_STATE,
        company: INITIAL_SEED_DATA.company,
        do_master_settings: INITIAL_SEED_DATA.do_master_settings,
        transporters,
        company_units_plants: companyUnits,
        company_units: companyUnits,
        company_masters: companyUnits,
        products,
        product_masters: products,
        rate_requests: requirements,
        transport_requirements: requirements,
        requirements,
        rate_submissions: rateSubmissions,
        dispatches,
        truck_dispatches: dispatches,
        _hasLoaded: true
      };

      return data;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('❌ [API] Failed to load data from server:', e.message);
      }
      throw e;
    } finally {
      inFlightLoadPromise = null;
    }
  })();

  return inFlightLoadPromise;
}
