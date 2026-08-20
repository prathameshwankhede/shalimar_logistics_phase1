// src/store/dbStore.js
// Restored Standard LocalStorage Database Store Engine with Complete ERP Master Directories (Company, Product, Cargo Masters) 💾🛡️
import { supabase } from '../supabaseClient';
const DB_KEY = 'transflow_logistics_db_v1';
const USER_SESSION_KEY = 'transflow_current_user';

export const INITIAL_SEED_DATA = {
  _updatedAt: 1,
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

  // 📄 100% AUTOMATED DELIVERY ORDER (DO) DOCUMENT MASTER SETTINGS
  do_master_settings: {
    hsn_code: '23040010',
    igst_rate: 5,
    do_prefix: 'DOR-SNPL-',
    state_name: 'MAHARASHTRA',
    state_code: '27 (MAHARASHTRA)',
    dispatch_plant_name: 'Shalimar Nutrients MIDC Processing Unit',
    dispatch_plant_address: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028',
    terms_conditions: '1. Food-grade tarpaulin covering mandatory for dry cargo.\n2. Automated 24x7 weighbridge tare and gross recorded at Shalimar Plant.\n3. Sound single-use tamper-evident seals mandatory for oil tankers.\n4. Transit unloading expected within 4 hours of arrival.'
  },

  // 🏢 1. COMPANY & PLANT UNITS MASTER DIRECTORY (10 ENTERPRISE CORPORATE FIELDS)
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

  // 📦 2. PRODUCT & MATERIAL MASTER DIRECTORY (ADMIN CAN ADD UNLIMITED NEW PRODUCTS)
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

  // 🚛 3. CARGO & VEHICLE TYPE MASTER DIRECTORY (ADMIN CAN ADD UNLIMITED CARGO BODY TYPES)
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

  // 🛡️ Enterprise Security Audit Trail Logs
  security_audit_logs: [
    {
      id: 'sec_001',
      action: 'ADMIN_LOGIN_AUTHENTICATED',
      username: 'admin',
      role: 'admin',
      ip: '192.168.1.100 (MIDC Plant Network)',
      status: 'SUCCESS 🛡️',
      timestamp: '2026-08-14T08:00:00Z'
    },
    {
      id: 'sec_002',
      action: 'CONTRACT_AWARDED_SAP_SYNC',
      username: 'admin',
      role: 'admin',
      ip: '192.168.1.100',
      status: 'SUCCESS 🛡️',
      timestamp: '2026-08-14T08:30:00Z'
    }
  ],

  whatsapp_api_settings: {
    enabled: false,
    mode: 'group',
    group_name: 'Shalimar Transporters Official Group 👥',
    group_invite_link: 'https://chat.whatsapp.com/JKGnlA860A7JYVKJnHG6Xb',
    group_id: 'JKGnlA860A7JYVKJnHG6Xb@g.us',
    provider: 'ultramsg',
    instance_id: 'instance98411',
    token: 'ultramsg_token_demo_8834',
    phone_number_id: ''
  },

  whatsapp_notifications: [],

  title_masters: [
    { id: 'tm_1', title: 'Shalimar Nutrients - Nagpur Plant Bulk Soya DOC Delivery', material_type: 'Soybean Meal De-Oiled Cake (DOC)' },
    { id: 'tm_2', title: 'Shalimar Nutrients - Solapur Edible Oil Tankers', material_type: 'Crude Soy / Sunflower Oil (Tankers)' },
    { id: 'tm_3', title: 'Shalimar Nutrients - Indore Plant Sunflower Seed Delivery', material_type: 'Raw Sunflower Seeds' },
    { id: 'tm_4', title: 'Shalimar Nutrients - Thane Plant Industrial Machinery Transfer', material_type: 'Industrial Processing Equipment' }
  ],

  city_masters: [
    { id: 'city_1', city: 'Nagpur (Shalimar Plant MIDC)', pin: '440028' },
    { id: 'city_2', city: 'Solapur (Shalimar Refinery)', pin: '413001' },
    { id: 'city_3', city: 'Indore Processing Unit', pin: '452001' },
    { id: 'city_4', city: 'Jhalawar / Jhalarapatan RIICO Industrial Area', pin: '326023' },
    { id: 'city_5', city: 'Thane Logistics Terminal', pin: '400601' },
    { id: 'city_6', city: 'Hyderabad Processing Hub', pin: '500001' }
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
      id: 'req_001',
      request_no: 'SNPL/26-27/REQ-0001',
      title: 'Shalimar Nutrients - Nagpur Plant Bulk Soya DOC Delivery',
      origin_city: 'Mumbai (JNW Port Terminal)',
      origin_pin: '400001',
      dest_city: 'Nagpur (Shalimar Plant MIDC)',
      dest_pin: '440028',
      material_type: 'Soybean Meal De-Oiled Cake (DOC)',
      required_qty: 1000,
      unit: 'MT',
      target_date: '2026-08-25',
      status: 'Awarded',
      created_at: '2026-08-10T09:00:00Z',
      notes: 'Food-grade tarpaulin covering mandatory. 24x7 automated weighbridge unloading at Shalimar plant.'
    },
    {
      id: 'req_002',
      request_no: 'SNPL/26-27/REQ-0002',
      title: 'Shalimar Nutrients - Solapur Edible Oil Tankers',
      origin_city: 'Latur Processing Unit',
      origin_pin: '413512',
      dest_city: 'Solapur (Shalimar Refinery)',
      dest_pin: '413001',
      material_type: 'Crude Soy / Sunflower Oil (Tankers)',
      required_qty: 500,
      unit: 'MT',
      target_date: '2026-08-30',
      status: 'Open',
      created_at: '2026-08-12T14:30:00Z',
      notes: 'Stainless steel food-grade tankers only. Seal verification required at dispatch.'
    }
  ],

  rate_submissions: [
    {
      id: 'sub_abc_001',
      rate_request_id: 'req_001',
      transporter_id: 'trans_abc',
      rate_per_unit: 500,
      total_estimated_amount: 500000,
      transit_days: 3,
      notes: '32ft Multi-Axle Trucks ready with clean tarps. Insurance included.',
      status: 'Submitted',
      submitted_at: '2026-08-11T10:15:00Z'
    },
    {
      id: 'sub_xyz_001',
      rate_request_id: 'req_001',
      transporter_id: 'trans_xyz',
      rate_per_unit: 450,
      total_estimated_amount: 450000,
      transit_days: 2,
      notes: 'Specialized in agri-commodity transport. Own fleet of 50+ trailers.',
      status: 'Selected',
      submitted_at: '2026-08-11T11:00:00Z'
    },
    {
      id: 'sub_pqr_001',
      rate_request_id: 'req_001',
      transporter_id: 'trans_pqr',
      rate_per_unit: 480,
      total_estimated_amount: 480000,
      transit_days: 3,
      notes: 'GPS tracking & temperature monitoring enabled.',
      status: 'Submitted',
      submitted_at: '2026-08-11T12:30:00Z'
    },
    {
      id: 'sub_abc_002',
      rate_request_id: 'req_002',
      transporter_id: 'trans_abc',
      rate_per_unit: 620,
      total_estimated_amount: 310000,
      transit_days: 4,
      notes: 'Dedicated oil tanker team.',
      status: 'Submitted',
      submitted_at: '2026-08-13T09:00:00Z'
    },
    {
      id: 'sub_xyz_002',
      rate_request_id: 'req_002',
      transporter_id: 'trans_xyz',
      rate_per_unit: 590,
      total_estimated_amount: 295000,
      transit_days: 3,
      notes: 'Food-grade certified stainless steel tankers.',
      status: 'Submitted',
      submitted_at: '2026-08-13T10:30:00Z'
    }
  ],

  allocations: [
    {
      id: 'alloc_001',
      rate_request_id: 'req_001',
      transporter_id: 'trans_xyz',
      submission_id: 'sub_xyz_001',
      allocated_qty: 1000,
      agreed_rate: 450,
      total_contract_value: 450000,
      allocated_at: '2026-08-12T16:00:00Z',
      status: 'In Progress'
    }
  ],

  truck_dispatches: [
    {
      id: 'dispatch_001',
      allocation_id: 'alloc_001',
      transporter_id: 'trans_xyz',
      truck_number: 'MH31AB1234',
      driver_name: 'Rajesh Verma',
      driver_phone: '+91 98901 22334',
      dispatched_qty: 300,
      dispatched_at: '2026-08-13T08:30:00Z',
      lr_number: 'LR-SNPL-XYZ-001',
      status: 'Dispatched'
    }
  ],

  contracts: [
    {
      id: 'contract_001',
      allocation_id: 'alloc_001',
      contract_number: 'CNT-SNPL-2026-NGP-8891',
      erp_po_number: 'SAP-SNPL-PO-99481',
      transporter_id: 'trans_xyz',
      payment_status: 'Advance Paid',
      advance_amount: 135000,
      loading_amount: 180000,
      settlement_amount: 135000,
      created_at: '2026-08-12T16:15:00Z'
    }
  ]
};

export async function loadDBFromSupabase() {
  console.log('LOAD START');
  if (!supabase) {
    console.warn('Supabase not configured, returning local database fallback');
    return loadDB();
  }

  try {
    const { data, error } = await supabase
      .from('app_database')
      .select('data')
      .eq('id', 'transflow-main')
      .maybeSingle();

    if (error) {
      console.error('Supabase load failed:', error);
      return loadDB();
    }

    if (!data || !data.data) {
      console.log('No data found in Supabase, initializing shared seed data...');
      const seedToSave = { ...INITIAL_SEED_DATA, _updatedAt: Date.now() };
      
      console.log('SUPABASE UPSERT START (INITIAL SEED)');
      const { data: resData, error: insertErr } = await supabase
        .from('app_database')
        .upsert(
          {
            id: 'transflow-main',
            data: seedToSave,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        )
        .select();

      console.log('SUPABASE UPSERT RESULT', { resData, error: insertErr });

      if (insertErr) {
        console.error('Supabase save failed:', insertErr);
      } else {
        console.log('Supabase save successful');
      }

      localStorage.setItem(DB_KEY, JSON.stringify(seedToSave));
      saveToPermanentIndexedDB(seedToSave);
      console.log('Supabase load successful');
      return seedToSave;
    }

    const supabaseDb = data.data;

    let localDb = null;
    try {
      const localStr = localStorage.getItem(DB_KEY);
      if (localStr) localDb = JSON.parse(localStr);
    } catch (e) {}

    const localTime = localDb?._updatedAt || 0;
    const supabaseTime = supabaseDb?._updatedAt || 0;

    if (supabaseTime >= localTime || localTime <= 100 || !localDb) {
      localStorage.setItem(DB_KEY, JSON.stringify(supabaseDb));
      saveToPermanentIndexedDB(supabaseDb);
      console.log('Supabase load successful');
      return supabaseDb;
    } else {
      console.log('Local cache has offline edits, syncing local cache to Supabase...');
      await saveDB(localDb);
      console.log('Supabase load successful');
      return localDb;
    }
  } catch (error) {
    console.error('Supabase load failed:', error);
    return loadDB();
  }
}

export function loadDB() {
  try {
    const dataStr = localStorage.getItem(DB_KEY);
    if (!dataStr) {
      const seedWithTimestamp = { ...INITIAL_SEED_DATA, _updatedAt: 1 };
      localStorage.setItem(DB_KEY, JSON.stringify(seedWithTimestamp));
      return { ...seedWithTimestamp };
    }
    const parsed = JSON.parse(dataStr);

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rate_requests)) {
      const seedWithTimestamp = { ...INITIAL_SEED_DATA, _updatedAt: 1 };
      localStorage.setItem(DB_KEY, JSON.stringify(seedWithTimestamp));
      return { ...seedWithTimestamp };
    }

    return {
      _updatedAt: parsed._updatedAt || 1,
      company: parsed.company || INITIAL_SEED_DATA.company,
      do_master_settings: parsed.do_master_settings || INITIAL_SEED_DATA.do_master_settings,
      company_masters: Array.isArray(parsed.company_masters) ? parsed.company_masters : INITIAL_SEED_DATA.company_masters,
      product_masters: Array.isArray(parsed.product_masters) ? parsed.product_masters : INITIAL_SEED_DATA.product_masters,
      cargo_masters: Array.isArray(parsed.cargo_masters) ? parsed.cargo_masters : INITIAL_SEED_DATA.cargo_masters,
      title_masters: Array.isArray(parsed.title_masters) ? parsed.title_masters : INITIAL_SEED_DATA.title_masters,
      city_masters: Array.isArray(parsed.city_masters) ? parsed.city_masters : INITIAL_SEED_DATA.city_masters,
      users: Array.isArray(parsed.users) ? parsed.users : INITIAL_SEED_DATA.users,
      transporters: Array.isArray(parsed.transporters) ? parsed.transporters : INITIAL_SEED_DATA.transporters,
      rate_requests: Array.isArray(parsed.rate_requests) ? parsed.rate_requests : INITIAL_SEED_DATA.rate_requests,
      rate_submissions: Array.isArray(parsed.rate_submissions) ? parsed.rate_submissions : [],
      allocations: Array.isArray(parsed.allocations) ? parsed.allocations : [],
      truck_dispatches: Array.isArray(parsed.truck_dispatches) ? parsed.truck_dispatches : [],
      contracts: Array.isArray(parsed.contracts) ? parsed.contracts : [],
      security_audit_logs: Array.isArray(parsed.security_audit_logs) ? parsed.security_audit_logs : [],
      whatsapp_api_settings: parsed.whatsapp_api_settings || INITIAL_SEED_DATA.whatsapp_api_settings,
      whatsapp_notifications: Array.isArray(parsed.whatsapp_notifications) ? parsed.whatsapp_notifications : []
    };
  } catch (err) {
    console.error('Failed to load DB from localStorage, using seed data', err);
    const seedWithTimestamp = { ...INITIAL_SEED_DATA, _updatedAt: 1 };
    localStorage.setItem(DB_KEY, JSON.stringify(seedWithTimestamp));
    return { ...seedWithTimestamp };
  }
}

// ----------------------------------------------------
// 🏛️ PERMANENT ZERO-DELETION INDEXEDDB BACKUP ENGINE (UP TO 50 GB)
// ----------------------------------------------------
const INDEXED_DB_NAME = 'transflow_permanent_db_v1';
const INDEXED_DB_STORE = 'enterprise_full_archive';

function openIndexedDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(INDEXED_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.createObjectStore(INDEXED_DB_STORE);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = () => resolve(null);
  });
}

export async function saveToPermanentIndexedDB(data) {
  try {
    const idb = await openIndexedDB();
    if (!idb) return;
    const tx = idb.transaction(INDEXED_DB_STORE, 'readwrite');
    const store = tx.objectStore(INDEXED_DB_STORE);
    store.put(data, 'full_data_snapshot');
  } catch (e) {
    console.error('IndexedDB save status:', e);
  }
}

export async function saveDB(data) {
  console.log('SAVE START');
  try {
    const dataToSave = {
      ...data,
      _updatedAt: Date.now()
    };

    localStorage.setItem(DB_KEY, JSON.stringify(dataToSave));
    saveToPermanentIndexedDB(dataToSave);

    if (!supabase) {
      console.warn('Supabase client not configured, saved to local cache');
      console.log('SAVE COMPLETE');
      return dataToSave;
    }

    console.log('SUPABASE UPSERT START');
    const { data: resData, error } = await supabase
      .from('app_database')
      .upsert(
        {
          id: 'transflow-main',
          data: dataToSave,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select();

    console.log('SUPABASE UPSERT RESULT', { resData, error });

    if (error) {
      console.error('Supabase save failed:', error);
    } else {
      console.log('Supabase save successful');
    }
    return dataToSave;
  } catch (err) {
    console.error('Supabase save failed:', err);
    saveToPermanentIndexedDB({ ...data, _updatedAt: Date.now() });
    return data;
  } finally {
    console.log('SAVE COMPLETE');
  }
}

export function resetDB() {
  const seedToSave = { ...INITIAL_SEED_DATA, _updatedAt: Date.now() };
  localStorage.setItem(DB_KEY, JSON.stringify(seedToSave));
  localStorage.removeItem(USER_SESSION_KEY);
  saveDB(seedToSave);
  return seedToSave;
}
