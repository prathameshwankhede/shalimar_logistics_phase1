// src/store/dbStore.js
// 100% Pure Enterprise Supabase Cloud Database Store Engine ☁️🛡️
import { supabase } from '../supabaseClient.js';

const CLOUD_ROW_ID = 'transflow-live-prod-v3';

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

/**
 * ☁️ Load Database directly from Supabase Cloud Server
 */
export async function loadDBFromSupabase() {
  if (!supabase) return INITIAL_SEED_DATA;

  try {
    const { data, error } = await supabase
      .from('app_database')
      .select('data')
      .eq('id', CLOUD_ROW_ID)
      .maybeSingle();

    if (error || !data || !data.data) {
      console.warn('Initializing initial seed in Supabase Cloud...');
      await saveDB(INITIAL_SEED_DATA);
      return INITIAL_SEED_DATA;
    }

    return data.data;
  } catch (error) {
    console.error('Supabase Cloud Load Error:', error);
    return INITIAL_SEED_DATA;
  }
}

/**
 * ☁️ Save Database directly to Supabase Cloud Server
 */
export async function saveDB(data) {
  try {
    const dataToSave = {
      ...data,
      _updatedAt: Date.now()
    };

    if (!supabase) return dataToSave;

    const { data: resData, error } = await supabase
      .from('app_database')
      .upsert(
        {
          id: CLOUD_ROW_ID,
          data: dataToSave,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      .select();

    if (error) {
      console.error('Supabase Cloud Save Error:', error);
      return dataToSave;
    }

    return resData && resData[0]?.data ? resData[0].data : dataToSave;
  } catch (err) {
    console.error('Supabase Cloud Save Exception:', err);
    return data;
  }
}

/**
 * ☁️ Load Fallback DB
 */
export function loadDB() {
  return { ...INITIAL_SEED_DATA };
}

/**
 * ☁️ Reset Operational Data in Cloud
 */
export function resetDB() {
  const cleanData = {
    ...INITIAL_SEED_DATA,
    _updatedAt: Date.now()
  };
  saveDB(cleanData);
  return cleanData;
}
