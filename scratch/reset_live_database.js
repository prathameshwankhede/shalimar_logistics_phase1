import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uqqdxjprkjxgddmsoxia.supabase.co';
const supabaseKey = 'sb_publishable_qrkTb1shX49w5Z6WJMat7g_VpBfbOq2';

const supabase = createClient(supabaseUrl, supabaseKey);

const ZERO_DATA_SEED = {
  _updatedAt: Date.now() + 100000,
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
    terms_conditions: '1. Food-grade tarpaulin covering mandatory for dry cargo.\n2. Automated 24x7 weighbridge tare and gross recorded at Shalimar Plant.\n3. Sound single-use tamper-evident seals mandatory for oil tankers.\n4. Transit unloading expected within 4 hours of arrival.'
  },
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
      created_at: new Date().toISOString()
    }
  ],
  transporters: [],
  rate_requests: [],
  rate_submissions: [],
  allocations: [],
  truck_dispatches: [],
  contracts: []
};

async function purgeEverythingForCompanySetup() {
  console.log('🧹 PURGING ALL TRANSPORTERS & MASTER DIRECTORIES FROM SUPABASE CLOUD...');
  const keysToReset = ['transflow-live-prod-v3', 'transflow-main', 'transflow_logistics_db_live_v3'];

  for (const recordId of keysToReset) {
    const payload = {
      ...ZERO_DATA_SEED,
      _updatedAt: Date.now() + 200000
    };

    const { data, error } = await supabase
      .from('app_database')
      .upsert({
        id: recordId,
        data: payload,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select();

    if (error) {
      console.error(`❌ Failed to purge record [${recordId}]:`, error);
    } else {
      console.log(`✅ 100% Zero-Data purge successful for record [${recordId}]!`);
    }
  }

  console.log('\n✨ ALL TRANSPORTERS & MASTER DIRECTORIES HAVE BEEN WIPED CLEAN! ✨');
  console.log('ONLY ADMIN ACCOUNT (admin / admin123) REMAINS ACTIVE FOR FRESH COMPANY ONBOARDING.');
}

purgeEverythingForCompanySetup();
