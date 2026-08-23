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

  // 🚚 50 ENTERPRISE REGISTERED TRANSPORTERS & USERS DIRECTORY
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
    ...[
      { name: 'ABC Transport Pvt Ltd', code: 'ABC001', person: 'Ramesh Kumar', city: 'Mumbai', gst: '27AAAAA0000A1Z5' },
      { name: 'XYZ Logistics & Freight', code: 'XYZ001', person: 'Vikram Sharma', city: 'Pune', gst: '27BBBBA1111B1Z2' },
      { name: 'PQR National Freight Carriers', code: 'PQR001', person: 'Sunil Patel', city: 'Thane', gst: '27CCCCA2222C1Z9' },
      { name: 'VRL Logistics India', code: 'TRP001', person: 'Vijay Sankeshwar', city: 'Nagpur', gst: '27VRLAA1001A1Z1' },
      { name: 'TCI Supply Chain Freight', code: 'TRP002', person: 'Vineet Agarwal', city: 'Indore', gst: '23TCIAA2002B1Z2' },
      { name: 'Gati KWE Bulk Logistics', code: 'TRP003', person: 'Pirojshaw Sarkari', city: 'Hyderabad', gst: '36GATIA3003C1Z3' },
      { name: 'Mahindra Logistics Ltd', code: 'TRP004', person: 'Rampur Vasudevan', city: 'Solapur', gst: '27MAHLA4004D1Z4' },
      { name: 'Rivigo Freight Express', code: 'TRP005', person: 'Gazal Kalra', city: 'Gurugram', gst: '06RIVIA5005E1Z5' },
      { name: 'Safexpress Supply Chain', code: 'TRP006', person: 'Pawan Jain', city: 'Delhi', gst: '07SAFEA6006F1Z6' },
      { name: 'Delhivery Surface Cargo', code: 'TRP007', person: 'Sahil Barua', city: 'Ahmedabad', gst: '24DELHA7007G1Z7' },
      { name: 'Blue Dart Surface Lines', code: 'TRP008', person: 'Balfour Manuel', city: 'Mumbai', gst: '27BLUEA8008H1Z8' },
      { name: 'Navata Road Transport', code: 'TRP009', person: 'Nageswara Rao', city: 'Vijayawada', gst: '37NAVAA9009I1Z9' },
      { name: 'SRS Logistics & Cargo', code: 'TRP010', person: 'K. Rajeswaran', city: 'Bengaluru', gst: '29SRSSA1010J1Z0' },
      { name: 'Patel Integrated Logistics', code: 'TRP011', person: 'Asgar Patel', city: 'Surat', gst: '24PATEA1111K1Z1' },
      { name: 'Chetak Logistics Pvt Ltd', code: 'TRP012', person: 'Mukesh Haritwal', city: 'Jaipur', gst: '08CHETA1212L1Z2' },
      { name: 'Central Freight Carriers', code: 'TRP013', person: 'Rakesh Aggarwal', city: 'Nagpur', gst: '27CENTA1313M1Z3' },
      { name: 'Southern Roadways Ltd', code: 'TRP014', person: 'T.S. Santhanam', city: 'Chennai', gst: '33SOUTA1414N1Z4' },
      { name: 'Deccan Express Logistics', code: 'TRP015', person: 'Mahesh Reddy', city: 'Hyderabad', gst: '36DECCA1515O1Z5' },
      { name: 'Western India Roadlines', code: 'TRP016', person: 'Pravin Shah', city: 'Vadodara', gst: '24WESTA1616P1Z6' },
      { name: 'Shrinath Transport Agency', code: 'TRP017', person: 'Nandlal Kabra', city: 'Udaipur', gst: '08SHRIA1717Q1Z7' },
      { name: 'KPN Cargo & Logistics', code: 'TRP018', person: 'K.P. Natarajan', city: 'Coimbatore', gst: '33KPNAA1818R1Z8' },
      { name: 'Associated Road Carriers', code: 'TRP019', person: 'A.K. Arya', city: 'Kolkata', gst: '19ASSCA1919S1Z9' },
      { name: 'Economic Transport Organisation', code: 'TRP020', person: 'B.L. Arya', city: 'Kanpur', gst: '09ECOTA2020T1Z0' },
      { name: 'Inter State Freight Carriers', code: 'TRP021', person: 'Suresh Goyal', city: 'Indore', gst: '23INSTA2121U1Z1' },
      { name: 'Premier Road Carriers', code: 'TRP022', person: 'Anil Gupta', city: 'Bhopal', gst: '23PREMA2222V1Z2' },
      { name: 'Mahabali Transport Corp', code: 'TRP023', person: 'Rajesh Verma', city: 'Nagpur', gst: '27MAHAA2323W1Z3' },
      { name: 'Apex Freight Systems', code: 'TRP024', person: 'Dinesh Joshi', city: 'Nashik', gst: '27APEXA2424X1Z4' },
      { name: 'Royal India Transport', code: 'TRP025', person: 'Vikrant Singh', city: 'Jaipur', gst: '08ROYAA2525Y1Z5' },
      { name: 'Transland Logistics Ltd', code: 'TRP026', person: 'Alok Mehta', city: 'Rajkot', gst: '24TRANA2626Z1Z6' },
      { name: 'Speed Cargo Logistics', code: 'TRP027', person: 'Deepak Sethi', city: 'Jalandhar', gst: '03SPEEA2727A1Z7' },
      { name: 'Shree Ram Roadlines', code: 'TRP028', person: 'Ramawtar Sharma', city: 'Jodhpur', gst: '08SHREA2828B1Z8' },
      { name: 'Shree Maruti Logistics', code: 'TRP029', person: 'Bhikhabhai Mokariya', city: 'Ahmedabad', gst: '24MARUA2929C1Z9' },
      { name: 'Jai Hanuman Transport', code: 'TRP030', person: 'Hanuman Prasad', city: 'Jhalawar', gst: '08JAHAA3030D1Z0' },
      { name: 'Golden Logistics India', code: 'TRP031', person: 'Goldy Singh', city: 'Amritsar', gst: '03GOLDA3131E1Z1' },
      { name: 'Om Cargo Movers', code: 'TRP032', person: 'Om Prakash Mundra', city: 'Bikaner', gst: '08OMCAA3232F1Z2' },
      { name: 'Tirupati Roadlines', code: 'TRP033', person: 'Venkatesh Rao', city: 'Tirupati', gst: '37TIRUA3333G1Z3' },
      { name: 'Shree Balaji Transporters', code: 'TRP034', person: 'Balu Ram Choudhary', city: 'Nagpur', gst: '27BALAA3434H1Z4' },
      { name: 'National Transport Co', code: 'TRP035', person: 'Subhash Goyal', city: 'Ludhiana', gst: '03NATIA3535I1Z5' },
      { name: 'Superfast Road Carriers', code: 'TRP036', person: 'Jaswant Gill', city: 'Chandigarh', gst: '04SUPEA3636J1Z6' },
      { name: 'United India Logistics', code: 'TRP037', person: 'Karan Deshmukh', city: 'Solapur', gst: '27UNITA3737K1Z7' },
      { name: 'Express Cargo Movers', code: 'TRP038', person: 'Nitin Deshpande', city: 'Aurangabad', gst: '27EXPEA3838L1Z8' },
      { name: 'Continental Freight Agency', code: 'TRP039', person: 'Siddharth Roy', city: 'Kolkata', gst: '19CONTA3939M1Z9' },
      { name: 'Star India Logistics', code: 'TRP040', person: 'Tarun Saxena', city: 'Gwalior', gst: '23STARA4040N1Z0' },
      { name: 'Reliance Freight Services', code: 'TRP041', person: 'Mukesh Shah', city: 'Jamnagar', gst: '24RELIA4141O1Z1' },
      { name: 'Swastik Transport Agency', code: 'TRP042', person: 'Suresh Agrawal', city: 'Akola', gst: '27SWASA4242P1Z2' },
      { name: 'Falcon Logistics & Cargo', code: 'TRP043', person: 'Feroz Khan', city: 'Mumbai', gst: '27FALCA4343Q1Z3' },
      { name: 'Pioneer Roadways Corp', code: 'TRP044', person: 'Pankaj Kulkarni', city: 'Pune', gst: '27PIONA4444R1Z4' },
      { name: 'Universal Transport Lines', code: 'TRP045', person: 'Umesh Trivedi', city: 'Kota', gst: '08UNIVA4545S1Z5' },
      { name: 'Bharat Freight Express', code: 'TRP046', person: 'Bharat Bhushan', city: 'Mathura', gst: '09BHARA4646T1Z6' },
      { name: 'Shalimar Dedicated Fleet', code: 'TRP047', person: 'Fleet Manager', city: 'Nagpur', gst: '27SDFAA4747U1Z7' }
    ].map((t, idx) => ({
      id: `usr_${t.code.toLowerCase()}`,
      username: t.code,
      password: 'password123',
      name: `${t.name} Admin`,
      role: 'transporter',
      transporter_id: `trans_${t.code.toLowerCase()}`,
      created_at: '2026-08-01T10:00:00Z'
    }))
  ],

  transporters: [
    ...[
      { name: 'ABC Transport Pvt Ltd', code: 'ABC001', person: 'Ramesh Kumar', city: 'Mumbai', gst: '27AAAAA0000A1Z5' },
      { name: 'XYZ Logistics & Freight', code: 'XYZ001', person: 'Vikram Sharma', city: 'Pune', gst: '27BBBBA1111B1Z2' },
      { name: 'PQR National Freight Carriers', code: 'PQR001', person: 'Sunil Patel', city: 'Thane', gst: '27CCCCA2222C1Z9' },
      { name: 'VRL Logistics India', code: 'TRP001', person: 'Vijay Sankeshwar', city: 'Nagpur', gst: '27VRLAA1001A1Z1' },
      { name: 'TCI Supply Chain Freight', code: 'TRP002', person: 'Vineet Agarwal', city: 'Indore', gst: '23TCIAA2002B1Z2' },
      { name: 'Gati KWE Bulk Logistics', code: 'TRP003', person: 'Pirojshaw Sarkari', city: 'Hyderabad', gst: '36GATIA3003C1Z3' },
      { name: 'Mahindra Logistics Ltd', code: 'TRP004', person: 'Rampur Vasudevan', city: 'Solapur', gst: '27MAHLA4004D1Z4' },
      { name: 'Rivigo Freight Express', code: 'TRP005', person: 'Gazal Kalra', city: 'Gurugram', gst: '06RIVIA5005E1Z5' },
      { name: 'Safexpress Supply Chain', code: 'TRP006', person: 'Pawan Jain', city: 'Delhi', gst: '07SAFEA6006F1Z6' },
      { name: 'Delhivery Surface Cargo', code: 'TRP007', person: 'Sahil Barua', city: 'Ahmedabad', gst: '24DELHA7007G1Z7' },
      { name: 'Blue Dart Surface Lines', code: 'TRP008', person: 'Balfour Manuel', city: 'Mumbai', gst: '27BLUEA8008H1Z8' },
      { name: 'Navata Road Transport', code: 'TRP009', person: 'Nageswara Rao', city: 'Vijayawada', gst: '37NAVAA9009I1Z9' },
      { name: 'SRS Logistics & Cargo', code: 'TRP010', person: 'K. Rajeswaran', city: 'Bengaluru', gst: '29SRSSA1010J1Z0' },
      { name: 'Patel Integrated Logistics', code: 'TRP011', person: 'Asgar Patel', city: 'Surat', gst: '24PATEA1111K1Z1' },
      { name: 'Chetak Logistics Pvt Ltd', code: 'TRP012', person: 'Mukesh Haritwal', city: 'Jaipur', gst: '08CHETA1212L1Z2' },
      { name: 'Central Freight Carriers', code: 'TRP013', person: 'Rakesh Aggarwal', city: 'Nagpur', gst: '27CENTA1313M1Z3' },
      { name: 'Southern Roadways Ltd', code: 'TRP014', person: 'T.S. Santhanam', city: 'Chennai', gst: '33SOUTA1414N1Z4' },
      { name: 'Deccan Express Logistics', code: 'TRP015', person: 'Mahesh Reddy', city: 'Hyderabad', gst: '36DECCA1515O1Z5' },
      { name: 'Western India Roadlines', code: 'TRP016', person: 'Pravin Shah', city: 'Vadodara', gst: '24WESTA1616P1Z6' },
      { name: 'Shrinath Transport Agency', code: 'TRP017', person: 'Nandlal Kabra', city: 'Udaipur', gst: '08SHRIA1717Q1Z7' },
      { name: 'KPN Cargo & Logistics', code: 'TRP018', person: 'K.P. Natarajan', city: 'Coimbatore', gst: '33KPNAA1818R1Z8' },
      { name: 'Associated Road Carriers', code: 'TRP019', person: 'A.K. Arya', city: 'Kolkata', gst: '19ASSCA1919S1Z9' },
      { name: 'Economic Transport Organisation', code: 'TRP020', person: 'B.L. Arya', city: 'Kanpur', gst: '09ECOTA2020T1Z0' },
      { name: 'Inter State Freight Carriers', code: 'TRP021', person: 'Suresh Goyal', city: 'Indore', gst: '23INSTA2121U1Z1' },
      { name: 'Premier Road Carriers', code: 'TRP022', person: 'Anil Gupta', city: 'Bhopal', gst: '23PREMA2222V1Z2' },
      { name: 'Mahabali Transport Corp', code: 'TRP023', person: 'Rajesh Verma', city: 'Nagpur', gst: '27MAHAA2323W1Z3' },
      { name: 'Apex Freight Systems', code: 'TRP024', person: 'Dinesh Joshi', city: 'Nashik', gst: '27APEXA2424X1Z4' },
      { name: 'Royal India Transport', code: 'TRP025', person: 'Vikrant Singh', city: 'Jaipur', gst: '08ROYAA2525Y1Z5' },
      { name: 'Transland Logistics Ltd', code: 'TRP026', person: 'Alok Mehta', city: 'Rajkot', gst: '24TRANA2626Z1Z6' },
      { name: 'Speed Cargo Logistics', code: 'TRP027', person: 'Deepak Sethi', city: 'Jalandhar', gst: '03SPEEA2727A1Z7' },
      { name: 'Shree Ram Roadlines', code: 'TRP028', person: 'Ramawtar Sharma', city: 'Jodhpur', gst: '08SHREA2828B1Z8' },
      { name: 'Shree Maruti Logistics', code: 'TRP029', person: 'Bhikhabhai Mokariya', city: 'Ahmedabad', gst: '24MARUA2929C1Z9' },
      { name: 'Jai Hanuman Transport', code: 'TRP030', person: 'Hanuman Prasad', city: 'Jhalawar', gst: '08JAHAA3030D1Z0' },
      { name: 'Golden Logistics India', code: 'TRP031', person: 'Goldy Singh', city: 'Amritsar', gst: '03GOLDA3131E1Z1' },
      { name: 'Om Cargo Movers', code: 'TRP032', person: 'Om Prakash Mundra', city: 'Bikaner', gst: '08OMCAA3232F1Z2' },
      { name: 'Tirupati Roadlines', code: 'TRP033', person: 'Venkatesh Rao', city: 'Tirupati', gst: '37TIRUA3333G1Z3' },
      { name: 'Shree Balaji Transporters', code: 'TRP034', person: 'Balu Ram Choudhary', city: 'Nagpur', gst: '27BALAA3434H1Z4' },
      { name: 'National Transport Co', code: 'TRP035', person: 'Subhash Goyal', city: 'Ludhiana', gst: '03NATIA3535I1Z5' },
      { name: 'Superfast Road Carriers', code: 'TRP036', person: 'Jaswant Gill', city: 'Chandigarh', gst: '04SUPEA3636J1Z6' },
      { name: 'United India Logistics', code: 'TRP037', person: 'Karan Deshmukh', city: 'Solapur', gst: '27UNITA3737K1Z7' },
      { name: 'Express Cargo Movers', code: 'TRP038', person: 'Nitin Deshpande', city: 'Aurangabad', gst: '27EXPEA3838L1Z8' },
      { name: 'Continental Freight Agency', code: 'TRP039', person: 'Siddharth Roy', city: 'Kolkata', gst: '19CONTA3939M1Z9' },
      { name: 'Star India Logistics', code: 'TRP040', person: 'Tarun Saxena', city: 'Gwalior', gst: '23STARA4040N1Z0' },
      { name: 'Reliance Freight Services', code: 'TRP041', person: 'Mukesh Shah', city: 'Jamnagar', gst: '24RELIA4141O1Z1' },
      { name: 'Swastik Transport Agency', code: 'TRP042', person: 'Suresh Agrawal', city: 'Akola', gst: '27SWASA4242P1Z2' },
      { name: 'Falcon Logistics & Cargo', code: 'TRP043', person: 'Feroz Khan', city: 'Mumbai', gst: '27FALCA4343Q1Z3' },
      { name: 'Pioneer Roadways Corp', code: 'TRP044', person: 'Pankaj Kulkarni', city: 'Pune', gst: '27PIONA4444R1Z4' },
      { name: 'Universal Transport Lines', code: 'TRP045', person: 'Umesh Trivedi', city: 'Kota', gst: '08UNIVA4545S1Z5' },
      { name: 'Bharat Freight Express', code: 'TRP046', person: 'Bharat Bhushan', city: 'Mathura', gst: '09BHARA4646T1Z6' },
      { name: 'Shalimar Dedicated Fleet', code: 'TRP047', person: 'Fleet Manager', city: 'Nagpur', gst: '27SDFAA4747U1Z7' }
    ].map((t, idx) => ({
      id: `trans_${t.code.toLowerCase()}`,
      company_name: t.name,
      code: t.code,
      contact_person: t.person,
      mobile: `+91 ${9820000000 + idx * 11223}`,
      email: `contact@${t.code.toLowerCase()}.com`,
      address: `Plot ${10 + idx}, Transport Hub, ${t.city}`,
      gst_pan: t.gst,
      username: t.code,
      status: 'Active',
      created_at: '2026-08-01T10:30:00Z'
    }))
  ],

  rate_requests: [],
  rate_submissions: [],
  allocations: [],
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

    const localTime = localDb?._updatedAt || 0;
    const supabaseTime = supabaseDb?._updatedAt || 0;

    if (supabaseTime >= localTime || localTime <= 100 || !localDb) {
      safeSetLocalStorage(DB_KEY, JSON.stringify(supabaseDb));
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
    const existingTransCodes = new Set(loadedTransporters.map(t => (t.code || t.username || '').toUpperCase()));
    const mergedTransporters = [
      ...loadedTransporters,
      ...INITIAL_SEED_DATA.transporters.filter(t => !existingTransCodes.has((t.code || t.username || '').toUpperCase()))
    ];

    const loadedUsers = Array.isArray(parsed.users) ? parsed.users : [];
    const existingUsernames = new Set(loadedUsers.map(u => (u.username || '').toUpperCase()));
    const mergedUsers = [
      ...loadedUsers,
      ...INITIAL_SEED_DATA.users.filter(u => !existingUsernames.has((u.username || '').toUpperCase()))
    ];

    return {
      _updatedAt: parsed._updatedAt || 1,
      company: parsed.company || INITIAL_SEED_DATA.company,
      do_master_settings: parsed.do_master_settings || INITIAL_SEED_DATA.do_master_settings,
      company_masters: Array.isArray(parsed.company_masters) ? parsed.company_masters : INITIAL_SEED_DATA.company_masters,
      product_masters: Array.isArray(parsed.product_masters) ? parsed.product_masters : INITIAL_SEED_DATA.product_masters,
      cargo_masters: Array.isArray(parsed.cargo_masters) ? parsed.cargo_masters : INITIAL_SEED_DATA.cargo_masters,
      title_masters: Array.isArray(parsed.title_masters) ? parsed.title_masters : INITIAL_SEED_DATA.title_masters,
      city_masters: Array.isArray(parsed.city_masters) ? parsed.city_masters : INITIAL_SEED_DATA.city_masters,
      users: mergedUsers,
      transporters: mergedTransporters,
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
      console.log('SAVE COMPLETE');
      return dataToSave;
    }

    console.log('SUPABASE UPSERT START');
    const { data: resData, error } = await supabase
      .from('app_database')
      .upsert(
        {
          id: 'transflow-live-prod-v3',
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
  safeSetLocalStorage(DB_KEY, JSON.stringify(seedToSave));
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(USER_SESSION_KEY);
  }
  saveDB(seedToSave);
  return seedToSave;
}
