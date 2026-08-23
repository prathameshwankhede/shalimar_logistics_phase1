// src/store/dbStore.js
// Restored Standard LocalStorage Database Store Engine with Complete ERP Master Directories (Company, Product, Cargo Masters) 💾🛡️
import { supabase } from '../supabaseClient.js';
const DB_KEY = 'transflow_logistics_db_live_v3';
const USER_SESSION_KEY = 'transflow_current_user';

function safeGetLocalStorage(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (e) {}
  return null;
}

function safeSetLocalStorage(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (e) {}
}

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
  company_masters: [],
  product_masters: [],
  cargo_masters: [],
  security_audit_logs: [],
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
    },
    {
      id: 'usr_w001',
      username: 'W001',
      password: '123',
      name: 'wankhede chakki',
      role: 'transporter',
      transporter_id: 'trans_1787492255920',
      created_at: '2026-08-01T10:00:00Z'
    },
    {
      id: 'usr_t001',
      username: 'T001',
      password: '123',
      name: 'Mahalaxmi Freight Carriers',
      role: 'transporter',
      transporter_id: 'trans_002',
      created_at: '2026-08-01T10:00:00Z'
    }
  ],
  transporters: [
    {
      id: 'trans_1787492255920',
      code: 'W001',
      company_name: 'wankhede chakki',
      contact_person: 'Prathamesh Wankhede',
      mobile: '+91 98230 11223',
      email: 'wankhede.logistics@gmail.com',
      address: 'Plot 45, MIDC Hingna Road, Nagpur, Maharashtra',
      gst_pan: '27AAPCS1419M1ZV',
      username: 'W001',
      status: 'Active'
    },
    {
      id: 'trans_002',
      code: 'T001',
      company_name: 'Mahalaxmi Freight Carriers',
      contact_person: 'Rajesh Sharma',
      mobile: '+91 98221 44556',
      email: 'mahalaxmifreight@gmail.com',
      address: 'Transport Nagar, Wardha Road, Nagpur',
      gst_pan: '27BMXPS2219K1ZX',
      username: 'T001',
      status: 'Active'
    },
    {
      id: 'trans_003',
      code: 'T002',
      company_name: 'VRL Logistics India',
      contact_person: 'Suresh Patil',
      mobile: '+91 94228 99001',
      email: 'nagpur.branch@vrllogistics.com',
      address: 'Ring Road Hub, Nagpur, Maharashtra',
      gst_pan: '27AAACV7712P1ZN',
      username: 'T002',
      status: 'Active'
    }
  ],
  rate_requests: [
    {
      id: 'req_1787491361939_0',
      request_no: 'SNPL/26-27/REQ-01/01',
      title: 'SNPL/26-27/REQ-01/01',
      company_unit: 'Shalimar Nutrients Pvt Ltd (Nagpur Plant)',
      origin_city: 'Nagpur (Shalimar Plant MIDC)',
      origin_pin: '440028',
      dest_city: 'Solapur (Shalimar Refinery)',
      dest_pin: '413001',
      material_type: 'Soybean Meal De-Oiled Cake (DOC)',
      required_qty: 500,
      unit: 'MT',
      target_date: '2026-08-30',
      status: 'Awarded',
      batch_no: 'SNPL/26-27/REQ-01',
      sub_no: '01',
      hsn_code: '15071000',
      notes: 'Company Unit: Shalimar Nutrients Pvt Ltd (Nagpur Plant). HSN Code: 15071000. Batch SNPL/26-27/REQ-01 Item #01.',
      created_at: '2026-08-23T13:22:41.939Z'
    },
    {
      id: 'req_1787503965953',
      request_no: 'SNPL/26-27/REQ-02/01',
      title: 'SNPL/26-27/REQ-02/01',
      company_unit: 'Shalimar Nutrients Pvt Ltd',
      origin_city: 'Nagpur (Shalimar Plant MIDC)',
      origin_pin: '440028',
      dest_city: 'Solapur (Shalimar Refinery)',
      dest_pin: '413001',
      material_type: 'Soybean Meal De-Oiled Cake (DOC)',
      required_qty: 500,
      unit: 'MT',
      target_date: '2026-08-30',
      status: 'Open',
      batch_no: 'SNPL/26-27/REQ-02',
      sub_no: '01',
      hsn_code: '23040010',
      notes: 'Test Requirement created directly.',
      created_at: '2026-08-23T16:52:45.970Z'
    }
  ],
  rate_submissions: [
    {
      id: 'sub_w001_1787492301932',
      rate_request_id: 'req_1787491361939_0',
      transporter_id: 'trans_1787492255920',
      rate_per_unit: 55,
      total_estimated_amount: 27500,
      transit_days: 2,
      notes: 'Fast 1-line quote submitted.',
      status: 'Selected',
      submitted_at: '2026-08-23T13:38:21.932Z'
    },
    {
      id: 'sub_mobile_test_1787504755556',
      rate_request_id: 'req_1787503965953',
      transporter_id: 'trans_1787492255920',
      rate_per_unit: 2450,
      total_estimated_amount: 1225000,
      transit_days: 2,
      notes: 'Mobile quote ₹2450/MT',
      status: 'Submitted',
      submitted_at: '2026-08-23T17:05:55.556Z'
    }
  ],
  allocations: [
    {
      id: 'alloc_1787492315000',
      rate_request_id: 'req_1787491361939_0',
      transporter_id: 'trans_1787492255920',
      agreed_rate: 55,
      allocated_qty: 500,
      status: 'Active',
      allocated_at: '2026-08-23T13:38:35.000Z'
    }
  ],
  truck_dispatches: [],
  contracts: []
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
      .eq('id', 'transflow-live-prod-v3')
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
            id: 'transflow-live-prod-v3',
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

      safeSetLocalStorage(DB_KEY, JSON.stringify(seedToSave));
      saveToPermanentIndexedDB(seedToSave);
      console.log('Supabase load successful');
      return seedToSave;
    }

    const supabaseDb = data.data;

    let localDb = null;
    try {
      const localStr = safeGetLocalStorage(DB_KEY);
      if (localStr) localDb = JSON.parse(localStr);
    } catch (e) {}

    if (supabaseDb && typeof supabaseDb === 'object') {
      safeSetLocalStorage(DB_KEY, JSON.stringify(supabaseDb));
      saveToPermanentIndexedDB(supabaseDb);
      console.log('Supabase load successful');
      return supabaseDb;
    }
    return loadDB();
  } catch (error) {
    console.error('Supabase load failed:', error);
    return loadDB();
  }
}

export function loadDB() {
  try {
    const dataStr = safeGetLocalStorage(DB_KEY);
    if (!dataStr) {
      const seedWithTimestamp = { ...INITIAL_SEED_DATA, _updatedAt: 1 };
      safeSetLocalStorage(DB_KEY, JSON.stringify(seedWithTimestamp));
      return { ...seedWithTimestamp };
    }
    const parsed = JSON.parse(dataStr);

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rate_requests)) {
      const seedWithTimestamp = { ...INITIAL_SEED_DATA, _updatedAt: 1 };
      safeSetLocalStorage(DB_KEY, JSON.stringify(seedWithTimestamp));
      return { ...seedWithTimestamp };
    }

    const loadedTransporters = Array.isArray(parsed.transporters) ? parsed.transporters : [];
    const loadedUsers = Array.isArray(parsed.users) && parsed.users.length > 0
      ? parsed.users
      : [
          {
            id: 'usr_admin',
            username: 'admin',
            password: 'admin123',
            name: 'Shalimar Admin (Logistics Head)',
            role: 'admin',
            transporter_id: null,
            created_at: new Date().toISOString()
          }
        ];

    return {
      _updatedAt: parsed._updatedAt || 1,
      company: parsed.company || INITIAL_SEED_DATA.company,
      do_master_settings: parsed.do_master_settings || INITIAL_SEED_DATA.do_master_settings,
      company_masters: Array.isArray(parsed.company_masters) ? parsed.company_masters : [],
      product_masters: Array.isArray(parsed.product_masters) ? parsed.product_masters : [],
      cargo_masters: Array.isArray(parsed.cargo_masters) ? parsed.cargo_masters : [],
      title_masters: Array.isArray(parsed.title_masters) ? parsed.title_masters : [],
      city_masters: Array.isArray(parsed.city_masters) ? parsed.city_masters : [],
      users: loadedUsers,
      transporters: loadedTransporters,
      rate_requests: Array.isArray(parsed.rate_requests) ? parsed.rate_requests : [],
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
    safeSetLocalStorage(DB_KEY, JSON.stringify(seedWithTimestamp));
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

    safeSetLocalStorage(DB_KEY, JSON.stringify(dataToSave));
    saveToPermanentIndexedDB(dataToSave);

    if (!supabase) {
      console.warn('Supabase client not configured, saved to local cache');
      return dataToSave;
    }

    // 🛡️ READ LATEST CLOUD STATE FIRST TO PREVENT OVERWRITING CONCURRENT BIDS
    let mergedData = dataToSave;
    try {
      const { data: cloudRows } = await supabase
        .from('app_database')
        .select('*')
        .eq('id', 'transflow-live-prod-v3');

      if (cloudRows && cloudRows.length > 0 && cloudRows[0].data) {
        const existingCloudDb = cloudRows[0].data;

        // Merge rate_submissions by ID so no bid from any mobile or laptop is ever deleted
        const subMap = new Map();
        (existingCloudDb.rate_submissions || []).forEach((s) => subMap.set(String(s.id), s));
        (dataToSave.rate_submissions || []).forEach((s) => subMap.set(String(s.id), s));

        // Merge rate_requests by ID
        const reqMap = new Map();
        (existingCloudDb.rate_requests || []).forEach((r) => reqMap.set(String(r.id), r));
        (dataToSave.rate_requests || []).forEach((r) => reqMap.set(String(r.id), r));

        // Merge transporters by ID
        const transMap = new Map();
        (existingCloudDb.transporters || []).forEach((t) => transMap.set(String(t.id || t.code), t));
        (dataToSave.transporters || []).forEach((t) => transMap.set(String(t.id || t.code), t));

        // Merge users by ID
        const userMap = new Map();
        (existingCloudDb.users || []).forEach((u) => userMap.set(String(u.id || u.username), u));
        (dataToSave.users || []).forEach((u) => userMap.set(String(u.id || u.username), u));

        // Merge allocations by ID
        const allocMap = new Map();
        (existingCloudDb.allocations || []).forEach((a) => allocMap.set(String(a.id), a));
        (dataToSave.allocations || []).forEach((a) => allocMap.set(String(a.id), a));

        // Merge contracts by ID
        const contractMap = new Map();
        (existingCloudDb.contracts || []).forEach((c) => contractMap.set(String(c.id), c));
        (dataToSave.contracts || []).forEach((c) => contractMap.set(String(c.id), c));

        // Merge truck_dispatches by ID
        const dispatchMap = new Map();
        (existingCloudDb.truck_dispatches || []).forEach((d) => dispatchMap.set(String(d.id), d));
        (dataToSave.truck_dispatches || []).forEach((d) => dispatchMap.set(String(d.id), d));

        // Merge security_audit_logs by ID
        const logMap = new Map();
        (existingCloudDb.security_audit_logs || []).forEach((l) => logMap.set(String(l.id), l));
        (dataToSave.security_audit_logs || []).forEach((l) => logMap.set(String(l.id), l));

        mergedData = {
          ...existingCloudDb,
          ...dataToSave,
          _updatedAt: Date.now(),
          rate_requests: Array.from(reqMap.values()),
          rate_submissions: Array.from(subMap.values()),
          transporters: Array.from(transMap.values()),
          users: Array.from(userMap.values()),
          allocations: Array.from(allocMap.values()),
          contracts: Array.from(contractMap.values()),
          truck_dispatches: Array.from(dispatchMap.values()),
          security_audit_logs: Array.from(logMap.values()).slice(0, 100)
        };
      }
    } catch (fetchErr) {
      console.warn('Pre-fetch cloud DB failed, fallback to local dataToSave:', fetchErr);
    }

    console.log('SUPABASE UPSERT START');
    const { data: resData, error } = await supabase
      .from('app_database')
      .upsert(
        {
          id: 'transflow-live-prod-v3',
          data: mergedData,
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
      safeSetLocalStorage(DB_KEY, JSON.stringify(mergedData));
      saveToPermanentIndexedDB(mergedData);
    }
    return mergedData;
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
  safeSetLocalStorage(DB_KEY, JSON.stringify(seedToSave));
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(USER_SESSION_KEY);
  }
  saveDB(seedToSave);
  return seedToSave;
}
