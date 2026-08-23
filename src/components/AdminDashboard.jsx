// src/components/AdminDashboard.jsx
// Cleaned up Admin Dashboard with Auto-Sequential ERP Requirement Formatting, High-Visibility Badge Styling, Account Suspension, & Transporter Deletion Engine 🗑️

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CreateRequirementModal } from './CreateRequirementModal';
import { TransporterManagerModal } from './TransporterManagerModal';
import { RateComparisonView } from './RateComparisonView';
import { ContractModal } from './ContractModal';
import { ERPPaymentModal } from './ERPPaymentModal';
import { ParticularBidReportModal } from './ParticularBidReportModal';
import { WhatsAppBroadcastModal } from './WhatsAppBroadcastModal';
import { sendWhatsAppAlert } from '../utils/whatsappEngine';
import { validateMobile, validatePincode, validateGSTIN, validatePAN, validateName, validateEmail } from '../utils/validationRules';
import {
  PlusCircle,
  UserPlus,
  TrendingDown,
  Building2,
  FileText,
  Truck,
  DollarSign,
  MapPin,
  CheckCircle2,
  Eye,
  Layers,
  Sparkles,
  Server,
  Bookmark,
  Trash2,
  Plus,
  Archive,
  Download,
  HardDrive,
  ShieldCheck,
  Lock,
  Activity,
  Key,
  X,
  RefreshCw,
  Edit,
  FolderOpen,
  MessageSquare,
  Send,
  Database,
  Upload
} from 'lucide-react';

export const AdminDashboard = () => {
  const { db, updateDB, currentUser, addSecurityLog } = useAuth();

  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('transflow_admin_active_tab') || 'requirements';
  }); // 'requirements', 'transporters', 'contracts', 'title_masters', 'security'

  const [masterFilterTab, setMasterFilterTab] = useState(() => {
    return localStorage.getItem('transflow_admin_master_sub_tab') || 'all';
  }); // 'all', 'titles', 'transporters', 'company', 'products'

  const [reqFilterTab, setReqFilterTab] = useState('open'); // 'open', 'done', 'all'

  useEffect(() => {
    localStorage.setItem('transflow_admin_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('transflow_admin_master_sub_tab', masterFilterTab);
  }, [masterFilterTab]);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedRequestForComparison, setSelectedRequestForComparison] = useState(null);
  const [selectedRequestForParticularReport, setSelectedRequestForParticularReport] = useState(null);
  const [whatsappModalData, setWhatsappModalData] = useState({ isOpen: false, data: null });
  
  const [isReqModalOpen, setIsReqModalOpen] = useState(false);
  const [isTransporterModalOpen, setIsTransporterModalOpen] = useState(false);
  const [isAddCompanyModalOpen, setIsAddCompanyModalOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);

  const [editingRouteMaster, setEditingRouteMaster] = useState(null);
  const [editingTransporterMaster, setEditingTransporterMaster] = useState(null);
  const [editingCompanyMaster, setEditingCompanyMaster] = useState(null);
  const [editingProductMaster, setEditingProductMaster] = useState(null);

  const [selectedTransporterForChat, setSelectedTransporterForChat] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');

  const [selectedContractForModal, setSelectedContractForModal] = useState(null);
  const [selectedContractForERP, setSelectedContractForERP] = useState(null);

  // 🔑 Admin Password Reset Modal State
  const [resetPassTransporter, setResetPassTransporter] = useState(null);
  const [newTransporterPassword, setNewTransporterPassword] = useState('');

  // Archive Notice State
  const [archiveNotice, setArchiveNotice] = useState('');

  // 📊 Live Reports & Audit Trail Modal States
  const [selectedAuditReportModal, setSelectedAuditReportModal] = useState(null);
  const [reportSearchTerm, setReportSearchTerm] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState('all');
  const [reportTransporterFilter, setReportTransporterFilter] = useState('all');

  const handleExportBiddingReportCSV = () => {
    const submissions = db.rate_submissions || [];
    if (submissions.length === 0) {
      alert('No transporter bidding data available to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,Req No,Batch Code,Transporter Name,Transporter Code,Quoted Rate (INR/MT),Counter Rate (INR/MT),Allocated Qty (MT),Total Contract Value (INR),Status,Approval Status\n";

    submissions.forEach((sub) => {
      const req = (db.rate_requests || []).find((r) => r.id === sub.rate_request_id);
      const trans = (db.transporters || []).find((t) => t.id === sub.transporter_id);
      const alloc = (db.allocations || []).find((a) => a.rate_request_id === sub.rate_request_id && a.transporter_id === sub.transporter_id);

      const timeStr = sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A';
      const reqNo = req?.request_no || 'REQ';
      const batchNo = req?.batch_no || reqNo;
      const transName = (trans?.company_name || 'Transporter').replace(/,/g, ' ');
      const transCode = trans?.code || 'TR';
      const rate = sub.rate_per_unit || 0;
      const counterRate = sub.counter_rate_per_unit || '-';
      const allocQty = alloc?.allocated_qty || 0;
      const totalVal = alloc ? (alloc.allocated_qty * alloc.agreed_rate) : 0;
      const status = sub.status || 'Submitted';
      const approvalStatus = alloc ? 'APPROVED & AWARDED' : (sub.is_frozen ? 'AGREED' : 'PENDING');

      csvContent += `"${timeStr}","${reqNo}","${batchNo}","${transName}","${transCode}",${rate},"${counterRate}",${allocQty},${totalVal},"${status}","${approvalStatus}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TransFlow_Freight_Bidding_Approval_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 📄 DO MASTER SETTINGS STATE
  const [doMasterForm, setDoMasterForm] = useState(() => db.do_master_settings || {
    hsn_code: '23040010',
    igst_rate: 5,
    do_prefix: 'DOR-SNPL-',
    state_name: 'MAHARASHTRA',
    state_code: '27 (MAHARASHTRA)',
    dispatch_plant_name: 'Shalimar Nutrients MIDC Processing Unit',
    dispatch_plant_address: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028',
    terms_conditions: '1. Food-grade tarpaulin covering mandatory for dry cargo.\n2. Automated 24x7 weighbridge tare and gross recorded at Shalimar Plant.\n3. Sound single-use tamper-evident seals mandatory for oil tankers.\n4. Transit unloading expected within 4 hours of arrival.'
  });

  const handleSaveDOMasterSettings = (e) => {
    e.preventDefault();
    const updatedDb = addSecurityLog(
      {
        ...db,
        do_master_settings: doMasterForm
      },
      'UPDATE_DO_MASTER_SETTINGS',
      currentUser?.username || 'admin',
      'admin',
      'MASTER_UPDATED 🛡️'
    );
    updateDB(updatedDb);
    setArchiveNotice('📄 Delivery Order (DO) Document Master Settings saved successfully!');
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  // 🏢 1. COMPANY MASTER FORM STATE & HANDLERS
  const [newCompanyMaster, setNewCompanyMaster] = useState({
    name: '',
    address: '',
    gstin: '',
    pan_no: '',
    proprietor_name: '',
    email: '',
    mobile_no: '',
    state: 'Maharashtra',
    city: '',
    district: '',
    pincode: '',
    pickup_location_name: '',
    drop_location_name: ''
  });

  const handleAddCompanyMaster = (e) => {
    e.preventDefault();
    if (!newCompanyMaster.name.trim()) return;

    // 🛡️ Live Validation Rules
    if (newCompanyMaster.pincode) {
      const pinVal = validatePincode(newCompanyMaster.pincode);
      if (!pinVal.valid) {
        alert(`📍 Postal PIN Error: ${pinVal.message}`);
        return;
      }
    }
    if (newCompanyMaster.mobile_no) {
      const mobVal = validateMobile(newCompanyMaster.mobile_no);
      if (!mobVal.valid) {
        alert(`📱 Mobile Number Error: ${mobVal.message}`);
        return;
      }
    }
    if (newCompanyMaster.gstin) {
      const gstVal = validateGSTIN(newCompanyMaster.gstin);
      if (!gstVal.valid) {
        alert(`📄 GSTIN Number Error: ${gstVal.message}`);
        return;
      }
    }
    if (newCompanyMaster.pan_no) {
      const panVal = validatePAN(newCompanyMaster.pan_no);
      if (!panVal.valid) {
        alert(`💳 PAN Number Error: ${panVal.message}`);
        return;
      }
    }
    if (newCompanyMaster.proprietor_name) {
      const nameVal = validateName(newCompanyMaster.proprietor_name);
      if (!nameVal.valid) {
        alert(`👤 Proprietor Name Error: ${nameVal.message}`);
        return;
      }
    }

    const newCompObj = {
      id: `comp_${Date.now()}`,
      code: (newCompanyMaster?.name || "").slice(0, 5).toUpperCase(),
      ...newCompanyMaster
    };
    const updatedDb = addSecurityLog(
      {
        ...db,
        company_masters: [newCompObj, ...(db.company_masters || [])]
      },
      'ADD_COMPANY_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'COMPANY_ADDED 🛡️'
    );
    updateDB(updatedDb);
    setNewCompanyMaster({
      name: '',
      address: '',
      gstin: '',
      pan_no: '',
      proprietor_name: '',
      email: '',
      mobile_no: '',
      state: 'Maharashtra',
      city: '',
      district: '',
      pincode: '',
      pickup_location_name: '',
      drop_location_name: ''
    });
    setIsAddCompanyModalOpen(false);
    setArchiveNotice(`🏢 New Company / Plant Master '${newCompObj.name}' added to Master Directory!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  // EDIT COMPANY MASTER STATE & HANDLERS
  const handleOpenEditCompanyModal = (comp) => {
    setEditingCompanyMaster({ ...comp });
  };

  const handleSaveEditCompanyMaster = (e) => {
    e.preventDefault();
    if (!editingCompanyMaster) return;

    const updatedCompanies = (db.company_masters || []).map((c) =>
      c.id === editingCompanyMaster.id ? editingCompanyMaster : c
    );

    const updatedDb = addSecurityLog(
      {
        ...db,
        company_masters: updatedCompanies
      },
      'EDIT_COMPANY_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'COMPANY_EDITED ✏️'
    );

    updateDB(updatedDb);
    setEditingCompanyMaster(null);
    setArchiveNotice(`✏️ Company / Plant Master '${editingCompanyMaster.name}' updated successfully!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleDeleteCompanyMaster = (comp) => {
    if (!window.confirm(`Delete company unit master '${comp.name}'?`)) return;
    const updatedDb = addSecurityLog(
      {
        ...db,
        company_masters: (db.company_masters || []).filter((c) => c.id !== comp.id)
      },
      'DELETE_COMPANY_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'COMPANY_DELETED 🛡️'
    );
    updateDB(updatedDb);
  };

  // 📑 1. REQUIREMENT TITLE MASTER FORM STATE & HANDLERS (WITH PICKUP & DROP LOCATIONS)
  const [newMasterTitle, setNewMasterTitle] = useState('');
  const [newMasterOrigin, setNewMasterOrigin] = useState('');
  const [newMasterDest, setNewMasterDest] = useState('');
  const [newMasterMaterial, setNewMasterMaterial] = useState('');

  const handleAddMasterTitle = (e) => {
    e.preventDefault();
    const cityVal = (newMasterOrigin || newMasterTitle || '').trim();
    if (!cityVal) return;

    const newTitleObj = {
      id: `tm_${Date.now()}`,
      title: cityVal,
      origin_city: cityVal,
      dest_city: 'Solapur (Shalimar Refinery)',
      material_type: newMasterMaterial.trim() || 'Refined Edible Oil (Bulk)'
    };

    // Auto-sync city_masters so all dropdowns receive this new Pickup Origin
    const existingCities = db.city_masters || [];
    const cityExists = existingCities.some((c) => (c?.city || "").toLowerCase() === (cityVal || "").toLowerCase());
    const updatedCityMasters = cityExists
      ? existingCities
      : [{ id: `city_${Date.now()}`, city: cityVal, state: 'Maharashtra' }, ...existingCities];

    const updatedDb = addSecurityLog(
      {
        ...db,
        title_masters: [newTitleObj, ...(db.title_masters || [])],
        city_masters: updatedCityMasters
      },
      'ADD_TITLE_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'TITLE_MASTER_ADDED 📌'
    );
    updateDB(updatedDb);
    setNewMasterOrigin('');
    setNewMasterTitle('');
    setIsAddRouteModalOpen(false);
    setArchiveNotice(`📍 Pickup Origin Master '${cityVal}' saved & synced to all Master dropdowns!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleEditMasterTitle = (tm) => {
    setEditingRouteMaster({ ...tm });
  };

  const handleSaveEditRouteMaster = (e) => {
    e.preventDefault();
    if (!editingRouteMaster || !editingRouteMaster.title.trim()) return;

    const updatedMasters = (db.title_masters || []).map((item) =>
      item.id === editingRouteMaster.id ? editingRouteMaster : item
    );

    const updatedDb = addSecurityLog(
      { ...db, title_masters: updatedMasters },
      `EDIT_TITLE_MASTER (${editingRouteMaster.title})`,
      currentUser?.username || 'admin',
      'admin',
      'TITLE_MASTER_EDITED ✏️'
    );
    updateDB(updatedDb);
    setEditingRouteMaster(null);
    setArchiveNotice(`✏️ Route Master '${editingRouteMaster.title}' updated successfully!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleDeleteMasterTitle = (tm) => {
    const cityName = tm.origin_city || tm.dest_city || tm.title;
    if (!window.confirm(`⚠️ CASCADE DELETE WARNING:\n\nAre you sure you want to delete Master Location '${cityName}'?\n\nThis will remove it from Master Directories, system dropdowns, and cascade clean all references!`)) {
      return;
    }

    const updatedTitleMasters = (db.title_masters || []).filter((item) => item.id !== tm.id);
    const updatedCityMasters = (db.city_masters || []).filter(
      (item) => (item?.city || "").toLowerCase() !== (cityName || "").toLowerCase()
    );

    const updatedDb = addSecurityLog(
      {
        ...db,
        title_masters: updatedTitleMasters,
        city_masters: updatedCityMasters
      },
      `DELETE_MASTER_LOCATION (${cityName})`,
      currentUser?.username || 'admin',
      'admin',
      'MASTER_LOCATION_DELETED 🗑️'
    );

    updateDB(updatedDb);
    setEditingRouteMaster(null);
    setArchiveNotice(`🗑️ Master Location '${cityName}' deleted completely from Master Directories & system dropdowns!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleDeleteTransporterMaster = (transporter) => {
    if (!window.confirm(`⚠️ CASCADE DELETE WARNING:\n\nAre you sure you want to delete Transporter '${transporter.company_name}' (${transporter.code})?\n\nThis will permanently delete the vendor account, user login credentials, and remove un-awarded bids!`)) {
      return;
    }

    const updatedTransporters = (db.transporters || []).filter((t) => t.id !== transporter.id);
    const updatedUsers = (db.users || []).filter(
      (u) => u.transporter_id !== transporter.id && u.username !== transporter.username
    );
    const updatedSubmissions = (db.rate_submissions || []).filter(
      (s) => s.transporter_id !== transporter.id
    );

    const updatedDb = addSecurityLog(
      {
        ...db,
        transporters: updatedTransporters,
        users: updatedUsers,
        rate_submissions: updatedSubmissions
      },
      `DELETE_TRANSPORTER (${transporter.company_name})`,
      currentUser?.username || 'admin',
      'admin',
      'TRANSPORTER_DELETED 🗑️'
    );

    updateDB(updatedDb);
    setEditingTransporterMaster(null);
  };

  const verifyAdminPassword = (actionTitle) => {
    const enteredPass = window.prompt(`🔒 SECURITY AUTHORIZATION REQUIRED:\n\nPlease enter Security Authorization Password to perform ${actionTitle}:`);
    if (!enteredPass) return false;

    const masterSecurityPass = 'SunilYede@katol';
    const actualAdminPass = currentUser?.password || 'admin123';

    if (enteredPass.trim() !== masterSecurityPass && enteredPass.trim() !== actualAdminPass.trim()) {
      alert(`🛑 ACCESS DENIED: Invalid Security Authorization Password for '${actionTitle}'. Security audit event logged.`);
      const updatedDb = addSecurityLog(
        db,
        `UNAUTHORIZED_BACKUP_ACCESS_ATTEMPT (${actionTitle})`,
        currentUser?.username || 'admin',
        'admin',
        'ACCESS_DENIED 🛑'
      );
      updateDB(updatedDb);
      return false;
    }
    return true;
  };

  const handleDownloadDatabaseBackup = () => {
    if (!verifyAdminPassword('Database Backup Download (.json)')) return;

    try {
      const backupData = {
        _exportedAt: new Date().toISOString(),
        _exportVersion: 'v2.0',
        company: db.company || {},
        do_master_settings: db.do_master_settings || {},
        company_masters: db.company_masters || [],
        product_masters: db.product_masters || [],
        cargo_masters: db.cargo_masters || [],
        title_masters: db.title_masters || [],
        city_masters: db.city_masters || [],
        transporters: db.transporters || [],
        rate_requests: db.rate_requests || [],
        rate_submissions: db.rate_submissions || [],
        allocations: db.allocations || [],
        contracts: db.contracts || [],
        truck_dispatches: db.truck_dispatches || [],
        users: db.users || [],
        security_audit_logs: db.security_audit_logs || []
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TransFlow_Full_ERP_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setArchiveNotice('📥 Complete System Database Backup (.json) downloaded successfully!');
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      alert(`Backup creation failed: ${err.message}`);
    }
  };

  const handleUploadDatabaseBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!verifyAdminPassword('Database Cloud Restore (.json)')) {
      if (e.target) e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonContent = event.target?.result;
        if (!jsonContent) return;
        const parsed = JSON.parse(jsonContent);

        if (!parsed || typeof parsed !== 'object') {
          alert('Invalid Backup File. Please upload a valid TransFlow JSON backup file.');
          if (e.target) e.target.value = '';
          return;
        }

        if (!window.confirm('⚠️ DATABASE RESTORE CONFIRMATION:\n\nAre you sure you want to restore system database from this backup file?\n\nThis will update your Live Cloud Database with the backup data.')) {
          if (e.target) e.target.value = '';
          return;
        }

        const restoredDb = addSecurityLog(
          {
            _updatedAt: Date.now() + 100000,
            company: parsed.company || db.company || {},
            do_master_settings: parsed.do_master_settings || db.do_master_settings || {},
            company_masters: Array.isArray(parsed.company_masters) ? parsed.company_masters : (db.company_masters || []),
            product_masters: Array.isArray(parsed.product_masters) ? parsed.product_masters : (db.product_masters || []),
            cargo_masters: Array.isArray(parsed.cargo_masters) ? parsed.cargo_masters : (db.cargo_masters || []),
            title_masters: Array.isArray(parsed.title_masters) ? parsed.title_masters : (db.title_masters || []),
            city_masters: Array.isArray(parsed.city_masters) ? parsed.city_masters : (db.city_masters || []),
            transporters: Array.isArray(parsed.transporters) ? parsed.transporters : (db.transporters || []),
            rate_requests: Array.isArray(parsed.rate_requests) ? parsed.rate_requests : (db.rate_requests || []),
            rate_submissions: Array.isArray(parsed.rate_submissions) ? parsed.rate_submissions : (db.rate_submissions || []),
            allocations: Array.isArray(parsed.allocations) ? parsed.allocations : (db.allocations || []),
            contracts: Array.isArray(parsed.contracts) ? parsed.contracts : (db.contracts || []),
            truck_dispatches: Array.isArray(parsed.truck_dispatches) ? parsed.truck_dispatches : (db.truck_dispatches || []),
            users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : (db.users || []),
            security_audit_logs: Array.isArray(parsed.security_audit_logs) ? parsed.security_audit_logs : (db.security_audit_logs || [])
          },
          'RESTORE_DATABASE_FROM_JSON_BACKUP',
          currentUser?.username || 'admin',
          'admin',
          'DB_RESTORED 🛡️'
        );

        updateDB(restoredDb);
        if (e.target) e.target.value = '';
        setArchiveNotice('🎉 System Database successfully restored from JSON backup file & synced to Supabase Cloud!');
        setTimeout(() => setArchiveNotice(''), 5000);
      } catch (err) {
        alert(`Failed to parse backup JSON file: ${err.message}`);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetDatabaseToFreshStart = () => {
    if (!verifyAdminPassword('System Data Reset')) return;

    if (!window.confirm('⚠️ CLEAR ALL SYSTEM OPERATIONAL DATA CONFIRMATION:\n\nAre you sure you want to clear all active rate requests, freight bids, awarded contracts, and truck dispatches?\n\nThis will reset operational tables and sync to Supabase Cloud.')) {
      return;
    }

    const cleanFreshDb = addSecurityLog(
      {
        ...db,
        _updatedAt: Date.now() + 100000,
        rate_requests: [],
        rate_submissions: [],
        allocations: [],
        contracts: [],
        truck_dispatches: [],
        whatsapp_notifications: []
      },
      'SYSTEM_DATABASE_RESET_FRESH_START',
      currentUser?.username || 'admin',
      'admin',
      'SYSTEM_RESET 🚀'
    );

    updateDB(cleanFreshDb);
    setArchiveNotice('🎉 System Database cleared completely! Operational tables are now 100% clean & ready for fresh live start.');
    setTimeout(() => setArchiveNotice(''), 5000);
  };

  const handleToggleTransporterStatus = (transporter) => {
    const isCurrentlyActive = transporter.status !== 'Suspended' && transporter.status !== 'Deactivated';
    const newStatus = isCurrentlyActive ? 'Suspended' : 'Active';

    const updatedTransporters = (db.transporters || []).map((t) =>
      t.id === transporter.id ? { ...t, status: newStatus } : t
    );

    const updatedDb = addSecurityLog(
      { ...db, transporters: updatedTransporters },
      `TOGGLE_TRANSPORTER_STATUS (${transporter.company_name} -> ${newStatus})`,
      currentUser?.username || 'admin',
      'admin',
      `TRANSPORTER_${(newStatus || "").toUpperCase()} 🛡️`
    );

    updateDB(updatedDb);
    setArchiveNotice(`🛡️ Transporter '${transporter.company_name}' status set to ${newStatus}!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleDeleteProductMaster = (prod) => {
    if (!window.confirm(`⚠️ CASCADE DELETE WARNING:\n\nAre you sure you want to delete Product Master '${prod.name}'?\n\nThis will remove it from Master Directories and product dropdowns!`)) {
      return;
    }

    const updatedProducts = (db.product_masters || []).filter((p) => p.id !== prod.id);

    const updatedDb = addSecurityLog(
      {
        ...db,
        product_masters: updatedProducts
      },
      `DELETE_PRODUCT_MASTER (${prod.name})`,
      currentUser?.username || 'admin',
      'admin',
      'PRODUCT_MASTER_DELETED 🗑️'
    );

    updateDB(updatedDb);
    setEditingProductMaster(null);
    setArchiveNotice(`🗑️ Product Master '${prod.name}' deleted from system!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleEditProductMaster = (prod) => {
    setEditingProductMaster({ ...prod });
  };

  const handleSaveEditProductMaster = (e) => {
    e.preventDefault();
    if (!editingProductMaster || !editingProductMaster.name.trim()) return;

    const updatedProducts = (db.product_masters || []).map((item) =>
      item.id === editingProductMaster.id ? editingProductMaster : item
    );

    const updatedDb = addSecurityLog(
      { ...db, product_masters: updatedProducts },
      `EDIT_PRODUCT_MASTER (${editingProductMaster.name})`,
      currentUser?.username || 'admin',
      'admin',
      'PRODUCT_EDITED ✏️'
    );
    updateDB(updatedDb);
    setEditingProductMaster(null);
    setArchiveNotice(`✏️ Product Master '${editingProductMaster.name}' updated successfully!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  // 📦 PRODUCT MASTER FORM STATE & HANDLERS
  const [newProductMaster, setNewProductMaster] = useState({
    name: '',
    category: 'Liquid Edible Bulk',
    hsn_code: '15071000',
    unit: 'MT'
  });

  const handleAddProductMaster = (e) => {
    e.preventDefault();
    if (!newProductMaster.name.trim()) return;
    const newProdObj = {
      id: `prod_${Date.now()}`,
      name: newProductMaster.name.trim(),
      category: newProductMaster.category.trim() || 'General Bulk Cargo',
      hsn_code: newProductMaster.hsn_code.trim() || '15071000',
      unit: newProductMaster.unit || 'MT'
    };

    const updatedDb = addSecurityLog(
      {
        ...db,
        product_masters: [newProdObj, ...(db.product_masters || [])]
      },
      'ADD_PRODUCT_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'PRODUCT_ADDED 📦'
    );
    updateDB(updatedDb);
    setNewProductMaster({
      name: '',
      category: 'Liquid Edible Bulk',
      hsn_code: '15071000',
      unit: 'MT'
    });
    setIsAddProductModalOpen(false);
    setArchiveNotice(`📦 New Product Master '${newProdObj.name}' added successfully!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  // 🚛 3. CARGO & VEHICLE MASTER FORM STATE & HANDLERS
  const [newCargoMaster, setNewCargoMaster] = useState({ vehicle_type: '', capacity_mt: 25, cargo_category: 'Dry Bagged Cargo' });
  const handleAddCargoMaster = (e) => {
    e.preventDefault();
    if (!newCargoMaster.vehicle_type) return;
    const newCargoObj = {
      id: `cargo_${Date.now()}`,
      ...newCargoMaster
    };
    const updatedDb = addSecurityLog(
      {
        ...db,
        cargo_masters: [newCargoObj, ...(db.cargo_masters || [])]
      },
      'ADD_CARGO_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'CARGO_ADDED 🛡️'
    );
    updateDB(updatedDb);
    setNewCargoMaster({ vehicle_type: '', capacity_mt: 25, cargo_category: 'Dry Bagged Cargo' });
    setArchiveNotice(`🚛 New Cargo Type '${newCargoObj.vehicle_type}' added to Cargo Master!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  const handleDeleteCargoMaster = (cargo) => {
    if (!window.confirm(`Delete cargo type master '${cargo.vehicle_type}'?`)) return;
    const updatedDb = addSecurityLog(
      {
        ...db,
        cargo_masters: (db.cargo_masters || []).filter((c) => c.id !== cargo.id)
      },
      'DELETE_CARGO_MASTER',
      currentUser?.username || 'admin',
      'admin',
      'CARGO_DELETED 🛡️'
    );
    updateDB(updatedDb);
  };

  // ⚡ BULK RATE REQUEST CREATOR STATE (UP TO 50 REQUESTS AT ONCE)
  const [masterPickupCity, setMasterPickupCity] = useState(() => (db.company_masters?.[0]?.name || db.city_masters?.[0]?.city || ''));
  const [expandedBatches, setExpandedBatches] = useState({});

  const toggleBatchExpand = (batchKey) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [batchKey]: !prev[batchKey]
    }));
  };

  const handleMasterPickupChange = (newCity) => {
    setMasterPickupCity(newCity);
    setBulkReqRows((prev) =>
      prev.map((row) => ({ ...row, origin_city: newCity }))
    );
  };

  // 🔢 Calculate Next Batch Number for SNPL/26-27/REQ-XX Format
  const getNextBatchNum = () => {
    let maxBatch = 0;
    (db.rate_requests || []).forEach((req) => {
      const targetStr = req.request_no || req.title || '';
      const match = targetStr.match(/REQ-(\d+)/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxBatch) maxBatch = num;
      }
    });
    return maxBatch + 1;
  };

  const createSingleReqRow = (indexOffset = 0) => {
    const currentBatchNum = getNextBatchNum();
    const batchCode = `SNPL/26-27/REQ-${currentBatchNum.toString().padStart(2, '0')}`;
    const subNum = (indexOffset + 1).toString().padStart(2, '0');
    const reqNo = `${batchCode}/${subNum}`;

    return {
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: reqNo,
      request_no: reqNo,
      origin_city: masterPickupCity || '',
      dest_city: '',
      company_unit: '',
      material_type: '',
      hsn_code: '',
      required_qty: '',
      target_date: ''
    };
  };

  const [bulkReqRows, setBulkReqRows] = useState(() => [createSingleReqRow(0)]);

  const handleAddBulkRow = () => {
    if (bulkReqRows.length >= 50) {
      alert('Maximum 50 Rate Requests can be created at once in a single batch!');
      return;
    }
    setBulkReqRows((prev) => [...prev, createSingleReqRow(prev.length)]);
  };

  const handleDuplicateLastRow = () => {
    if (bulkReqRows.length >= 50) {
      alert('Maximum 50 Rate Requests can be created at once in a single batch!');
      return;
    }
    const lastRow = bulkReqRows[bulkReqRows.length - 1] || createSingleReqRow(0);
    const currentBatchNum = getNextBatchNum();
    const batchCode = `SNPL/26-27/REQ-${currentBatchNum.toString().padStart(2, '0')}`;
    const subNum = (bulkReqRows.length + 1).toString().padStart(2, '0');
    const reqNo = `${batchCode}/${subNum}`;

    const newRow = {
      ...lastRow,
      id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: reqNo,
      request_no: reqNo
    };
    setBulkReqRows((prev) => [...prev, newRow]);
  };

  const handleFillSample5Rows = (count = 10) => {
    const sampleRows = [];
    for (let i = 0; i < count; i++) {
      sampleRows.push(createSingleReqRow(i));
    }
    setBulkReqRows(sampleRows);
  };

  const handleRemoveBulkRow = (rowId) => {
    if (bulkReqRows.length <= 1) {
      alert('At least 1 Rate Request row is required.');
      return;
    }
    setBulkReqRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const handleUpdateBulkRow = (rowId, field, value) => {
    setBulkReqRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (field === 'material_type') {
          const matchedProd = (db.product_masters || []).find(
            (p) => (p.name || '').trim().toLowerCase() === (value || '').trim().toLowerCase()
          );
          return {
            ...row,
            material_type: value,
            hsn_code: matchedProd?.hsn_code || ''
          };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const handleBulkBroadcastRequirements = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!bulkReqRows || !bulkReqRows.length) {
      alert('No rate request rows found.');
      return;
    }

    const currentBatchNum = getNextBatchNum();
    const batchCode = `SNPL/26-27/REQ-${currentBatchNum.toString().padStart(2, '0')}`;
    const newRequests = [];

    for (let i = 0; i < bulkReqRows.length; i++) {
      const row = bulkReqRows[i];

      const originVal = (row.origin_city || masterPickupCity || '').trim();
      const destVal = (row.dest_city || '').trim();
      const prodVal = (row.material_type || '').trim();
      const qtyVal = parseFloat(row.required_qty);
      const dateVal = (row.target_date || '').trim();

      const isInvalidOrigin = !originVal || originVal.includes('-- No Pickup Origin') || originVal.includes('-- Select');
      const isInvalidDest = !destVal || destVal.includes('-- No Drop Location') || destVal.includes('-- Select');
      const isInvalidProd = !prodVal || prodVal.includes('-- No Product') || prodVal.includes('-- Select');
      const isInvalidQty = !qtyVal || qtyVal <= 0 || isNaN(qtyVal);
      const isInvalidDate = !dateVal;

      if (isInvalidOrigin || isInvalidDest || isInvalidProd || isInvalidQty || isInvalidDate) {
        const missingFields = [];
        if (isInvalidOrigin) missingFields.push('Pickup Origin Location');
        if (isInvalidDest) missingFields.push('Drop Destination Location');
        if (isInvalidProd) missingFields.push('Product / Material Name');
        if (isInvalidQty) missingFields.push('Valid Quantity in MT (e.g. 500)');
        if (isInvalidDate) missingFields.push('Target Dispatch Date');

        alert(`⚠️ CANNOT BROADCAST RATE REQUEST (Row #${i + 1}):\n\nThe following required field(s) are missing or unselected:\n• ${missingFields.join('\n• ')}\n\n💡 Tip: Please add Plants & Products in Master Directories first if dropdowns are empty!`);
        return;
      }

      if (dateVal < todayStr) {
        alert(`⚠️ CANNOT BROADCAST RATE REQUEST (Row #${i + 1}):\n\nTarget Dispatch Date (${dateVal}) is in the PAST!\n\nPlease select Today (${todayStr}) or a Future Date.`);
        return;
      }

      const subNum = (i + 1).toString().padStart(2, '0');
      const reqNo = `${batchCode}/${subNum}`;

      const matchedProd = (db.product_masters || []).find(
        (p) => (p.name || '').trim().toLowerCase() === prodVal.toLowerCase()
      );
      const hsnCodeVal = matchedProd?.hsn_code || row.hsn_code || '';

      newRequests.push({
        id: `req_${Date.now()}_${i}`,
        request_no: reqNo,
        title: reqNo,
        batch_no: batchCode,
        sub_no: subNum,
        origin_city: originVal,
        origin_pin: '440028',
        dest_city: destVal,
        dest_pin: '413001',
        company_unit: row.company_unit || (db.company_masters?.[0]?.name || 'Shalimar Nutrients Pvt Ltd'),
        material_type: prodVal,
        hsn_code: hsnCodeVal,
        required_qty: qtyVal,
        unit: 'MT',
        target_date: dateVal,
        status: 'Open',
        created_at: new Date().toISOString(),
        notes: `Company Unit: ${row.company_unit || 'Shalimar Group'}. HSN Code: ${hsnCodeVal}. Batch ${batchCode} Item #${subNum}.`
      });
    }

    if (newRequests.length === 0) {
      alert('Please enter a valid Quantity in MT (e.g. 500) for at least one row.');
      return;
    }

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: [...newRequests, ...(db.rate_requests || [])]
      },
      `BULK_CREATE_RATE_REQUIREMENTS (${batchCode})`,
      currentUser?.username || 'admin',
      'admin',
      `BATCH_BROADCAST (${batchCode} - ${newRequests.length} ITEMS) ⚡`
    );

    updateDB(updatedDb);

    // 📱 Automated Background WhatsApp Alert Push for all Registered Transporters
    (db.transporters || []).forEach((transporter) => {
      if (transporter.mobile) {
        sendWhatsAppAlert({
          db,
          updateDB,
          recipientPhone: transporter.mobile,
          recipientName: transporter.company_name,
          title: `🚨 New Freight Bid Broadcast: ${batchCode}`,
          message: `🚨 *SHALIMAR LOGISTICS BID ALERT* 🚨\n\n🏢 Company: ${newRequests[0].company_unit}\n📦 Batch: ${batchCode} (${newRequests.length} Items)\n📍 Route: ${newRequests[0].origin_city} ➔ ${newRequests[0].dest_city}\n⚖️ Volume: ${newRequests.reduce((a, b) => a + (Number(b.required_qty) || 0), 0)} MT\n📅 Target Date: ${newRequests[0].target_date}\n\nSubmit rates: https://transflow-logistics.vercel.app/`
        });
      }
    });

    // Reset Bulk Form with 1 fresh row initialized for NEXT Batch
    setBulkReqRows([createSingleReqRow(0)]);

    // 📱 Open 1-Click WhatsApp Broadcast Modal Popup
    setWhatsappModalData({
      isOpen: true,
      data: {
        batchCode,
        itemsCount: newRequests.length,
        origin: newRequests[0].origin_city,
        dest: newRequests[0].dest_city,
        totalQty: newRequests.reduce((a, b) => a + (Number(b.required_qty) || 0), 0),
        materialType: newRequests[0].material_type,
        targetDate: newRequests[0].target_date,
        companyUnit: newRequests[0].company_unit
      }
    });

    setArchiveNotice(`🚀 Batch ${batchCode} broadcasted with instant WhatsApp Alerts!`);
    setTimeout(() => setArchiveNotice(''), 5000);
  };

  // EDIT TRANSPORT REQUIREMENT STATE & HANDLER
  const [editingReq, setEditingReq] = useState(null);

  const handleOpenEditModal = (req) => {
    setEditingReq({ ...req });
  };

  const handleSaveEditRequirement = (e) => {
    e.preventDefault();
    if (!editingReq) return;

    const updatedRequests = (db.rate_requests || []).map((r) =>
      r.id === editingReq.id ? editingReq : r
    );

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: updatedRequests
      },
      'EDIT_RATE_REQUIREMENT',
      currentUser?.username || 'admin',
      'admin',
      'REQUIREMENT_EDITED ✏️'
    );

    updateDB(updatedDb);
    setEditingReq(null);
    setArchiveNotice(`✏️ Transport Indent '${editingReq.request_no}' updated successfully!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  // ⚡ 1-CLICK QUICK ADD HANDLERS FOR RAPID PROCUREMENT BAR
  const handleQuickAddPickupCity = () => {
    const newCity = prompt('📍 Enter New Pickup / Origin City Name:');
    if (newCity && newCity.trim()) {
      const cityObj = { id: `city_${Date.now()}`, city: newCity.trim(), state: 'Maharashtra', pin: '440001' };
      const updatedDb = addSecurityLog(
        { ...db, city_masters: [cityObj, ...(db.city_masters || [])] },
        'ADD_CITY_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'CITY_ADDED 🛡️'
      );
      updateDB(updatedDb);
      setQuickReq({ ...quickReq, origin_city: newCity.trim() });
    }
  };

  const handleQuickAddDropCity = () => {
    const newCity = prompt('🎯 Enter New Drop / Destination City Name:');
    if (newCity && newCity.trim()) {
      const cityObj = { id: `city_${Date.now()}`, city: newCity.trim(), state: 'Maharashtra', pin: '413001' };
      const updatedDb = addSecurityLog(
        { ...db, city_masters: [cityObj, ...(db.city_masters || [])] },
        'ADD_CITY_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'CITY_ADDED 🛡️'
      );
      updateDB(updatedDb);
      setQuickReq({ ...quickReq, dest_city: newCity.trim() });
    }
  };

  const handleQuickAddCompany = () => {
    const newComp = prompt('🏢 Enter New Company Unit / Plant Name:');
    if (newComp && newComp.trim()) {
      const compObj = { id: `comp_${Date.now()}`, name: newComp.trim(), code: (newComp || "").trim().slice(0, 5).toUpperCase(), address: 'MIDC Industrial Area' };
      const updatedDb = addSecurityLog(
        { ...db, company_masters: [compObj, ...(db.company_masters || [])] },
        'ADD_COMPANY_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'COMPANY_ADDED 🛡️'
      );
      updateDB(updatedDb);
      setQuickReq({ ...quickReq, company_unit: newComp.trim() });
    }
  };

  const handleQuickAddProduct = () => {
    const newProd = prompt('📦 Enter New Cargo / Commodity Product Name:');
    if (newProd && newProd.trim()) {
      const prodObj = { id: `prod_${Date.now()}`, name: newProd.trim(), code: `PRD-${Date.now().toString().slice(-4)}` };
      const updatedDb = addSecurityLog(
        { ...db, product_masters: [prodObj, ...(db.product_masters || [])] },
        'ADD_PRODUCT_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'PRODUCT_ADDED 🛡️'
      );
      updateDB(updatedDb);
      setQuickReq({ ...quickReq, material_type: newProd.trim() });
    }
  };

  // Statistics calculation
  const totalRequirements = (db?.rate_requests || []).length;
  const totalSubmissions = (db?.rate_submissions || []).length;
  const totalTransporters = (db?.transporters || []).length;
  const totalAllocatedValue = (db?.allocations || []).reduce((acc, curr) => acc + (curr?.total_contract_value || 0), 0);

  // 🛑 TOGGLE TRANSPORTER ACCOUNT STATUS (ACTIVE / INACTIVE SUSPENSION)
  const toggleTransporterStatus = (transporterId) => {
    const transporter = (db?.transporters || []).find((t) => t.id === transporterId);
    if (!transporter) return;

    const newStatus = transporter.status === 'Active' ? 'Inactive' : 'Active';
    const updatedTransporters = (db?.transporters || []).map((t) =>
      t.id === transporterId ? { ...t, status: newStatus } : t
    );

    const updatedDb = addSecurityLog(
      { ...db, transporters: updatedTransporters },
      `ADMIN_${(newStatus || "").toUpperCase()}_TRANSPORTER (${transporter.code} - ${transporter.company_name})`,
      currentUser?.username || 'admin',
      'admin',
      newStatus === 'Inactive' ? 'ACCOUNT_SUSPENDED 🛑' : 'ACCOUNT_ACTIVATED 🛡️'
    );

    updateDB(updatedDb);
  };

  // ✏️ EDIT TRANSPORTER ACCOUNT DETAILS HANDLER
  const handleEditTransporter = (transporter) => {
    const updatedName = window.prompt('Edit Transporter Company Name:', transporter.company_name);
    if (updatedName === null || !updatedName.trim()) return;

    const updatedPerson = window.prompt('Edit Contact Person Name:', transporter.contact_person || '');
    const updatedMobile = window.prompt('Edit Mobile / Phone Number:', transporter.mobile || '');
    const updatedEmail = window.prompt('Edit Email Address:', transporter.email || '');
    const updatedGst = window.prompt('Edit GST / PAN Number:', transporter.gst_pan || '');

    const updatedTransporters = (db?.transporters || []).map((t) => {
      if (t.id === transporter.id) {
        return {
          ...t,
          company_name: updatedName.trim(),
          contact_person: updatedPerson !== null ? updatedPerson.trim() : t.contact_person,
          mobile: updatedMobile !== null ? updatedMobile.trim() : t.mobile,
          email: updatedEmail !== null ? updatedEmail.trim() : t.email,
          gst_pan: updatedGst !== null ? updatedGst.trim() : t.gst_pan
        };
      }
      return t;
    });

    const updatedDb = addSecurityLog(
      { ...db, transporters: updatedTransporters },
      `ADMIN_EDITED_TRANSPORTER (${transporter.code} - ${updatedName})`,
      currentUser?.username || 'admin',
      'admin',
      'TRANSPORTER_EDITED ✏️'
    );

    updateDB(updatedDb);
    setArchiveNotice(`✏️ Transporter "${updatedName}" (${transporter.code}) details updated successfully!`);
    setTimeout(() => setArchiveNotice(''), 4000);
  };

  // 🔑 Open Reset Password Modal
  const openResetPasswordModal = (transporter) => {
    setResetPassTransporter(transporter);
    setNewTransporterPassword(''); // Starts blank so admin can type or auto-generate
  };

  // Auto-Generate Strong Password
  const handleAutoGeneratePassword = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000);
    setNewTransporterPassword(`Shalimar#${randomPin}`);
  };

  // 🔑 Submit Reset Password
  const handleSaveResetPassword = (e) => {
    e.preventDefault();
    if (!resetPassTransporter) return;

    const userAcc = (db?.users || []).find((u) => u.transporter_id === resetPassTransporter.id || u.username === resetPassTransporter.username);
    if (!userAcc) {
      alert(`User account not found for transporter ${resetPassTransporter.company_name}`);
      return;
    }

    const updatedUsers = (db?.users || []).map((u) =>
      u.id === userAcc.id ? { ...u, password: newTransporterPassword } : u
    );

    const updatedDb = addSecurityLog(
      { ...db, users: updatedUsers },
      `ADMIN_RESET_TRANSPORTER_PASSWORD (${userAcc.username})`,
      currentUser?.username || 'admin',
      'admin',
      'PASSWORD_CHANGED 🔑'
    );

    updateDB(updatedDb);
    setArchiveNotice(`🔑 Success! Password for ${resetPassTransporter.company_name} (${userAcc.username}) updated to: "${newTransporterPassword}"`);
    setResetPassTransporter(null);

    setTimeout(() => setArchiveNotice(''), 6000);
  };



  // 🗑️ DELETE MISTAKEN / WRONG REQUIREMENT HANDLER
  const handleDeleteRequirement = (req) => {
    if (window.confirm(`Are you sure you want to delete Requirement "${req.request_no} - ${req.title}"?\n\nThis will also remove any submitted rate quotes for this requirement.`)) {
      const updatedRequests = db.rate_requests.filter((r) => r.id !== req.id);
      const updatedSubmissions = db.rate_submissions.filter((s) => s.rate_request_id !== req.id);
      const updatedAllocations = db.allocations.filter((a) => a.rate_request_id !== req.id);

      updateDB({
        ...db,
        rate_requests: updatedRequests,
        rate_submissions: updatedSubmissions,
        allocations: updatedAllocations
      });

      setArchiveNotice(`🗑️ Requirement ${req.request_no} deleted successfully!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    }
  };

  // 📦 1-CLICK AUTO-ARCHIVE & STORAGE PURGE ENGINE ⭐
  const handleAutoArchiveData = () => {
    if (!window.confirm('📦 Confirm 1-Click Auto-Archive?\n\nThis will download all completed contracts, dispatches & awarded bids into a Excel/CSV backup file and instantly FREE UP 100% database storage for new requests!')) {
      return;
    }

    // 1. Generate CSV Backup File Content
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'RECORD_TYPE,ID,REFERENCE_NO,CONTRACT_TITLE,AGREED_RATE_PER_MT,TOTAL_QUANTITY_MT,STATUS,CREATED_DATE\n';

    db.contracts.forEach((c) => {
      const alloc = db.allocations.find((a) => a.id === c.allocation_id);
      const req = alloc ? db.rate_requests.find((r) => r.id === alloc.rate_request_id) : null;
      csvContent += `CONTRACT,${c.contract_number},${c.erp_po_number},"${req?.title || 'Contract'}",${alloc?.agreed_rate || 0},${alloc?.allocated_qty || 0},${c.payment_status},${c.created_at}\n`;
    });

    db.truck_dispatches.forEach((d) => {
      csvContent += `TRUCK_DISPATCH,${d.id},${d.lr_number},"${d.truck_number}",0,${d.dispatched_qty},${d.status},${d.dispatched_at}\n`;
    });

    db.rate_submissions.forEach((s) => {
      const req = db.rate_requests.find((r) => r.id === s.rate_request_id);
      csvContent += `RATE_BID,${s.id},${req?.request_no || 'REQ'},"${req?.title || 'Bid'}",${s.rate_per_unit},0,${s.status},${s.submitted_at}\n`;
    });

    // 2. Trigger Browser File Download (Excel / CSV)
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Shalimar_Logistics_Archived_Data_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 3. Purge Closed & Awarded Items to Make Database 100% Fresh & Clean!
    const activeRequests = (db.rate_requests || []).filter((r) => r.status === 'Open');

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: activeRequests,
        rate_submissions: (db.rate_submissions || []).filter((s) => activeRequests.some((r) => r.id === s.rate_request_id)),
        allocations: [],
        truck_dispatches: [],
        contracts: []
      },
      'AUTO_ARCHIVE_DATA',
      currentUser?.username || 'admin',
      'admin',
      'DATA_PURGED_SUCCESSFULLY 📦'
    );

    updateDB(updatedDb);
    setArchiveNotice(
      `📦 1-Click Auto-Archive Complete! Completed data downloaded as CSV backup file. Database storage is now 100% Fresh & Free!`
    );

    setTimeout(() => setArchiveNotice(''), 6000);
  };

  // 📊 Calculate Top Summary KPI Metrics
  const summaryRequirementsCount = (db.rate_requests || []).length;
  const summarySubmissionsCount = (db.rate_submissions || []).length;
  const summaryTransportersCount = (db.transporters || []).length;

  const summaryTotalContractValue = (db.contracts || []).reduce((acc, c) => {
    return acc + (parseFloat(c.total_contract_value) || 0);
  }, 0) || (db.allocations || []).reduce((acc, a) => {
    const qty = parseFloat(a.allocated_qty) || 0;
    const rate = parseFloat(a.agreed_rate) || 0;
    return acc + Math.round(qty * rate * 1.05);
  }, 0);

  return (
    <div>
      {/* Top Admin Summary Stats - Ultra-Attractive Glowing KPI Cards 💎 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '18px', marginBottom: '28px' }}>
        {/* CARD 1: RATE REQUESTS */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.36), 0 0 12px 0 rgba(56, 189, 248, 0.15)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
            padding: '14px',
            borderRadius: '14px',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Layers size={26} color="#ffffff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>RATE REQUESTS</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' }}>
                ● LIVE
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {summaryRequirementsCount} <span style={{ fontSize: '0.9rem', color: '#38bdf8', fontWeight: '700' }}>Active</span>
            </div>
          </div>
        </div>

        {/* CARD 2: SUBMITTED BIDS */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.36), 0 0 12px 0 rgba(52, 211, 153, 0.15)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
            padding: '14px',
            borderRadius: '14px',
            boxShadow: '0 0 15px rgba(52, 211, 153, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <TrendingDown size={26} color="#ffffff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>SUBMITTED BIDS</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' }}>
                ⚡ QUOTES
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {summarySubmissionsCount} <span style={{ fontSize: '0.9rem', color: '#34d399', fontWeight: '700' }}>Offers</span>
            </div>
          </div>
        </div>

        {/* CARD 3: REGISTERED TRANSPORTERS */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(15, 23, 42, 0.6) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.36), 0 0 12px 0 rgba(245, 158, 11, 0.15)',
            borderRadius: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, #d97706 0%, #fbbf24 100%)',
            padding: '14px',
            borderRadius: '14px',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={26} color="#ffffff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '800', letterSpacing: '0.05em' }}>TRANSPORTERS</span>
              <span style={{ fontSize: '0.65rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '1px 6px', borderRadius: '10px', fontWeight: '800' }}>
                🛡️ VERIFIED
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.02em' }}>
              {summaryTransportersCount} <span style={{ fontSize: '0.9rem', color: '#fbbf24', fontWeight: '700' }}>Vendors</span>
            </div>
          </div>
        </div>
      </div>

      {archiveNotice && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          color: '#34d399',
          fontSize: '0.92rem',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={22} />
          {archiveNotice}
        </div>
      )}

      {/* Main Tab Navigation & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => {
              setActiveTab('requirements');
              setSelectedRequestForComparison(null);
            }}
            className="btn"
            style={{
              background: (activeTab === 'requirements' || selectedRequestForComparison)
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: '#ffffff',
              border: (activeTab === 'requirements' || selectedRequestForComparison)
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: (activeTab === 'requirements' || selectedRequestForComparison)
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: (activeTab === 'requirements' || selectedRequestForComparison) ? '900' : '700',
              transform: (activeTab === 'requirements' || selectedRequestForComparison) ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer'
            }}
          >
            <Layers size={17} /> {selectedRequestForComparison ? `🔍 Comparing Rates: ${selectedRequestForComparison.request_no}` : 'Rate Requests & Comparison'}
          </button>

          <button
            onClick={() => {
              setSelectedRequestForComparison(null);
              setActiveTab('contracts');
            }}
            className="btn"
            style={{
              background: (activeTab === 'contracts' && !selectedRequestForComparison)
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: (activeTab === 'contracts' && !selectedRequestForComparison) ? '#ffffff' : 'var(--text-sub)',
              border: (activeTab === 'contracts' && !selectedRequestForComparison)
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: (activeTab === 'contracts' && !selectedRequestForComparison)
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: (activeTab === 'contracts' && !selectedRequestForComparison) ? '900' : '700',
              transform: (activeTab === 'contracts' && !selectedRequestForComparison) ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer'
            }}
          >
            <FileText size={17} /> Awarded Contracts & PO Settlement
          </button>

          <button
            onClick={() => {
              setSelectedRequestForComparison(null);
              setActiveTab('title_masters');
            }}
            className="btn"
            style={{
              background: ((activeTab === 'title_masters' || activeTab === 'transporters') && !selectedRequestForComparison)
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: ((activeTab === 'title_masters' || activeTab === 'transporters') && !selectedRequestForComparison) ? '#ffffff' : 'var(--text-sub)',
              border: ((activeTab === 'title_masters' || activeTab === 'transporters') && !selectedRequestForComparison)
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: ((activeTab === 'title_masters' || activeTab === 'transporters') && !selectedRequestForComparison)
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: ((activeTab === 'title_masters' || activeTab === 'transporters') && !selectedRequestForComparison) ? '900' : '700',
              transform: ((activeTab === 'title_masters' || activeTab === 'transporters') && !selectedRequestForComparison) ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer'
            }}
          >
            <Bookmark size={17} /> 📑 Master Directories
          </button>

          <button
            onClick={() => {
              setSelectedRequestForComparison(null);
              setActiveTab('reports');
            }}
            className="btn"
            style={{
              background: (activeTab === 'reports' && !selectedRequestForComparison)
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: (activeTab === 'reports' && !selectedRequestForComparison) ? '#ffffff' : 'var(--text-sub)',
              border: (activeTab === 'reports' && !selectedRequestForComparison)
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: (activeTab === 'reports' && !selectedRequestForComparison)
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: (activeTab === 'reports' && !selectedRequestForComparison) ? '900' : '700',
              transform: (activeTab === 'reports' && !selectedRequestForComparison) ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Activity size={17} /> 📊 Bidding & Approval Reports
          </button>

          <button
            onClick={() => {
              setSelectedRequestForComparison(null);
              setActiveTab('db_backup');
            }}
            className="btn"
            style={{
              background: (activeTab === 'db_backup' && !selectedRequestForComparison)
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: (activeTab === 'db_backup' && !selectedRequestForComparison) ? '#ffffff' : 'var(--text-sub)',
              border: (activeTab === 'db_backup' && !selectedRequestForComparison)
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: (activeTab === 'db_backup' && !selectedRequestForComparison)
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: (activeTab === 'db_backup' && !selectedRequestForComparison) ? '900' : '700',
              transform: (activeTab === 'db_backup' && !selectedRequestForComparison) ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Database size={17} /> 🗄️ System Backup & Restore
          </button>
      </div>
      </div>

      {/* VIEW 1: Rate Comparison Sub-View */}
      {selectedRequestForComparison ? (
        <div>
          <button
            onClick={() => setSelectedRequestForComparison(null)}
            className="btn btn-secondary"
            style={{ marginBottom: '16px', fontSize: '0.85rem' }}
          >
            ← Back to All Requirements
          </button>
          <RateComparisonView
            rateRequest={selectedRequestForComparison}
            onBack={() => setSelectedRequestForComparison(null)}
          />
        </div>
      ) : (
        <>
          {/* TAB 1: Rate Requests Table */}
          {activeTab === 'requirements' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              
              {/* ⚡ RATE REQUEST BULK MULTI-INDENT COMMAND CENTER (UP TO 50 AT ONCE) ⚡ */}
              <div className="glass-panel-glow" style={{
                borderRadius: '24px',
                padding: '26px 30px',
                marginBottom: '36px'
              }}>
                {/* Header & Status Indicator Bar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '12px', letterSpacing: '-0.01em' }}>
                    <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)', padding: '10px 14px', borderRadius: '12px', boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}>
                      <Sparkles size={22} color="#ffffff" />
                    </div>
                    <div>
                      <span style={{ fontWeight: '900', color: 'var(--text-main)' }}>
                        ⚡ Rate Request (Batch Bulk Creator - Up to 50)
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '2px' }}>
                        Create & broadcast up to 50 active freight indents in 1-Click!
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.82rem', background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '6px 14px', borderRadius: '20px', fontWeight: '800' }}>
                      🚀 {bulkReqRows.length} / 50 Active Rows
                    </span>
                  </div>
                </div>

                {/* 📍 HIGH-TECH MASTER PICKUP CONTROL HUB ⚡ */}
                <div className="glass-panel-subtle" style={{
                  borderRadius: '16px',
                  padding: '16px 22px',
                  marginBottom: '22px'
                }}>
                  {/* Master Pickup Origin */}
                  <div style={{ background: 'rgba(2, 132, 199, 0.1)', border: '1px solid #0284c7', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: '#0284c7', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MapPin size={22} color="#ffffff" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.92rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          📍 MASTER PICKUP ORIGIN (APPLIES TO ALL 50 ROWS)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          Set default pickup location here to apply to all 50 bulk rows below ⬇️
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: 1, maxWidth: '520px' }}>
                      <select
                        className="form-control"
                        value={masterPickupCity}
                        onChange={(e) => handleMasterPickupChange(e.target.value)}
                        style={{
                          fontSize: '0.9rem',
                          height: '44px',
                          border: '1.5px solid #0284c7',
                          color: 'var(--text-main)',
                          fontWeight: '800',
                          borderRadius: '8px'
                        }}
                      >
                        {(() => {
                          const optionsList = Array.from(
                            new Set([
                              ...(db.company_masters || []).map((c) => c.pickup_location_name || c.name || c.city).filter(Boolean),
                              ...(db.title_masters || []).map((tm) => tm.origin_city || tm.title).filter(Boolean),
                              ...(db.city_masters || []).map((c) => c.city).filter(Boolean)
                            ])
                          );
                          if (optionsList.length === 0) {
                            return <option value="">-- No Pickup Origin in Master (Add in Master Directory) --</option>;
                          }
                          return [
                            <option key="master_orig_default" value="">-- Select Pickup Origin (From Master) --</option>,
                            ...optionsList.map((cityName, i) => (
                              <option key={`master_orig_${i}`} value={cityName}>{cityName}</option>
                            ))
                          ];
                        })()}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bulk Action Buttons Toolbar */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '22px' }}>
                  <button
                    type="button"
                    onClick={handleAddBulkRow}
                    className="btn"
                    style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', border: '1px solid #0284c7', padding: '8px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '10px' }}
                    title="Add another Rate Request row (Up to 50)"
                  >
                    <Plus size={15} /> ➕ Add Row ({bulkReqRows.length}/50)
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateLastRow}
                    className="btn"
                    style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#9333ea', border: '1px solid #9333ea', padding: '8px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '10px' }}
                    title="Duplicate parameters from last row"
                  >
                    📋 Duplicate Row
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillSample5Rows(10)}
                    className="btn"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid #d97706', padding: '8px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '10px' }}
                    title="Fill 10 Sample Rate Request rows instantly"
                  >
                    ⚡ 10 Sample Rows
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFillSample5Rows(50)}
                    className="btn"
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: '1px solid #059669', padding: '8px 18px', fontSize: '0.85rem', fontWeight: '900', borderRadius: '10px' }}
                    title="1-Click Fill 50 Rate Request Rows (Max Batch)"
                  >
                    🚀 ⚡ 50 Max Rows (1-Click)
                  </button>
                </div>

                <form onSubmit={handleBulkBroadcastRequirements}>
                  {/* Rows Grid List (HIGH-TECH GLASS CARDS) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                    {bulkReqRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="glass-panel-subtle"
                        style={{
                          borderLeft: '4px solid #0284c7',
                          borderRadius: '14px',
                          padding: '16px 18px',
                          display: 'grid',
                          gridTemplateColumns: '1fr 2fr 2fr 1.3fr 0.9fr 1.1fr auto',
                          gap: '12px',
                          alignItems: 'end',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        {/* 1. Ref / SR No. (Locked) */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#0284c7', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            🔒 #{idx + 1} SR NO. (AUTO)
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            value={row.title}
                            readOnly
                            tabIndex="-1"
                            style={{ fontSize: '0.85rem', height: '42px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: '1px solid #0284c7', color: '#ffffff', fontWeight: '900', cursor: 'not-allowed', borderRadius: '8px' }}
                          />
                        </div>

                        {/* 2. Drop Location */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#d97706', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            🎯 DROP LOCATION
                          </label>
                          <select
                            className="form-control"
                            value={row.dest_city}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'dest_city', e.target.value)}
                            style={{ fontSize: '0.85rem', height: '42px', border: '1px solid rgba(245, 158, 11, 0.6)', color: 'var(--text-main)', borderRadius: '8px', fontWeight: '700' }}
                          >
                            {(() => {
                              const dropList = Array.from(
                                new Set([
                                  ...(db.company_masters || []).map((c) => c.drop_location_name || c.name || c.city).filter(Boolean),
                                  ...(db.title_masters || []).map((tm) => tm.dest_city || tm.title).filter(Boolean),
                                  ...(db.city_masters || []).map((c) => c.city).filter(Boolean)
                                ])
                              );
                              if (dropList.length === 0) {
                                return <option value="">-- No Drop Location in Master (Add in Master Directory) --</option>;
                              }
                              return [
                                <option key="dest_default" value="">-- Select Drop Location (From Master) --</option>,
                                ...dropList.map((destName, i) => (
                                  <option key={`dest_${i}`} value={destName}>{destName}</option>
                                ))
                              ];
                            })()}
                          </select>
                        </div>

                        {/* 3. PRODUCT NAME DROPDOWN */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#38bdf8', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            📦 PRODUCT NAME
                          </label>
                          <select
                            className="form-control"
                            value={row.material_type}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'material_type', e.target.value)}
                            style={{ fontSize: '0.82rem', height: '42px', border: '1.5px solid #38bdf8', color: 'var(--text-main)', borderRadius: '8px', fontWeight: '800' }}
                          >
                            {(() => {
                              const prods = db.product_masters || [];
                              if (prods.length === 0) {
                                return <option value="">-- No Product in Master (Add in Master Directory) --</option>;
                              }
                              return [
                                <option key="prod_default" value="">-- Select Product Name (From Master) --</option>,
                                ...prods.map((prod, i) => (
                                  <option key={`prod_${prod.id || i}`} value={prod.name}>
                                    📦 {prod.name}
                                  </option>
                                ))
                              ];
                            })()}
                          </select>
                        </div>

                        {/* 4. HSN CODE FIELD */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#10b981', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            🏷️ HSN CODE
                          </label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Auto from Master"
                            value={row.hsn_code || (db.product_masters?.find((p) => p.name === row.material_type)?.hsn_code) || ''}
                            readOnly
                            tabIndex="-1"
                            title="🔒 HSN Code is auto-selected from Product Master and locked"
                            style={{ fontSize: '0.85rem', height: '42px', background: 'rgba(15, 23, 42, 0.7)', border: '1.5px solid #10b981', color: '#34d399', borderRadius: '8px', fontWeight: '800', fontFamily: 'monospace', cursor: 'not-allowed' }}
                          />
                        </div>

                        {/* 5. Qty (MT) */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#c084fc', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            ⚖️ QTY (MT)
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            className="form-control"
                            value={row.required_qty}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'required_qty', e.target.value)}
                            required
                            style={{ fontSize: '0.85rem', height: '42px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(192, 132, 252, 0.4)', color: '#ffffff', fontWeight: '800', borderRadius: '8px' }}
                          />
                        </div>

                        {/* 6. Target Date */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#38bdf8', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            📅 TARGET DATE
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            min={todayStr}
                            value={row.target_date}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'target_date', e.target.value)}
                            required
                            style={{ fontSize: '0.85rem', height: '42px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#ffffff', borderRadius: '8px' }}
                          />
                        </div>

                        {/* 7. Remove Row Button */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBulkRow(row.id)}
                            className="btn btn-danger"
                            style={{ padding: '9px 12px', height: '42px', borderRadius: '8px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.2)' }}
                            disabled={bulkReqRows.length <= 1}
                            title="Remove row"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Mass Broadcast CTA Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.12)', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={18} color="#38bdf8" /> Ready to broadcast <strong style={{ color: '#ffffff', fontSize: '1rem' }}>{bulkReqRows.length} Freight Requirements</strong> in 1-Click to Transporters
                    </div>
                    <button
                      type="submit"
                      className="btn"
                      style={{
                        background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                        color: '#ffffff',
                        boxShadow: '0 0 25px rgba(16, 185, 129, 0.6), 0 0 50px rgba(16, 185, 129, 0.3)',
                        padding: '14px 36px',
                        fontSize: '1.05rem',
                        fontWeight: '900',
                        borderRadius: '14px',
                        border: '2px solid #34d399',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        transform: 'scale(1.02)',
                        transition: 'all 0.25s ease'
                      }}
                      title="Click here to save & broadcast these filled rate requests to Transporters"
                    >
                      <Plus size={22} /> 🚀 Broadcast All {bulkReqRows.length} Rate Requests (1-Click)
                    </button>
                  </div>
                </form>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📦 Freight Transport Requirements Directory
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Filter active open indents vs awarded & completed contracts
                  </span>
                </div>

                {/* Sub-Tab Filter Switcher Bar */}
                <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '24px', border: '1px solid var(--border-color)', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setReqFilterTab('open')}
                    className={`btn ${reqFilterTab === 'open' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    🟢 Active Open Indents ({(db.rate_requests || []).filter((r) => r.status === 'Open' || !r.status).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqFilterTab('done')}
                    className={`btn ${reqFilterTab === 'done' ? 'btn-success' : 'btn-secondary'}`}
                    style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ✅ Awarded & Done ({(db.rate_requests || []).filter((r) => r.status === 'Awarded').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqFilterTab('all')}
                    className={`btn ${reqFilterTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    📂 All Indents ({(db.rate_requests || []).length})
                  </button>
                </div>
              </div>

              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Req No.</th>
                      <th>Title & Route</th>
                      <th>Cargo & Qty</th>
                      <th>Target Date</th>
                      <th>Submitted Bids</th>
                      <th>📊 Bidding & Approval Report</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredRequests = (db.rate_requests || []).filter((req) => {
                        if (reqFilterTab === 'open') return req.status === 'Open' || !req.status;
                        if (reqFilterTab === 'done') return req.status === 'Awarded';
                        return true;
                      });

                      // Group Rate Requests by Master Batch Code (e.g. SNPL/26-27/REQ-0001 or SNPL/26-27/REQ-01)
                      const groups = {};
                      filteredRequests.forEach((req) => {
                        let masterKey = req.batch_no;
                        const reqNo = req.request_no || req.title || '';
                        
                        if (!masterKey) {
                          const parts = reqNo.split('/');
                          if (parts.length >= 3) {
                            masterKey = parts.slice(0, 3).join('/'); // e.g. SNPL/26-27/REQ-0001
                          } else {
                            masterKey = reqNo;
                          }
                        }

                        if (!groups[masterKey]) {
                          groups[masterKey] = {
                            batchKey: masterKey,
                            items: []
                          };
                        }
                        groups[masterKey].items.push(req);
                      });

                      const groupedList = Object.values(groups);

                      return groupedList.map((group) => {
                        const isMultiItemBatch = group.items.length > 1;
                        const isExpanded = expandedBatches[group.batchKey] || false;

                        const totalBatchQty = group.items.reduce((acc, curr) => acc + (parseFloat(curr.required_qty) || 0), 0);
                        const allBatchBids = (db.rate_submissions || []).filter((s) => group.items.some((item) => item.id === s.rate_request_id));
                        const firstItem = group.items[0];

                        if (isMultiItemBatch) {
                          return (
                            <React.Fragment key={`batch_grp_${group.batchKey}`}>
                              {/* MASTER BATCH FOLDER ROW (SHOWN ONLY WHEN BATCH IS CLOSED) */}
                              {!isExpanded && (
                                <tr
                                  onClick={() => toggleBatchExpand(group.batchKey)}
                                  style={{
                                    background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)',
                                    borderLeft: '5px solid #38bdf8',
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease-in-out'
                                  }}
                                  title="Click anywhere on this batch row to open sub-indents"
                                >
                                  <td>
                                    <span style={{
                                      fontFamily: 'monospace',
                                      fontSize: '0.85rem',
                                      fontWeight: '900',
                                      color: '#ffffff',
                                      background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                                      padding: '5px 12px',
                                      borderRadius: '8px',
                                      boxShadow: '0 0 12px rgba(56, 189, 248, 0.4)',
                                      letterSpacing: '0.04em',
                                      display: 'inline-block'
                                    }}>
                                      {group.batchKey}
                                    </span>
                                  </td>

                                  <td>
                                    <div style={{ fontWeight: '900', color: 'var(--text-main)', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      📦 Master Batch Folder ({group.items.length} Requirements)
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                      <MapPin size={13} color="#0284c7" /> 📍 {firstItem.origin_city} ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '900', fontSize: '0.95rem', letterSpacing: '0.01em' }}>{firstItem.dest_city}</strong>
                                    </div>
                                  </td>

                                  <td>
                                    <div style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.95rem' }}>
                                      {(totalBatchQty || 0).toLocaleString()} MT Total
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                      {group.items.length} x {firstItem.required_qty} MT ({firstItem.material_type})
                                    </div>
                                  </td>

                                  <td>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{firstItem.target_date}</div>
                                  </td>

                                  <td>
                                    <div>
                                      <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>{allBatchBids.length} Total Bids</span>
                                    </div>
                                  </td>

                                  <td>
                                    {(() => {
                                      const isAwarded = group.items.every((i) => i.status === 'Awarded');
                                      const awardedAlloc = (db.allocations || []).find((a) => group.items.some((item) => item.id === a.rate_request_id));
                                      const awardedTrans = awardedAlloc ? (db.transporters || []).find((t) => t.id === awardedAlloc.transporter_id) : null;

                                      return (
                                        <div>
                                          {awardedAlloc ? (
                                            <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '900' }}>
                                              🏆 Approved: {awardedTrans?.company_name || 'Transporter'}
                                            </div>
                                          ) : allBatchBids.length > 0 ? (
                                            <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: '800' }}>
                                              📥 {allBatchBids.length} Transporter Quote(s)
                                            </div>
                                          ) : (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                              ⏳ Awaiting Quotes
                                            </div>
                                          )}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedAuditReportModal(firstItem);
                                            }}
                                            className="btn btn-secondary"
                                            style={{ padding: '3px 8px', fontSize: '0.72rem', marginTop: '4px', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px' }}
                                          >
                                            📋 Audit Log
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  <td>
                                    <span className="badge badge-open" style={{ padding: '4px 10px' }}>
                                      📦 BATCH ({group.items.length} REQS)
                                    </span>
                                  </td>

                                  <td style={{ textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleBatchExpand(group.batchKey);
                                      }}
                                      className="btn btn-primary"
                                      style={{
                                        background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                                        border: '1.5px solid #7dd3fc',
                                        padding: '8px 18px',
                                        fontSize: '0.85rem',
                                        borderRadius: '12px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
                                        transition: 'all 0.25s ease'
                                      }}
                                    >
                                      <span style={{ color: '#ffffff', fontWeight: '900' }}>
                                        📂 Open Batch ({group.items.length} Items) 🔽
                                      </span>
                                    </button>
                                  </td>
                                </tr>
                              )}

                              {/* SUB-ITEMS ACCORDION DRAWER CONTAINER (/01 to /50) */}
                              {isExpanded && (
                                <tr key={`expanded_${group.batchKey}`}>
                                  <td colSpan="7" style={{ padding: '18px 22px 28px 22px', background: 'rgba(15, 23, 42, 0.95)' }}>
                                    <div className="glass-panel-glow drawer-expanded" style={{
                                      border: '2px solid #38bdf8',
                                      borderRadius: '20px',
                                      padding: '24px 26px',
                                      boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 35px rgba(56, 189, 248, 0.3)',
                                      background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)'
                                    }}>
                                      {/* Drawer Header Toolbar */}
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1.5px solid rgba(56, 189, 248, 0.3)', paddingBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                          <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)', padding: '10px 14px', borderRadius: '14px', boxShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}>
                                            <FolderOpen size={24} color="#ffffff" />
                                          </div>
                                          <div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#ffffff', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <span>📂 BATCH FOLDER CONTENTS:</span>
                                              <span style={{ fontFamily: 'monospace', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.18)', border: '1.5px solid #38bdf8', padding: '3px 12px', borderRadius: '10px', fontSize: '0.95rem', fontWeight: '900' }}>
                                                {group.batchKey}
                                              </span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: '700', marginTop: '3px' }}>
                                              Showing all {group.items.length} sub-indents ({group.batchKey}/01 to {group.batchKey}/{group.items.length.toString().padStart(2, '0')})
                                            </div>
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '0.82rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8', padding: '6px 14px', borderRadius: '20px', fontWeight: '900' }}>
                                            📍 {firstItem?.origin_city || 'Origin'} ➔ 🎯 <strong style={{ color: '#fbbf24', fontWeight: '900' }}>{firstItem?.dest_city || 'Destination'}</strong>
                                          </span>
                                          <span style={{ fontSize: '0.82rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid #34d399', padding: '6px 14px', borderRadius: '20px', fontWeight: '900' }}>
                                            ⚖️ {(totalBatchQty || 0).toLocaleString()} MT Batch Total
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setWhatsappModalData({
                                              isOpen: true,
                                              data: {
                                                batchCode: group.batchKey,
                                                itemsCount: group.items.length,
                                                origin: firstItem?.origin_city || 'Origin',
                                                dest: firstItem?.dest_city || 'Destination',
                                                totalQty: totalBatchQty || 0,
                                                materialType: firstItem?.material_type || 'Cargo',
                                                targetDate: firstItem?.target_date || 'Target Date',
                                                companyUnit: firstItem?.company_unit || 'Shalimar Nutrients'
                                              }
                                            })}
                                            className="btn"
                                            style={{
                                              background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                                              color: '#ffffff',
                                              border: '1.5px solid #4ade80',
                                              padding: '6px 16px',
                                              fontSize: '0.82rem',
                                              borderRadius: '12px',
                                              fontWeight: '900',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              boxShadow: '0 4px 14px rgba(34, 197, 94, 0.4)'
                                            }}
                                            title="Send WhatsApp Notification Alert for this Batch to Transporters"
                                          >
                                            <MessageSquare size={15} /> 📱 WhatsApp Broadcast
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => setSelectedRequestForParticularReport(firstItem)}
                                            className="btn"
                                            style={{
                                              background: '#059669',
                                              color: '#ffffff',
                                              border: '1.5px solid #34d399',
                                              padding: '6px 16px',
                                              fontSize: '0.82rem',
                                              borderRadius: '12px',
                                              fontWeight: '900',
                                              cursor: 'pointer',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)'
                                            }}
                                            title="Generate Single Combined Comparative Report for entire Batch"
                                          >
                                            <FileText size={15} /> 📄 Batch Comparative Report ({group.batchKey})
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => toggleBatchExpand(group.batchKey)}
                                            className="btn btn-primary"
                                            style={{
                                              background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
                                              border: '1.5px solid #7dd3fc',
                                              padding: '6px 16px',
                                              fontSize: '0.82rem',
                                              borderRadius: '12px',
                                              fontWeight: '900',
                                              color: '#ffffff',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            📂 Close Batch 🔼
                                          </button>
                                        </div>
                                      </div>

                                      {/* Sub-Items Scrollable High-Tech Table */}
                                      <div style={{ maxHeight: '450px', overflowY: 'auto', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                                        <table className="custom-table" style={{ width: '100%', margin: 0 }}>
                                          <thead>
                                            <tr>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>REQUISITION CODE</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>ROUTE / LOCATION</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>CARGO & QTY</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>TARGET DATE</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>SUBMITTED QUOTES</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>📊 BID & APPROVAL REPORT</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900' }}>STATUS</th>
                                              <th style={{ color: '#38bdf8', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', textAlign: 'right' }}>ACTIONS</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(group.items || []).map((req, rIdx) => {
                                              const bids = (db.rate_submissions || []).filter((s) => s.rate_request_id === req.id);
                                              const validRates = bids.map((b) => parseFloat(b.rate_per_unit)).filter((r) => !isNaN(r));
                                              const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
                                              const displayCode = req.request_no || req.title || 'REQ';

                                              return (
                                                <tr
                                                  key={req.id || `sub_row_${rIdx}`}
                                                  style={{ background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                                                >
                                                  <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                      fontFamily: 'monospace',
                                                      fontSize: '0.88rem',
                                                      fontWeight: '900',
                                                      color: '#38bdf8',
                                                      background: 'rgba(56, 189, 248, 0.15)',
                                                      padding: '4px 12px',
                                                      borderRadius: '8px',
                                                      border: '1px solid #38bdf8',
                                                      letterSpacing: '0.04em'
                                                    }}>
                                                      {displayCode}
                                                    </span>
                                                  </td>

                                                  <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '800', color: '#ffffff', fontSize: '0.88rem' }}>
                                                      {req.company_unit || 'Shalimar Nutrients'}
                                                    </div>
                                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                      <MapPin size={13} color="#0284c7" /> {req.origin_city} ➔ 🎯 <strong style={{ color: '#fbbf24', fontWeight: '900' }}>{req.dest_city}</strong>
                                                    </div>
                                                  </td>

                                                  <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.9rem' }}>
                                                      {req.required_qty ? Number(req.required_qty).toLocaleString() : 0} {req.unit || 'MT'}
                                                    </div>
                                                    <div style={{ fontSize: '0.76rem', color: '#cbd5e1', fontWeight: '600' }}>{req.material_type || 'Cargo'}</div>
                                                  </td>

                                                  <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: '700' }}>{req.target_date || '-'}</div>
                                                  </td>

                                                  <td style={{ padding: '12px 16px' }}>
                                                    <div>
                                                      <span style={{ fontWeight: '900', color: '#ffffff', fontSize: '0.88rem' }}>{bids.length} Transporter Bids</span>
                                                      {lowestRate !== null && (
                                                        <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                          💰 Lowest L1 Quote: ₹{(lowestRate || 0).toLocaleString()}/MT
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>

                                                  <td style={{ padding: '12px 16px' }}>
                                                    {(() => {
                                                      const alloc = (db.allocations || []).find((a) => a.rate_request_id === req.id);
                                                      const transporter = alloc ? (db.transporters || []).find((t) => t.id === alloc.transporter_id) : null;

                                                      return (
                                                        <div>
                                                          {alloc ? (
                                                            <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '900' }}>
                                                              🏆 Approved: {transporter?.company_name || 'Transporter'}
                                                            </div>
                                                          ) : bids.length > 0 ? (
                                                            <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: '800' }}>
                                                              📥 {bids.length} Quote(s) Recd
                                                            </div>
                                                          ) : (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>⏳ No Quotes</div>
                                                          )}
                                                          <button
                                                            type="button"
                                                            onClick={() => setSelectedAuditReportModal(req)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '2px 8px', fontSize: '0.7rem', marginTop: '4px', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px' }}
                                                          >
                                                            📋 Audit Log
                                                          </button>
                                                        </div>
                                                      );
                                                    })()}
                                                  </td>

                                                  <td style={{ padding: '12px 16px' }}>
                                                    <span className={`badge ${req.status === 'Awarded' ? 'badge-awarded' : 'badge-open'}`}>
                                                      {req.status === 'Awarded' ? '✓ Awarded' : 'Open for Bids'}
                                                    </span>
                                                  </td>

                                                  <td style={{ textAlign: 'right', padding: '12px 16px' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                      <button
                                                        onClick={() => setSelectedRequestForComparison(req)}
                                                        className="btn btn-primary"
                                                        style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: '900', borderRadius: '8px', boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)' }}
                                                      >
                                                        <TrendingDown size={15} /> Compare Quotes ({bids.length})
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        }

                        // SINGLE REQUIREMENT ROW (non-batch)
                        const req = group.items[0];
                        const bids = (db.rate_submissions || []).filter((s) => s.rate_request_id === req.id);
                        const validRates = bids.map((b) => b.rate_per_unit);
                        const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
                        const displayCode = req.request_no || req.title;

                        return (
                          <tr key={req.id}>
                            <td>
                              <span style={{
                                fontFamily: 'monospace',
                                fontSize: '0.82rem',
                                fontWeight: '800',
                                color: '#0284c7',
                                background: 'rgba(56, 189, 248, 0.15)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                letterSpacing: '0.04em',
                                display: 'inline-block'
                              }}>
                                {displayCode}
                              </span>
                            </td>

                            <td>
                              <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{displayCode}</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={13} color="#0284c7" /> 📍 {req.origin_city} ({req.origin_pin || 'MIDC'}) ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '900', fontSize: '0.95rem', letterSpacing: '0.01em' }}>{req.dest_city} ({req.dest_pin || 'Refinery'})</strong>
                              </div>
                            </td>

                            <td>
                              <div style={{ fontWeight: '700', color: '#38bdf8' }}>{(req?.required_qty || 0).toLocaleString()} {req?.unit || "MT"}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.material_type}</div>
                            </td>

                            <td>
                              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.target_date}</div>
                            </td>

                            <td>
                              <div>
                                <span style={{ fontWeight: '700', color: '#ffffff' }}>{bids.length} Bids</span>
                                {lowestRate && (
                                  <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '700' }}>
                                    Lowest: ₹{lowestRate}/MT
                                  </div>
                                )}
                              </div>
                            </td>

                            <td>
                              {(() => {
                                const alloc = (db.allocations || []).find((a) => a.rate_request_id === req.id);
                                const transporter = alloc ? (db.transporters || []).find((t) => t.id === alloc.transporter_id) : null;

                                return (
                                  <div>
                                    {alloc ? (
                                      <div style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: '900' }}>
                                        🏆 Approved: {transporter?.company_name || 'Transporter'}
                                      </div>
                                    ) : bids.length > 0 ? (
                                      <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '800' }}>
                                        📥 {bids.length} Quote(s) Recd
                                      </div>
                                    ) : (
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>⏳ Awaiting Quotes</div>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAuditReportModal(req)}
                                      className="btn btn-secondary"
                                      style={{ padding: '3px 8px', fontSize: '0.72rem', marginTop: '4px', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px' }}
                                    >
                                      📋 Audit Trail
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>

                            <td>
                              <span className={`badge ${req.status === 'Awarded' ? 'badge-awarded' : 'badge-open'}`}>
                                {req.status === 'Awarded' ? '✓ Awarded' : 'Open for Bids'}
                              </span>
                            </td>

                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRequestForParticularReport(req)}
                                  className="btn"
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '0.8rem',
                                    fontWeight: '800',
                                    borderRadius: '8px',
                                    border: '1px solid #059669',
                                    color: '#059669',
                                    background: 'rgba(5, 150, 105, 0.1)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                  title="Print Particular Bid Audit Report & PDF"
                                >
                                  <FileText size={14} /> Particular Report
                                </button>
                                <button
                                  onClick={() => setSelectedRequestForComparison(req)}
                                  className="btn btn-primary"
                                  style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                                >
                                  <TrendingDown size={14} /> Compare Rates ({bids.length})
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}

                    {db.rate_requests.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No transport requirements created yet. Click 'Create Requirement' above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Contracts & Orders Overview */}
          {activeTab === 'contracts' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Awarded Contracts & Orders</h3>

                <button
                  onClick={handleAutoArchiveData}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', border: '1px solid #f59e0b', color: '#fbbf24' }}
                >
                  <Download size={14} /> Download Archive & Clear Storage 📦
                </button>
              </div>

              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Contract #</th>
                      <th>Route</th>
                      <th>Awarded Transporter</th>
                      <th>Allocated Qty & Rate</th>
                      <th>Total Value</th>
                      <th>PO Order Status</th>
                      <th>Payment Stage</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(db.contracts || []).map((cnt) => {
                      const alloc = (db.allocations || []).find((a) => a.id === cnt.allocation_id);
                      const req = alloc ? (db.rate_requests || []).find((r) => r.id === alloc.rate_request_id) : null;
                      const transporter = (db.transporters || []).find((t) => t.id === cnt.transporter_id);

                      return (
                        <tr key={cnt.id}>
                          <td>
                            <div style={{ fontWeight: '800', color: '#38bdf8' }}>{cnt.contract_number}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{cnt.created_at ? new Date(cnt.created_at).toLocaleDateString() : 'N/A'}</div>
                          </td>

                          <td>
                            <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                              📍 {req?.origin_city || 'Origin'} ➔ 🎯 <strong style={{ color: '#fbbf24', fontWeight: '900' }}>{req?.dest_city || 'Destination'}</strong>
                            </div>
                          </td>

                          <td>
                            <div style={{ fontWeight: '700' }}>{transporter?.company_name || 'Transporter'}</div>
                          </td>

                          <td>
                            <div style={{ fontWeight: '700' }}>{alloc?.allocated_qty || 0} MT</div>
                            <div style={{ fontSize: '0.78rem', color: '#34d399' }}>@ ₹{alloc?.agreed_rate || 0}/MT</div>
                          </td>

                          <td>
                            <div style={{ fontWeight: '800', color: 'var(--text-main)' }}>₹{alloc?.total_contract_value ? Number(alloc.total_contract_value).toLocaleString() : 0}</div>
                          </td>

                          <td>
                            <span className="badge badge-open" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Server size={12} /> {cnt.erp_po_number}
                            </span>
                          </td>

                          <td>
                            <span className="badge badge-awarded">{cnt.payment_status}</span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => setSelectedContractForModal(cnt)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                <FileText size={13} /> View Contract
                              </button>
                              <button
                                onClick={() => setSelectedContractForERP(cnt)}
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              >
                                <DollarSign size={13} /> Payment Status
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {db.contracts.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No contracts awarded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE FREIGHT BIDDING & APPROVAL REPORTS HUB */}
          {activeTab === 'reports' && (
            <div className="glass-panel" style={{ padding: '26px' }}>
              {/* Header Banner */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Activity size={24} color="#38bdf8" /> 📊 Live Transporter Bidding & Final Approval Reports
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Real-time tracking of every transporter quote, admin counter-offer, and final contract approval across the organization.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportBiddingReportCSV}
                  className="btn btn-success"
                  style={{ padding: '10px 20px', fontSize: '0.88rem', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)' }}
                >
                  <Download size={18} /> 📥 Download Report (Excel / CSV)
                </button>
              </div>

              {/* Metric Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                <div style={{ padding: '18px', borderRadius: '16px', borderLeft: '4px solid #0284c7', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(2, 132, 199, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📥 TOTAL BIDS RECEIVED</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ffffff', marginTop: '6px' }}>{(db.rate_submissions || []).length} Quotes</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Across all registered transporters</div>
                </div>

                <div style={{ padding: '18px', borderRadius: '16px', borderLeft: '4px solid #f59e0b', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>💬 COUNTER OFFERS</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ffffff', marginTop: '6px' }}>
                    {(db.rate_submissions || []).filter((s) => s.counter_rate_per_unit).length} Active
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Negotiating target freight rates</div>
                </div>

                <div style={{ padding: '18px', borderRadius: '16px', borderLeft: '4px solid #10b981', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(16, 185, 129, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>🏆 FINAL APPROVED CONTRACTS</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ffffff', marginTop: '6px' }}>{(db.allocations || []).length} Awarded</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Finalized & synced with SAP ERP</div>
                </div>

                <div style={{ padding: '18px', borderRadius: '16px', borderLeft: '4px solid #a855f7', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(168, 85, 247, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>💰 TOTAL FREIGHT VALUE</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#ffffff', marginTop: '6px' }}>
                    ₹{(db.allocations || []).reduce((acc, curr) => acc + (curr.allocated_qty * curr.agreed_rate), 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Awarded contract commitment</div>
                </div>
              </div>

              {/* Filter & Search Controls */}
              <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Search by Req No, Transporter Name, Code..."
                    value={reportSearchTerm}
                    onChange={(e) => setReportSearchTerm(e.target.value)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <select
                  className="form-control"
                  value={reportStatusFilter}
                  onChange={(e) => setReportStatusFilter(e.target.value)}
                  style={{ width: '200px', fontSize: '0.85rem' }}
                >
                  <option value="all">📂 All Bidding Statuses</option>
                  <option value="submitted">📥 Submitted Bids</option>
                  <option value="negotiating">💬 Counter Offers</option>
                  <option value="awarded">🏆 Final Approved & Awarded</option>
                </select>

                <select
                  className="form-control"
                  value={reportTransporterFilter}
                  onChange={(e) => setReportTransporterFilter(e.target.value)}
                  style={{ width: '220px', fontSize: '0.85rem' }}
                >
                  <option value="all">🚚 All Transporters</option>
                  {(db.transporters || []).map((t) => (
                    <option key={t.id} value={t.id}>{t.company_name} ({t.code})</option>
                  ))}
                </select>
              </div>

              {/* 📈 LIVE VISUAL FREIGHT ANALYTICS & BIDDING TREND CHARTS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '28px' }}>
                
                {/* CHART 1: Bidding Rate Comparison & Freight Savings Bar Chart */}
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingDown size={18} color="#34d399" /> 📊 Live Rate Reduction & Savings per Route
                      </h4>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Initial Transporter Quote vs Final Target Rate (₹/MT)</p>
                    </div>
                    <span className="badge badge-awarded" style={{ fontSize: '0.7rem' }}>⚡ Live Analytics</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {(db.rate_requests || []).slice(0, 4).map((req) => {
                      const subs = (db.rate_submissions || []).filter((s) => s.rate_request_id === req.id);
                      const initialAvgRate = subs.length > 0 
                        ? Math.round(subs.reduce((acc, curr) => acc + (parseFloat(curr.rate_per_unit) || 0), 0) / subs.length)
                        : (req.admin_counter_rate ? req.admin_counter_rate + 80 : 500);
                      const finalApprovedRate = req.admin_counter_rate || (subs[0]?.counter_rate_per_unit || Math.round(initialAvgRate * 0.9));
                      const maxBarRate = Math.max(initialAvgRate, finalApprovedRate, 600);
                      const initialPercent = Math.min(100, Math.round((initialAvgRate / maxBarRate) * 100));
                      const finalPercent = Math.min(100, Math.round((finalApprovedRate / maxBarRate) * 100));
                      const savingsPerTon = Math.max(0, initialAvgRate - finalApprovedRate);

                      return (
                        <div key={`chart_req_${req.id}`} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.78rem' }}>
                            <span style={{ fontWeight: '800', color: '#ffffff' }}>📍 {req.origin_city} ➔ {req.dest_city}</span>
                            <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '800' }}>
                              {savingsPerTon > 0 ? `🔥 Saved ₹${savingsPerTon}/MT` : '✓ Rate Locked'}
                            </span>
                          </div>

                          {/* Dual Bar Graphic */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {/* Initial Quote Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', width: '75px' }}>Initial Quote</span>
                              <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: '6px', height: '14px', overflow: 'hidden', position: 'relative' }}>
                                <div style={{ width: `${initialPercent}%`, background: 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)', height: '100%', borderRadius: '6px', transition: 'width 0.6s ease' }}></div>
                              </div>
                              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#fbbf24', width: '65px', textAlign: 'right' }}>₹{initialAvgRate}/MT</span>
                            </div>

                            {/* Final Rate Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.68rem', color: '#34d399', width: '75px', fontWeight: '700' }}>Final Target</span>
                              <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: '6px', height: '14px', overflow: 'hidden', position: 'relative' }}>
                                <div style={{ width: `${finalPercent}%`, background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', height: '100%', borderRadius: '6px', transition: 'width 0.6s ease' }}></div>
                              </div>
                              <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#34d399', width: '65px', textAlign: 'right' }}>₹{finalApprovedRate}/MT</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CHART 2: Transporter Bidding Participation & Contract Allocation Share */}
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.98rem', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={18} color="#c084fc" /> 🚛 Transporter Quote Volume & Market Share
                      </h4>
                      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Share of quotes submitted per registered logistics vendor</p>
                    </div>
                    <span className="badge badge-open" style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>Market Share</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const allSubs = db.rate_submissions || [];
                      const totalSubCount = Math.max(1, allSubs.length);

                      return (db.transporters || []).slice(0, 5).map((t, idx) => {
                        const tSubCount = allSubs.filter((s) => s.transporter_id === t.id).length;
                        const percent = Math.round((tSubCount / totalSubCount) * 100);
                        const colors = ['#38bdf8', '#34d399', '#fbbf24', '#c084fc', '#f43f5e'];
                        const barColor = colors[idx % colors.length];

                        return (
                          <div key={`trans_chart_${t.id}`} style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#ffffff' }}>{t.company_name}</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>({t.code})</span>
                              </div>
                              <span style={{ fontSize: '0.76rem', fontWeight: '800', color: barColor }}>
                                {tSubCount} Quotes ({percent}%)
                              </span>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.08)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.max(15, percent)}%`, background: barColor, height: '100%', borderRadius: '5px', transition: 'width 0.6s ease' }}></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

              </div>

              {/* Report Log Table */}
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Req / Batch Code</th>
                      <th>Transporter Account</th>
                      <th>Quoted Rate</th>
                      <th>Admin Counter</th>
                      <th>Total Value</th>
                      <th>Status</th>
                      <th>Final Approval</th>
                      <th style={{ textAlign: 'right' }}>Audit Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const filteredSubs = (db.rate_submissions || []).filter((sub) => {
                        const req = (db.rate_requests || []).find((r) => r.id === sub.rate_request_id);
                        const trans = (db.transporters || []).find((t) => t.id === sub.transporter_id);
                        const alloc = (db.allocations || []).find((a) => a.rate_request_id === sub.rate_request_id && a.transporter_id === sub.transporter_id);

                        if (reportTransporterFilter !== 'all' && sub.transporter_id !== reportTransporterFilter) return false;

                        if (reportStatusFilter === 'submitted' && sub.status !== 'Submitted') return false;
                        if (reportStatusFilter === 'negotiating' && !sub.counter_rate_per_unit) return false;
                        if (reportStatusFilter === 'awarded' && !alloc) return false;

                        if (reportSearchTerm.trim()) {
                          const term = (reportSearchTerm || "").toLowerCase();
                          const reqNo = (req?.request_no || req?.title || '').toLowerCase();
                          const transName = (trans?.company_name || '').toLowerCase();
                          const transCode = (trans?.code || '').toLowerCase();
                          return reqNo.includes(term) || transName.includes(term) || transCode.includes(term);
                        }

                        return true;
                      });

                      if (filteredSubs.length === 0) {
                        return (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                              No bidding report records match your selected filters.
                            </td>
                          </tr>
                        );
                      }

                      return filteredSubs.map((sub) => {
                        const req = (db.rate_requests || []).find((r) => r.id === sub.rate_request_id);
                        const trans = (db.transporters || []).find((t) => t.id === sub.transporter_id);
                        const alloc = (db.allocations || []).find((a) => a.rate_request_id === sub.rate_request_id && a.transporter_id === sub.transporter_id);
                        const contract = alloc ? (db.contracts || []).find((c) => c.allocation_id === alloc.id) : null;

                        return (
                          <tr key={sub.id}>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A'}
                            </td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#0284c7', background: 'rgba(56,189,248,0.12)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(56,189,248,0.3)' }}>
                                {req?.request_no || 'REQ'}
                              </span>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                                📍 {req?.origin_city} ➔ 🎯 <strong>{req?.dest_city}</strong>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.88rem' }}>{trans?.company_name || 'Transporter'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {trans?.code || 'TR'} | GST: {trans?.gst_pan || 'N/A'}</div>
                            </td>
                            <td>
                              <strong style={{ color: '#38bdf8', fontSize: '0.92rem' }}>₹{sub.rate_per_unit}/MT</strong>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>for {req?.required_qty || 0} {req?.unit || 'MT'}</div>
                            </td>
                            <td>
                              {sub.counter_rate_per_unit ? (
                                <span style={{ color: '#fbbf24', fontWeight: '900', fontSize: '0.88rem' }}>₹{sub.counter_rate_per_unit}/MT</span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>-</span>
                              )}
                            </td>
                            <td>
                              <strong style={{ color: 'var(--text-main)' }}>
                                ₹{((alloc ? alloc.allocated_qty * alloc.agreed_rate : (sub.rate_per_unit * (req?.required_qty || 0))) || 0).toLocaleString()}
                              </strong>
                            </td>
                            <td>
                              <span className={`badge ${sub.is_frozen ? 'badge-awarded' : 'badge-open'}`}>
                                {sub.status || 'Submitted'}
                              </span>
                            </td>
                            <td>
                              {alloc ? (
                                <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '900', display: 'flex', flexDirection: 'column' }}>
                                  <span>🏆 APPROVED & AWARDED</span>
                                  <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#38bdf8' }}>{contract?.contract_number || alloc.id}</span>
                                </div>
                              ) : sub.is_frozen ? (
                                <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: '800' }}>❄️ Rate Locked</span>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>⏳ Under Review</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRequestForParticularReport(req)}
                                  className="btn"
                                  style={{ padding: '5px 10px', fontSize: '0.76rem', fontWeight: '800', border: '1px solid #059669', color: '#059669', background: 'rgba(5, 150, 105, 0.1)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                  title="Print Particular Bid Audit Report"
                                >
                                  <FileText size={13} /> Particular Report
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditReportModal(req)}
                                  className="btn btn-secondary"
                                  style={{ padding: '5px 10px', fontSize: '0.76rem', border: '1px solid #38bdf8', color: '#38bdf8' }}
                                >
                                  📋 Full Trail
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: DEDICATED DATABASE BACKUP & CLOUD RESTORE CENTER */}
          {activeTab === 'db_backup' && (
            <div className="glass-panel" style={{ padding: '30px', borderRadius: '18px', background: '#ffffff', border: '1.5px solid #0284c7', boxShadow: '0 4px 25px rgba(2, 132, 199, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0284c7', background: '#ffffff', padding: '4px 12px', borderRadius: '6px', width: 'fit-content', border: '1.5px solid #0284c7', marginBottom: '8px', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.12)' }}>
                    🛡️ VERCEL / SUPABASE CLOUD DATABASE ENGINE
                  </div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', margin: '4px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Database size={24} color="#059669" /> 🗄️ System Database Backup & Cloud Restore Center
                  </h2>
                  <p style={{ fontSize: '0.88rem', color: '#475569', margin: 0 }}>
                    Manage 1-click JSON database backups, cloud restores, and system data resets for all 10 ERP tables.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleDownloadDatabaseBackup}
                    className="btn btn-success"
                    style={{
                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 22px',
                      fontSize: '0.9rem',
                      fontWeight: '900',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    <Download size={18} /> 📥 Download Full Database Backup (.json)
                  </button>

                  <label
                    className="btn btn-primary"
                    style={{
                      background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 22px',
                      fontSize: '0.9rem',
                      fontWeight: '900',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
                    }}
                  >
                    <Upload size={18} /> 📤 Restore Backup File (.json)
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleUploadDatabaseBackup}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleResetDatabaseToFreshStart}
                    className="btn btn-danger"
                    style={{
                      background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '12px 22px',
                      fontSize: '0.9rem',
                      fontWeight: '900',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    <Trash2 size={18} /> 🗑️ ⚠️ Clear All Data & Start Fresh
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONSOLIDATED ERP MASTERS DIRECTORY (TRANSPORTERS, COMPANIES, PRODUCTS, CARGO, DO SETTINGS) */}
          {(activeTab === 'title_masters' || activeTab === 'transporters') && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              
              {/* 📑 Master Directories Filter Sub-Nav Bar */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => setMasterFilterTab('all')}
                  className={`btn ${masterFilterTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '20px', fontWeight: '700' }}
                >
                  📂 All Master Directories ({ ((db?.title_masters || []).length + (db?.transporters || []).length + (db?.company_masters || []).length + (db?.product_masters || []).length) })
                </button>
                <button
                  onClick={() => setMasterFilterTab('company')}
                  className={`btn ${masterFilterTab === 'company' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '20px', fontWeight: '700' }}
                >
                  🏢 Company Units & Plants
                </button>
                <button
                  onClick={() => setMasterFilterTab('products')}
                  className={`btn ${masterFilterTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '20px', fontWeight: '700' }}
                >
                  📦 Products / Cargo
                </button>
              </div>

              {/* 🚛 2.5 TRANSPORTERS MASTER DIRECTORY */}
              {(masterFilterTab === 'all' || masterFilterTab === 'transporters') && (
                <div style={{ background: 'rgba(15, 23, 42, 0.85)', border: '2px solid #0284c7', boxShadow: '0 0 25px rgba(2, 132, 199, 0.25)', borderRadius: '16px', padding: '22px', marginBottom: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={22} color="#38bdf8" /> 🚛 Transporters & Logistics Vendors Directory
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Registered Transporter Accounts, Vendor Codes, Login Credentials & Account Status Management
                      </p>
                    </div>

                    <button onClick={() => setIsTransporterModalOpen(true)} className="btn btn-success" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <UserPlus size={15} /> Onboard New Transporter
                    </button>
                  </div>

                  {/* Transporters Table */}
                  <div className="custom-table-container">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Transporter Name</th>
                          <th>Vendor Code</th>
                          <th>Contact Person</th>
                          <th>Mobile & Email</th>
                          <th>GST / PAN</th>
                          <th>Portal Account</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(db.transporters || []).map((t) => {
                          const user = (db.users || []).find((u) => u.transporter_id === t.id || u.username === t.username);
                          return (
                            <tr key={t.id}>
                              <td>
                                <div style={{ fontWeight: '900', color: '#ffffff', fontSize: '0.92rem' }}>{t.company_name}</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>ID: {t.id}</div>
                              </td>
                              <td>
                                <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '3px 10px', borderRadius: '6px', border: '1px solid #38bdf8' }}>
                                  {t.code || t.username?.toUpperCase() || 'TR'}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.85rem' }}>{t.contact_person || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: '700' }}>📞 {t.mobile || 'N/A'}</div>
                                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>✉️ {t.email || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontFamily: 'monospace', color: '#34d399', fontSize: '0.82rem', fontWeight: '800' }}>GST: {t.gst_pan || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '800' }}>👤 {t.username}</div>
                              </td>
                              <td>
                                <span className={`badge ${t.status === 'Suspended' ? 'badge-suspended' : 'badge-awarded'}`}>
                                  {t.status || 'Active'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTransporterStatus(t)}
                                    className={`btn ${t.status === 'Suspended' || t.status === 'Deactivated' ? 'btn-success' : 'btn-secondary'}`}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.76rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      border: t.status === 'Suspended' || t.status === 'Deactivated' ? '1px solid #10b981' : '1px solid #ef4444',
                                      color: t.status === 'Suspended' || t.status === 'Deactivated' ? '#34d399' : '#f87171'
                                    }}
                                    title={t.status === 'Suspended' || t.status === 'Deactivated' ? 'Activate Transporter Account' : 'Deactivate Transporter Account'}
                                  >
                                    {t.status === 'Suspended' || t.status === 'Deactivated' ? '🟢 Activate' : '🔴 Deactivate'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setResetPassTransporter(t)}
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.76rem', border: '1px solid #38bdf8', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    title="Reset Login Password"
                                  >
                                    <Key size={13} /> Reset Pass
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {(db.transporters || []).length === 0 && (
                          <tr>
                            <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                              No transporters onboarded yet. Click 'Onboard New Transporter' above.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 🏢 3. COMPANY & PLANT UNITS MASTER DIRECTORY (ADMIN CAN ADD UNLIMITED NEW COMPANIES) */}
              {(masterFilterTab === 'all' || masterFilterTab === 'company') && (
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '16px', padding: '20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={20} color="#38bdf8" /> 🏢 Company Units & Plant Master Directory
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Company yahan se apne naye sister concerns, processing plants, aur regional hubs add karke store kar sakti hai.
                    </p>
                  </div>
                  <button onClick={() => setIsAddCompanyModalOpen(true)} className="btn btn-success" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={15} /> Add New Company Unit / Plant
                  </button>
                </div>

                {/* Company Units List Table */}
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Company / Plant Name</th>
                        <th>Proprietor / Contact Name</th>
                        <th>GSTIN & PAN No.</th>
                        <th>Mobile & Email</th>
                        <th>City, District & PIN</th>
                        <th>Registered Address</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(db.company_masters || []).map((comp) => (
                        <tr key={comp.id}>
                          <td>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{comp.name}</div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {comp.code && <span className="badge badge-open" style={{ fontSize: '0.65rem' }}>{comp.code}</span>}
                              {comp.pickup_location_name && (
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                                  📍 Pickup: {comp.pickup_location_name}
                                </span>
                              )}
                              {comp.drop_location_name && (
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>
                                  🎯 Drop: {comp.drop_location_name}
                                </span>
                              )}
                              {!comp.pickup_location_name && !comp.drop_location_name && (
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                  🏢 {comp.city || 'General Plant Unit'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>{comp.proprietor_name || 'N/A'}</td>
                          <td>
                            <div style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '0.82rem', fontWeight: '700' }}>GST: {comp.gstin || comp.gst || 'N/A'}</div>
                            {comp.pan_no && <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }}>PAN: {comp.pan_no}</div>}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>{comp.mobile_no || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comp.email || 'N/A'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>{comp.city || 'Nagpur'}, {comp.district || 'Nagpur'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '700' }}>PIN: {comp.pincode || comp.pin || '440028'} ({comp.state || 'Maharashtra'})</div>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{comp.address || comp.register_address || 'MIDC Industrial Area'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleOpenEditCompanyModal(comp)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', border: '1px solid #38bdf8', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Edit company master details"
                              >
                                <Edit size={13} /> Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

              {/* 📦 3. PRODUCT & MATERIAL MASTER DIRECTORY (ADMIN CAN ADD UNLIMITED NEW PRODUCTS) */}
              {(masterFilterTab === 'all' || masterFilterTab === 'company_product' || masterFilterTab === 'products') && (
                <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '16px', padding: '20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={20} color="#34d399" /> 📦 Product & Material Master Directory
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Company apne saare agri commodities, edible oils, raw seeds, and cargo materials yahan add karke store kar sakti hai.
                    </p>
                  </div>
                  <button onClick={() => setIsAddProductModalOpen(true)} className="btn btn-success" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={15} /> Add New Product Master
                  </button>
                </div>

                {/* Product List Table */}
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Product / Commodity Name</th>
                        <th>Category</th>
                        <th>HSN Code</th>
                        <th>Default Unit</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(db.product_masters || []).map((prod) => (
                        <tr key={prod.id}>
                          <td style={{ fontWeight: '700', color: '#ffffff' }}>{prod.name}</td>
                          <td style={{ fontSize: '0.82rem', color: '#38bdf8' }}>{prod.category}</td>
                          <td style={{ fontFamily: 'monospace', color: '#34d399', fontSize: '0.82rem' }}>{prod.hsn_code}</td>
                          <td><span className="badge badge-open">{prod.unit}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleEditProductMaster(prod)}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.78rem', border: '1px solid #38bdf8', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Edit product details"
                              >
                                <Edit size={13} /> Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              )}

            </div>
          )}

          {/* TAB 5: Security & Audit Trail Directory */}
          {activeTab === 'security' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                    <ShieldCheck size={22} color="#34d399" /> Enterprise Security Audit & Access Trail Log
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Real-time anti-hacking security log: Tracks all login authentication events, rate contract awards, password resets, account suspensions, and transporter deletions.
                  </p>
                </div>

                <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px 14px', borderRadius: '10px', border: '1px solid #10b981', color: '#34d399', fontSize: '0.82rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={15} /> XSS Shield & Brute Force Lock Active
                </div>
              </div>

              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th># Timestamp</th>
                      <th>Security Event / Action</th>
                      <th>User Account</th>
                      <th>Role</th>
                      <th>Client IP Address</th>
                      <th>Security Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(db.security_audit_logs || []).map((log, idx) => (
                      <tr key={log.id || idx}>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {log?.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '700', color: '#ffffff' }}>🛡️ {log.action}</div>
                        </td>
                        <td>
                          <span className="badge badge-open">👤 {log.username}</span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', color: log.role === 'admin' ? '#38bdf8' : '#34d399' }}>
                            {log.role?.toUpperCase()}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-sub)' }}>
                            {log.ip}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-awarded" style={{ fontSize: '0.75rem' }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {(db.security_audit_logs || []).length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                          No security events logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 🔑 ADMIN RESET TRANSPORTER PASSWORD MODAL DIALOG */}
      {resetPassTransporter && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '430px', padding: '20px 22px', boxSizing: 'border-box', border: '1.5px solid #38bdf8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Admin Reset Transporter Password</h3>
              </div>
              <button onClick={() => setResetPassTransporter(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '10px 14px', borderRadius: '10px', marginBottom: '14px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
              <div style={{ fontWeight: '800', fontSize: '0.88rem', color: 'var(--text-main)' }}>{resetPassTransporter.company_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                Account Code: <strong>{resetPassTransporter.code}</strong> | Login Username: <strong style={{ color: '#0284c7' }}>{resetPassTransporter.username}</strong>
              </div>
            </div>

            <form onSubmit={handleSaveResetPassword}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0, fontSize: '0.78rem' }}>Set New Password</label>
                  <button
                    type="button"
                    onClick={handleAutoGeneratePassword}
                    style={{ background: 'none', border: 'none', color: '#059669', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={12} /> Auto-Generate Temp Password
                  </button>
                </div>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter new password"
                  value={newTransporterPassword}
                  onChange={(e) => setNewTransporterPassword(e.target.value)}
                  required
                  style={{ fontSize: '0.9rem', fontWeight: '800', padding: '8px 12px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setResetPassTransporter(null)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem', fontWeight: '800' }}>
                  <Key size={14} /> Save New Password 🔑
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT TRANSPORT REQUIREMENT MODAL */}
      {editingReq && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit size={22} color="#38bdf8" />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>
                    Edit Transport Indent ({editingReq.request_no})
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Modify procurement parameters, route, company unit, and target dates
                  </p>
                </div>
              </div>
              <button onClick={() => setEditingReq(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditRequirement} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">SR No. / Reference Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingReq.title}
                  onChange={(e) => setEditingReq({ ...editingReq, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">📍 Pickup Origin Location</label>
                <select
                  className="form-control"
                  value={editingReq.origin_city}
                  onChange={(e) => setEditingReq({ ...editingReq, origin_city: e.target.value })}
                >
                  {editingReq.origin_city && !(db.city_masters || []).some(c => c.city === editingReq.origin_city) && (
                    <option value={editingReq.origin_city}>{editingReq.origin_city}</option>
                  )}
                  {(db.city_masters || []).map((c) => (
                    <option key={`edit_orig_${c.id}`} value={`${c.city}`}>{c.city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">🎯 Drop Destination Location</label>
                <select
                  className="form-control"
                  value={editingReq.dest_city}
                  onChange={(e) => setEditingReq({ ...editingReq, dest_city: e.target.value })}
                >
                  {editingReq.dest_city && !(db.city_masters || []).some(c => c.city === editingReq.dest_city) && (
                    <option value={editingReq.dest_city}>{editingReq.dest_city}</option>
                  )}
                  {(db.city_masters || []).map((c) => (
                    <option key={`edit_dest_${c.id}`} value={`${c.city}`}>{c.city}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">🏢 Company / Plant Location</label>
                <select
                  className="form-control"
                  value={editingReq.company_unit || ''}
                  onChange={(e) => setEditingReq({ ...editingReq, company_unit: e.target.value })}
                >
                  {editingReq.company_unit && !(db.company_masters || []).some(comp => comp.name === editingReq.company_unit) && (
                    <option value={editingReq.company_unit}>{editingReq.company_unit}</option>
                  )}
                  {(db.company_masters || []).map((comp) => (
                    <option key={`edit_comp_${comp.id}`} value={comp.name}>{comp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">📦 Cargo Product Material</label>
                <select
                  className="form-control"
                  value={editingReq.material_type}
                  onChange={(e) => setEditingReq({ ...editingReq, material_type: e.target.value })}
                >
                  {editingReq.material_type && !(db.product_masters || []).some(p => p.name === editingReq.material_type) && (
                    <option value={editingReq.material_type}>{editingReq.material_type}</option>
                  )}
                  {(db.product_masters || []).map((p) => (
                    <option key={`edit_prod_${p.id}`} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">⚖️ Required Quantity (MT)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={editingReq.required_qty}
                  onChange={(e) => setEditingReq({ ...editingReq, required_qty: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="form-label">📅 Target Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={editingReq.target_date}
                  onChange={(e) => setEditingReq({ ...editingReq, target_date: e.target.value })}
                  required
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Special Notes / Loading Instructions</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={editingReq.notes || ''}
                  onChange={(e) => setEditingReq({ ...editingReq, notes: e.target.value })}
                ></textarea>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteRequirement(editingReq);
                    setEditingReq(null);
                  }}
                  className="btn btn-danger"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Permanently delete this requirement"
                >
                  <Trash2 size={15} /> Delete Requirement
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setEditingReq(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" style={{ padding: '8px 20px' }}>
                    <CheckCircle2 size={16} /> Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT COMPANY MASTER MODAL */}
      {editingCompanyMaster && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ padding: '24px', maxWidth: '750px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Edit size={22} color="#38bdf8" />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>
                    Edit Company / Plant Unit Master
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Modify corporate 10 fields: GSTIN, PAN, Proprietor name, email, mobile, address & locations
                  </p>
                </div>
              </div>
              <button onClick={() => setEditingCompanyMaster(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditCompanyMaster} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              <div>
                <label className="form-label">1. Company / Plant Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.name}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">2. Registered Plant Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.address || editingCompanyMaster.register_address || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, address: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">3. GSTIN Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.gstin || editingCompanyMaster.gst || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, gstin: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">4. PAN Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.pan_no || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, pan_no: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">5. Proprietor / Contact Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.proprietor_name || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, proprietor_name: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">6. Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={editingCompanyMaster.email || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, email: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">7. Mobile / Phone No.</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.mobile_no || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, mobile_no: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">8. State</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.state || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, state: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">9. City</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.city || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, city: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">10. District</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.district || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, district: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">11. Postal PIN Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingCompanyMaster.pincode || editingCompanyMaster.pin || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, pincode: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">12. Pickup Origin</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Nagpur (Shalimar Plant MIDC)"
                  value={editingCompanyMaster.pickup_location_name || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, pickup_location_name: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">13. Drop Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Solapur (Shalimar Refinery)"
                  value={editingCompanyMaster.drop_location_name || ''}
                  onChange={(e) => setEditingCompanyMaster({ ...editingCompanyMaster, drop_location_name: e.target.value })}
                />
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteCompanyMaster(editingCompanyMaster);
                    setEditingCompanyMaster(null);
                  }}
                  className="btn btn-danger"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Delete company unit master"
                >
                  <Trash2 size={15} /> Delete Company Unit
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => setEditingCompanyMaster(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success" style={{ padding: '8px 20px' }}>
                    <CheckCircle2 size={16} /> Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🏢 ADD NEW COMPANY / PLANT MASTER MODAL */}
      {isAddCompanyModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '680px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <Building2 size={20} color="#38bdf8" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Add New Company Unit / Plant Master</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Create sister concern, processing unit, or regional refinery hub</p>
                </div>
              </div>
              <button onClick={() => setIsAddCompanyModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCompanyMaster}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8' }}>1. Company / Plant Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Shalimar Indore Refinery Unit"
                    value={newCompanyMaster.name}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8' }}>2. Registered Plant Address</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Plot 12 MIDC Industrial Area"
                    value={newCompanyMaster.address}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8' }}>3. GSTIN Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 27AAPCS1419M1ZV"
                    value={newCompanyMaster.gstin}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, gstin: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8' }}>4. PAN Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. AAPCS1419M"
                    value={newCompanyMaster.pan_no}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, pan_no: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">5. Proprietor / Contact Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Rajesh Sharma"
                    value={newCompanyMaster.proprietor_name}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, proprietor_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">6. Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="plant@shalimar.com"
                    value={newCompanyMaster.email}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">7. Mobile / Phone No.</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="e.g. 9823012345"
                    value={newCompanyMaster.mobile_no}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, mobile_no: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">8. State</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Maharashtra"
                    value={newCompanyMaster.state}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, state: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">9. City</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nagpur"
                    value={newCompanyMaster.city}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, city: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">10. District</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nagpur"
                    value={newCompanyMaster.district}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, district: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">11. PIN Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="440028"
                    value={newCompanyMaster.pincode}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, pincode: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">12. Pickup Origin</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Nagpur (Shalimar Plant MIDC)"
                    value={newCompanyMaster.pickup_location_name || ''}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, pickup_location_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">13. Drop Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Solapur (Shalimar Refinery)"
                    value={newCompanyMaster.drop_location_name || ''}
                    onChange={(e) => setNewCompanyMaster({ ...newCompanyMaster, drop_location_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setIsAddCompanyModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '8px 20px', fontWeight: '800' }}>
                  <Plus size={16} /> Save Company Unit to Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📦 ADD NEW CARGO PRODUCT MASTER MODAL */}
      {isAddProductModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '580px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(52, 211, 153, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <Layers size={20} color="#34d399" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Add New Cargo Product Master</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Register new agri commodity, edible oil, or raw seed material</p>
                </div>
              </div>
              <button onClick={() => setIsAddProductModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddProductMaster}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ color: '#34d399' }}>Product / Commodity Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Refined Soybean Oil (Edible)"
                  value={newProductMaster.name}
                  onChange={(e) => setNewProductMaster({ ...newProductMaster, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '12px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Product Category</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Liquid Edible Bulk"
                    value={newProductMaster.category}
                    onChange={(e) => setNewProductMaster({ ...newProductMaster, category: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">HSN / SAC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 15071000"
                    value={newProductMaster.hsn_code}
                    onChange={(e) => setNewProductMaster({ ...newProductMaster, hsn_code: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Unit</label>
                  <select
                    className="form-control"
                    value={newProductMaster.unit}
                    onChange={(e) => setNewProductMaster({ ...newProductMaster, unit: e.target.value })}
                  >
                    <option value="MT">MT (Tons)</option>
                    <option value="KL">KL (Kilo Litres)</option>
                    <option value="BAGS">BAGS</option>
                    <option value="UNITS">UNITS</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setIsAddProductModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '8px 20px', fontWeight: '800' }}>
                  <Plus size={16} /> Save Product Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📍 ADD NEW ROUTE / LOCATION MASTER MODAL */}
      {isAddRouteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '620px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <MapPin size={20} color="#38bdf8" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Add New Route & Location Master</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Create default pickup origin, drop location & route template</p>
                </div>
              </div>
              <button onClick={() => setIsAddRouteModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMasterTitle}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ color: '#38bdf8' }}>📍 Default Location City / Plant Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Nagpur (Shalimar Plant MIDC)"
                  value={newMasterOrigin}
                  onChange={(e) => setNewMasterOrigin(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setIsAddRouteModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '8px 20px', fontWeight: '800' }}>
                  <Plus size={16} /> Save Route Master
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT ROUTE & LOCATION MASTER MODAL */}
      {editingRouteMaster && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '620px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <Edit size={20} color="#38bdf8" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Edit Route & Location Master</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Update default pickup origin & template name</p>
                </div>
              </div>
              <button onClick={() => setEditingRouteMaster(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditRouteMaster}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ color: '#38bdf8' }}>📍 Default Location City / Plant Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingRouteMaster.origin_city || editingRouteMaster.dest_city || editingRouteMaster.title || ''}
                  onChange={(e) => setEditingRouteMaster({ ...editingRouteMaster, origin_city: e.target.value, dest_city: e.target.value, title: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setEditingRouteMaster(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '8px 20px', fontWeight: '800' }}>
                  <CheckCircle2 size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT TRANSPORTER VENDOR MODAL */}
      {editingTransporterMaster && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '640px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <Truck size={20} color="#38bdf8" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Edit Transporter Vendor Account</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Update vendor company name, contact person, mobile & GST details</p>
                </div>
              </div>
              <button onClick={() => setEditingTransporterMaster(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const updatedTransporters = (db.transporters || []).map((t) =>
                t.id === editingTransporterMaster.id ? editingTransporterMaster : t
              );
              const updatedDb = addSecurityLog(
                { ...db, transporters: updatedTransporters },
                `EDIT_TRANSPORTER (${editingTransporterMaster.company_name})`,
                currentUser?.username || 'admin',
                'admin',
                'TRANSPORTER_EDITED ✏️'
              );
              updateDB(updatedDb);
              setEditingTransporterMaster(null);
              setArchiveNotice(`✏️ Transporter '${editingTransporterMaster.company_name}' updated successfully!`);
              setTimeout(() => setArchiveNotice(''), 4000);
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8' }}>Transporter Company Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTransporterMaster.company_name || ''}
                    onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, company_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: '#38bdf8' }}>Vendor Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTransporterMaster.code || ''}
                    onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, code: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Contact Person</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTransporterMaster.contact_person || ''}
                    onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, contact_person: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Mobile Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTransporterMaster.mobile || ''}
                    onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, mobile: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">GST / PAN Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingTransporterMaster.gst_pan || ''}
                    onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, gst_pan: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={editingTransporterMaster.email || ''}
                    onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Registered Office Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingTransporterMaster.address || ''}
                  onChange={(e) => setEditingTransporterMaster({ ...editingTransporterMaster, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setEditingTransporterMaster(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '8px 20px', fontWeight: '800' }}>
                  <CheckCircle2 size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ EDIT PRODUCT MASTER MODAL */}
      {editingProductMaster && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '580px', padding: '28px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <Edit size={20} color="#38bdf8" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Edit Product & Commodity Master</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Update product name, HSN SAC code, category & default unit</p>
                </div>
              </div>
              <button onClick={() => setEditingProductMaster(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEditProductMaster}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" style={{ color: '#38bdf8' }}>Product / Commodity Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingProductMaster.name || ''}
                  onChange={(e) => setEditingProductMaster({ ...editingProductMaster, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">HSN / SAC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingProductMaster.hsn_code || ''}
                    onChange={(e) => setEditingProductMaster({ ...editingProductMaster, hsn_code: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Default Unit</label>
                  <select
                    className="form-control"
                    value={editingProductMaster.unit || 'MT'}
                    onChange={(e) => setEditingProductMaster({ ...editingProductMaster, unit: e.target.value })}
                  >
                    <option value="MT">MT (Tons)</option>
                    <option value="KL">KL (Kilo Litres)</option>
                    <option value="BAGS">BAGS</option>
                    <option value="UNITS">UNITS</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" onClick={() => setEditingProductMaster(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" style={{ padding: '8px 20px', fontWeight: '800' }}>
                  <CheckCircle2 size={16} /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📋 DETAILED REQUIREMENT BIDDING & APPROVAL AUDIT LOG MODAL */}
      {selectedAuditReportModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel-glow" style={{
            width: '100%',
            maxWidth: '750px',
            maxHeight: '90vh',
            overflowY: 'auto',
            borderRadius: '24px',
            border: '2px solid #38bdf8',
            padding: '28px',
            background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.98) 100%)',
            boxShadow: '0 25px 60px rgba(0,0,0,0.7), 0 0 40px rgba(56,189,248,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1.5px solid rgba(56, 189, 248, 0.3)', paddingBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>📋 FREIGHT BIDDING & APPROVAL AUDIT TRAIL</span>
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: '800', marginTop: '4px' }}>
                  Requisition Code: {selectedAuditReportModal.request_no || selectedAuditReportModal.title || 'REQ'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAuditReportModal(null)}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', borderRadius: '10px', fontWeight: '900', color: '#ef4444', border: '1px solid #ef4444' }}
              >
                ✕ Close
              </button>
            </div>

            {/* Indent Summary Card */}
            <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', padding: '16px', borderRadius: '14px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ROUTE</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>
                    📍 {selectedAuditReportModal.origin_city} ➔ 🎯 <strong style={{ color: '#fbbf24' }}>{selectedAuditReportModal.dest_city}</strong>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>CARGO & QTY</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '900', color: '#38bdf8' }}>
                    {selectedAuditReportModal.required_qty} MT ({selectedAuditReportModal.material_type || 'Cargo'})
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>TARGET DATE</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>
                    {selectedAuditReportModal.target_date || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Step-by-Step Timeline */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#ffffff', marginBottom: '14px' }}>
              🕒 Complete Bidding & Final Approval Event History
            </h4>

            {(() => {
              const bids = (db.rate_submissions || []).filter((s) => s.rate_request_id === selectedAuditReportModal.id);
              const alloc = (db.allocations || []).find((a) => a.rate_request_id === selectedAuditReportModal.id);
              const contract = alloc ? (db.contracts || []).find((c) => c.allocation_id === alloc.id) : null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Step 1: Indent Broadcasted */}
                  <div style={{ background: 'rgba(30, 41, 59, 0.6)', borderLeft: '4px solid #0284c7', padding: '12px 16px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '800' }}>STEP 1: INDENT CREATED & BROADCASTED</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                      Admin published requirement {selectedAuditReportModal.request_no} to all registered transporters.
                    </div>
                  </div>

                  {/* Step 2: Transporter Quotes */}
                  {bids.length > 0 ? (
                    bids.map((b, bIdx) => {
                      const trans = (db.transporters || []).find((t) => t.id === b.transporter_id);
                      return (
                        <div key={b.id || bIdx} style={{ background: 'rgba(30, 41, 59, 0.7)', borderLeft: '4px solid #38bdf8', padding: '12px 16px', borderRadius: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: '800' }}>
                              STEP 2.{bIdx + 1}: TRANSPORTER BID SUBMITTED
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                              {b.submitted_at ? new Date(b.submitted_at).toLocaleString() : ''}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#ffffff', marginTop: '4px' }}>
                            🚚 {trans?.company_name || 'Transporter'} quoted <span style={{ color: '#38bdf8' }}>₹{b.rate_per_unit}/MT</span>
                          </div>
                          {b.counter_rate_per_unit && (
                            <div style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: '800', marginTop: '4px' }}>
                              💬 Admin Counter Offer: ₹{b.counter_rate_per_unit}/MT
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderLeft: '4px solid #64748b', padding: '12px 16px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>⏳ No transporter quotes received yet for this indent.</div>
                    </div>
                  )}

                  {/* Step 3: Final Approval & Contract */}
                  {alloc ? (
                    <div style={{ background: 'rgba(16, 185, 129, 0.15)', borderLeft: '4px solid #10b981', border: '1.5px solid #10b981', padding: '14px 18px', borderRadius: '12px' }}>
                      <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '900' }}>🏆 STEP 3: FINAL CONTRACT APPROVED & AWARDED</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#ffffff', marginTop: '4px' }}>
                        Awarded to: { (db.transporters || []).find(t => t.id === alloc.transporter_id)?.company_name } @ <span style={{ color: '#34d399' }}>₹{alloc.agreed_rate}/MT</span> ({alloc.allocated_qty} MT)
                      </div>
                      {contract && (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px', fontFamily: 'monospace' }}>
                          ERP Contract Ref: <strong style={{ color: '#38bdf8' }}>{contract.contract_number}</strong> | SAP PO: <strong style={{ color: '#34d399' }}>{contract.erp_po_number}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(30, 41, 59, 0.4)', borderLeft: '4px solid #f59e0b', padding: '12px 16px', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.82rem', color: '#fbbf24', fontWeight: '800' }}>⏳ Status: Pending Final Approval & Contract Award</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateRequirementModal isOpen={isReqModalOpen} onClose={() => setIsReqModalOpen(false)} />
      <TransporterManagerModal isOpen={isTransporterModalOpen} onClose={() => setIsTransporterModalOpen(false)} />
      <ContractModal contract={selectedContractForModal} onClose={() => setSelectedContractForModal(null)} />
      <ERPPaymentModal contract={selectedContractForERP} onClose={() => setSelectedContractForERP(null)} />
      {selectedRequestForParticularReport && (
        <ParticularBidReportModal
          rateRequest={selectedRequestForParticularReport}
          isOpen={Boolean(selectedRequestForParticularReport)}
          onClose={() => setSelectedRequestForParticularReport(null)}
        />
      )}

      <WhatsAppBroadcastModal
        isOpen={whatsappModalData.isOpen}
        onClose={() => setWhatsappModalData({ isOpen: false, data: null })}
        batchData={whatsappModalData.data}
        transporters={db.transporters || []}
      />
    </div>
  );
};
