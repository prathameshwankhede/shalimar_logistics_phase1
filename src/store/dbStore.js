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
      pan_no: 'AAPCS1419M',
      proprietor_name: 'Shalimar Directors / Admin',
      email: 'logistics.ngp@shalimar.com',
      mobile_no: '9876543210',
      address: 'Plot No. 12, Industrial Area, MIDC, Nagpur',
      state: 'Maharashtra',
      city: 'Nagpur',
      district: 'Nagpur'
    },
    {
      id: 'comp_2',
      name: 'Shalimar Solapur Edible Oil Refinery',
      code: 'SNPL-SLP',
      gstin: '27AAPCS1419M2ZW',
      pan_no: 'AAPCS1419M',
      proprietor_name: 'Shalimar Solapur Plant Head',
      email: 'refinery.solapur@shalimar.com',
      mobile_no: '9876543211',
      address: 'MIDC Chincholi, Solapur',
      state: 'Maharashtra',
      city: 'Solapur',
      district: 'Solapur'
    },
    {
      id: 'comp_3',
      name: 'Shalimar Agri Processing MP Unit',
      code: 'SNPL-IND',
      gstin: '23AAPCS1419M1ZP',
      pan_no: 'AAPCS1419M',
      proprietor_name: 'Shalimar MP Regional Manager',
      email: 'pithampur.mp@shalimar.com',
      mobile_no: '9876543212',
      address: 'Sector 3, Industrial Area, Pithampur',
      state: 'Madhya Pradesh',
      city: 'Indore',
      district: 'Dhar / Indore'
    }
  ],
  product_masters: [
    {
      id: 'prod_1',
      name: 'Soybean Meal De-Oiled Cake (DOC)',
      category: 'Agri Meal & Feed',
      hsn_code: '23040010',
      unit: 'MT'
    },
    {
      id: 'prod_2',
      name: 'Crude Soy / Sunflower Oil',
      category: 'Edible Oils (Liquid Bulk)',
      hsn_code: '15071000',
      unit: 'MT'
    },
    {
      id: 'prod_3',
      name: 'Raw Sunflower Seeds',
      category: 'Agri Seeds',
      hsn_code: '12060000',
      unit: 'MT'
    },
    {
      id: 'prod_4',
      name: 'Industrial Processing Equipment & Machinery',
      category: 'Machinery & Steel',
      hsn_code: '84798990',
      unit: 'UNITS'
    }
  ],
  cargo_masters: [
    {
      id: 'cargo_1',
      vehicle_type: '32ft Multi-Axle Closed Container',
      capacity_mt: 25,
      cargo_category: 'Dry Bagged / Covered Cargo'
    },
    {
      id: 'cargo_2',
      vehicle_type: 'Stainless Steel Food-Grade Tanker',
      capacity_mt: 30,
      cargo_category: 'Liquid Edible Oil Tankers'
    },
    {
      id: 'cargo_3',
      vehicle_type: 'Open Body 10-Wheeler Truck',
      capacity_mt: 16,
      cargo_category: 'Agri Seeds & Bulk Grains'
    },
    {
      id: 'cargo_4',
      vehicle_type: '40ft Heavy Multi-Axle Lowbed Trailer',
      capacity_mt: 40,
      cargo_category: 'Heavy Industrial Machinery'
    }
  ],
  title_masters: [
    {
      id: 'tm_1',
      title: 'Shalimar Nutrients - Nagpur Plant Bulk Soya DOC Delivery',
      material_type: 'Soybean Meal De-Oiled Cake (DOC)'
    },
    {
      id: 'tm_2',
      title: 'Shalimar Nutrients - Solapur Edible Oil Tankers',
      material_type: 'Crude Soy / Sunflower Oil (Tankers)'
    },
    {
      id: 'tm_3',
      title: 'Shalimar Nutrients - Indore Plant Sunflower Seed Delivery',
      material_type: 'Raw Sunflower Seeds'
    },
    {
      id: 'tm_4',
      title: 'Shalimar Nutrients - Thane Plant Industrial Machinery Transfer',
      material_type: 'Industrial Processing Equipment'
    }
  ],
  city_masters: [
    { id: 'city_1', city: 'Nagpur (Shalimar Plant MIDC)', pin: '440028', state: 'Maharashtra' },
    { id: 'city_2', city: 'Solapur (Shalimar Refinery)', pin: '413001', state: 'Maharashtra' },
    { id: 'city_3', city: 'Indore Processing Unit', pin: '452001', state: 'Madhya Pradesh' },
    { id: 'city_4', city: 'Jhalawar / Jhalarapatan RIICO Industrial Area', pin: '326023', state: 'Rajasthan' },
    { id: 'city_5', city: 'Thane Logistics Terminal', pin: '400601', state: 'Maharashtra' },
    { id: 'city_6', city: 'Hyderabad Processing Hub', pin: '500001', state: 'Telangana' }
  ],
  users: [
    {
      id: 'usr_admin',
      username: 'admin',
      password: 'admin123',
      name: 'Shalimar Admin (Logistics Head)',
      role: 'admin',
      transporter_id: null,
      created_at: '2026-08-01T10:00:00Z'
    },
    {
      id: 'usr_abc',
      username: 'ABC001',
      password: 'password123',
      name: 'ABC Transport Admin',
      role: 'transporter',
      transporter_id: 'trans_abc',
      created_at: '2026-08-01T10:30:00Z'
    },
    {
      id: 'usr_xyz',
      username: 'XYZ001',
      password: 'password123',
      name: 'XYZ Transport Admin',
      role: 'transporter',
      transporter_id: 'trans_xyz',
      created_at: '2026-08-01T11:00:00Z'
    },
    {
      id: 'usr_pqr',
      username: 'PQR001',
      password: 'password123',
      name: 'PQR Transport Admin',
      role: 'transporter',
      transporter_id: 'trans_pqr',
      created_at: '2026-08-01T11:30:00Z'
    }
  ],
  transporters: [
    {
      id: 'trans_abc',
      company_name: 'ABC Transport Pvt Ltd',
      code: 'ABC001',
      contact_person: 'Ramesh Kumar',
      mobile: '+91 98230 11223',
      email: 'ramesh@abctransport.com',
      address: 'Plot 45, Transport Nagar, Mumbai',
      gst_pan: '27AAAAA0000A1Z5',
      username: 'ABC001',
      status: 'Active',
      created_at: '2026-08-01T10:30:00Z'
    },
    {
      id: 'trans_xyz',
      company_name: 'XYZ Logistics & Freight',
      code: 'XYZ001',
      contact_person: 'Vikram Sharma',
      mobile: '+91 98220 44556',
      email: 'vikram@xyzlogistics.com',
      address: 'GIDC Industrial Estate, Pune',
      gst_pan: '27BBBBA1111B1Z2',
      username: 'XYZ001',
      status: 'Active',
      created_at: '2026-08-01T11:00:00Z'
    },
    {
      id: 'trans_pqr',
      company_name: 'PQR National Freight Carriers',
      code: 'PQR001',
      contact_person: 'Sunil Patel',
      mobile: '+91 98210 77889',
      email: 'sunil@pqrfreight.com',
      address: 'Sector 18, Transport Hub, Thane',
      gst_pan: '27CCCCA2222C1Z9',
      username: 'PQR001',
      status: 'Active',
      created_at: '2026-08-01T11:30:00Z'
    }
  ],
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
      company_unit: 'Shalimar Nutrients Pvt Ltd (Nagpur Plant)',
      material_type: 'Soybean Meal De-Oiled Cake (DOC)',
      hsn_code: '23040010',
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
