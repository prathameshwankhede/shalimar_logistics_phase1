// src/components/AdminDashboard.jsx
// Cleaned up Admin Dashboard with Auto-Sequential ERP Requirement Formatting, High-Visibility Badge Styling, Account Suspension, & Transporter Deletion Engine 🗑️

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { createRateRequest, createRequirement, updateRequirement, deleteRequirement } from '../api/rateRequestApi';
import { createTransporter, updateTransporterStatus, resetTransporterPassword, deleteTransporter } from '../api/transporterApi';
import { createProduct, updateProduct, deleteProduct, createCompanyUnit, updateCompanyUnit, deleteCompanyUnit } from '../api/masterDataApi';
import { downloadFullBackupApi, restoreBackupApi, downloadReportApi, clearAllDataApi } from '../api/backupApi';
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
  EyeOff,
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

  // 🧭 TAB PERSISTENCE ENGINE: Read URL Hash or LocalStorage so browser refresh NEVER redirects to Home!
  const getInitialAdminTab = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('contracts')) return 'contracts';
      if (hash.startsWith('masters') || hash.startsWith('title_masters')) return 'title_masters';
      if (hash.startsWith('backup') || hash.startsWith('db_backup')) return 'db_backup';
      if (hash.startsWith('security')) return 'security';
      if (hash.startsWith('requirements')) return 'requirements';
    }
    return localStorage.getItem('transflow_admin_active_tab') || 'requirements';
  };

  const [activeTab, setActiveTab] = useState(getInitialAdminTab);

  const [masterFilterTab, setMasterFilterTab] = useState(() => {
    return localStorage.getItem('transflow_admin_master_sub_tab') || 'all';
  });

  const [reqFilterTab, setReqFilterTab] = useState('all');

  useEffect(() => {
    localStorage.setItem('transflow_admin_active_tab', activeTab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('transflow_admin_master_sub_tab', masterFilterTab);
  }, [masterFilterTab]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Restore selected comparison request on refresh if present
  const [selectedRequestForComparison, setSelectedRequestForComparison] = useState(() => {
    const savedReqId = localStorage.getItem('transflow_admin_comparison_id');
    if (savedReqId && db?.rate_requests) {
      return db.rate_requests.find(r => String(r.id) === String(savedReqId) || String(r.request_no) === String(savedReqId)) || null;
    }
    return null;
  });

  useEffect(() => {
    if (selectedRequestForComparison) {
      localStorage.setItem('transflow_admin_comparison_id', selectedRequestForComparison.id || selectedRequestForComparison.request_no);
    } else {
      localStorage.removeItem('transflow_admin_comparison_id');
    }
  }, [selectedRequestForComparison]);
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

  // 🔒 Security Password Modal State for Database Operations
  const restoreFileInputRef = useRef(null);
  const [securityAuthModal, setSecurityAuthModal] = useState({ isOpen: false, actionTitle: '', pendingAction: null });
  const [enteredAuthPass, setEnteredAuthPass] = useState('');
  const [showAuthPass, setShowAuthPass] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState('');

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

  const handleAddCompanyMaster = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const compName = (newCompanyMaster.name || '').trim() || `Shalimar Plant Unit ${Date.now().toString().slice(-4)}`;

    const payload = {
      company_name: compName,
      registered_address: (newCompanyMaster.address || '').trim(),
      gstin: (newCompanyMaster.gstin || '').trim(),
      pan: (newCompanyMaster.pan_no || '').trim(),
      contact_name: (newCompanyMaster.proprietor_name || '').trim(),
      email: (newCompanyMaster.email || '').trim(),
      mobile: (newCompanyMaster.mobile_no || '').trim(),
      state: (newCompanyMaster.state || 'Maharashtra').trim(),
      city: (newCompanyMaster.city || '').trim(),
      district: (newCompanyMaster.district || '').trim(),
      pin_code: (newCompanyMaster.pincode || '').trim(),
      pickup_origin: (newCompanyMaster.pickup_location_name || '').trim(),
      drop_location: (newCompanyMaster.drop_location_name || '').trim()
    };

    try {
      const res = await createCompanyUnit(payload);
      if (res && res.error) {
        alert(`❌ Failed to save company unit: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const savedItem = res.data || { id: `comp_${Date.now()}`, ...payload };
      const updatedList = [savedItem, ...(db.company_masters || []).filter(c => c.id !== savedItem.id)];

      const updatedDb = addSecurityLog(
        {
          ...db,
          company_masters: updatedList,
          company_units: updatedList
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
      setArchiveNotice(`🏢 New Company / Plant Master '${compName}' saved to MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Company unit creation error:', err);
      alert(`❌ Error creating company unit: ${err.message}`);
    }
  };

  // EDIT COMPANY MASTER STATE & HANDLERS
  const handleOpenEditCompanyModal = (comp) => {
    setEditingCompanyMaster({ ...comp });
  };

  const handleSaveEditCompanyMaster = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingCompanyMaster) return;

    const compName = (editingCompanyMaster.name || editingCompanyMaster.company_name || '').trim() || 'Shalimar Company Unit';

    const payload = {
      company_name: compName,
      registered_address: (editingCompanyMaster.address || editingCompanyMaster.registered_address || '').trim(),
      gstin: (editingCompanyMaster.gstin || '').trim(),
      pan: (editingCompanyMaster.pan_no || editingCompanyMaster.pan || '').trim(),
      contact_name: (editingCompanyMaster.proprietor_name || editingCompanyMaster.contact_name || '').trim(),
      email: (editingCompanyMaster.email || '').trim(),
      mobile: (editingCompanyMaster.mobile_no || editingCompanyMaster.mobile || '').trim(),
      state: (editingCompanyMaster.state || 'Maharashtra').trim(),
      city: (editingCompanyMaster.city || '').trim(),
      district: (editingCompanyMaster.district || '').trim(),
      pin_code: (editingCompanyMaster.pincode || editingCompanyMaster.pin_code || '').trim(),
      pickup_origin: (editingCompanyMaster.pickup_location_name || editingCompanyMaster.pickup_origin || '').trim(),
      drop_location: (editingCompanyMaster.drop_location_name || editingCompanyMaster.drop_location || '').trim()
    };

    try {
      const res = await updateCompanyUnit(editingCompanyMaster.id, payload);
      if (res && res.error) {
        alert(`❌ Failed to update company unit: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedItem = res.data || { ...editingCompanyMaster, ...payload };
      const updatedCompanies = (db.company_masters || []).map((c) =>
        c.id === editingCompanyMaster.id ? updatedItem : c
      );

      const updatedDb = addSecurityLog(
        {
          ...db,
          company_masters: updatedCompanies,
          company_units: updatedCompanies
        },
        'EDIT_COMPANY_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'COMPANY_EDITED ✏️'
      );

      updateDB(updatedDb);
      setEditingCompanyMaster(null);
      setArchiveNotice(`✏️ Company / Plant Master '${compName}' updated successfully in MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Company unit update error:', err);
      alert(`❌ Error updating company unit: ${err.message}`);
    }
  };

  const handleDeleteCompanyMaster = async (comp) => {
    if (!comp || !comp.id) return;
    const compName = comp.name || comp.company_name || 'this plant unit';
    if (!window.confirm(`Are you sure you want to delete company unit/plant master '${compName}'?`)) return;

    try {
      const res = await deleteCompanyUnit(comp.id);
      if (res && res.error) {
        alert(`❌ Failed to delete company unit: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedCompanies = (db.company_masters || []).filter((c) => c.id !== comp.id);

      const updatedDb = addSecurityLog(
        {
          ...db,
          company_masters: updatedCompanies,
          company_units: updatedCompanies
        },
        'DELETE_COMPANY_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'COMPANY_DELETED 🛡️'
      );
      updateDB(updatedDb);

      if (editingCompanyMaster && editingCompanyMaster.id === comp.id) {
        setEditingCompanyMaster(null);
      }

      setArchiveNotice(`🗑️ Company / Plant Master '${compName}' deleted from MySQL.`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Company unit delete error:', err);
      alert(`❌ Error deleting company unit: ${err.message}`);
    }
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

  const handleVerifySecuritySubmit = (e) => {
    e.preventDefault();
    const masterPass = 'SunilYede@katol';
    const currentPass = currentUser?.password || 'admin123';

    if (enteredAuthPass.trim() !== masterPass && enteredAuthPass.trim() !== currentPass.trim()) {
      setAuthErrorMsg('🛑 ACCESS DENIED: Invalid Security Authorization Password!');
      const updatedDb = addSecurityLog(
        db,
        `UNAUTHORIZED_BACKUP_ACCESS_ATTEMPT (${securityAuthModal.actionTitle})`,
        currentUser?.username || 'admin',
        'admin',
        'ACCESS_DENIED 🛑'
      );
      updateDB(updatedDb);
      return;
    }

    const actionToRun = securityAuthModal.pendingAction;
    setSecurityAuthModal({ isOpen: false, actionTitle: '', pendingAction: null });
    setEnteredAuthPass('');
    setAuthErrorMsg('');
    if (actionToRun) actionToRun();
  };

  const handleDownloadDatabaseBackup = async () => {
    try {
      setArchiveNotice('⏳ Generating native MySQL database backup (.sql)...');
      const sqlText = await downloadFullBackupApi();
      if (!sqlText || typeof sqlText !== 'string') {
        alert('Backup creation failed: Server returned empty backup.');
        return;
      }

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      const filename = `shalimar_mysql_full_backup_${dateStr}_${timeStr}.sql`;

      const blob = new Blob([sqlText], { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setArchiveNotice('📥 Complete Native MySQL Database Backup (.sql) downloaded successfully!');
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Backup download error:', err);
      alert(`Backup creation failed: ${err.message}`);
    }
  };

  const processUploadBackupFile = (file) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const sqlContent = event.target?.result;
        if (!sqlContent) return;

        if (!window.confirm('⚠️ MYSQL DATABASE RESTORE CONFIRMATION:\n\nAre you sure you want to restore the system database from this .sql backup file?\n\nThis will execute native DDL & DML statements directly on your Live Hostinger MySQL Database.')) {
          return;
        }

        setArchiveNotice('⏳ Restoring native .sql backup into Hostinger MySQL database...');
        const res = await restoreBackupApi(sqlContent);

        if (res && res.success === false) {
          alert(`❌ Restore failed: ${res.message || 'Server error'}`);
          return;
        }

        alert(`🎉 SUCCESS: ${res.message || 'Database restored successfully from .sql backup!'}`);
        window.location.reload();
      } catch (err) {
        console.error('Restore error:', err);
        alert(`Failed to restore backup .sql file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleInitiateRestoreBackup = () => {
    if (restoreFileInputRef.current) {
      restoreFileInputRef.current.value = '';
      restoreFileInputRef.current.click();
    }
  };

  const handleUploadDatabaseBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processUploadBackupFile(file);
    if (e.target) e.target.value = '';
  };

  const executeResetDatabase = async () => {
    if (!window.confirm('⚠️ WARNING: CLEAR ALL SYSTEM OPERATIONAL DATA CONFIRMATION:\n\nAre you sure you want to permanently clear all operational tables from MySQL?\n\nThis will reset operational data in Hostinger MySQL. System admin account will be preserved.')) {
      return;
    }

    try {
      setArchiveNotice('⏳ Clearing operational data from MySQL...');
      const res = await clearAllDataApi();
      if (res && res.success === false) {
        alert(`❌ Clear data failed: ${res.message || 'Server error'}`);
        return;
      }

      setArchiveNotice('🎉 System Database cleared completely from MySQL! Operational tables are now 100% clean.');
      setTimeout(() => {
        setArchiveNotice('');
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Clear data error:', err);
      alert(`Clear data failed: ${err.message}`);
    }
  };

  const handleResetDatabaseToFreshStart = () => {
    setEnteredAuthPass('');
    setAuthErrorMsg('');
    setSecurityAuthModal({
      isOpen: true,
      actionTitle: 'Clear All Data & Start Fresh',
      pendingAction: executeResetDatabase
    });
  };

  const handleToggleTransporterStatus = async (transporter) => {
    const isCurrentlyActive = transporter.status !== 'Suspended' && transporter.status !== 'Deactivated' && transporter.status !== 'Inactive';
    const nextStatus = isCurrentlyActive ? 'Inactive' : 'Active';

    const confirmed = window.confirm(
      `Are you sure you want to ${isCurrentlyActive ? 'deactivate' : 'activate'} transporter '${transporter.company_name}'?`
    );
    if (!confirmed) return;

    try {
      const res = await updateTransporterStatus(transporter.id, nextStatus);
      if (res && res.error) {
        alert(`❌ Failed to update status: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedTransporters = (db.transporters || []).map((t) =>
        t.id === transporter.id ? { ...t, status: nextStatus } : t
      );

      const updatedDb = addSecurityLog(
        { ...db, transporters: updatedTransporters },
        `TOGGLE_TRANSPORTER_STATUS (${transporter.company_name} -> ${nextStatus})`,
        currentUser?.username || 'admin',
        'admin',
        `TRANSPORTER_${(nextStatus || "").toUpperCase()} 🛡️`
      );

      updateDB(updatedDb);
      setArchiveNotice(`🛡️ Transporter '${transporter.company_name}' status set to ${nextStatus}!`);
      setTimeout(() => setArchiveNotice(''), 5000);
    } catch (err) {
      console.error('Transporter status API error:', err.message);
        console.error('Transporter status API error:', err.message);
        alert(`❌ Failed to update transporter status: ${err.message}`);
      }
    };

  const handleDeleteProductMaster = async (prod) => {
    if (!prod || !prod.id) return;
    const prodName = prod.name || 'this product';
    if (!window.confirm(`Delete product master '${prodName}'?`)) return;

    try {
      const res = await deleteProduct(prod.id);
      if (res && res.error) {
        alert(`❌ Failed to delete product: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedProducts = (db.product_masters || []).filter((p) => p.id !== prod.id);

      const updatedDb = addSecurityLog(
        {
          ...db,
          product_masters: updatedProducts,
          products: updatedProducts
        },
        `DELETE_PRODUCT_MASTER (${prodName})`,
        currentUser?.username || 'admin',
        'admin',
        'PRODUCT_MASTER_DELETED 🗑️'
      );

      updateDB(updatedDb);
      if (editingProductMaster && editingProductMaster.id === prod.id) {
        setEditingProductMaster(null);
      }
      setArchiveNotice(`🗑️ Product Master '${prodName}' deleted from MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Product master delete error:', err);
      alert(`❌ Error deleting product: ${err.message}`);
    }
  };

  const handleEditProductMaster = (prod) => {
    setEditingProductMaster({ ...prod });
  };

  const handleSaveEditProductMaster = async (e) => {
    e.preventDefault();
    if (!editingProductMaster || !editingProductMaster.name.trim()) return;

    const payload = {
      name: editingProductMaster.name.trim(),
      category: (editingProductMaster.category || '').trim(),
      hsn_code: (editingProductMaster.hsn_code || '').trim(),
      unit: editingProductMaster.unit || editingProductMaster.default_unit || 'MT'
    };

    try {
      const res = await updateProduct(editingProductMaster.id, payload);
      if (res && res.error) {
        alert(`❌ Failed to update product: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedItem = res.data || { ...editingProductMaster, ...payload };
      const updatedProducts = (db.product_masters || []).map((item) =>
        item.id === editingProductMaster.id ? updatedItem : item
      );

      const updatedDb = addSecurityLog(
        { ...db, product_masters: updatedProducts, products: updatedProducts },
        `EDIT_PRODUCT_MASTER (${payload.name})`,
        currentUser?.username || 'admin',
        'admin',
        'PRODUCT_EDITED ✏️'
      );
      updateDB(updatedDb);
      setEditingProductMaster(null);
      setArchiveNotice(`✏️ Product Master '${payload.name}' updated successfully in MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Product master update error:', err);
      alert(`❌ Error updating product: ${err.message}`);
    }
  };

  // 📦 PRODUCT MASTER FORM STATE & HANDLERS
  const [newProductMaster, setNewProductMaster] = useState({
    name: '',
    category: '',
    hsn_code: '',
    unit: 'MT'
  });

  const handleAddProductMaster = async (e) => {
    e.preventDefault();
    const prodName = (newProductMaster.name || '').trim();
    if (!prodName) {
      alert('📦 Please enter Product / Commodity Name.');
      return;
    }

    const payload = {
      name: prodName,
      category: (newProductMaster.category || '').trim(),
      hsn_code: (newProductMaster.hsn_code || '').trim(),
      unit: newProductMaster.unit || 'MT'
    };

    try {
      const res = await createProduct(payload);
      if (res && res.error) {
        alert(`❌ Failed to save product: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const savedItem = res.data || { id: `prod_${Date.now()}`, ...payload };
      const updatedList = [savedItem, ...(db.product_masters || []).filter(p => p.id !== savedItem.id)];

      const updatedDb = addSecurityLog(
        {
          ...db,
          product_masters: updatedList,
          products: updatedList
        },
        'ADD_PRODUCT_MASTER',
        currentUser?.username || 'admin',
        'admin',
        'PRODUCT_ADDED 📦'
      );

      updateDB(updatedDb);
      setNewProductMaster({
        name: '',
        category: '',
        hsn_code: '',
        unit: 'MT'
      });
      setIsAddProductModalOpen(false);
      setArchiveNotice(`📦 New Product Master '${prodName}' saved to MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Product master creation error:', err);
      alert(`❌ Error creating product: ${err.message}`);
    }
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
      target_date: todayStr
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

  const handleBulkBroadcastRequirements = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (bulkReqRows.length > 50) {
      alert('🛑 MAXIMUM BATCH LIMIT EXCEEDED: A single batch broadcast can contain up to 50 cargo items.');
      return;
    }

    // 🛡️ STRICT VALIDATION: Check that all filled rows have Drop Location, Product Name, and valid Qty MT
    for (let i = 0; i < bulkReqRows.length; i++) {
      const row = bulkReqRows[i];
      const rowNum = i + 1;

      const hasDest = row.dest_city && !row.dest_city.includes('-- Select') && !row.dest_city.includes('-- No') && row.dest_city.trim().length > 0;
      if (!hasDest) {
        alert(`🛑 MISSING DROP LOCATION (Row #${rowNum}): Please select a Drop Location from the dropdown before broadcasting.`);
        return;
      }

      const hasProd = row.material_type && !row.material_type.includes('-- Select') && !row.material_type.includes('-- No') && row.material_type.trim().length > 0;
      if (!hasProd) {
        alert(`🛑 MISSING PRODUCT NAME (Row #${rowNum}): Please select a Product Name from the dropdown before broadcasting.`);
        return;
      }

      const qtyVal = parseFloat(row.required_qty);
      if (!qtyVal || isNaN(qtyVal) || qtyVal <= 0) {
        alert(`🛑 MISSING QUANTITY (Row #${rowNum}): Please enter a valid tonnage quantity in MT (e.g. 500) before broadcasting.`);
        return;
      }
    }

    const defaultOrigin = masterPickupCity || db.company_masters?.[0]?.pickup_location_name || db.city_masters?.[0]?.city || 'Nagpur (MIDC)';

    const batchItems = bulkReqRows.map((row, i) => {
      const prodVal = row.material_type.trim();
      const qtyVal = parseFloat(row.required_qty);
      const dateVal = (row.target_date || todayStr).trim() < todayStr ? todayStr : (row.target_date || todayStr).trim();
      const matchedProd = (db.product_masters || []).find(
        (p) => (p.name || '').trim().toLowerCase() === prodVal.toLowerCase()
      );
      const hsnCodeVal = matchedProd?.hsn_code || row.hsn_code || '15071000';

      return {
        product_name: prodVal,
        quantity_mt: qtyVal,
        unit: 'MT',
        pickup_origin: row.origin_city.trim() || defaultOrigin,
        drop_location: row.dest_city.trim(),
        hsn_code: hsnCodeVal,
        target_date: dateVal
      };
    });

    const batchPayload = {
      pickup_origin: batchItems[0].pickup_origin,
      drop_location: batchItems[0].drop_location,
      target_date: batchItems[0].target_date,
      items: batchItems
    };

    let createdReq = null;
    try {
      const apiRes = await createRequirement(batchPayload);
      if (apiRes && apiRes.error) {
        alert(`❌ Failed to save requirement to MySQL: ${typeof apiRes.error === 'string' ? apiRes.error : apiRes.error.message || 'Server error'}`);
        return;
      }
      createdReq = apiRes.requirement || apiRes.data;
    } catch (err) {
      console.error('Direct rate requirement REST API error:', err.message);
      alert(`❌ Error saving batch requirement: ${err.message}`);
      return;
    }

    const batchCode = createdReq.req_no;

    const newNotifications = [];
    (db.transporters || []).forEach((transporter) => {
      if (transporter.mobile) {
        const notif = sendWhatsAppAlert({
          db: db,
          recipientPhone: transporter.mobile,
          recipientName: transporter.company_name,
          title: `🚨 New Freight Bid Broadcast: ${batchCode}`,
          message: `🚨 *SHALIMAR LOGISTICS BID ALERT* 🚨\n\n📦 Batch: ${batchCode} (${batchItems.length} Items)\n📍 Route: ${createdReq.pickup_origin} ➔ ${createdReq.drop_location}\n⚖️ Volume: ${createdReq.total_quantity_mt || 0} MT\n📅 Target Date: ${createdReq.target_date}\n\nSubmit rates: ${typeof window !== 'undefined' ? window.location.origin : ''}/`
        });
        if (notif) newNotifications.push(notif);
      }
    });

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: [createdReq, ...(db.rate_requests || []).filter((r) => r.id !== createdReq.id)],
        transport_requirements: [createdReq, ...(db.transport_requirements || []).filter((r) => r.id !== createdReq.id)],
        whatsapp_notifications: [...newNotifications, ...(db.whatsapp_notifications || [])]
      },
      `BULK_CREATE_RATE_REQUIREMENTS (${batchCode})`,
      currentUser?.username || 'admin',
      'admin',
      `BATCH_BROADCAST (${batchCode} - ${batchItems.length} ITEMS) ⚡`
    );

    updateDB(updatedDb);

    // Reset Bulk Form with 1 fresh row initialized for NEXT Batch
    setBulkReqRows([createSingleReqRow(0)]);

    // 📱 Open 1-Click WhatsApp Broadcast Modal Popup
    setWhatsappModalData({
      isOpen: true,
      data: {
        batchCode,
        itemsCount: batchItems.length,
        origin: createdReq.pickup_origin,
        dest: createdReq.drop_location,
        totalQty: createdReq.total_quantity_mt,
        materialType: createdReq.product_name,
        targetDate: createdReq.target_date
      }
    });

    alert(`🎉 SUCCESS: Broadcasted Rate Requirement ${batchCode} with ${batchItems.length} Cargo Line(s)! Total Tonnage: ${createdReq.total_quantity_mt} MT.`);
    setArchiveNotice(`🚀 Batch ${batchCode} broadcasted with instant WhatsApp Alerts!`);
    setTimeout(() => setArchiveNotice(''), 5000);
  };

  // EDIT TRANSPORT REQUIREMENT STATE & HANDLER
  const [editingReq, setEditingReq] = useState(null);

  const handleOpenEditModal = (req) => {
    setEditingReq({ ...req });
  };

  const handleSaveEditRequirement = async (e) => {
    e.preventDefault();
    if (!editingReq) return;

    const payload = {
      pickup_origin: editingReq.origin_city || editingReq.pickup_origin,
      drop_location: editingReq.dest_city || editingReq.drop_location,
      product_name: editingReq.material_type || editingReq.product_name,
      quantity_mt: Number(editingReq.required_qty || editingReq.quantity_mt || 0),
      target_date: editingReq.target_date,
      status: editingReq.status || 'Active',
      approval_status: editingReq.approval_status || 'Pending'
    };

    try {
      const res = await updateRequirement(editingReq.id, payload);
      if (res && res.error) {
        alert(`❌ Failed to update requirement: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedItem = res.data || { ...editingReq, ...payload };
      const updatedRequests = (db.rate_requests || []).map((r) =>
        r.id === editingReq.id ? updatedItem : r
      );

      const updatedDb = addSecurityLog(
        {
          ...db,
          rate_requests: updatedRequests,
          transport_requirements: updatedRequests
        },
        'EDIT_RATE_REQUIREMENT',
        currentUser?.username || 'admin',
        'admin',
        'REQUIREMENT_EDITED ✏️'
      );

      updateDB(updatedDb);
      setEditingReq(null);
      setArchiveNotice(`✏️ Transport Indent '${editingReq.request_no || editingReq.req_no}' updated successfully in MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Update requirement API error:', err);
      alert(`❌ Error updating requirement: ${err.message}`);
    }
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

  // ⚡ Native O(1) Hash Map Index for Bids
  const bidIndexMap = useMemo(() => {
    const map = new Map();
    (db?.rate_submissions || []).forEach((s) => {
      if (s?.rate_request_id) {
        const key = String(s.rate_request_id);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(s);
      }
    });
    return map;
  }, [db?.rate_submissions]);

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
    const randomPin = Math.floor(1000 + Math.random() * 9000);
    setNewTransporterPassword(`Shalimar#${randomPin}`);
  };

  // Auto-Generate Strong Password
  const handleAutoGeneratePassword = () => {
    const randomPin = Math.floor(1000 + Math.random() * 9000);
    setNewTransporterPassword(`Shalimar#${randomPin}`);
  };

  // 🔑 Submit Reset Password
  const handleSaveResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPassTransporter) return;

    try {
      const res = await resetTransporterPassword(resetPassTransporter.id, newTransporterPassword);
      if (res && res.error) {
        alert(`❌ Password Reset Failed: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const tempPassUsed = res.tempPassword || newTransporterPassword;

      const userAcc = (db?.users || []).find((u) => u.transporter_id === resetPassTransporter.id || u.username === resetPassTransporter.username);
      const updatedUsers = (db?.users || []).map((u) =>
        userAcc && u.id === userAcc.id ? { ...u, password: tempPassUsed } : u
      );

      const updatedDb = addSecurityLog(
        { ...db, users: updatedUsers },
        `ADMIN_RESET_TRANSPORTER_PASSWORD (${resetPassTransporter.username || resetPassTransporter.code})`,
        currentUser?.username || 'admin',
        'admin',
        'PASSWORD_CHANGED 🔑'
      );

      updateDB(updatedDb);
      setArchiveNotice(`🔑 Success! Password for ${resetPassTransporter.company_name} updated to: "${tempPassUsed}"`);
      setResetPassTransporter(null);

      setTimeout(() => setArchiveNotice(''), 8000);
    } catch (err) {
      console.error('Password reset API error:', err.message);
      alert(`❌ Failed to reset transporter password: ${err.message}`);
    }
  };

  // 🗑️ DELETE TRANSPORTER HANDLER
  const handleDeleteTransporter = async (trans) => {
    if (!trans || !trans.id) return;
    const transName = trans.company_name || trans.code || trans.username || 'this transporter';
    if (!window.confirm(`⚠️ DELETE TRANSPORTER WARNING:\n\nAre you sure you want to delete Transporter '${transName}' (${trans.code || trans.username})?\n\nThis will remove it from the MySQL database.`)) {
      return;
    }

    try {
      const res = await deleteTransporter(trans.id);
      if (res && res.error) {
        alert(`❌ Cannot delete transporter: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedTransporters = (db.transporters || []).filter((t) => t.id !== trans.id && t.code !== trans.code);
      const updatedUsers = (db.users || []).filter((u) => u.transporter_id !== trans.id && u.username !== trans.username);

      updateDB({
        ...db,
        transporters: updatedTransporters,
        users: updatedUsers
      });

      setArchiveNotice(`🗑️ Transporter '${transName}' deleted successfully from MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Delete transporter error:', err);
      alert(`❌ Error deleting transporter: ${err.message}`);
    }
  };



  // 🗑️ DELETE MISTAKEN / WRONG REQUIREMENT HANDLER
  const handleDeleteRequirement = async (req) => {
    if (!req || !req.id) return;
    const reqNoStr = req.req_no || req.request_no || req.id;
    if (!window.confirm(`Are you sure you want to delete Requirement "${reqNoStr} - ${req.title || ''}"?\n\nThis will remove it from the database.`)) {
      return;
    }

    try {
      const res = await deleteRequirement(req.id);
      if (res && res.error) {
        alert(`❌ Cannot delete requirement: ${typeof res.error === 'string' ? res.error : res.error.message || 'Server error'}`);
        return;
      }

      const updatedRequests = (db.rate_requests || []).filter((r) => r.id !== req.id);
      const updatedSubmissions = (db.rate_submissions || []).filter((s) => s.rate_request_id !== req.id);
      const updatedAllocations = (db.allocations || []).filter((a) => a.rate_request_id !== req.id);

      updateDB({
        ...db,
        rate_requests: updatedRequests,
        transport_requirements: updatedRequests,
        rate_submissions: updatedSubmissions,
        allocations: updatedAllocations
      });

      setArchiveNotice(`🗑️ Requirement ${reqNoStr} deleted successfully from MySQL!`);
      setTimeout(() => setArchiveNotice(''), 4000);
    } catch (err) {
      console.error('Delete requirement error:', err);
      alert(`❌ Error deleting requirement: ${err.message}`);
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
        _isResetOperation: true,
        _updatedAt: Date.now() + 100000,
        rate_requests: activeRequests,
        rate_submissions: (db.rate_submissions || []).filter((s) => activeRequests.some((r) => String(r.id) === String(s.rate_request_id) || String(r.request_no) === String(s.rate_request_id))),
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
                          const companyUnits = db.company_units_plants || db.company_units || db.company_masters || [];
                          const reqs = db.transport_requirements || db.rate_requests || [];
                          const reqItems = db.transport_requirement_items || [];
                          const cities = db.city_masters || db.cities || [];

                          const optionsList = Array.from(
                            new Set([
                              ...companyUnits.flatMap((c) => [c.pickup_origin, c.pickup_location_name, c.company_name, c.name, c.city]).filter(Boolean),
                              ...reqs.flatMap((r) => [r.pickup_origin, r.origin_city]).filter(Boolean),
                              ...reqItems.map((i) => i.pickup_origin).filter(Boolean),
                              ...cities.map((c) => c.city || c.name).filter(Boolean)
                            ].map((val) => String(val).trim()).filter((val) => val.length > 0))
                          );

                          if (optionsList.length === 0) {
                            return <option value="">-- No Pickup Origin in Master (Add in Master Directory) --</option>;
                          }
                          return [
                            <option key="master_orig_default" value="">-- Select Pickup Origin (From Master) --</option>,
                            ...optionsList.map((cityName, i) => (
                              <option key={`master_orig_${i}`} value={cityName}>📍 {cityName}</option>
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
                          gridTemplateColumns: '1.2fr 3.2fr 2.5fr 1fr 1.2fr auto',
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

                        {/* 2. Drop Location Dropdown (Strict Master Only) */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#d97706', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            🎯 DROP LOCATION
                          </label>
                          <select
                            className="form-control"
                            value={row.dest_city || ''}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'dest_city', e.target.value)}
                            style={{ fontSize: '0.85rem', height: '42px', border: '1.5px solid rgba(245, 158, 11, 0.8)', color: 'var(--text-main)', borderRadius: '8px', fontWeight: '700', width: '100%', background: 'var(--bg-card)' }}
                          >
                            {(() => {
                              const companyUnits = db.company_units_plants || db.company_units || db.company_masters || [];
                              const reqs = db.transport_requirements || db.rate_requests || [];
                              const reqItems = db.transport_requirement_items || [];
                              const cities = db.city_masters || db.cities || [];

                              const dropList = Array.from(
                                new Set([
                                  ...companyUnits.flatMap((c) => [c.drop_location, c.drop_location_name, c.city, c.district]).filter(Boolean),
                                  ...reqs.flatMap((r) => [r.drop_location, r.dest_city]).filter(Boolean),
                                  ...reqItems.map((i) => i.drop_location).filter(Boolean),
                                  ...cities.map((c) => c.city || c.name).filter(Boolean)
                                ].map((val) => String(val).trim()).filter((val) => val.length > 0))
                              );

                              if (dropList.length === 0) {
                                return <option value="">-- No Location in Master Directory (Add in Master Directory) --</option>;
                              }
                              return [
                                <option key="dest_def" value="">-- Select Drop Location (From Master) --</option>,
                                ...dropList.map((destName, i) => (
                                  <option key={`dest_${i}`} value={destName}>🎯 {destName}</option>
                                ))
                              ];
                            })()}
                          </select>
                        </div>

                        {/* 3. PRODUCT NAME DROPDOWN (Strict Master Only) */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#38bdf8', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            📦 PRODUCT NAME
                          </label>
                          <select
                            className="form-control"
                            value={row.material_type || ''}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'material_type', e.target.value)}
                            style={{ fontSize: '0.82rem', height: '42px', border: '1.5px solid #38bdf8', color: 'var(--text-main)', borderRadius: '8px', fontWeight: '800', background: 'var(--bg-card)' }}
                          >
                            {(() => {
                              const prods = Array.from(
                                new Set([
                                  ...(db.products || []).map((p) => p.name).filter(Boolean),
                                  ...(db.product_masters || []).map((p) => p.name).filter(Boolean),
                                  ...(db.transport_requirement_items || []).map((i) => i.product_name).filter(Boolean),
                                  ...(db.transport_requirements || db.rate_requests || []).flatMap((r) => [r.product_name, r.material_type]).filter(Boolean)
                                ].map((val) => String(val).trim()).filter((val) => val.length > 0))
                              );

                              if (prods.length === 0) {
                                return <option value="">-- No Product in Master Directory (Add in Master Directory) --</option>;
                              }
                              return [
                                <option key="prod_def" value="">-- Select Product Name (From Master) --</option>,
                                ...prods.map((prodName, i) => (
                                  <option key={`prod_${i}`} value={prodName}>📦 {prodName}</option>
                                ))
                              ];
                            })()}
                          </select>
                        </div>

                        {/* 4. Qty (MT) */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: '900', color: '#c084fc', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            ⚖️ QTY (MT)
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty (MT)"
                            className="form-control"
                            value={row.required_qty}
                            onChange={(e) => handleUpdateBulkRow(row.id, 'required_qty', e.target.value)}
                            style={{ fontSize: '0.85rem', height: '42px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(192, 132, 252, 0.4)', color: '#ffffff', fontWeight: '800', borderRadius: '8px' }}
                          />
                        </div>

                        {/* 5. Target Date */}
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
                            style={{ fontSize: '0.85rem', height: '42px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#ffffff', borderRadius: '8px' }}
                          />
                        </div>

                        {/* 6. Remove Row Button */}
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
                      type="button"
                      onClick={(e) => handleBulkBroadcastRequirements(e)}
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
                    🟢 Active Open Indents ({(db.rate_requests || []).filter((r) => r.status !== 'Awarded' && r.status !== 'Closed').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqFilterTab('done')}
                    className={`btn ${reqFilterTab === 'done' ? 'btn-success' : 'btn-secondary'}`}
                    style={{ padding: '6px 16px', fontSize: '0.8rem', borderRadius: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    ✅ Awarded & Done ({(db.rate_requests || []).filter((r) => r.status === 'Awarded' || r.status === 'Closed').length})
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
                        if (reqFilterTab === 'open') return req.status !== 'Awarded' && req.status !== 'Closed';
                        if (reqFilterTab === 'done') return req.status === 'Awarded' || req.status === 'Closed';
                        return true;
                      });

                      return filteredRequests.map((req) => {
                        const reqNoStr = req.req_no || req.request_no || req.id;
                        const pickupStr = req.pickup_origin || req.origin_city || 'Origin';
                        const dropStr = req.drop_location || req.dest_city || 'Destination';
                        const childItems = req.items && Array.isArray(req.items) ? req.items : [];
                        const isMultiItemBatch = childItems.length > 1;
                        const totalQty = req.total_quantity_mt || req.required_qty || req.quantity_mt || 0;
                        const bidsCount = Number(req.submitted_bids_count || 0);
                        const bids = (db.rate_submissions || []).filter((s) => String(s.rate_request_id) === String(req.id) || String(s.rate_request_id) === String(reqNoStr) || String(s.requirement_id) === String(req.id) || String(s.requirement_id) === String(reqNoStr));
                        const displayBidCount = Math.max(bids.length, bidsCount);
                        const validRates = bids.map((b) => parseFloat(b.rate_per_unit || b.rate_per_mt)).filter((r) => !isNaN(r) && r > 0);
                        const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
                        const isExpanded = isMultiItemBatch && (expandedBatches[reqNoStr] || expandedBatches[req.id] || false);

                        return (
                          <React.Fragment key={req.id}>
                            {/* 1. MASTER REQUIREMENT ROW */}
                            <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid rgba(255, 255, 255, 0.08)', background: isExpanded ? 'rgba(2, 132, 199, 0.15)' : 'transparent' }}>
                              {/* 1. REQ NO. */}
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
                                  {reqNoStr}
                                </span>
                              </td>

                              {/* 2. TITLE & ROUTE */}
                              <td>
                                <div style={{ fontWeight: '900', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                  {reqNoStr}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  <MapPin size={13} color="#0284c7" /> 📍 {pickupStr} ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '900', fontSize: '0.95rem' }}>{dropStr}</strong>
                                </div>
                              </td>

                              {/* 3. CARGO & QTY */}
                              <td>
                                {isMultiItemBatch ? (
                                  <div>
                                    <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.95rem' }}>
                                      {Number(totalQty).toLocaleString()} MT Total
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                      📦 Batch ({childItems.length} Cargo Items)
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.9rem' }}>
                                      {Number(totalQty).toLocaleString()} {req.unit || 'MT'}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                                      {childItems[0]?.product_name || req.material_type || req.product_name || 'General Cargo'}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* 4. TARGET DATE */}
                              <td>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{req.target_date}</div>
                              </td>

                              {/* 5. SUBMITTED BIDS */}
                              <td>
                                <div>
                                  <span style={{ fontWeight: '800', color: 'var(--text-main)' }}>{displayBidCount} Bids</span>
                                  {lowestRate && (
                                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '700' }}>
                                      Lowest: ₹{lowestRate}/MT
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 6. BIDDING & APPROVAL REPORT */}
                              <td>
                                {(() => {
                                  const alloc = (db.allocations || []).find((a) => String(a.rate_request_id) === String(req.id) || String(a.rate_request_id) === String(reqNoStr));
                                  const transporter = alloc ? (db.transporters || []).find((t) => t.id === alloc.transporter_id) : null;

                                  return (
                                    <div>
                                      {alloc ? (
                                        <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: '900' }}>
                                          🏆 Approved: {transporter?.company_name || 'Transporter'}
                                        </div>
                                      ) : displayBidCount > 0 ? (
                                        <div style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: '800' }}>
                                          📥 {displayBidCount} Transporter Quote(s)
                                        </div>
                                      ) : (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                          ⏳ Awaiting Quotes
                                        </div>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAuditReportModal(req)}
                                        className="btn btn-secondary"
                                        style={{ padding: '3px 8px', fontSize: '0.72rem', marginTop: '4px', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px' }}
                                      >
                                        📋 Audit Log
                                      </button>
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* 7. STATUS */}
                              <td>
                                <span className={`badge ${req.status === 'Awarded' ? 'badge-awarded' : 'badge-open'}`}>
                                  {req.status === 'Awarded' ? '✓ Awarded' : 'Open for Bids'}
                                </span>
                              </td>

                              {/* 8. ACTIONS */}
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                  {isMultiItemBatch && (
                                    <button
                                      type="button"
                                      onClick={() => toggleBatchExpand(reqNoStr)}
                                      className="btn btn-primary"
                                      style={{
                                        background: isExpanded ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                                        border: '1.5px solid #7dd3fc',
                                        padding: '6px 14px',
                                        fontSize: '0.8rem',
                                        fontWeight: '900',
                                        borderRadius: '8px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)'
                                      }}
                                    >
                                      {isExpanded ? `📂 Close Batch 🔼` : `📂 Open Batch (${childItems.length} Items) 🔽`}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSelectedRequestForParticularReport(req)}
                                    className="btn"
                                    style={{
                                      padding: '6px 12px',
                                      fontSize: '0.78rem',
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
                                    type="button"
                                    onClick={() => setSelectedRequestForComparison(req)}
                                    className="btn btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: '800', borderRadius: '8px' }}
                                  >
                                    <TrendingDown size={14} /> Compare Rates ({displayBidCount})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditModal(req)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 10px', fontSize: '0.78rem', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '8px' }}
                                    title="Edit requirement details"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRequirement(req)}
                                    className="btn btn-danger"
                                    style={{ padding: '6px 10px', fontSize: '0.78rem', borderRadius: '8px' }}
                                    title="Delete requirement"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* 2. EXPANDED SUB-ITEMS ACCORDION DRAWER CONTAINER (ONLY FOR MULTI-ITEM BATCHES) */}
                            {isExpanded && isMultiItemBatch && (
                              <tr key={`expanded_${req.id}`}>
                                <td colSpan="8" style={{ padding: '16px 20px 24px 20px', background: '#0f172a', borderBottom: '2px solid #0284c7' }}>
                                  <div style={{
                                    border: '1.5px solid #0284c7',
                                    borderRadius: '16px',
                                    padding: '20px 22px',
                                    background: '#1e293b',
                                    boxShadow: '0 10px 30px rgba(2, 132, 199, 0.25)'
                                  }}>
                                    {/* Drawer Header Toolbar */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1.5px solid rgba(255,255,255,0.1)', paddingBottom: '14px', flexWrap: 'wrap', gap: '14px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: '#0284c7', color: '#ffffff', padding: '8px 12px', borderRadius: '10px' }}>
                                          <FolderOpen size={22} color="#ffffff" />
                                        </div>
                                        <div>
                                          <div style={{ fontSize: '1.05rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span>📂 BATCH FOLDER CONTENTS:</span>
                                            <span style={{ fontFamily: 'monospace', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', border: '1.5px solid #38bdf8', padding: '2px 10px', borderRadius: '8px', fontSize: '0.92rem', fontWeight: '900' }}>
                                              {reqNoStr}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '700', marginTop: '2px' }}>
                                            Showing all {childItems.length} sub-indents ({reqNoStr}/01 to {reqNoStr}/{childItems.length.toString().padStart(2, '0')})
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.82rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '5px 12px', borderRadius: '20px', fontWeight: '900' }}>
                                          📍 {pickupStr} ➔ 🎯 <strong style={{ color: '#fbbf24', fontWeight: '900' }}>{dropStr}</strong>
                                        </span>
                                        <span style={{ fontSize: '0.82rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)', padding: '5px 12px', borderRadius: '20px', fontWeight: '900' }}>
                                          ⚖️ {Number(totalQty).toLocaleString()} MT Batch Total
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => alert(`Broadcasting Batch ${reqNoStr} to WhatsApp Transporter Groups...`)}
                                          className="btn btn-success"
                                          style={{
                                            background: '#059669',
                                            border: 'none',
                                            padding: '6px 14px',
                                            fontSize: '0.8rem',
                                            borderRadius: '10px',
                                            fontWeight: '900',
                                            color: '#ffffff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          💬 📱 WhatsApp Broadcast
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedRequestForComparison(req)}
                                          className="btn btn-success"
                                          style={{
                                            background: '#059669',
                                            border: 'none',
                                            padding: '6px 14px',
                                            fontSize: '0.8rem',
                                            borderRadius: '10px',
                                            fontWeight: '900',
                                            color: '#ffffff',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                          }}
                                        >
                                          📄 📄 Batch Comparative Report ({reqNoStr})
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => toggleBatchExpand(reqNoStr)}
                                          className="btn btn-primary"
                                          style={{
                                            background: '#0284c7',
                                            border: 'none',
                                            padding: '6px 14px',
                                            fontSize: '0.8rem',
                                            borderRadius: '10px',
                                            fontWeight: '900',
                                            color: '#ffffff',
                                            cursor: 'pointer'
                                          }}
                                        >
                                          📂 Close Batch 🔼
                                        </button>
                                      </div>
                                    </div>

                                    {/* Sub-Items Table Matching User Screenshot */}
                                    <div style={{ maxHeight: '80vh', overflowY: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                      <table className="custom-table" style={{ width: '100%', margin: 0, background: '#0f172a' }}>
                                        <thead>
                                          <tr style={{ background: '#1e293b' }}>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>REQUISITION CODE</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>ROUTE / LOCATION</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>CARGO & QTY</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>TARGET DATE</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>SUBMITTED QUOTES</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>📊 BID & APPROVAL REPORT</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155' }}>STATUS</th>
                                            <th style={{ color: '#f8fafc', padding: '12px 16px', fontSize: '0.78rem', fontWeight: '900', borderBottom: '2px solid #334155', textAlign: 'center' }}>ACTIONS</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {childItems.map((item, subIdx) => {
                                            const subCode = `${reqNoStr}/${(subIdx + 1).toString().padStart(2, '0')}`;
                                            const bids = (db.rate_submissions || []).filter((s) => String(s.requirement_id) === String(req.id) || String(s.requirement_id) === String(reqNoStr) || String(s.rate_request_id) === String(req.id) || String(s.rate_request_id) === String(reqNoStr));
                                            const validRates = bids.map(b => parseFloat(b.rate_per_mt || b.rate_per_unit || 0)).filter(r => r > 0);
                                            const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
                                            const bidsCount = Math.max(displayBidCount, bids.length);
                                            const alloc = (db.allocations || []).find((a) => String(a.requirement_id) === String(req.id) || String(a.req_no) === String(reqNoStr));
                                            const awardedTransporter = alloc ? (alloc.transporter_name || alloc.transporter_id) : req.awarded_transporter;

                                            return (
                                              <tr key={item.id || subIdx} style={{ background: subIdx % 2 === 0 ? '#0f172a' : '#1e293b', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                                <td style={{ padding: '14px 16px' }}>
                                                  <span style={{
                                                    fontFamily: 'monospace',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '900',
                                                    color: '#ffffff',
                                                    background: '#1e293b',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    display: 'inline-block'
                                                  }}>
                                                    {subCode}
                                                  </span>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: '700' }}>
                                                    📍 {item.pickup_origin || pickupStr} ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '900' }}>{item.drop_location || dropStr}</strong>
                                                  </div>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                  <div style={{ fontSize: '0.95rem', fontWeight: '900', color: '#0284c7' }}>
                                                    {Number(item.quantity_mt || item.required_qty || 0).toLocaleString()} {item.unit || 'MT'}
                                                  </div>
                                                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700', marginTop: '2px' }}>
                                                    {item.product_name || item.material_type || 'HI-PRO SOYA'}
                                                  </div>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                  <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '700' }}>{req.target_date || '2026-08-25'}</div>
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                  <div style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '700' }}>
                                                    {bidsCount > 0 ? `${bidsCount} Transporter Bids` : 'No Bids Yet'}
                                                  </div>
                                                  {lowestRate && (
                                                    <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '900', marginTop: '2px' }}>
                                                      💰 Lowest L1 Quote: ₹{lowestRate}/MT
                                                    </div>
                                                  )}
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                  {awardedTransporter ? (
                                                    <div>
                                                      <div style={{ fontSize: '0.82rem', color: '#059669', fontWeight: '900' }}>
                                                        🏆 Approved: {awardedTransporter}
                                                      </div>
                                                      <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', display: 'inline-block', marginTop: '2px' }}>
                                                        📋 Audit Log
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Pending Approval</span>
                                                  )}
                                                </td>

                                                <td style={{ padding: '14px 16px' }}>
                                                  {awardedTransporter ? (
                                                    <span className="badge badge-success" style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '4px 12px', borderRadius: '20px', fontWeight: '900' }}>
                                                      ✓ Awarded
                                                    </span>
                                                  ) : (
                                                    <span className="badge badge-open" style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', padding: '4px 12px', borderRadius: '20px', fontWeight: '900' }}>
                                                      Active
                                                    </span>
                                                  )}
                                                </td>

                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => setSelectedRequestForComparison(req)}
                                                    className="btn btn-primary"
                                                    style={{
                                                      background: '#2563eb',
                                                      border: 'none',
                                                      padding: '8px 14px',
                                                      fontSize: '0.82rem',
                                                      borderRadius: '8px',
                                                      fontWeight: '900',
                                                      color: '#ffffff',
                                                      cursor: 'pointer',
                                                      whiteSpace: 'nowrap'
                                                    }}
                                                  >
                                                    📉 Compare Quotes ({bidsCount})
                                                  </button>
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



          {/* TAB 5: DEDICATED DATABASE BACKUP & CLOUD RESTORE CENTER */}
          {activeTab === 'db_backup' && (
            <div className="glass-panel" style={{ padding: '30px', borderRadius: '18px', background: '#ffffff', border: '1.5px solid #0284c7', boxShadow: '0 4px 25px rgba(2, 132, 199, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0284c7', background: '#ffffff', padding: '4px 12px', borderRadius: '6px', width: 'fit-content', border: '1.5px solid #0284c7', marginBottom: '8px', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.12)' }}>
                    🛡️ HOSTINGER / MYSQL CLOUD DATABASE ENGINE
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
                    onClick={handleExportBiddingReportCSV}
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
                    <Download size={18} /> 📥 Download Report (Excel / CSV)
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDatabaseBackup}
                    className="btn btn-success"
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
                      boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)'
                    }}
                  >
                    <Download size={18} /> 📥 Download Full Database Backup (.sql)
                  </button>

                  <button
                    type="button"
                    onClick={handleInitiateRestoreBackup}
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
                    <Upload size={18} /> 📤 Restore Backup File (.sql)
                  </button>
                  <input
                    ref={restoreFileInputRef}
                    type="file"
                    accept=".sql"
                    onChange={handleUploadDatabaseBackup}
                    style={{ display: 'none' }}
                  />

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
                  📂 All Master Directories ({ ((db?.title_masters || []).length + (db?.transporters || []).length + (db?.company_units_plants || db?.company_units || db?.company_masters || []).length + (db?.products || db?.product_masters || []).length) })
                </button>
                <button
                  onClick={() => setMasterFilterTab('company')}
                  className={`btn ${masterFilterTab === 'company' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '8px 16px', fontSize: '0.82rem', borderRadius: '20px', fontWeight: '700' }}
                >
                  🏢 Company Units & Plants ({ (db?.company_units_plants || db?.company_units || db?.company_masters || []).length })
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
                                <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.95rem' }}>{t.company_name}</div>
                                <div style={{ fontSize: '0.76rem', color: '#475569' }}>ID: {t.id}</div>
                              </td>
                              <td>
                                <span style={{ fontFamily: 'monospace', fontWeight: '900', color: '#0284c7', background: '#e0f2fe', padding: '3px 10px', borderRadius: '6px', border: '1px solid #7dd3fc' }}>
                                  {t.code || t.username?.toUpperCase() || 'TR'}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.85rem' }}>{t.contact_person || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.82rem', color: '#1e293b', fontWeight: '700' }}>📞 {t.mobile || 'N/A'}</div>
                                <div style={{ fontSize: '0.76rem', color: '#475569' }}>✉️ {t.email || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontFamily: 'monospace', color: '#34d399', fontSize: '0.82rem', fontWeight: '800' }}>GST: {t.gstin || t.gst_pan || 'N/A'}</div>
                              </td>
                              <td>
                                <div style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '800' }}>👤 {t.username}</div>
                              </td>
                              <td>
                                <span className={`badge ${t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? 'badge-suspended' : 'badge-awarded'}`}>
                                  {t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? 'Inactive' : (t.status || 'Active')}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setEditingTransporterMaster(t)}
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: '0.76rem', border: '1px solid #38bdf8', color: '#38bdf8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    title="Edit Transporter Details"
                                  >
                                    <Edit size={13} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTransporterStatus(t)}
                                    className={`btn ${t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? 'btn-success' : 'btn-secondary'}`}
                                    style={{
                                      padding: '4px 10px',
                                      fontSize: '0.76rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      border: t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? '1px solid #10b981' : '1px solid #ef4444',
                                      color: t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? '#34d399' : '#f87171'
                                    }}
                                    title={t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? 'Activate Transporter Account' : 'Deactivate Transporter Account'}
                                  >
                                    {t.status === 'Suspended' || t.status === 'Deactivated' || t.status === 'Inactive' ? '🟢 Activate' : '🔴 Deactivate'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openResetPasswordModal(t)}
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
                      {(db.company_units_plants || db.company_units || db.company_masters || []).map((comp) => (
                        <tr key={comp.id}>
                          <td>
                            <div style={{ fontWeight: '700', color: 'var(--text-main)' }}>{comp.company_name || comp.name}</div>
                            <div style={{ display: 'flex', gap: '4px', marginTop: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {comp.code && <span className="badge badge-open" style={{ fontSize: '0.65rem' }}>{comp.code}</span>}
                              {(comp.pickup_origin || comp.pickup_location_name) && (
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}>
                                  📍 Pickup: {comp.pickup_origin || comp.pickup_location_name}
                                </span>
                              )}
                              {(comp.drop_location || comp.drop_location_name) && (
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc' }}>
                                  🎯 Drop: {comp.drop_location || comp.drop_location_name}
                                </span>
                              )}
                              {!comp.pickup_origin && !comp.pickup_location_name && !comp.drop_location && !comp.drop_location_name && (
                                <span style={{ fontSize: '0.65rem', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                                  🏢 {comp.city || 'General Plant Unit'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>{comp.contact_name || comp.proprietor_name || 'N/A'}</td>
                          <td>
                            <div style={{ fontFamily: 'monospace', color: '#0284c7', fontSize: '0.82rem', fontWeight: '700' }}>GST: {comp.gstin || comp.gst || 'N/A'}</div>
                            {(comp.pan || comp.pan_no) && <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.75rem' }}>PAN: {comp.pan || comp.pan_no}</div>}
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>{comp.mobile || comp.mobile_no || 'N/A'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{comp.email || 'N/A'}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '600' }}>{comp.city || 'Nagpur'}, {comp.district || 'Nagpur'}</div>
                            <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: '700' }}>PIN: {comp.pin_code || comp.pincode || comp.pin || 'N/A'} ({comp.state || 'Maharashtra'})</div>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{comp.registered_address || comp.address || 'N/A'}</td>
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
                  <button onClick={() => { setNewProductMaster({ name: '', category: '', hsn_code: '', unit: 'MT' }); setIsAddProductModalOpen(true); }} className="btn btn-success" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                  {(() => {
                    const companyUnits = db.company_units_plants || db.company_units || db.company_masters || [];
                    const opts = Array.from(new Set(companyUnits.map(c => (c.pickup_origin || c.pickup_location_name || '').trim()).filter(Boolean)));
                    if (editingReq.origin_city && !opts.includes(editingReq.origin_city)) {
                      opts.unshift(editingReq.origin_city);
                    }
                    return opts.map((opt, idx) => (
                      <option key={`edit_orig_${idx}`} value={opt}>{opt}</option>
                    ));
                  })()}
                </select>
              </div>

              <div>
                <label className="form-label">🎯 Drop Destination Location</label>
                <select
                  className="form-control"
                  value={editingReq.dest_city}
                  onChange={(e) => setEditingReq({ ...editingReq, dest_city: e.target.value })}
                >
                  {(() => {
                    const companyUnits = db.company_units_plants || db.company_units || db.company_masters || [];
                    const opts = Array.from(new Set(companyUnits.map(c => (c.drop_location || c.drop_location_name || '').trim()).filter(Boolean)));
                    if (editingReq.dest_city && !opts.includes(editingReq.dest_city)) {
                      opts.unshift(editingReq.dest_city);
                    }
                    return opts.map((opt, idx) => (
                      <option key={`edit_dest_${idx}`} value={opt}>{opt}</option>
                    ));
                  })()}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '12px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Product Category</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Liquid Edible Bulk"
                    value={editingProductMaster.category || ''}
                    onChange={(e) => setEditingProductMaster({ ...editingProductMaster, category: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">HSN / SAC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 15071000"
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
      <TransporterManagerModal
        isOpen={isTransporterModalOpen || Boolean(editingTransporterMaster)}
        onClose={() => {
          setIsTransporterModalOpen(false);
          setEditingTransporterMaster(null);
        }}
        editingTransporter={editingTransporterMaster}
      />
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

      {/* 🔒 ENTERPRISE SECURITY AUTHORIZATION PASSWORD MODAL */}
      {securityAuthModal.isOpen && (
        <div className="modal-overlay" style={{ zIndex: 999999 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '440px', padding: '24px', boxSizing: 'border-box', border: '2px solid #ef4444', background: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: '10px', borderRadius: '10px' }}>
                  <Lock size={22} color="#ef4444" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '900', color: '#ffffff', margin: 0 }}>
                    Security Authorization Password
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: '#f87171', margin: '2px 0 0 0' }}>
                    {securityAuthModal.actionTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSecurityAuthModal({ isOpen: false, actionTitle: '', pendingAction: null });
                  setEnteredAuthPass('');
                  setAuthErrorMsg('');
                }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleVerifySecuritySubmit}>
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  🔒 Enter Security Authorization Password to execute database operation.
                </div>
              </div>

              {authErrorMsg && (
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: '800', marginBottom: '14px' }}>
                  {authErrorMsg}
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '20px', position: 'relative' }}>
                <label className="form-label" style={{ color: '#ef4444', fontWeight: '800' }}>
                  Security Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAuthPass ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter Security Password..."
                    value={enteredAuthPass}
                    onChange={(e) => setEnteredAuthPass(e.target.value)}
                    autoFocus
                    required
                    style={{ fontSize: '0.95rem', fontWeight: '800', paddingRight: '42px', height: '46px', border: '1.5px solid #ef4444', background: '#020617', color: '#ffffff' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPass(!showAuthPass)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showAuthPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSecurityAuthModal({ isOpen: false, actionTitle: '', pendingAction: null });
                    setEnteredAuthPass('');
                    setAuthErrorMsg('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  style={{ padding: '8px 20px', fontSize: '0.85rem', fontWeight: '900', background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' }}
                >
                  <Key size={16} /> Authorize & Execute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
