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
  company_masters: [],
  product_masters: [],
  cargo_masters: [],
  title_masters: [],
  city_masters: [],
  users: [
    {
      id: 'usr_admin',
      username: 'admin',
      password: 'admin123',
      name: 'Shalimar Admin (Logistics Head)',
      role: 'admin',
      transporter_id: null,
      created_at: '2026-08-01T10:00:00Z'
    }
  ],
  transporters: [],
  rate_requests: [
    {
      id: 'req_init_1',
      request_no: 'SNPL/26-27/REQ-01/01',
      title: 'SNPL/26-27/REQ-01/01',
      batch_no: 'SNPL/26-27/REQ-01',
      sub_no: '01',
      origin_city: 'Nagpur (Shalimar Plant MIDC)',
      origin_pin: '440028',
      dest_city: 'Solapur (Shalimar Refinery)',
      dest_pin: '413001',
      company_unit: 'Shalimar Nutrients Pvt Ltd',
      material_type: 'Refined Soybean Oil (Edible)',
      hsn_code: '15079010',
      required_qty: 250,
      unit: 'MT',
      target_date: new Date().toISOString().split('T')[0],
      status: 'Open',
      created_at: new Date().toISOString(),
      notes: 'Standard food-grade liquid tanker transport.'
    }
  ],
  rate_submissions: [],
  allocations: [],
  truck_dispatches: [],
  contracts: [],
  security_audit_logs: [],
  whatsapp_notifications: []
};

const LOCAL_STORAGE_KEY = 'transflow_local_db_v3';

function getApiBaseUrl() {
  const envApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
  if (envApiUrl) return envApiUrl;
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    return window.location.origin;
  }
  return '';
}

/**
 * ☁️ Load Database from Node.js API / Hostinger MySQL Server
 */
export async function loadDBFromApi() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/state`, {
      headers: { 'Accept': 'application/json' }
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
    console.warn('API State load warning, using local cache fallback:', err.message);
  }

  return loadDB();
}

// Backward compatibility alias for existing component calls
export const loadDBFromSupabase = loadDBFromApi;

/**
 * ☁️ Save Database to Node.js API / Hostinger MySQL Server
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
      headers: { 'Content-Type': 'application/json' },
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
