// src/store/dbStore.js
// Enterprise Hostinger Node.js API + MySQL Database Store Engine 🛡️⚡

export const INITIAL_SEED_DATA = {
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
  company_masters: [
    {
      id: 'comp_1',
      name: 'Shalimar Nutrients Pvt Ltd (Nagpur Plant)',
      code: 'SNPL-NGP',
      gstin: '27AAPCS1419M1ZV',
      city: 'Nagpur'
    }
  ],
  product_masters: [
    { id: 'prod_1', name: 'Soya DOC (De-Oiled Cake)', category: 'Agri-Commodities', hsn_code: '23040010', unit: 'MT' },
    { id: 'prod_2', name: 'Refined Soyabean Oil (Bulk Tanker)', category: 'Edible Oils', hsn_code: '15079010', unit: 'MT' }
  ],
  cargo_masters: [
    { id: 'cargo_1', name: 'Bulk Loose DOC in Tarpaulin Truck', category: 'Dry Cargo', unit: 'MT' },
    { id: 'cargo_2', name: 'Food Grade Liquid Tanker (30 KL)', category: 'Liquid Cargo', unit: 'MT' }
  ],
  title_masters: [
    { id: 'title_1', name: 'Raw Material Freight Procurement' },
    { id: 'title_2', name: 'Finished Oil Tanker Dispatch Contract' }
  ],
  city_masters: [
    { id: 'city_1', name: 'Nagpur', state: 'Maharashtra', code: 'NGP' },
    { id: 'city_2', name: 'Solapur', state: 'Maharashtra', code: 'SLP' },
    { id: 'city_3', name: 'Mumbai', state: 'Maharashtra', code: 'BOM' },
    { id: 'city_4', name: 'Pune', state: 'Maharashtra', code: 'PNE' },
    { id: 'city_5', name: 'Indore', state: 'Madhya Pradesh', code: 'IND' }
  ],
  users: [],
  transporters: [],
  rate_requests: [],
  rate_submissions: [],
  allocations: [],
  truck_dispatches: [],
  contracts: [],
  security_audit_logs: [],
  whatsapp_api_settings: {
    enabled: true,
    provider: 'Green API (Production Enterprise Gateway)',
    instance_id: '******',
    token: '******',
    api_url: 'https://api.green-api.com',
    target_groups: ['Transporter Broadcast Group', 'Shalimar Logistics Desk']
  },
  whatsapp_notifications: []
};

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
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * ☁️ Modular Targeted API Fetch Functions (Minimal Data Footprint)
 */
export async function fetchDashboardMetrics() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/dashboard`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    const json = await res.json();
    return json.dashboard || null;
  } catch (e) {
    return null;
  }
}

export async function fetchRateRequests(page = 1, limit = 20) {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/rate-requests?page=${page}&limit=${limit}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.rate_requests || [];
  } catch (e) {
    return [];
  }
}

export async function fetchRateSubmissions() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/rate-submissions`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.rate_submissions || [];
  } catch (e) {
    return [];
  }
}

export async function fetchTransportersList() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/transporters`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.transporters || [];
  } catch (e) {
    return [];
  }
}

export async function fetchMasterData() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/master-data`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.master_records || [];
  } catch (e) {
    return [];
  }
}

export async function fetchAuditLogs() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/security/audit-logs`, { headers: getAuthHeaders() });
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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
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
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result.data));
      } catch (e) {}
      return result.data;
    }
  } catch (err) {
    console.error('API State save error:', err.message);
  }

  return dataToSave;
}

/**
 * ☁️ Load Fallback DB from LocalStorage
 */
export function loadDB() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { ...INITIAL_SEED_DATA };
}

/**
 * ☁️ Reset Operational Data
 */
export function resetDB() {
  const cleanData = {
    ...INITIAL_SEED_DATA,
    _updatedAt: Date.now()
  };
  saveDB(cleanData);
  return cleanData;
}

export function loadDBFromSupabase() {
  return loadDB();
}
