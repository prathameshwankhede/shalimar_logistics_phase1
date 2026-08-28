// src/components/TransporterPortal.jsx
// High-Speed 1-Line Express Freight Bidding UI with Corner Bids History Tab ⚡🚛

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitBid } from '../api/rateSubmissionApi';
import { ContractModal } from './ContractModal';
import { ERPPaymentModal } from './ERPPaymentModal';
import { TruckDispatchSlipModal } from './TruckDispatchSlipModal';
import { validateMobile, validateVehicleNo } from '../utils/validationRules';
import {
  Truck,
  Send,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  TrendingUp,
  Snowflake,
  MessageSquare,
  Lock,
  Calendar,
  Download,
  Zap,
  Grid,
  History,
  FolderOpen
} from 'lucide-react';

export const TransporterPortal = () => {
  const { currentUser, currentTransporter, db, updateDB, quickSwitchUser, addSecurityLog } = useAuth();

  // 🧭 TAB PERSISTENCE ENGINE: Read URL Hash or LocalStorage so browser refresh NEVER redirects to Home!
  const getInitialTransporterTab = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('my_bids')) return 'my_bids';
      if (hash.startsWith('allocations')) return 'allocations';
      if (hash.startsWith('month_end')) return 'month_end';
      if (hash.startsWith('open_requests')) return 'open_requests';
    }
    return localStorage.getItem('transflow_transporter_active_tab') || 'open_requests';
  };

  const [activeTab, setActiveTab] = useState(getInitialTransporterTab);

  React.useEffect(() => {
    localStorage.setItem('transflow_transporter_active_tab', activeTab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
  }, [activeTab]);
  const [biddingViewMode, setBiddingViewMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      return 'card';
    }
    return 'express';
  }); // 'express' (1-line), 'card' (detailed grid)
  const [allocationFilter, setAllocationFilter] = useState('all'); // 'all', 'active', 'completed'
  const [selectedMonth, setSelectedMonth] = useState('2026-08'); // Month filter for statement

  const [expandedBatches, setExpandedBatches] = useState({});
  const toggleBatchExpand = (batchKey) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [batchKey]: !prev[batchKey]
    }));
  };

  const [selectedReqForBid, setSelectedReqForBid] = useState(null);
  const [quickRates, setQuickRates] = useState({}); // 1-Line Express input rate state per sub-indent key
  const [selectedDispatchSlip, setSelectedDispatchSlip] = useState(null);

  const getSubIndentKey = (req) => {
    if (!req) return 'unknown';
    if (req.id && req.item_id) return `${req.id}_${req.item_id}`;
    if (req.item_id) return String(req.item_id);
    if (req.sub_indent_id) return String(req.sub_indent_id);
    if (req.sub_indent_no) return String(req.sub_indent_no);
    if (req.request_no) return String(req.request_no);
    return String(req.id);
  };

  const handleBatchSubmitAll = (batchKey, items) => {
    const openItems = (items || []).filter((req) => req.status !== 'Awarded');
    
    // Check which items have rates typed in quickRates using getSubIndentKey
    const filledItems = openItems.filter((req) => {
      const key = getSubIndentKey(req);
      const val = parseFloat(quickRates[key]);
      return val && !isNaN(val) && val > 0;
    });

    if (filledItems.length === 0) {
      alert('Please enter rate (₹/MT) for at least one sub-indent in this batch to submit.');
      return;
    }

    let updatedSubmissions = [...(db.rate_submissions || [])];
    const transId = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';

    filledItems.forEach((req) => {
      const key = getSubIndentKey(req);
      const rateVal = parseFloat(quickRates[key]);
      const parentReqId = req.requirement_id || req.id;
      const targetItemId = req.item_id || req.sub_indent_id || req.id;
      const subIndentNo = req.sub_indent_no || req.request_no || req.id;
      const qtyVal = Number(req.required_qty || req.quantity_mt || 0);
      const totalCalcAmount = parseFloat((rateVal * qtyVal).toFixed(2));

      const existingIdx = updatedSubmissions.findIndex(
        (s) => (String(s.requirement_id || s.rate_request_id) === String(parentReqId) || String(s.rate_request_id) === String(req.parent_req_no)) &&
               (String(s.item_id) === String(targetItemId) || String(s.item_id) === String(subIndentNo)) &&
               (String(s.transporter_id) === String(transId) || String(s.transporter_id) === String(currentTransporter?.code) || String(s.transporter_id) === String(currentTransporter?.username))
      );

      const subObj = {
        ...(existingIdx >= 0 ? updatedSubmissions[existingIdx] : {}),
        id: existingIdx >= 0 ? updatedSubmissions[existingIdx].id : `sub_${(transId).toLowerCase()}_${targetItemId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        requirement_id: parentReqId,
        rate_request_id: parentReqId,
        item_id: targetItemId,
        transporter_id: transId,
        transporter_name: currentTransporter?.company_name || transId,
        rate_per_unit: rateVal,
        rate_per_mt: rateVal,
        quoted_quantity_mt: qtyVal,
        total_estimated_amount: totalCalcAmount,
        total_amount: totalCalcAmount,
        transit_days: '2',
        status: 'Submitted',
        submitted_at: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        updatedSubmissions[existingIdx] = subObj;
      } else {
        updatedSubmissions.unshift(subObj);
      }

      // Persist bid directly to MySQL rate_submissions table via API
      submitBid({
        id: subObj.id,
        requirement_id: parentReqId,
        rate_request_id: parentReqId,
        item_id: targetItemId,
        request_no: subIndentNo,
        transporter_id: transId,
        transporter_name: currentTransporter?.company_name || transId,
        rate_per_unit: rateVal,
        rate_per_mt: rateVal,
        quoted_quantity_mt: qtyVal,
        total_amount: totalCalcAmount,
        status: 'Submitted'
      }).catch(err => console.error('Batch bid persistence warning:', err.message));

      setQuickRates((prev) => ({ ...prev, [key]: '' }));
    });

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_submissions: updatedSubmissions
      },
      `SUBMIT_BATCH_ALL_QUOTES (${filledItems.length} quotes submitted for Batch ${batchKey})`,
      currentTransporter.company_name,
      'transporter',
      'BATCH_BIDS_SUBMITTED 🚀'
    );

    updateDB(updatedDb);
    setSuccessNotice(`🚀 Submitted quotes for ${filledItems.length} items in Batch ${batchKey} successfully!`);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Form states for submitting rate in modal
  const [bidForm, setBidForm] = useState({
    rate_per_unit: '',
    transit_days: '2',
    notes: ''
  });

  // Form state for Truck Dispatch entry (keyed per allocation ID for isolated card typing 🚛)
  const [dispatchForm, setDispatchForm] = useState({});

  const handleDispatchFieldChange = (allocId, field, value) => {
    setDispatchForm((prev) => ({
      ...prev,
      [allocId]: {
        ...(prev[allocId] || { truck_number: '', driver_name: '', driver_phone: '', dispatched_qty: '' }),
        [field]: value
      }
    }));
  };

  const [selectedContractModal, setSelectedContractModal] = useState(null);
  const [successNotice, setSuccessNotice] = useState('');

  if (!currentTransporter) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '40px auto' }}>
        <Building2 size={48} color="#38bdf8" style={{ margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', marginBottom: '6px' }}>Select Transporter Account</h2>
        <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem', marginBottom: '20px' }}>
          Please select a Transporter account below to access your dedicated portal:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {(db.transporters || []).map((t) => (
            <button
              key={t.id}
              onClick={() => quickSwitchUser(t.username || t.code)}
              className="btn btn-secondary"
              style={{ padding: '12px 16px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <strong style={{ color: 'var(--text-main, #0f172a)' }}>{t.company_name}</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {t.code} | GST: {t.gst_pan}</div>
              </div>
              <span className="badge badge-open">Login as {t.code} ➔</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // DATA ISOLATION: Fetch data associated with this Transporter ID, Code, or Username (Case-Insensitive 🛡️)
  const mySubmissions = (db.rate_submissions || []).filter((s) => {
    const sId = String(s.transporter_id || '').toLowerCase();
    const cId = String(currentTransporter?.id || '').toLowerCase();
    const cCode = String(currentTransporter?.code || '').toLowerCase();
    const cUser = String(currentTransporter?.username || '').toLowerCase();
    return (cId && sId === cId) || (cCode && sId === cCode) || (cUser && sId === cUser);
  });
  const myAllocations = (db.allocations || []).filter((a) => {
    const aId = String(a.transporter_id || '').toLowerCase();
    const cId = String(currentTransporter?.id || '').toLowerCase();
    const cCode = String(currentTransporter?.code || '').toLowerCase();
    const cUser = String(currentTransporter?.username || '').toLowerCase();
    return (cId && aId === cId) || (cCode && aId === cCode) || (cUser && aId === cUser);
  });
  const myDispatches = (db.truck_dispatches || []).filter((d) => {
    const dId = String(d.transporter_id || '').toLowerCase();
    const cId = String(currentTransporter?.id || '').toLowerCase();
    const cCode = String(currentTransporter?.code || '').toLowerCase();
    const cUser = String(currentTransporter?.username || '').toLowerCase();
    return (cId && dId === cId) || (cCode && dId === cCode) || (cUser && dId === cUser);
  });

  // Available open rate requests (ONLY ACTIVE UNACCEPTED & UNAWARDED REQUIREMENTS)
  const rawOpenRateRequests = (db.rate_requests || []).filter((r) => {
    if (!r || !r.id) return false;

    // 1. Exclude if requirement is marked Awarded or Closed
    if (r.status === 'Awarded' || r.status === 'Closed') return false;

    // 2. Exclude if allocated in db.allocations to any transporter
    const isAllocated = (db.allocations || []).some((a) => String(a.rate_request_id) === String(r.id) || String(a.rate_request_id) === String(r.request_no));
    if (isAllocated) return false;

    // 3. Exclude if rate is accepted/frozen by any transporter
    const isAcceptedByAnyone = (db.rate_submissions || []).some(
      (s) => (String(s.rate_request_id) === String(r.id) || String(s.rate_request_id) === String(r.request_no)) && (s.is_frozen || s.status === 'Rate Frozen' || s.status === 'Accepted')
    );
    if (isAcceptedByAnyone) return false;

    return true;
  });

  // Flatten parent requirements with child sub-indents into individual sub-indent items for transporter bidding
  const openRateRequests = [];
  rawOpenRateRequests.forEach((parentReq) => {
    const childItems = parentReq.items || [];
    if (childItems.length > 0) {
      childItems.forEach((item, idx) => {
        const subIdxStr = (idx + 1).toString().padStart(2, '0');
        const parentReqNo = parentReq.req_no || parentReq.request_no || parentReq.id;
        const subIndentNo = item.sub_indent_no || `${parentReqNo}/${subIdxStr}`;

        openRateRequests.push({
          ...parentReq,
          id: parentReq.id,
          requirement_id: parentReq.id,
          item_id: item.id,
          sub_indent_id: item.id,
          sub_indent_no: subIndentNo,
          request_no: subIndentNo,
          req_no: parentReqNo,
          batch_no: parentReqNo,
          title: subIndentNo,
          origin_city: item.pickup_origin || parentReq.pickup_origin,
          dest_city: item.drop_location || parentReq.drop_location,
          pickup_origin: item.pickup_origin || parentReq.pickup_origin,
          drop_location: item.drop_location || parentReq.drop_location,
          material_type: item.product_name || item.material_type || parentReq.product_name,
          product_name: item.product_name || item.material_type || parentReq.product_name,
          required_qty: Number(item.quantity_mt || item.required_qty || 0),
          quantity_mt: Number(item.quantity_mt || item.required_qty || 0),
          unit: item.unit || 'MT',
          target_date: item.target_date || parentReq.target_date,
          parent_total_qty: parentReq.total_quantity_mt || parentReq.quantity_mt,
          parent_req_no: parentReqNo
        });
      });
    } else {
      openRateRequests.push({
        ...parentReq,
        item_id: parentReq.id,
        sub_indent_id: parentReq.id,
        sub_indent_no: parentReq.req_no || parentReq.request_no || parentReq.id,
        parent_req_no: parentReq.req_no || parentReq.request_no || parentReq.id
      });
    }
  });

  // Count pending counter offers for badge notification
  const pendingCounterOffers = mySubmissions.filter((s) => s.status === 'Negotiating' && s.counter_rate_per_unit && !s.is_frozen);

  // MONTH-END CALCULATIONS
  const filteredDispatchesForMonth = myDispatches.filter((d) => {
    if (!selectedMonth) return true;
    return d.dispatched_at.startsWith(selectedMonth);
  });

  const monthTotalDispatchedQty = filteredDispatchesForMonth.reduce((acc, curr) => acc + (parseFloat(curr.dispatched_qty) || 0), 0);

  // Calculate gross freight amount earned this month
  const monthTotalFreightBilling = filteredDispatchesForMonth.reduce((acc, curr) => {
    const alloc = myAllocations.find((a) => a.id === curr.allocation_id);
    const rate = alloc ? (parseFloat(alloc.agreed_rate) || 0) : 0;
    return acc + (parseFloat(curr.dispatched_qty) * rate);
  }, 0);

  const monthAdvanceCleared = Math.round(monthTotalFreightBilling * 0.7);
  const monthBalancePending = Math.round(monthTotalFreightBilling * 0.3);

  // 📥 DOWNLOAD MONTH-END STATEMENT AS CSV / EXCEL
  const handleDownloadMonthEndStatement = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += `MONTH_END_STATEMENT_FOR_${currentTransporter.code}_(${selectedMonth})\n`;
    csv += 'LR_NUMBER,DISPATCH_DATE,TRUCK_NUMBER,DRIVER_NAME,MATERIAL_TYPE,DESTINATION_CITY,LOADED_QTY_MT,AGREED_RATE_PER_MT,TOTAL_FREIGHT_VALUE,ESTIMATED_GST_5PERCENT,TOTAL_INVOICE_AMOUNT\n';

    filteredDispatchesForMonth.forEach((d) => {
      const alloc = myAllocations.find((a) => a.id === d.allocation_id);
      const req = alloc ? (db.rate_requests || []).find((r) => r.id === alloc.rate_request_id) : null;
      const rate = alloc ? (parseFloat(alloc.agreed_rate) || 0) : 0;
      const val = (parseFloat(d.dispatched_qty) || 0) * rate;
      const gst = Math.round(val * 0.05);

      csv += `${d.lr_number},${new Date(d.dispatched_at).toLocaleDateString()},${d.truck_number},"${d.driver_name}",${req?.material_type || 'Agri Cargo'},"${req?.dest_city || 'MIDC'}",${d.dispatched_qty},${rate},${val},${gst},${val + gst}\n`;
    });

    csv += `\nTOTAL_DISPATCHED_TONNAGE,${monthTotalDispatchedQty}_MT\n`;
    csv += `TOTAL_GROSS_FREIGHT,₹${monthTotalFreightBilling}\n`;
    csv += `ADVANCE_RECEIVED_70PERCENT,₹${monthAdvanceCleared}\n`;
    csv += `BALANCE_PENDING_30PERCENT,₹${monthBalancePending}\n`;

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MonthEnd_Statement_${currentTransporter.code}_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // FAST 1-LINE INLINE SUBMIT HANDLER (Supports Double/Re-Quoted Bids 🚀)
  const handleExpressQuickSubmit = (e, req) => {
    e.preventDefault();
    if (!currentTransporter) {
      alert('Please select or log in to a Transporter Account first.');
      return;
    }

    const rateKey = getSubIndentKey(req);
    const rawInput = quickRates[rateKey] !== undefined ? quickRates[rateKey] : quickRates[req.id];
    const rateVal = parseFloat(String(rawInput || '').replace(/,/g, '').trim());
    if (!rateVal || isNaN(rateVal) || rateVal <= 0) {
      alert('Please enter a valid freight rate per MT (e.g. 2450).');
      return;
    }

    const parentReqId = req.requirement_id || req.id;
    const targetItemId = req.item_id || req.sub_indent_id || req.id;
    const subIndentNo = req.sub_indent_no || req.request_no || req.id;
    const qtyVal = Number(req.required_qty || req.quantity_mt || 0);
    const totalCalcAmount = parseFloat((rateVal * qtyVal).toFixed(2));
    const transId = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';

    let updatedSubmissions = [...(db.rate_submissions || [])];
    const existingIdx = updatedSubmissions.findIndex(
      (s) => (String(s.requirement_id || s.rate_request_id) === String(parentReqId) || String(s.rate_request_id) === String(req.parent_req_no)) &&
             (String(s.item_id) === String(targetItemId) || String(s.item_id) === String(subIndentNo)) &&
             (String(s.transporter_id) === String(transId) || String(s.transporter_id) === String(currentTransporter?.code) || String(s.transporter_id) === String(currentTransporter?.username))
    );

    if (existingIdx >= 0 && updatedSubmissions[existingIdx].is_frozen) {
      alert(`🛑 RATE FROZEN: Your agreed rate of ₹${updatedSubmissions[existingIdx].rate_per_unit}/MT has already been accepted/awarded and cannot be changed.`);
      return;
    }

    // 🛡️ COUNTER BID VALIDATION RULE: Updated rate MUST be strictly lower than competing counter rate!
    const existingBid = existingIdx >= 0 ? updatedSubmissions[existingIdx] : null;
    const counterCeiling = parseFloat(existingBid?.counter_rate_per_unit || req.admin_counter_rate || (existingBid ? existingBid.rate_per_unit : 0));
    if (existingBid && counterCeiling > 0 && rateVal >= counterCeiling) {
      alert(`🛑 BID VALIDATION ERROR:\n\nYour updated rate (₹${rateVal.toLocaleString()}/MT) must be STRICTLY LOWER than the competing/counter rate (₹${counterCeiling.toLocaleString()}/MT)!\n\nYou cannot submit a higher or equal freight rate.`);
      return;
    }

    const newSubId = existingIdx >= 0 ? updatedSubmissions[existingIdx].id : `sub_${(transId).toLowerCase()}_${targetItemId}_${Date.now()}`;
    const subObj = {
      ...(existingIdx >= 0 ? updatedSubmissions[existingIdx] : {}),
      id: newSubId,
      requirement_id: parentReqId,
      rate_request_id: parentReqId,
      item_id: targetItemId,
      transporter_id: transId,
      transporter_name: currentTransporter?.company_name || transId,
      rate_per_unit: rateVal,
      rate_per_mt: rateVal,
      quoted_quantity_mt: qtyVal,
      total_estimated_amount: totalCalcAmount,
      total_amount: totalCalcAmount,
      transit_days: 2,
      notes: 'Fast 1-line quote submitted.',
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      ...(counterCeiling > 0 ? {
        has_responded_to_counter: true,
        responded_counter_rate: counterCeiling
      } : {})
    };

    if (existingIdx >= 0) {
      updatedSubmissions[existingIdx] = subObj;
    } else {
      updatedSubmissions.unshift(subObj);
    }

    // Persist bid directly to MySQL rate_submissions table via API
    submitBid({
      id: subObj.id,
      requirement_id: parentReqId,
      rate_request_id: parentReqId,
      item_id: targetItemId,
      request_no: subIndentNo,
      transporter_id: transId,
      transporter_name: currentTransporter?.company_name || transId,
      rate_per_unit: rateVal,
      rate_per_mt: rateVal,
      quoted_quantity_mt: qtyVal,
      total_amount: totalCalcAmount,
      status: 'Submitted'
    }).catch(err => console.error('Quick bid persistence warning:', err.message));

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_submissions: updatedSubmissions
      },
      `SUBMIT_RATE_BID (Updated ₹${rateVal}/MT for ${subIndentNo})`,
      currentTransporter.company_name,
      'transporter',
      'BID_SUBMITTED 🛡️'
    );

    updateDB(updatedDb);
    setSuccessNotice(`⚡ Quote rate ₹${rateVal.toLocaleString()}/MT saved & updated for ${subIndentNo}!`);
    setQuickRates((prev) => ({ ...prev, [rateKey]: '' }));
    setTimeout(() => setSuccessNotice(''), 5000);
  };

  const handleRateSubmit = (e) => {
    e.preventDefault();
    if (!selectedReqForBid) return;
    if (!currentTransporter) {
      alert('Please select or log in to a Transporter Account first.');
      return;
    }

    // Check if requirement was deleted by admin while modal was open
    const isStillActive = (db.rate_requests || []).some((r) => String(r.id) === String(selectedReqForBid.id));
    if (!isStillActive) {
      alert(`🛑 REQUIREMENT CANCELLED: This requirement was cancelled or deleted by Shalimar Admin.`);
      setSelectedReqForBid(null);
      return;
    }

    const rateVal = parseFloat(String(bidForm.rate_per_unit || '').replace(/,/g, '').trim());
    if (!rateVal || isNaN(rateVal) || rateVal <= 0) {
      alert('Please enter a valid freight rate per MT (e.g. 2450).');
      return;
    }

    let updatedSubmissions = [...(db.rate_submissions || [])];
    const transIdForModal = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';
    const existingIdx = updatedSubmissions.findIndex(
      (s) => (String(s.rate_request_id) === String(selectedReqForBid.id) || String(s.rate_request_id) === String(selectedReqForBid.request_no)) &&
             (String(s.transporter_id) === String(transIdForModal) || String(s.transporter_id) === String(currentTransporter?.code) || String(s.transporter_id) === String(currentTransporter?.username))
    );

    if (existingIdx >= 0 && updatedSubmissions[existingIdx].is_frozen) {
      alert(`🛑 RATE FROZEN: Your agreed rate of ₹${updatedSubmissions[existingIdx].rate_per_unit}/MT has already been accepted/awarded and cannot be changed.`);
      setSelectedReqForBid(null);
      return;
    }

    const newSubId = existingIdx >= 0 ? updatedSubmissions[existingIdx].id : `sub_${(transIdForModal).toLowerCase()}_${Date.now()}`;
    const subObj = {
      id: newSubId,
      rate_request_id: selectedReqForBid.id,
      transporter_id: transIdForModal,
      rate_per_unit: rateVal,
      total_estimated_amount: rateVal * (Number(selectedReqForBid.required_qty) || 0),
      transit_days: parseInt(bidForm.transit_days) || 2,
      notes: bidForm.notes || 'Competitive rate offered.',
      status: 'Submitted',
      submitted_at: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      updatedSubmissions[existingIdx] = subObj;
    } else {
      updatedSubmissions.unshift(subObj);
    }

    // Persist bid directly to MySQL rate_submissions table via API
    submitBid({
      id: subObj.id,
      rate_request_id: selectedReqForBid.id,
      request_no: selectedReqForBid.request_no || selectedReqForBid.id,
      transporter_id: transIdForModal,
      transporter_name: currentTransporter?.company_name || transIdForModal,
      rate_per_unit: rateVal,
      vehicle_type: bidForm.notes || '',
      comments: bidForm.notes || '',
      status: 'Submitted'
    }).catch(err => console.error('Modal bid persistence warning:', err.message));

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_submissions: updatedSubmissions
      },
      `SUBMIT_RATE_BID (Updated ₹${rateVal}/MT for ${selectedReqForBid.request_no})`,
      currentTransporter.company_name,
      'transporter',
      'BID_SUBMITTED 🛡️'
    );

    updateDB(updatedDb);
    alert(`🎉 SUCCESS: Rate quote ₹${rateVal.toLocaleString()}/MT saved & updated for ${selectedReqForBid.request_no}!`);
    setSuccessNotice(`Rate quote ₹${rateVal.toLocaleString()}/MT saved & updated for ${selectedReqForBid.request_no}!`);
    setSelectedReqForBid(null);
    setBidForm({ rate_per_unit: '', transit_days: '2', notes: '' });

    setTimeout(() => setSuccessNotice(''), 5000);
  };

  // Transporter Accepts Admin Counter Rate & Freezes Rate -> AUTO AWARD & INSTANT CONTRACT CREATION
  const handleAcceptCounterRate = (sub) => {
    const agreedRate = sub.counter_rate_per_unit;
    const req = (db.rate_requests || []).find((r) => r.id === sub.rate_request_id);

    // 1. Freeze Transporter's submission
    const updatedSubmissions = (db.rate_submissions || []).map((s) => {
      if (s.id === sub.id) {
        return {
          ...s,
          rate_per_unit: agreedRate,
          is_frozen: true,
          status: 'Rate Frozen',
          accepted_at: new Date().toISOString()
        };
      }
      return s;
    });

    // 2. Mark Rate Request as 'Awarded' so it closes for other transporters
    const updatedRateRequests = (db.rate_requests || []).map((r) => {
      if (r.id === sub.rate_request_id) {
        return { ...r, status: 'Awarded' };
      }
      return r;
    });

    // 3. Create Contract Allocation if not already existing
    let updatedAllocations = [...(db.allocations || [])];
    const existingAlloc = updatedAllocations.find((a) => a.rate_request_id === sub.rate_request_id);
    let updatedContracts = [...(db.contracts || [])];

    if (!existingAlloc && req) {
      const allocObj = {
        id: `alloc_${Date.now()}`,
        rate_request_id: req.id,
        transporter_id: currentTransporter.id,
        agreed_rate: parseFloat(agreedRate),
        allocated_qty: parseFloat(req.required_qty),
        status: 'Awarded',
        allocated_at: new Date().toISOString()
      };
      updatedAllocations = [allocObj, ...updatedAllocations];

      // Create Contract record for ERP
      const newContractNum = `SNPL-CTR-${Date.now().toString().slice(-4)}`;
      const erpPoNum = `SAP-PO-45${Math.floor(100000 + Math.random() * 900000)}`;
      const newContract = {
        id: `contract_${Date.now()}`,
        allocation_id: allocObj.id,
        contract_number: newContractNum,
        erp_po_number: erpPoNum,
        payment_status: 'Approved',
        created_at: new Date().toISOString()
      };
      updatedContracts = [newContract, ...updatedContracts];
    }

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: updatedRateRequests,
        rate_submissions: updatedSubmissions,
        allocations: updatedAllocations,
        contracts: updatedContracts
      },
      `ACCEPT_COUNTER_RATE (Agreed ₹${agreedRate}/MT - Awarded to ${currentTransporter.company_name})`,
      currentTransporter.company_name,
      'transporter',
      'RATE_ACCEPTED 🛡️'
    );

    updateDB(updatedDb);
    setSuccessNotice(`🎉 Rate Accepted! Contract awarded at ₹${agreedRate}/MT. Check Contracts tab for DO & SAP PO!`);
    setTimeout(() => setSuccessNotice(''), 4500);
  };

  // TRUCK DISPATCH + NEWEST DISPATCH FIRST + AUTO COMPLETION TRACKING!
  const handleDispatchTruckSubmit = (e, alloc) => {
    e.preventDefault();
    const allocForm = dispatchForm[alloc.id] || {};
    const qtyVal = parseFloat(allocForm.dispatched_qty);
    if (!qtyVal || qtyVal <= 0) return;

    // 🛡️ Live Validation Rules
    const vehicleVal = validateVehicleNo(allocForm.truck_number || '');
    if (!vehicleVal.valid) {
      alert(`🚛 Vehicle Number Error: ${vehicleVal.message}`);
      return;
    }

    let cleanDriverPhone = currentTransporter.mobile;
    if (allocForm.driver_phone) {
      const phoneVal = validateMobile(allocForm.driver_phone);
      if (!phoneVal.valid) {
        alert(`📱 Driver Phone Error: ${phoneVal.message}`);
        return;
      }
      cleanDriverPhone = phoneVal.clean;
    }

    const existingTrucks = myDispatches.filter((d) => d.allocation_id === alloc.id);
    const totalDispatchedQty = existingTrucks.reduce((acc, curr) => acc + (parseFloat(curr.dispatched_qty) || 0), 0);
    const remainingQty = Math.max(0, alloc.allocated_qty - totalDispatchedQty);

    if (qtyVal > remainingQty) {
      alert(`Cannot dispatch ${qtyVal} MT. Remaining allowed balance is only ${remainingQty} MT.`);
      return;
    }

    const dispatchId = `dispatch_${Date.now()}`;
    const lrNo = `LR-${currentTransporter.code}-${Date.now().toString().slice(-4)}`;

    const newDispatch = {
      id: dispatchId,
      allocation_id: alloc.id,
      transporter_id: currentTransporter.id,
      truck_number: (allocForm.truck_number || '').toUpperCase().replace(/\s+/g, ''),
      driver_name: allocForm.driver_name || 'Driver',
      driver_phone: cleanDriverPhone,
      driver_license: (allocForm.driver_license || '').toUpperCase().trim() || 'MH31 20210012345',
      dispatched_qty: qtyVal,
      dispatched_at: new Date().toISOString(),
      lr_number: lrNo,
      status: 'Dispatched'
    };

    let updatedRateRequests = [...(db.rate_requests || [])];
    const originalReq = (db.rate_requests || []).find((r) => r.id === alloc.rate_request_id);

    // Unfulfilled balance calculation
    const unfulfilledBalance = remainingQty - qtyVal;

    // Check if contract is now 100% completed
    const updatedAllocations = (db.allocations || []).map((a) => {
      if (a.id === alloc.id && unfulfilledBalance <= 0) {
        return { ...a, status: 'Completed' };
      }
      return a;
    });

    if (unfulfilledBalance > 0 && originalReq) {
      const newRebroadcastId = `req_bal_${Date.now()}`;
      const newRebroadcastReq = {
        id: newRebroadcastId,
        request_no: `${originalReq.request_no}-BAL${Math.round(unfulfilledBalance)}`,
        title: `${originalReq.title} (Remaining Balance - ${unfulfilledBalance} ${originalReq.unit})`,
        origin_city: originalReq.origin_city,
        origin_pin: originalReq.origin_pin,
        dest_city: originalReq.dest_city,
        dest_pin: originalReq.dest_pin,
        material_type: originalReq.material_type,
        required_qty: unfulfilledBalance,
        unit: originalReq.unit,
        target_date: originalReq.target_date,
        status: 'Open',
        created_at: new Date().toISOString(),
        notes: `Re-broadcasted unfulfilled balance of ${unfulfilledBalance} MT from previous dispatch allocation.`
      };

      updatedRateRequests = [newRebroadcastReq, ...updatedRateRequests];
    }

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: updatedRateRequests,
        allocations: updatedAllocations,
        truck_dispatches: [newDispatch, ...(db.truck_dispatches || [])]
      },
      `TRUCK_DISPATCHED (${newDispatch.truck_number} - ${qtyVal} MT, LR: ${lrNo})`,
      currentTransporter.company_name,
      'transporter',
      'DISPATCHED 🚛'
    );

    updateDB(updatedDb);

    setDispatchForm((prev) => ({
      ...prev,
      [alloc.id]: { truck_number: '', driver_name: '', driver_phone: '', driver_license: '', dispatched_qty: '' }
    }));
    setSelectedDispatchSlip(newDispatch);
    setSuccessNotice(`Truck ${newDispatch.truck_number} dispatched! LR No: ${lrNo}. ${unfulfilledBalance <= 0 ? '🎉 Contract 100% Dispatched & Completed!' : ''}`);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  return (
    <div>
      {/* Transporter Profile Header */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '14px', borderRadius: '14px' }}>
              <Building2 size={28} color="#38bdf8" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>{currentTransporter.company_name}</h2>
                <span className="badge badge-open" style={{ fontWeight: '800' }}>CODE: {currentTransporter.code}</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                Contact: <strong>{currentTransporter.contact_person}</strong> ({currentTransporter.mobile}) | GST: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{currentTransporter.gst_pan}</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {pendingCounterOffers.length > 0 && (
              <div style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', padding: '10px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} color="#fbbf24" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '800' }}>🔥 LOWER COMPETING BID RECEIVED!</div>
                  <div style={{ fontSize: '0.85rem', color: '#ffffff', fontWeight: '700' }}>{pendingCounterOffers.length} Lower Competitor Offer(s)</div>
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: '10px', textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MY SUBMITTED BIDS</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399' }}>{mySubmissions.length} Bids</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 16px', borderRadius: '10px', textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MY CONTRACTS</div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>{myAllocations.length} Total</div>
            </div>
          </div>
        </div>
      </div>

      {successNotice && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          border: '1px solid #10b981',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '20px',
          color: '#34d399',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={20} /> {successNotice}
        </div>
      )}

      {/* Tabs Layout with High-Glow Active Indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        {/* Main Operational Tabs */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('open_requests')}
            className="btn"
            style={{
              background: activeTab === 'open_requests'
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: '#ffffff',
              border: activeTab === 'open_requests'
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: activeTab === 'open_requests'
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: activeTab === 'open_requests' ? '900' : '700',
              transform: activeTab === 'open_requests' ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer'
            }}
          >
            <TrendingUp size={17} /> Open Requirements ({openRateRequests.length})
          </button>

          <button
            onClick={() => setActiveTab('allocations')}
            className="btn"
            style={{
              background: activeTab === 'allocations'
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: '#ffffff',
              border: activeTab === 'allocations'
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: activeTab === 'allocations'
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: activeTab === 'allocations' ? '900' : '700',
              transform: activeTab === 'allocations' ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer'
            }}
          >
            <Truck size={17} /> Awarded Contracts & Dispatch ({myAllocations.length})
          </button>

          <button
            onClick={() => setActiveTab('month_end')}
            className="btn"
            style={{
              background: activeTab === 'month_end'
                ? 'linear-gradient(135deg, #059669 0%, #34d399 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: '#ffffff',
              border: activeTab === 'month_end'
                ? '2px solid #6ee7b7'
                : '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: activeTab === 'month_end'
                ? '0 0 22px rgba(52, 211, 153, 0.6), 0 0 45px rgba(52, 211, 153, 0.3)'
                : 'none',
              fontWeight: activeTab === 'month_end' ? '900' : '700',
              transform: activeTab === 'month_end' ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer'
            }}
          >
            <Calendar size={17} color={activeTab === 'month_end' ? '#ffffff' : '#34d399'} /> 📅 Month-End Billing Statement
          </button>
        </div>

        {/* ↘️ Corner Tab: Submitted Bids History */}
        <div>
          <button
            onClick={() => setActiveTab('my_bids')}
            className="btn"
            style={{
              background: activeTab === 'my_bids'
                ? 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)'
                : 'rgba(30, 41, 59, 0.65)',
              color: '#ffffff',
              border: activeTab === 'my_bids'
                ? '2px solid #7dd3fc'
                : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: activeTab === 'my_bids'
                ? '0 0 22px rgba(56, 189, 248, 0.6), 0 0 45px rgba(56, 189, 248, 0.3)'
                : 'none',
              fontWeight: activeTab === 'my_bids' ? '900' : '700',
              transform: activeTab === 'my_bids' ? 'scale(1.05)' : 'scale(1)',
              padding: '10px 18px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative'
            }}
            title="View history of all rate quotes submitted by your company"
          >
            <History size={16} color="#ffffff" />
            Submitted Bids History ({mySubmissions.length})
            {pendingCounterOffers.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#000000', borderRadius: '50%', padding: '2px 7px', fontSize: '0.72rem', fontWeight: '900' }}>
                {pendingCounterOffers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: Available Open Requirements (WITH 1-LINE EXPRESS BIDDING GRID ⚡) */}
      {activeTab === 'open_requests' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
                Available Freight Requirements for Bidding
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enter your quote rate directly on the line and click Quote for 1-second submission!</p>
            </div>

            {/* View Mode Toggle Switch */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button
                onClick={() => setBiddingViewMode('express')}
                style={{
                  background: biddingViewMode === 'express' ? '#38bdf8' : 'transparent',
                  color: biddingViewMode === 'express' ? '#000000' : 'var(--text-sub)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Zap size={13} /> ⚡ 1-Line Express Table
              </button>
              <button
                onClick={() => setBiddingViewMode('card')}
                style={{
                  background: biddingViewMode === 'card' ? '#38bdf8' : 'transparent',
                  color: biddingViewMode === 'card' ? '#000000' : 'var(--text-sub)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Grid size={13} /> 📇 Detailed Cards
              </button>
            </div>
          </div>

          {/* MODE 1: 1-LINE EXPRESS QUICK BIDDING TABLE ⚡ */}
          {biddingViewMode === 'express' ? (
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Req No.</th>
                    <th>Requirement Title & Route</th>
                    <th>Cargo & Qty</th>
                    <th>Target Date</th>
                    <th style={{ width: '230px' }}>Your Quote Rate (₹ / MT)</th>
                    <th style={{ textAlign: 'right', width: '160px' }}>Status / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const groups = {};
                    (openRateRequests || []).forEach((req) => {
                      let masterKey = req.batch_no;
                      const reqNo = req.request_no || req.title || '';
                      if (!masterKey) {
                        const parts = reqNo.split('/');
                        if (parts.length >= 3) {
                          masterKey = parts.slice(0, 3).join('/');
                        } else {
                          masterKey = reqNo;
                        }
                      }
                      if (!groups[masterKey]) {
                        groups[masterKey] = { batchKey: masterKey, items: [] };
                      }
                      groups[masterKey].items.push(req);
                    });

                    const sortedGroups = Object.values(groups).sort((a, b) => {
                      const itemA = a.items[0];
                      const itemB = b.items[0];

                      const numA = parseInt((itemA?.batch_no || itemA?.request_no || itemA?.title || '').match(/REQ-(\d+)/i)?.[1] || 0, 10);
                      const numB = parseInt((itemB?.batch_no || itemB?.request_no || itemB?.title || '').match(/REQ-(\d+)/i)?.[1] || 0, 10);
                      if (numA !== numB) return numB - numA;

                      const timeA = new Date(itemA?.created_at || itemA?.target_date || 0).getTime() || 0;
                      const timeB = new Date(itemB?.created_at || itemB?.target_date || 0).getTime() || 0;
                      return timeB - timeA;
                    });

                    sortedGroups.forEach((grp) => {
                      grp.items.sort((x, y) => {
                        const subX = parseInt((x.request_no || x.title || '').split('/').pop() || 0, 10);
                        const subY = parseInt((y.request_no || y.title || '').split('/').pop() || 0, 10);
                        return subX - subY;
                      });
                    });

                    return sortedGroups.map((group) => {
                      const isMultiItemBatch = group.items.length > 1;
                      const isExpanded = expandedBatches[group.batchKey] || false;
                      const firstItem = group.items[0];
                      const totalBatchQty = group.items.reduce((acc, curr) => acc + (parseFloat(curr.required_qty) || 0), 0);

                      if (isMultiItemBatch) {
                        return (
                          <React.Fragment key={`trans_grp_${group.batchKey}`}>
                            {/* MASTER BATCH FOLDER ROW (SHOWN ONLY WHEN BATCH IS CLOSED) */}
                            {!isExpanded && (
                              <tr
                                onClick={() => toggleBatchExpand(group.batchKey)}
                                style={{
                                  background: 'linear-gradient(90deg, rgba(2, 132, 199, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)',
                                  borderLeft: '5px solid #38bdf8',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease-in-out'
                                }}
                                title="Click anywhere on this batch row to open sub-indents"
                              >
                                <td>
                                  <span
                                    className="badge badge-open"
                                    style={{
                                      fontFamily: 'monospace',
                                      fontWeight: '900',
                                      background: 'rgba(2, 132, 199, 0.12)',
                                      color: '#0284c7',
                                      border: '1px solid #0284c7',
                                      padding: '5px 12px',
                                      borderRadius: '8px',
                                      letterSpacing: '0.04em'
                                    }}
                                  >
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
                                  <div style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.95rem' }}>{(totalBatchQty || 0).toLocaleString()} MT Total</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.items.length} x {firstItem.required_qty} MT ({firstItem.material_type})</div>
                                </td>

                                <td>
                                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{firstItem.target_date}</div>
                                </td>

                                <td>
                                  <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: '800' }}>Click Open Batch to Quote</span>
                                </td>

                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleBatchExpand(group.batchKey);
                                    }}
                                    className="btn"
                                    style={{
                                      background: 'rgba(2, 132, 199, 0.12)',
                                      color: '#0284c7',
                                      border: '1px solid #0284c7',
                                      padding: '6px 14px',
                                      fontSize: '0.82rem',
                                      fontWeight: '800',
                                      borderRadius: '8px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    📂 Open Batch ({group.items.length} Items) 🔽
                                  </button>
                                </td>
                              </tr>
                            )}

                               {/* EXPANDED SUB-ITEMS ACCORDION DRAWER CONTAINER (/01 to /50) */}
                               {isExpanded && (
                                 <tr key={`expanded_${group.batchKey}`}>
                                   <td colSpan="6" style={{ padding: '16px 20px 24px 20px', background: '#f8fafc' }}>
                                     <div style={{
                                       border: '1.5px solid #cbd5e1',
                                       borderRadius: '16px',
                                       padding: '20px 22px',
                                       background: '#ffffff',
                                       boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
                                     }}>
                                       {/* Drawer Header Toolbar */}
                                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                           <div style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', padding: '8px 12px', borderRadius: '10px' }}>
                                             <FolderOpen size={20} color="#ffffff" />
                                           </div>
                                           <div>
                                             <div style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                               <span>📂 BATCH FOLDER CONTENTS:</span>
                                               <span style={{ fontFamily: 'monospace', color: '#0284c7', background: '#e0f2fe', border: '1px solid #7dd3fc', padding: '2px 10px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '900' }}>
                                                 {group.batchKey}
                                               </span>
                                             </div>
                                             <div style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>
                                               Showing all {group.items.length} sub-indents ({group.batchKey}/01 to {group.batchKey}/{group.items.length.toString().padStart(2, '0')})
                                             </div>
                                           </div>
                                         </div>

                                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                           {/* ⚡ 1-CLICK BULK BATCH QUOTE ALL CONTROL BAR */}
                                            <button
                                              type="button"
                                              onClick={() => handleBatchSubmitAll(group.batchKey, group.items)}
                                              className="btn btn-primary"
                                              style={{
                                                padding: '6px 14px',
                                                fontSize: '0.82rem',
                                                fontWeight: '900',
                                                background: 'linear-gradient(135deg, #0284c7 0%, #059669 100%)',
                                                border: 'none',
                                                borderRadius: '10px',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                              }}
                                              title="Submit individual typed rates for all batch sub-indents in 1-Click"
                                            >
                                              <Send size={15} /> 🚀 Submit All Batch Bids ({group.items.length})
                                            </button>

                                           <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0284c7', border: '1px solid #7dd3fc', padding: '4px 12px', borderRadius: '20px', fontWeight: '800' }}>
                                             📍 {firstItem?.origin_city || 'Origin'} ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '900' }}>{firstItem?.dest_city || 'Destination'}</strong>
                                           </span>
                                           <span style={{ fontSize: '0.78rem', background: '#dcfce7', color: '#059669', border: '1px solid #6ee7b7', padding: '4px 12px', borderRadius: '20px', fontWeight: '800' }}>
                                             ⚖️ {(totalBatchQty || 0).toLocaleString()} MT Batch Total
                                           </span>
                                           <button
                                             type="button"
                                             onClick={() => toggleBatchExpand(group.batchKey)}
                                             className="btn"
                                             style={{
                                               background: '#0284c7',
                                               color: '#ffffff',
                                               border: 'none',
                                               padding: '5px 14px',
                                               fontSize: '0.8rem',
                                               fontWeight: '800',
                                               borderRadius: '8px',
                                               cursor: 'pointer'
                                             }}
                                           >
                                             📂 Close Batch 🔼
                                           </button>
                                         </div>
                                       </div>

                                       {/* Sub-Items Clean Table (Matching User Reference Image 🚀) */}
                                       <div style={{ maxHeight: '80vh', overflowY: 'auto', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                                         <table className="custom-table" style={{ width: '100%', margin: 0, background: '#ffffff' }}>
                                           <thead>
                                             <tr style={{ background: '#f1f5f9' }}>
                                               <th style={{ color: '#0f172a', padding: '10px 14px', fontWeight: '900', borderBottom: '2px solid #cbd5e1' }}>REQUISITION CODE</th>
                                               <th style={{ color: '#0f172a', padding: '10px 14px', fontWeight: '900', borderBottom: '2px solid #cbd5e1' }}>ROUTE / COMPANY</th>
                                               <th style={{ color: '#0f172a', padding: '10px 14px', fontWeight: '900', borderBottom: '2px solid #cbd5e1' }}>CARGO / QTY</th>
                                               <th style={{ color: '#0f172a', padding: '10px 14px', fontWeight: '900', borderBottom: '2px solid #cbd5e1' }}>TARGET DATE</th>
                                               <th style={{ color: '#0f172a', padding: '10px 14px', fontWeight: '900', borderBottom: '2px solid #cbd5e1' }}>SUBMIT YOUR RATE / BID</th>
                                               <th style={{ color: '#0f172a', padding: '10px 14px', textAlign: 'right', fontWeight: '900', borderBottom: '2px solid #cbd5e1' }}>STATUS</th>
                                             </tr>
                                           </thead>
                                           <tbody>
                                             {(group.items || []).map((req, rIdx) => {
                                               const myExistingBid = (mySubmissions || []).find((s) => 
                                                  (String(s.rate_request_id) === String(req.id) || String(s.rate_request_id) === String(req.parent_req_no) || String(s.requirement_id) === String(req.id)) &&
                                                  (String(s.item_id) === String(req.item_id) || String(s.item_id) === String(req.sub_indent_no) || String(s.item_id) === String(req.request_no) || !req.item_id)
                                                );
                                               const isAwarded = req.status === 'Awarded';
                                               const subKey = getSubIndentKey(req);
                                               const currentInputRate = quickRates[subKey] !== undefined ? quickRates[subKey] : '';
                                               const displayCode = req.request_no || req.title || 'REQ';

                                               return (
                                                 <tr
                                                   key={req.item_id ? `${req.id}_${req.item_id}` : (req.id || `sub_trans_${rIdx}`)}
                                                   style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
                                                 >
                                                   <td style={{ padding: '10px 14px' }}>
                                                     <div style={{
                                                       fontSize: '0.92rem',
                                                       fontWeight: '900',
                                                       color: '#0f172a',
                                                       letterSpacing: '0.01em'
                                                     }}>
                                                       {displayCode}
                                                     </div>
                                                   </td>

                                                   <td style={{ padding: '10px 14px' }}>
                                                     <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                                                       <MapPin size={12} color="#0284c7" /> 📍 {req.origin_city || 'N/A'} ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '800', fontSize: '0.88rem' }}>{req.dest_city || 'N/A'}</strong>
                                                     </div>
                                                     {req.admin_counter_rate && (
                                                        <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#d97706', border: '1px solid #f59e0b', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                          🔥 Competing Transporter Bid: ₹{req.admin_counter_rate}/MT
                                                        </span>
                                                      )}
                                                   </td>

                                                   <td style={{ padding: '10px 14px' }}>
                                                     <div style={{ fontWeight: '900', color: '#0284c7', fontSize: '0.9rem' }}>
                                                       {req.required_qty ? Number(req.required_qty).toLocaleString() : 0} {req.unit || 'MT'}
                                                     </div>
                                     <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>{req.material_type || 'Cargo'}</div>
                                                   </td>

                                                   <td style={{ padding: '10px 14px' }}>
                                                     <div style={{ fontSize: '0.84rem', color: '#334155', fontWeight: '700' }}>{req.target_date || '-'}</div>
                                                   </td>

                                                   <td style={{ padding: '10px 14px' }}>
                                                     {myExistingBid ? (
                                                       myExistingBid.is_frozen ? (
                                                         <div className="current-bid-badge" style={{ background: '#dcfce7', border: '1.5px solid #16a34a', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                           <Lock size={12} color="#047857" />
                                                           <span style={{ fontSize: '0.74rem', color: '#047857', fontWeight: '800' }}>FROZEN:</span>
                                                           <strong style={{ color: '#064e3b', fontSize: '0.95rem', fontWeight: '900' }}>₹{myExistingBid.rate_per_unit}/MT</strong>
                                                         </div>
                                                       ) : (() => {
                                                          const counterCeiling = parseFloat(myExistingBid?.counter_rate_per_unit || req.admin_counter_rate || 0);
                                                          const alreadyResponded = Boolean(myExistingBid?.has_responded_to_counter && String(myExistingBid?.responded_counter_rate) === String(counterCeiling));
                                                          const isAlreadyLower = Boolean(myExistingBid && counterCeiling > 0 && parseFloat(myExistingBid.rate_per_unit) < counterCeiling);
                                                          const canUpdateOnce = Boolean(counterCeiling > 0 && !alreadyResponded && !isAlreadyLower);

                                                          return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                              <div className="current-bid-badge" style={{ background: '#dcfce7', border: '1.5px solid #16a34a', padding: '5px 10px', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span style={{ color: '#047857', fontWeight: '900' }}>✓ Current Bid:</span>
                                                                <strong style={{ color: '#064e3b', fontSize: '0.92rem', fontWeight: '900' }}>₹{myExistingBid.rate_per_unit}/MT</strong>
                                                              </div>

                                                              {/* ⚡ ALLOW EXACTLY 1 LOWERING ATTEMPT ONLY IF TRANSPORTER HAS NOT ALREADY BEATEN OR RESPONDED! */}
                                                              {canUpdateOnce && (
                                                                <form onSubmit={(e) => handleExpressQuickSubmit(e, req)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                                  <div style={{ position: 'relative', width: '100%' }}>
                                                                    <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                                                                    <input
                                                                      type="number"
                                                                      inputMode="decimal"
                                                                      min="0"
                                                                      step="0.01"
                                                                      max={counterCeiling > 0 ? counterCeiling - 1 : undefined}
                                                                      placeholder={counterCeiling > 0 ? `< ₹${counterCeiling}` : 'Lower Rate'}
                                                                      className="form-control"
                                                                      value={currentInputRate}
                                                                      onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        const key = getSubIndentKey(req);
                                                                        setQuickRates((prev) => ({
                                                                          ...prev,
                                                                          [key]: val
                                                                        }));
                                                                      }}
                                                                      style={{ paddingLeft: '22px', fontSize: '0.82rem', fontWeight: '800', height: '32px', width: '105px' }}
                                                                    />
                                                                  </div>
                                                                  <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', height: '32px', borderRadius: '6px', fontWeight: '900', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                                                                    ✏️ Update
                                                                  </button>
                                                                </form>
                                                              )}
                                                            </div>
                                                          );
                                                        })()
                                                     ) : isAwarded ? (
                                                       <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Requirements Closed</span>
                                                     ) : (
                                                       <form onSubmit={(e) => handleExpressQuickSubmit(e, req)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                         <div style={{ position: 'relative', width: '100%' }}>
                                                           <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                                                           <input
                                                             type="number"
                                                             inputMode="decimal"
                                                             min="0"
                                                             step="0.01"
                                                             placeholder="Rate"
                                                             className="form-control"
                                                             value={currentInputRate}
                                                             onChange={(e) => {
                                                               const val = e.target.value;
                                                               const key = getSubIndentKey(req);
                                                               setQuickRates((prev) => ({
                                                                 ...prev,
                                                                 [key]: val
                                                               }));
                                                             }}
                                                             style={{ paddingLeft: '22px', fontSize: '0.86rem', fontWeight: '800', height: '36px', width: '110px' }}
                                                             required
                                                           />
                                                         </div>
                                                         <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', height: '36px', borderRadius: '8px' }}>
                                                           <Send size={13} /> Quote
                                                         </button>
                                                       </form>
                                                     )}
                                                   </td>

                                                   <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                                                     {myExistingBid?.counter_rate_per_unit && !myExistingBid?.is_frozen ? (
                                                       <button
                                                         onClick={() => handleAcceptCounterRate(myExistingBid)}
                                                         className="btn btn-success"
                                                         style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '8px' }}
                                                       >
                                                         <Snowflake size={13} /> Match Lowest Bid ₹{myExistingBid.counter_rate_per_unit} ❄️
                                                       </button>
                                                    ) : myExistingBid ? (
                                                      <span className="badge badge-awarded" style={{ fontSize: '0.72rem' }}>
                                                        {myExistingBid.is_frozen ? '❄️ Agreed' : '🔒 Final Bid'}
                                                      </span>
                                                    ) : isAwarded ? (
                                                      <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', fontSize: '0.72rem' }}>
                                                        Closed
                                                      </span>
                                                    ) : (
                                                      <span className="badge badge-open" style={{ fontSize: '0.72rem' }}>
                                                        Active Bidding
                                                      </span>
                                                    )}
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

                        // SINGLE ITEM ROW
                      const req = group.items[0];
                      const myExistingBid = mySubmissions.find((s) => String(s.rate_request_id) === String(req.id) || String(s.rate_request_id) === String(req.request_no));
                      const isAwarded = req.status === 'Awarded';
                      const currentInputRate = quickRates[req.id] || '';
                      const displayCode = req.request_no || req.title;

                      return (
                        <tr
                          key={req.id}
                          style={{
                            background: myExistingBid
                              ? myExistingBid.counter_rate_per_unit
                                ? 'rgba(245, 158, 11, 0.08)'
                                : 'rgba(16, 185, 129, 0.06)'
                              : 'transparent'
                          }}
                        >
                          <td>
                            <span
                              className="badge badge-open"
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: '800',
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)'
                              }}
                            >
                              {displayCode}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '0.92rem' }}>{displayCode}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={13} color="#38bdf8" /> 📍 {req.origin_city} ➔ 🎯 <strong style={{ color: '#d97706', fontWeight: '900', fontSize: '0.95rem', letterSpacing: '0.01em' }}>{req.dest_city}</strong>
                            </div>
                            {req.admin_counter_rate && (
                              <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid #f59e0b', padding: '2px 8px', borderRadius: '6px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                🔥 Competing Transporter Bid: ₹{req.admin_counter_rate}/MT
                              </span>
                            )}
                          </td>

                          <td>
                            <div style={{ fontWeight: '700', color: '#38bdf8' }}>{req.required_qty} {req.unit}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.material_type}</div>
                          </td>

                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{req.target_date}</div>
                          </td>

                          <td>
                            {myExistingBid ? (
                              myExistingBid.is_frozen ? (
                                <div className="current-bid-badge" style={{ background: '#dcfce7', border: '1.5px solid #16a34a', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <Lock size={12} color="#047857" />
                                  <span style={{ fontSize: '0.74rem', color: '#047857', fontWeight: '800' }}>FROZEN:</span>
                                  <strong style={{ color: '#064e3b', fontSize: '0.95rem', fontWeight: '900' }}>₹{myExistingBid.rate_per_unit}/MT</strong>
                                </div>
                              ) : (() => {
                                const counterCeiling = parseFloat(myExistingBid?.counter_rate_per_unit || req.admin_counter_rate || 0);
                                const alreadyResponded = Boolean(myExistingBid?.has_responded_to_counter && String(myExistingBid?.responded_counter_rate) === String(counterCeiling));
                                const isAlreadyLower = Boolean(myExistingBid && counterCeiling > 0 && parseFloat(myExistingBid.rate_per_unit) < counterCeiling);
                                const canUpdateOnce = Boolean(counterCeiling > 0 && !alreadyResponded && !isAlreadyLower);

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div className="current-bid-badge" style={{ background: '#dcfce7', border: '1.5px solid #16a34a', padding: '5px 10px', borderRadius: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#047857', fontWeight: '900' }}>✓ Current Bid:</span>
                                      <strong style={{ color: '#064e3b', fontSize: '0.92rem', fontWeight: '900' }}>₹{myExistingBid.rate_per_unit}/MT</strong>
                                    </div>

                                    {/* ⚡ ALLOW EXACTLY 1 LOWERING ATTEMPT ONLY IF TRANSPORTER HAS NOT ALREADY BEATEN OR RESPONDED! */}
                                    {canUpdateOnce && (
                                      <form onSubmit={(e) => handleExpressQuickSubmit(e, req)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', width: '100%' }}>
                                          <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                                          <input
                                            type="number"
                                            min="1"
                                            max={counterCeiling > 0 ? counterCeiling - 1 : undefined}
                                            placeholder={counterCeiling > 0 ? `< ₹${counterCeiling}` : 'Lower Rate'}
                                            className="form-control"
                                            value={currentInputRate}
                                            onChange={(e) => setQuickRates({ ...quickRates, [req.id]: e.target.value })}
                                            style={{ paddingLeft: '22px', fontSize: '0.82rem', fontWeight: '800', height: '32px', width: '105px' }}
                                          />
                                        </div>
                                        <button type="submit" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap', height: '32px', borderRadius: '6px', fontWeight: '900', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                                          ✏️ Update
                                        </button>
                                      </form>
                                    )}
                                  </div>
                                );
                              })()
                            ) : isAwarded ? (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Requirements Closed</span>
                            ) : (
                              <form onSubmit={(e) => handleExpressQuickSubmit(e, req)} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <div style={{ position: 'relative', width: '100%' }}>
                                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                                  <input
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 480"
                                    className="form-control"
                                    value={currentInputRate}
                                    onChange={(e) => setQuickRates({ ...quickRates, [req.id]: e.target.value })}
                                    style={{ paddingLeft: '22px', fontSize: '0.88rem', fontWeight: '700', height: '36px' }}
                                    required
                                  />
                                </div>
                                <button type="submit" className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', height: '36px' }}>
                                  <Send size={13} /> Quote
                                </button>
                              </form>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {myExistingBid?.counter_rate_per_unit && !myExistingBid?.is_frozen ? (
                              <button
                                onClick={() => handleAcceptCounterRate(myExistingBid)}
                                className="btn btn-success"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              >
                                <Snowflake size={13} /> Match Lowest Bid ₹{myExistingBid.counter_rate_per_unit} ❄️
                              </button>
                            ) : myExistingBid ? (
                              <span className="badge badge-awarded" style={{ fontSize: '0.72rem' }}>
                                {myExistingBid.is_frozen ? '❄️ Agreed' : '🔒 Final Bid'}
                              </span>
                            ) : isAwarded ? (
                              <span className="badge badge-open" style={{ opacity: 0.6 }}>Awarded</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '700' }}>⚡ Ready to Quote</span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}

                  {openRateRequests.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No active freight requirements available right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* MODE 2: DETAILED CARD GRID */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {openRateRequests.map((req) => {
                const myExistingBid = mySubmissions.find((s) => s.rate_request_id === req.id);
                const isAwarded = req.status === 'Awarded';

                return (
                  <div
                    key={req.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: myExistingBid ? (myExistingBid.counter_rate_per_unit ? '2px solid #f59e0b' : '1px solid #10b981') : '1px solid var(--border-color)',
                      borderRadius: '14px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justify: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span className="badge badge-open">{req.request_no}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Target: {req.target_date}</span>
                      </div>

                      <h4 style={{ fontSize: '1.05rem', fontWeight: '700', marginBottom: '6px' }}>{req.title}</h4>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={14} color="#38bdf8" /> {req.origin_city} ➔ {req.dest_city}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cargo</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#38bdf8' }}>{req.material_type}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quantity</div>
                          <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ffffff' }}>{req.required_qty} {req.unit}</div>
                        </div>
                      </div>

                      {req.notes && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Note: {req.notes}
                        </p>
                      )}
                    </div>

                    <div>
                      {myExistingBid ? (
                        myExistingBid.counter_rate_per_unit && !myExistingBid.is_frozen ? (
                          <div style={{ background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', padding: '12px', borderRadius: '10px' }}>
                            <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: '800', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <MessageSquare size={14} /> 🔥 LOWER COMPETING TRANSPORTER BID OFFERED!
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lowest Competitor Rate:</span>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>₹{myExistingBid.counter_rate_per_unit}/MT</div>
                              </div>
                              <button
                                onClick={() => handleAcceptCounterRate(myExistingBid)}
                                className="btn btn-success"
                                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                              >
                                <Snowflake size={14} /> Match Lowest Bid ₹{myExistingBid.counter_rate_per_unit} ❄️
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={12} /> {myExistingBid.is_frozen ? '❄️ RATE FROZEN (AGREED)' : 'SUBMITTED RATE (LOCKED)'}
                              </div>
                              <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>₹{myExistingBid.rate_per_unit}/MT</div>
                            </div>
                            <span className="badge badge-awarded" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                              {myExistingBid.is_frozen ? '❄️ FROZEN' : '🔒 FINAL BID'}
                            </span>
                          </div>
                        )
                      ) : isAwarded ? (
                        <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          🔒 Requirement Closed & Awarded
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedReqForBid(req);
                            setBidForm({ rate_per_unit: '', transit_days: '2', notes: '' });
                          }}
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                        >
                          <Send size={15} /> Submit Freight Quote
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Allocations & Truck Dispatch */}
      {activeTab === 'allocations' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Awarded Freight Contracts & Dispatch Management</h3>

            {/* Sub-Filters: All, Active Pending, Completed */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setAllocationFilter('all')}
                className={allocationFilter === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                All Contracts ({myAllocations.length})
              </button>
              <button
                onClick={() => setAllocationFilter('active')}
                className={allocationFilter === 'active' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                🚚 Active / Loading
              </button>
              <button
                onClick={() => setAllocationFilter('completed')}
                className={allocationFilter === 'completed' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.78rem', border: '1px solid #10b981', color: allocationFilter === 'completed' ? '#ffffff' : '#34d399' }}
              >
                ✓ 100% Completed
              </button>
            </div>
          </div>

          {myAllocations
            .filter((alloc) => {
              const dispatches = myDispatches.filter((d) => d.allocation_id === alloc.id);
              const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.dispatched_qty) || 0), 0);
              const remainingBalance = Math.max(0, alloc.allocated_qty - totalDispatched);
              const isCompleted = remainingBalance <= 0 || alloc.status === 'Completed';

              if (allocationFilter === 'active') return !isCompleted;
              if (allocationFilter === 'completed') return isCompleted;
              return true;
            })
            .map((alloc) => {
              const req = (db.rate_requests || []).find((r) => r.id === alloc.rate_request_id);
              const contract = db.contracts.find((c) => c.allocation_id === alloc.id);
              const dispatches = myDispatches.filter((d) => d.allocation_id === alloc.id);

              const sortedDispatches = [...dispatches].sort(
                (a, b) => new Date(b.dispatched_at).getTime() - new Date(a.dispatched_at).getTime()
              );

              const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.dispatched_qty) || 0), 0);
              const remainingBalance = Math.max(0, alloc.allocated_qty - totalDispatched);
              const isCompleted = remainingBalance <= 0 || alloc.status === 'Completed';

              return (
                <div
                  key={alloc.id}
                  style={{
                    background: isCompleted ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255,255,255,0.03)',
                    border: isCompleted ? '1px solid #10b981' : '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className={isCompleted ? "badge badge-awarded" : "badge badge-open"}>
                          {contract?.contract_number || 'ACTIVE CONTRACT'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#0284c7', fontFamily: 'monospace' }}>Order Ref: {contract?.erp_po_number}</span>
                      </div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '800' }}>{req?.title || 'Contract Delivery'}</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                        📍 {req?.origin_city || 'Origin'} ➔ 📍 {req?.dest_city || 'Destination'}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Agreed Rate</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#34d399' }}>₹{alloc.agreed_rate}/MT</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Allocated: <strong>{alloc.allocated_qty} MT</strong> | Dispatched: <strong style={{ color: '#38bdf8' }}>{totalDispatched} MT</strong> | Balance: <strong style={{ color: isCompleted ? '#34d399' : '#fbbf24' }}>{remainingBalance} MT</strong>
                      </div>
                    </div>
                  </div>

                  {!isCompleted ? (
                    (() => {
                      const allocForm = dispatchForm[alloc.id] || { truck_number: '', driver_name: '', driver_phone: '', dispatched_qty: '' };
                      return (
                        <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                          <h5 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Truck size={18} /> Dispatch New Truck (LR Creation & Auto-Rebroadcast of Unfulfilled Tonnage)
                          </h5>

                          <form onSubmit={(e) => handleDispatchTruckSubmit(e, alloc)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Truck Number (e.g. MH31FC4512)</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="MH31FC4512"
                                value={allocForm.truck_number || ''}
                                onChange={(e) => handleDispatchFieldChange(alloc.id, 'truck_number', e.target.value)}
                                style={{
                                  fontSize: '0.85rem',
                                  border: allocForm.truck_number && !validateVehicleNo(allocForm.truck_number).valid ? '2px solid #ef4444' : undefined,
                                  background: allocForm.truck_number && !validateVehicleNo(allocForm.truck_number).valid ? 'rgba(239, 68, 68, 0.08)' : undefined
                                }}
                                required
                              />
                              {allocForm.truck_number && !validateVehicleNo(allocForm.truck_number).valid && (
                                <div style={{ color: '#fca5a5', fontSize: '0.72rem', fontWeight: '800', marginTop: '3px' }}>
                                  ⚠️ Invalid Vehicle Number (e.g. MH31FC4512)
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Loaded Quantity (MT)</label>
                              <input
                                type="number"
                                min="1"
                                max={remainingBalance || 100}
                                className="form-control"
                                placeholder={`Max ${remainingBalance} MT`}
                                value={allocForm.dispatched_qty || ''}
                                onChange={(e) => handleDispatchFieldChange(alloc.id, 'dispatched_qty', e.target.value)}
                                required
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Driver Name</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Rajesh Verma"
                                value={allocForm.driver_name || ''}
                                onChange={(e) => handleDispatchFieldChange(alloc.id, 'driver_name', e.target.value)}
                                required
                                style={{ fontSize: '0.85rem' }}
                              />
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Driver Mobile No.</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. 9823012345"
                                value={allocForm.driver_phone || ''}
                                onChange={(e) => handleDispatchFieldChange(alloc.id, 'driver_phone', e.target.value)}
                                style={{
                                  fontSize: '0.85rem',
                                  border: allocForm.driver_phone && !validateMobile(allocForm.driver_phone).valid ? '2px solid #ef4444' : undefined,
                                  background: allocForm.driver_phone && !validateMobile(allocForm.driver_phone).valid ? 'rgba(239, 68, 68, 0.08)' : undefined
                                }}
                                required
                              />
                              {allocForm.driver_phone && !validateMobile(allocForm.driver_phone).valid && (
                                <div style={{ color: '#fca5a5', fontSize: '0.72rem', fontWeight: '800', marginTop: '3px' }}>
                                  ⚠️ Enter 10-digit Indian Mobile Number
                                </div>
                              )}
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: '0.78rem' }}>Driver License No. (DL)</label>
                              <input
                                type="text"
                                className="form-control"
                                placeholder="e.g. MH31 20210012345"
                                value={allocForm.driver_license || ''}
                                onChange={(e) => handleDispatchFieldChange(alloc.id, 'driver_license', e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                                required
                              />
                            </div>

                            <button type="submit" className="btn btn-primary" style={{ padding: '10px', fontSize: '0.82rem' }}>
                              <Send size={14} /> Dispatch & Generate LR
                            </button>
                          </form>
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      border: '1px solid #10b981',
                      borderRadius: '12px',
                      padding: '12px 18px',
                      marginBottom: '16px',
                      color: '#34d399',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <CheckCircle2 size={20} /> 🎉 100% TONNAGE FULLY DISPATCHED & CONTRACT COMPLETED (0 MT REMAINING)
                    </div>
                  )}

                  {sortedDispatches.length > 0 && (
                    <div>
                      <h5 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '8px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} /> Dispatched Truck Fleet Log (Newest Dispatches First)
                      </h5>
                      <div className="custom-table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>LR Number</th>
                              <th>Truck Number</th>
                              <th>Dispatched Qty</th>
                              <th>Driver Details</th>
                              <th>Dispatch Timestamp</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedDispatches.map((d, index) => (
                              <tr key={d.id} style={{ background: index === 0 ? 'rgba(56, 189, 248, 0.08)' : 'transparent' }}>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#38bdf8' }}>{d.lr_number}</span>
                                  {index === 0 && <span className="badge badge-open" style={{ fontSize: '0.68rem', marginLeft: '6px', padding: '1px 5px' }}>NEWEST</span>}
                                </td>
                                <td>
                                  <strong style={{ color: '#ffffff' }}>{d.truck_number}</strong>
                                </td>
                                <td>
                                  <span style={{ fontWeight: '700', color: '#34d399' }}>{d.dispatched_qty} MT</span>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.82rem', fontWeight: '700' }}>{d.driver_name} ({d.driver_phone})</div>
                                  <div style={{ fontSize: '0.74rem', color: '#38bdf8', fontFamily: 'monospace' }}>DL: {d.driver_license || 'MH31 20210012345'}</div>
                                </td>
                                <td>
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d?.dispatched_at ? new Date(d.dispatched_at).toLocaleString() : 'Just now'}</div>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="badge badge-awarded">✓ Dispatched</span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedDispatchSlip(d)}
                                      className="btn btn-secondary"
                                      style={{ padding: '3px 8px', fontSize: '0.72rem', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '6px' }}
                                    >
                                      📄 Slip PDF
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
              );
            })}
        </div>
      )}

      {/* TAB 3: MONTH-END FREIGHT BILLING STATEMENT */}
      {activeTab === 'month_end' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={22} color="#34d399" /> Month-End Freight Billing Statement & Audit
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Track monthly dispatches, total freight billing earnings, and 1-click export for GST filing & Shalimar accounting.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                className="form-control"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#ffffff', fontWeight: '700', width: 'auto' }}
              >
                <option value="2026-08">📅 August 2026</option>
                <option value="2026-07">📅 July 2026</option>
                <option value="2026-09">📅 September 2026</option>
                <option value="">📅 All Time Summary</option>
              </select>

              <button onClick={handleDownloadMonthEndStatement} className="btn btn-success" style={{ fontSize: '0.82rem', padding: '10px 16px' }}>
                <Download size={16} /> Export Month-End CSV / Excel 📥
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL DISPATCHED TRUCKS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#38bdf8' }}>{filteredDispatchesForMonth.length} Trucks</div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL TONNAGE DELIVERED</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#34d399' }}>{(monthTotalDispatchedQty || 0).toLocaleString()} MT</div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>GROSS FREIGHT BILLING</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#fbbf24' }}>₹{(monthTotalFreightBilling || 0).toLocaleString()}</div>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ESTIMATED 5% GST</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#818cf8' }}>₹{Math.round((monthTotalFreightBilling || 0) * 0.05).toLocaleString()}</div>
            </div>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>LR Number</th>
                  <th>Dispatch Date</th>
                  <th>Truck Number</th>
                  <th>Cargo Material & Route</th>
                  <th>Loaded Qty (MT)</th>
                  <th>Rate / MT</th>
                  <th>Gross Freight (₹)</th>
                  <th>5% GST (₹)</th>
                  <th>Total Invoice (₹)</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatchesForMonth.map((d) => {
                  const alloc = myAllocations.find((a) => a.id === d.allocation_id);
                  const req = alloc ? openRateRequests.find((r) => r.id === alloc.rate_request_id) : null;
                  const rate = alloc ? (parseFloat(alloc.agreed_rate) || 0) : 0;
                  const grossVal = (parseFloat(d.dispatched_qty) || 0) * rate;
                  const gstVal = Math.round(grossVal * 0.05);

                  return (
                    <tr key={d.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#38bdf8' }}>{d.lr_number}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{new Date(d.dispatched_at).toLocaleDateString()}</div>
                      </td>
                      <td>
                        <strong style={{ color: '#ffffff' }}>{d.truck_number}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>{req?.material_type}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>➔ {req?.dest_city}</div>
                      </td>
                      <td>
                        <strong style={{ color: '#34d399' }}>{d.dispatched_qty} MT</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>₹{rate}/MT</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '700', color: '#ffffff' }}>₹{(grossVal || 0).toLocaleString()}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>₹{(gstVal || 0).toLocaleString()}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '800', color: '#34d399' }}>₹{((grossVal || 0) + (gstVal || 0)).toLocaleString()}</div>
                      </td>
                    </tr>
                  );
                })}

                {filteredDispatchesForMonth.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No dispatches recorded for selected month ({selectedMonth}).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4 (CORNER): My Submitted Bids History */}
      {activeTab === 'my_bids' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px' }}>My Submitted Freight Bids & Counter-Offers History</h3>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Req No. & Title</th>
                  <th>Submitted Quote</th>
                  <th>Lowest Competing Bid</th>
                  <th>Est. Total Amount</th>
                  <th>Transit Days</th>
                  <th>Bid Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mySubmissions.map((sub) => {
                  const req = (db.rate_requests || []).find((r) => r.id === sub.rate_request_id);
                  const isNegotiating = sub.status === 'Negotiating';
                  const isFrozen = sub.is_frozen || sub.status === 'Rate Frozen';
                  const isReqDeleted = !req;

                  return (
                    <tr key={sub.id} style={{ background: isReqDeleted ? 'rgba(239, 68, 68, 0.08)' : isNegotiating ? 'rgba(245, 158, 11, 0.08)' : 'transparent' }}>
                      <td>
                        {isReqDeleted ? (
                          <div>
                            <span className="badge badge-danger" style={{ marginBottom: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444' }}>
                              🗑️ CANCELLED BY ADMIN
                            </span>
                            <div style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Requirement Deleted by Shalimar Logistics Dept</div>
                          </div>
                        ) : (
                          <div>
                            <span className="badge badge-open" style={{ marginBottom: '4px' }}>{req.request_no}</span>
                            <div style={{ fontWeight: '700' }}>{req.title}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {req.origin_city} ➔ {req.dest_city} ({req.required_qty} MT)
                            </div>
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff' }}>
                          ₹{(Number(sub?.rate_per_unit) || 0).toLocaleString()} / MT
                        </div>
                        <span style={{ fontSize: '0.7rem', color: isReqDeleted ? '#ef4444' : '#34d399', fontWeight: '700' }}>
                          {isReqDeleted ? '🗑️ Cancelled' : '🔒 Rate Locked'}
                        </span>
                      </td>

                      <td>
                        {sub?.counter_rate_per_unit ? (
                          <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '6px 10px', borderRadius: '8px', border: '1px solid #f59e0b', display: 'inline-block' }}>
                            <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: '700', display: 'block' }}>🔥 LOWEST COMPETING BID</span>
                            <strong style={{ color: '#ffffff', fontSize: '1.05rem' }}>₹{sub.counter_rate_per_unit}/MT</strong>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No counter</span>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: '700', color: '#38bdf8' }}>
                          ₹{((Number(sub?.rate_per_unit) || 0) * (req?.required_qty || 1)).toLocaleString()}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.85rem' }}>{sub.transit_days} Days</div>
                      </td>

                      <td>
                        {isReqDeleted ? (
                          <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444' }}>
                            🗑️ Cancelled
                          </span>
                        ) : isFrozen ? (
                          <span className="badge badge-open" style={{ background: 'rgba(56, 189, 248, 0.25)', border: '1px solid #38bdf8' }}>
                            ❄️ Rate Frozen
                          </span>
                        ) : isNegotiating ? (
                          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.25)', border: '1px solid #f59e0b', color: '#fbbf24' }}>
                            💬 Action Required
                          </span>
                        ) : (
                          <span className={`badge ${sub.status === 'Selected' ? 'badge-awarded' : 'badge-open'}`}>
                            {sub.status}
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {isNegotiating && sub.counter_rate_per_unit && !isFrozen && !isReqDeleted && (
                          <button
                            onClick={() => handleAcceptCounterRate(sub)}
                            className="btn btn-success"
                            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                          >
                            <Snowflake size={14} /> Match Lowest Bid ₹{sub.counter_rate_per_unit}/MT ❄️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Rate Submission */}
      {selectedReqForBid && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Submit Freight Quote Rate</h3>
              <button onClick={() => setSelectedReqForBid(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>{selectedReqForBid.title}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                📍 {selectedReqForBid.origin_city} ➔ {selectedReqForBid.dest_city} ({selectedReqForBid.required_qty} MT)
              </div>
            </div>

            <form onSubmit={handleRateSubmit}>
              <div className="form-group">
                <label className="form-label">Your Best Rate (₹ per MT / Ton)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 480"
                  value={bidForm.rate_per_unit}
                  onChange={(e) => setBidForm({ ...bidForm, rate_per_unit: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Expected Transit Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="2"
                  value={bidForm.transit_days}
                  onChange={(e) => setBidForm({ ...bidForm, transit_days: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fleet Remarks / Conditions</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="e.g. Own fleet of 32ft multi-axle trucks available immediately."
                  value={bidForm.notes}
                  onChange={(e) => setBidForm({ ...bidForm, notes: e.target.value })}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setSelectedReqForBid(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Send size={15} /> Submit Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Truck Dispatch Slip PDF Modal */}
      {selectedDispatchSlip && (
        <TruckDispatchSlipModal
          dispatch={selectedDispatchSlip}
          onClose={() => setSelectedDispatchSlip(null)}
        />
      )}

    </div>
  );
};
