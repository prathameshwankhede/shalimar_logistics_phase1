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

export async function fetchCompanyUnitsList() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/company-units`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.company_units || [];
  } catch (e) {
    return [];
  }
}

export async function fetchProductsList() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/products`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.products || json.product_masters || [];
  } catch (e) {
    return [];
  }
}

export async function fetchRequirementsList() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/requirements`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || json.requirements || json.rate_requests || [];
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
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('transflow_db');
    localStorage.removeItem('transflow_live_db');
    localStorage.removeItem('transflow_db_v1');
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
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem('transflow_db');
    localStorage.removeItem('transflow_live_db');
    localStorage.removeItem('transflow_db_v1');
  } catch (e) {}
  return { ...EMPTY_STATE };
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

export async function loadDBFromSupabase() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/state`, {
      headers: getAuthHeaders()
    });
    let data = null;
    if (res.ok) {
      const json = await res.json();
      data = json && json.data ? json.data : null;
    }

    // Always fetch live transporters list from MySQL database
    try {
      const liveTransporters = await fetchTransportersList();
      if (Array.isArray(liveTransporters)) {
        data = {
          ...(data || EMPTY_STATE),
          transporters: liveTransporters
        };
      }
    } catch (err) {
      console.warn('Live transporters fetch notice:', err.message);
    }

    // Always fetch live company units list from MySQL database
    try {
      const liveCompanyUnits = await fetchCompanyUnitsList();
      if (Array.isArray(liveCompanyUnits)) {
        data = {
          ...(data || EMPTY_STATE),
          company_units: liveCompanyUnits,
          company_masters: liveCompanyUnits
        };
      }
    } catch (err) {
      console.warn('Live company units fetch notice:', err.message);
    }

    // Always fetch live products list from MySQL database
    try {
      const liveProducts = await fetchProductsList();
      if (Array.isArray(liveProducts)) {
        data = {
          ...(data || EMPTY_STATE),
          products: liveProducts,
          product_masters: liveProducts
        };
      }
    } catch (err) {
      console.warn('Live products fetch notice:', err.message);
    }

    // Always fetch live transport requirements list from MySQL database
    try {
      const liveRequirements = await fetchRequirementsList();
      if (Array.isArray(liveRequirements)) {
        data = {
          ...(data || EMPTY_STATE),
          rate_requests: liveRequirements,
          transport_requirements: liveRequirements,
          requirements: liveRequirements
        };
      }
    } catch (err) {
      console.warn('Live requirements fetch notice:', err.message);
    }

    return data;
  } catch (e) {
    console.error('API loadDBFromSupabase error:', e.message);
  }
  return null;
}
