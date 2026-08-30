// src/components/TransporterPortal.jsx
// High-Speed 1-Line Express Freight Bidding UI with Corner Bids History Tab ⚡🚛

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { submitBid, submitTransporterResponse, fetchTransporterDashboardSummary } from '../api/rateSubmissionApi';
import { acceptFinalRate, createTruckDispatch } from '../api/rateRequestApi';
import { NegotiationHistoryModal } from './NegotiationHistoryModal';
import { ContractModal } from './ContractModal';
import { ERPPaymentModal } from './ERPPaymentModal';
import { TruckDispatchSlipModal } from './TruckDispatchSlipModal';
import { validateMobile, validateVehicleNo } from '../utils/validationRules';
import { isBidFrozen, normalizeBidStatus } from '../utils/bidStatus';
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
  const { currentUser, currentTransporter, db, updateDB, updateLocalRateSubmission, quickSwitchUser, addSecurityLog, refreshRequirements, refreshDB } = useAuth();

  // 📊 MYSQL-BACKED DASHBOARD SUMMARY COUNTERS
  const [dashboardSummary, setDashboardSummary] = useState({
    submittedBids: 0,
    contracts: 0
  });

  const refreshDashboardSummary = async () => {
    try {
      const res = await fetchTransporterDashboardSummary();
      if (res && res.success) {
        setDashboardSummary({
          submittedBids: Number(res.submittedBids || 0),
          contracts: Number(res.contracts || 0)
        });
      }
    } catch (e) {
      console.error('Failed to load dashboard summary:', e);
    }
  };

  useEffect(() => {
    refreshDashboardSummary();
  }, [currentTransporter]);

  // 🛡️ SAFE DATA REFRESH HELPER: Guarantees no ReferenceError or unhandled rejection during refresh
  const safeRefreshRequirements = async () => {
    try {
      refreshDashboardSummary();
      if (typeof refreshRequirements === 'function') {
        return await refreshRequirements();
      } else if (typeof refreshDB === 'function') {
        return await refreshDB();
      }
    } catch (e) {
      console.error('Data refresh error:', e);
    }
  };

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

  const [allocationFilter, setAllocationFilter] = useState('all'); // 'all', 'active', 'completed'
  const [selectedMonth, setSelectedMonth] = useState('2026-08'); // Month filter for statement
  const [submittingItems, setSubmittingItems] = useState({});

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

  const handleBatchSubmitAll = async (batchKey, items) => {
    const openItems = (items || []).filter((req) => req.status !== 'Awarded');
    
    // Check which unquoted items have rates typed in quickRates using getSubIndentKey
    const filledItems = openItems.filter((req) => {
      const key = getSubIndentKey(req);
      const val = parseFloat(quickRates[key]);
      return val && !isNaN(val) && val > 0;
    });

    if (filledItems.length === 0) {
      alert('Please enter rate (₹/MT) for at least one sub-indent in this batch before submitting.');
      return;
    }

    const transId = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';

    try {
      for (const req of filledItems) {
        const key = getSubIndentKey(req);
        const rateVal = parseFloat(quickRates[key]);
        const parentReqId = req.requirement_id || req.id;
        const targetItemId = req.item_id || req.sub_indent_id || req.id;
        const subIndentNo = req.sub_indent_no || req.request_no || req.id;
        const qtyVal = Number(req.required_qty || req.quantity_mt || 0);
        const totalCalcAmount = parseFloat((rateVal * qtyVal).toFixed(2));

        await submitBid({
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
        });

        setQuickRates((prev) => ({ ...prev, [key]: '' }));
      }

      setSuccessNotice(`🚀 Submitted quotes for ${filledItems.length} items in Batch ${batchKey} successfully!`);
      setTimeout(() => setSuccessNotice(''), 4000);

      // ⚡ Instantly refresh fresh MySQL database state so all submitted items update immediately
      await safeRefreshRequirements();
    } catch (err) {
      console.error('Batch submit all error:', err);
      alert(err.message || 'Error submitting batch quotes.');
    }
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

  // 🔧 Universal Normalized Key Helper
  const normalizeKey = (value) =>
    value === null || value === undefined
      ? ''
      : String(value).trim().toLowerCase();

  // 🏆 Central Bid Rate Resolver (Extracts valid positive numeric rate from canonical bid fields)
  const getBidRate = (bid) => {
    if (!bid) return null;

    const value =
      bid.final_rate ??
      bid.rate_per_mt ??
      bid.original_rate ??
      bid.counter_offer_rate ??
      bid.rate_per_unit;

    const rate = Number(String(value ?? '').replace(/[₹,\s]/g, ''));

    return Number.isFinite(rate) && rate > 0 ? rate : null;
  };

  // 🎯 ONE CENTRAL BID MATCHER (Guarantees 100% accurate match across batch sub-indents & standalone requirements)
  const findMyBid = (req, submissionsList = db.rate_submissions, transporter = currentTransporter, user = currentUser) => {
    if (!req || !Array.isArray(submissionsList)) return null;

    const transporterKeys = [
      transporter?.id,
      transporter?.transporter_id,
      transporter?.code,
      transporter?.username,
      transporter?.company_name,
      user?.id,
      user?.username,
      user?.transporter_id,
      transporter?.id ? String(transporter.id).replace(/^(usr_|trans_)/i, '') : null,
      user?.id ? String(user.id).replace(/^(usr_|trans_)/i, '') : null
    ]
      .filter(Boolean)
      .map(normalizeKey);

    const reqKeys = [
      req.id,
      req.requirement_id,
      req.req_no,
      req.request_no,
      req.parent_req_no,
      req.batch_no,
      req.requisition_code
    ]
      .filter(Boolean)
      .map(normalizeKey);

    const itemKeys = [
      req.item_id,
      req.sub_indent_id,
      req.sub_indent_no,
      req.request_no,
      req.requisition_code,
      req.id
    ]
      .filter(Boolean)
      .map(normalizeKey);

    return submissionsList.find((bid) => {
      if (!bid) return false;

      const bidTransporterKeys = [
        bid.transporter_id,
        bid.transporter_code,
        bid.transporter_username,
        bid.transporter_name,
        bid.transporter_id ? String(bid.transporter_id).replace(/^(usr_|trans_)/i, '') : null
      ]
        .filter(Boolean)
        .map(normalizeKey);

      const transporterMatch =
        transporterKeys.length === 0 ||
        transporterKeys.some(key => bidTransporterKeys.includes(key)) ||
        transporterKeys.some(key => bidTransporterKeys.some(bKey => bKey.includes(key) || key.includes(bKey)));

      if (!transporterMatch) return false;

      const bidReqKeys = [
        bid.requirement_id,
        bid.rate_request_id,
        bid.request_id,
        bid.parent_req_no,
        bid.req_no,
        bid.batch_no,
        bid.request_no
      ]
        .filter(Boolean)
        .map(normalizeKey);

      const bidItemKeys = [
        bid.item_id,
        bid.sub_indent_id,
        bid.sub_indent_no,
        bid.request_no,
        bid.requisition_code
      ]
        .filter(Boolean)
        .map(normalizeKey);

      const reqIdClean = req.requirement_id || req.id;
      const itemIdClean = req.item_id || req.sub_indent_id;
      const subIndentNoClean = req.sub_indent_no;

      const bidReqIdClean = bid.requirement_id || bid.rate_request_id;
      const bidItemIdClean = bid.item_id || bid.sub_indent_id;
      const bidSubIndentNoClean = bid.sub_indent_no;

      const hasSpecificItem = Boolean(itemIdClean || (subIndentNoClean && String(subIndentNoClean).includes('/')));
      const bidHasSpecificItem = Boolean(bidItemIdClean || (bidSubIndentNoClean && String(bidSubIndentNoClean).includes('/')));

      if (hasSpecificItem || bidHasSpecificItem) {
        // Must match parent requirement AND specific sub-indent item
        const reqMatches = reqKeys.some(key => bidReqKeys.includes(key));
        const itemMatches = itemKeys.some(key => bidItemKeys.includes(key));
        return reqMatches && itemMatches;
      }

      const requirementMatch = reqKeys.some(key => bidReqKeys.includes(key));
      return requirementMatch;
    }) || null;
  };

  const mySubmissions = (db.rate_submissions || []).filter(bid => {
    if (!bid) return false;
    const transporterKeys = [
      currentTransporter?.id,
      currentTransporter?.transporter_id,
      currentTransporter?.code,
      currentTransporter?.username,
      currentTransporter?.company_name,
      currentUser?.id,
      currentUser?.username,
      currentUser?.transporter_id,
      currentTransporter?.id ? String(currentTransporter.id).replace(/^(usr_|trans_)/i, '') : null,
      currentUser?.id ? String(currentUser.id).replace(/^(usr_|trans_)/i, '') : null
    ].filter(Boolean).map(normalizeKey);

    const bidTransporterKeys = [
      bid.transporter_id,
      bid.transporter_code,
      bid.transporter_username,
      bid.transporter_name,
      bid.transporter_id ? String(bid.transporter_id).replace(/^(usr_|trans_)/i, '') : null
    ].filter(Boolean).map(normalizeKey);

    return transporterKeys.length === 0 ||
      transporterKeys.some(key => bidTransporterKeys.includes(key)) ||
      transporterKeys.some(key => bidTransporterKeys.some(bKey => bKey.includes(key) || key.includes(bKey)));
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

  // 🏆 Modern Awarded / Finalized Requirements Won by This Authenticated Transporter
  const myFinalizedItems = React.useMemo(() => {
    const itemsList = [];
    (db.rate_requests || []).forEach((req) => {
      const childItems = req.items || [];
      if (childItems.length > 0) {
        childItems.forEach((child) => {
          const myBid = findMyBid(child, db.rate_submissions, currentTransporter, currentUser) ||
                        findMyBid({ ...child, id: child.id, requirement_id: req.id }, db.rate_submissions, currentTransporter, currentUser);
          const isFinalized = myBid && (
            Boolean(myBid.is_finalized) ||
            String(myBid.bid_status || '').toUpperCase() === 'FINALIZED' ||
            String(myBid.acceptance_status || '').toUpperCase() === 'ACCEPTED' ||
            Number(myBid.final_rate) > 0
          );
          if (isFinalized) {
            itemsList.push({
              item: child,
              parentReq: req,
              myBid,
              isMultiItem: true,
              uniqueKey: `awarded_${req.id}_${child.id || child.sub_indent_no}`
            });
          }
        });
      } else {
        const myBid = findMyBid(req, db.rate_submissions, currentTransporter, currentUser);
        const isFinalized = myBid && (
          Boolean(myBid.is_finalized) ||
          String(myBid.bid_status || '').toUpperCase() === 'FINALIZED' ||
          String(myBid.acceptance_status || '').toUpperCase() === 'ACCEPTED' ||
          Number(myBid.final_rate) > 0
        );
        if (isFinalized) {
          itemsList.push({
            item: req,
            parentReq: req,
            myBid,
            isMultiItem: false,
            uniqueKey: `awarded_${req.id}`
          });
        }
      }
    });
    return itemsList;
  }, [db.rate_requests, db.rate_submissions, currentTransporter, currentUser]);

  const totalContractsCount = myFinalizedItems.length + myAllocations.length;

  // Available open rate requests (INDEPENDENT ITEM / SUB-INDENT EVALUATION)
  const rawOpenRateRequests = (db.rate_requests || []).filter((r) => {
    if (!r || !r.id) return false;
    const statusUpper = String(r.status || '').toUpperCase();
    if (statusUpper === 'ARCHIVED' || statusUpper === 'DELETED' || statusUpper === 'CANCELLED') return false;
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

        // Independent evaluation of item / sub-indent open status:
        // 1. Must not be fully dispatched or closed
        const dispStatusUpper = String(item.dispatch_status || '').toUpperCase();
        const allocStatusUpper = String(item.allocation_status || '').toUpperCase();
        if (dispStatusUpper === 'FULLY_DISPATCHED' || dispStatusUpper === 'RELEASED_FOR_REQUOTE' || allocStatusUpper === 'RELEASED_FOR_REQUOTE') {
          return;
        }

        // 2. Remaining quantity must be > 0
        const remQty = item.remaining_quantity_mt !== null && item.remaining_quantity_mt !== undefined
          ? Number(item.remaining_quantity_mt)
          : Number(item.quantity_mt || item.required_qty || 0) - Number(item.dispatched_quantity_mt || 0);
        if (remQty <= 0 && Number(item.quantity_mt || item.required_qty || 0) > 0) {
          return;
        }

        // 3. Must not have a finalized/accepted winner in the current cycle
        const itemAcceptedByAnyone = (db.rate_submissions || []).some((s) => {
          if (!s) return false;
          const sReqMatch = String(s.requirement_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReqNo);
          const sItemMatch = String(s.item_id) === String(item.id) || String(s.item_id) === String(subIndentNo);
          return sReqMatch && sItemMatch && isBidFrozen(s);
        });

        if (itemAcceptedByAnyone) {
          return;
        }

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
          required_qty: remQty > 0 ? remQty : Number(item.quantity_mt || item.required_qty || 0),
          quantity_mt: remQty > 0 ? remQty : Number(item.quantity_mt || item.required_qty || 0),
          unit: item.unit || 'MT',
          target_date: item.target_date || parentReq.target_date,
          parent_total_qty: parentReq.total_quantity_mt || parentReq.quantity_mt,
          parent_req_no: parentReqNo,
          source_item_id: item.source_item_id || null,
          is_reopened: Boolean(item.source_item_id)
        });
      });
    } else {
      // Legacy single-item requirement
      const statusUpper = String(parentReq.status || '').toUpperCase();
      if (statusUpper === 'AWARDED' || statusUpper === 'CLOSED' || statusUpper === 'COMPLETED' || statusUpper === 'FULLY_DISPATCHED') {
        return;
      }
      const isAcceptedByAnyone = (db.rate_submissions || []).some(
        (s) => (String(s.rate_request_id) === String(parentReq.id) || String(s.rate_request_id) === String(parentReq.request_no) || String(s.requirement_id) === String(parentReq.id)) && isBidFrozen(s)
      );
      if (!isAcceptedByAnyone) {
        openRateRequests.push({
          ...parentReq,
          item_id: parentReq.id,
          sub_indent_id: parentReq.id,
          sub_indent_no: parentReq.req_no || parentReq.request_no || parentReq.id,
          parent_req_no: parentReq.req_no || parentReq.request_no || parentReq.id
        });
      }
    }
  });

  // Count pending counter offers for badge notification
  const pendingCounterOffers = mySubmissions.filter((s) => (s.counter_offer_status === 'PENDING' || s.bid_status === 'COUNTER_OFFERED') && !isBidFrozen(s));

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

  // 🤝 Negotiation & Dispatch State
  const [activeTransporterCounterSubId, setActiveTransporterCounterSubId] = useState(null);
  const [transporterCounterRateInput, setTransporterCounterRateInput] = useState('');
  const [selectedHistorySub, setSelectedHistorySub] = useState(null);

  // 🚚 Truck Dispatch Modal State
  const [dispatchingReqItem, setDispatchingReqItem] = useState(null);
  const [dispatchFormData, setDispatchFormData] = useState({
    truck_number: '',
    loaded_quantity_mt: '',
    driver_name: '',
    driver_mobile: '',
    driver_license: ''
  });
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

  const handleOpenDispatchModal = (req, myBid) => {
    const dispatches = (db.truck_dispatches || []).filter((d) => {
      if (req && (req.id || req.item_id || req.sub_indent_no)) {
        return (
          d.requirement_item_id === req.id ||
          d.requirement_item_id === req.item_id ||
          d.requirement_item_id === req.sub_indent_no
        );
      }
      return d.requirement_id === (req.requirement_id || req.id);
    });

    const alreadyDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.loaded_quantity_mt || curr.dispatched_qty) || 0), 0);
    const totalQty = parseFloat(req.quantity_mt || req.required_qty || 0);
    const remainingQty = Math.max(0, totalQty - alreadyDispatched);

    setDispatchingReqItem({
      req,
      myBid,
      totalQty,
      dispatchedQty: alreadyDispatched,
      remainingQty
    });
    setDispatchFormData({
      truck_number: '',
      loaded_quantity_mt: remainingQty > 0 ? String(remainingQty) : '',
      driver_name: '',
      driver_mobile: '',
      driver_license: ''
    });
  };

  const handleAcceptFinalRateClick = async (req, myBid, parentReq) => {
    try {
      const subId = myBid?.id;
      if (subId) {
        setSubmittingItems(prev => ({ ...prev, [`accept_${subId}`]: true }));
      }
      const reqId = parentReq?.id || parentReq?.req_no || parentReq?.request_no || req?.requirement_id || req?.id;
      const itemId = req?.id || req?.item_id || req?.sub_indent_id || req?.sub_indent_no || 'MAIN';
      const res = await acceptFinalRate(reqId, itemId, subId);
      if (res && res.success) {
        if (typeof updateLocalRateSubmission === 'function' && myBid) {
          updateLocalRateSubmission({
            ...myBid,
            acceptance_status: 'ACCEPTED',
            transporter_accepted_at: new Date().toISOString()
          });
        }
        setSuccessNotice(`🤝 Successfully accepted finalized rate of ₹${myBid?.final_rate || myBid?.rate_per_mt}/MT for ${req?.sub_indent_no || req?.request_no || req?.id || 'requirement'}. You can now dispatch trucks!`);
        setTimeout(() => setSuccessNotice(''), 6000);
        await safeRefreshRequirements();
      }
    } catch (err) {
      alert(err.message || 'Failed to accept final rate.');
    } finally {
      if (myBid?.id) {
        setSubmittingItems(prev => ({ ...prev, [`accept_${myBid.id}`]: false }));
      }
    }
  };

  const handleDispatchTruckSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!dispatchingReqItem) return;

    const { req, myBid, remainingQty } = dispatchingReqItem;
    const loadedQty = parseFloat(dispatchFormData.loaded_quantity_mt);

    if (isNaN(loadedQty) || loadedQty <= 0) {
      alert('Please enter a valid loaded quantity in MT.');
      return;
    }

    if (loadedQty > remainingQty) {
      alert(`Loaded quantity (${loadedQty} MT) cannot exceed remaining balance (${remainingQty} MT).`);
      return;
    }

    if (!dispatchFormData.truck_number.trim()) {
      alert('Please enter a valid truck vehicle number.');
      return;
    }

    if (!dispatchFormData.driver_name.trim()) {
      alert('Please enter driver name.');
      return;
    }

    if (!dispatchFormData.driver_mobile.trim()) {
      alert('Please enter driver mobile number.');
      return;
    }

    if (!dispatchFormData.driver_license.trim()) {
      alert('Please enter driver license number (DL).');
      return;
    }

    try {
      setIsSubmittingDispatch(true);
      const reqId = req.requirement_id || req.parent_req_no || req.id;
      const itemId = req.id || req.item_id || req.sub_indent_id || req.sub_indent_no || 'MAIN';

      const payload = {
        requirement_id: reqId,
        item_id: itemId,
        requirement_item_id: itemId,
        sub_indent_no: req.sub_indent_no || null,
        truck_number: dispatchFormData.truck_number.trim().toUpperCase(),
        loaded_quantity_mt: loadedQty,
        driver_name: dispatchFormData.driver_name.trim(),
        driver_mobile: dispatchFormData.driver_mobile.trim(),
        driver_license: dispatchFormData.driver_license.trim().toUpperCase()
      };

      const res = await createTruckDispatch(reqId, itemId, payload);
      if (res && res.success) {
        setSuccessNotice(`✓ Truck ${payload.truck_number} dispatched successfully! LR No: ${res.lr_number}`);
        setTimeout(() => setSuccessNotice(''), 6000);
        setDispatchingReqItem(null);
        setSelectedDispatchSlip(res.dispatch || { ...payload, lr_number: res.lr_number, requirement_id: reqId, item_id: itemId, finalized_rate: myBid.final_rate });
        await safeRefreshRequirements();
      }
    } catch (err) {
      alert(err.message || 'Failed to dispatch truck.');
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // ♿ ACCESSIBILITY FOCUS MANAGEMENT: Auto-advance focus to the next unsubmitted item input
  const focusNextUnsubmittedItem = (currentItemId) => {
    setTimeout(() => {
      const allRateInputs = Array.from(document.querySelectorAll('input[id^="rate_input_"]'));
      if (!allRateInputs || allRateInputs.length === 0) {
        const submitAllBtn = document.getElementById('submit_all_batch_bids_btn') || document.getElementById('close_batch_btn_footer');
        if (submitAllBtn) submitAllBtn.focus();
        return;
      }

      const currentInputId = `rate_input_${currentItemId}`;
      const currentIndex = allRateInputs.findIndex(el => el.id === currentInputId || el.id.includes(String(currentItemId)));
      
      let nextInput = null;
      if (currentIndex >= 0 && currentIndex < allRateInputs.length - 1) {
        nextInput = allRateInputs[currentIndex + 1];
      } else if (allRateInputs.length > 0) {
        nextInput = allRateInputs[0];
      }

      if (nextInput) {
        nextInput.focus();
        if (typeof nextInput.select === 'function') nextInput.select();
      } else {
        const submitAllBtn = document.getElementById('submit_all_batch_bids_btn') || document.getElementById('close_batch_btn_footer');
        if (submitAllBtn) submitAllBtn.focus();
      }
    }, 150);
  };

  // 🤝 Render Negotiation Cell for Transporter
  const renderTransporterNegotiationCell = (myExistingBid, req) => {
    if (!myExistingBid) return null;

    const bidStatusUpper = String(myExistingBid.bid_status || myExistingBid.status || '').toUpperCase();
    const counterOfferStatus = String(myExistingBid.counter_offer_status || '').toUpperCase();
    const counterOfferBy = String(myExistingBid.counter_offer_by || '').toUpperCase();

    const origRate = myExistingBid.original_rate || myExistingBid.rate_per_mt || myExistingBid.rate_per_unit || 0;
    const currentRate = myExistingBid.final_rate || myExistingBid.rate_per_mt || myExistingBid.rate_per_unit || origRate;
    const adminCounter = myExistingBid.counter_offer_rate;

    const isFinalized = Boolean(myExistingBid.is_finalized) || isBidFrozen(myExistingBid) || counterOfferStatus === 'ACCEPTED' || bidStatusUpper === 'COUNTER_ACCEPTED' || bidStatusUpper === 'FINALIZED' || Number(myExistingBid.final_rate) > 0;
    const isAccepted = String(myExistingBid.acceptance_status || '').toUpperCase() === 'ACCEPTED';

    // CASE 0 — AWARDED TO ANOTHER TRANSPORTER (NON-WINNING TRANSPORTER VIEW)
    const isAwardedToOther = (
      req.dispatch_status &&
      req.dispatch_status !== 'PENDING' &&
      !isFinalized
    );

    if (isAwardedToOther) {
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '0.8rem',
            background: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            padding: '5px 12px',
            borderRadius: '8px',
            fontWeight: '800',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            🔒 Not Selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedHistorySub(myExistingBid)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', textDecoration: 'underline' }}
          >
            📜 History
          </button>
        </div>
      );
    }
    
    const isCounteredByAdmin = !isFinalized && (
      (counterOfferBy === 'ADMIN' && counterOfferStatus === 'PENDING') ||
      (bidStatusUpper === 'COUNTER_OFFERED' && counterOfferBy !== 'TRANSPORTER') ||
      (!counterOfferBy && Number(adminCounter) > 0 && counterOfferStatus !== 'REJECTED')
    );

    const isCounteredByTransporter = !isFinalized && (
      (counterOfferBy === 'TRANSPORTER' && (counterOfferStatus === 'PENDING' || bidStatusUpper === 'COUNTER_RESPONDED')) ||
      bidStatusUpper === 'COUNTER_RESPONDED'
    );

    const isRejected = !isFinalized && (counterOfferStatus === 'REJECTED' || bidStatusUpper === 'COUNTER_REJECTED');

    const isResponding = submittingItems[`resp_${myExistingBid.id}`];
    const isAccepting = submittingItems[`accept_${myExistingBid.id}`];
    const showCounterInput = activeTransporterCounterSubId === myExistingBid.id;

    const handleAcceptAdminCounter = async () => {
      try {
        setSubmittingItems(prev => ({ ...prev, [`resp_${myExistingBid.id}`]: true }));
        await submitTransporterResponse(myExistingBid.id, { action: 'accept' });
        setSuccessNotice(`✓ Accepted Admin Counter Offer of ₹${adminCounter}/MT for ${req.sub_indent_no || req.request_no || req.id}`);
        setTimeout(() => setSuccessNotice(''), 5000);
        await safeRefreshRequirements();
      } catch (err) {
        alert(err.message || 'Failed to accept counter offer.');
      } finally {
        setSubmittingItems(prev => ({ ...prev, [`resp_${myExistingBid.id}`]: false }));
      }
    };

    const handleRejectAdminCounter = async () => {
      try {
        setSubmittingItems(prev => ({ ...prev, [`resp_${myExistingBid.id}`]: true }));
        await submitTransporterResponse(myExistingBid.id, { action: 'reject' });
        setSuccessNotice(`✕ Rejected Admin Counter Offer for ${req.sub_indent_no || req.request_no || req.id}`);
        setTimeout(() => setSuccessNotice(''), 5000);
        await safeRefreshRequirements();
      } catch (err) {
        alert(err.message || 'Failed to reject counter offer.');
      } finally {
        setSubmittingItems(prev => ({ ...prev, [`resp_${myExistingBid.id}`]: false }));
      }
    };

    const handleSendTransporterCounter = async (e) => {
      if (e) e.preventDefault();
      const counterVal = parseFloat(transporterCounterRateInput);
      if (!counterVal || counterVal <= 0) {
        alert('Please enter a valid rate.');
        return;
      }
      try {
        setSubmittingItems(prev => ({ ...prev, [`resp_${myExistingBid.id}`]: true }));
        await submitTransporterResponse(myExistingBid.id, { action: 'counter', counter_rate: counterVal });
        setSuccessNotice(`⚡ Counter Offer ₹${counterVal}/MT submitted to Admin for ${req.sub_indent_no || req.request_no || req.id}`);
        setActiveTransporterCounterSubId(null);
        setTransporterCounterRateInput('');
        setTimeout(() => setSuccessNotice(''), 5000);
        await safeRefreshRequirements();
      } catch (err) {
        alert(err.message || 'Failed to submit counter offer.');
      } finally {
        setSubmittingItems(prev => ({ ...prev, [`resp_${myExistingBid.id}`]: false }));
      }
    };

    // CASE C — FINALIZED RATE FLOW (WINNING TRANSPORTER)
    if (isFinalized) {
      const remainingQty = req.remaining_quantity_mt !== undefined && req.remaining_quantity_mt !== null
        ? Number(req.remaining_quantity_mt)
        : Math.max(0, Number(req.quantity_mt || req.required_qty || 0) - Number(req.dispatched_quantity_mt || 0));
      const dispatchedQty = Number(req.dispatched_quantity_mt || 0);
      const isFullyDispatched = remainingQty <= 0 && dispatchedQty > 0;

      if (!isAccepted) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fffbeb', border: '1.5px solid #f59e0b', padding: '10px 14px', borderRadius: '12px', minWidth: '260px' }}>
            <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🏆 Rate Finalized — Final Agreed Rate: <span style={{ background: '#fef3c7', padding: '2px 8px', borderRadius: '6px', border: '1px solid #f59e0b', color: '#92400e' }}>₹{myExistingBid.final_rate || currentRate}/MT</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={isAccepting}
                onClick={() => handleAcceptFinalRateClick(req, myExistingBid)}
                className="btn btn-success"
                style={{ padding: '7px 16px', fontSize: '0.84rem', fontWeight: '900', borderRadius: '8px', background: '#16a34a', color: '#ffffff', border: 'none', cursor: isAccepting ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isAccepting ? '⏳ Accepting...' : '🤝 Accept Final Rate'}
              </button>
              <button type="button" onClick={() => setSelectedHistorySub(myExistingBid)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', textDecoration: 'underline' }}>
                📜 History
              </button>
            </div>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#dcfce7', border: '1.5px solid #16a34a', padding: '10px 14px', borderRadius: '12px', minWidth: '260px' }}>
          <div style={{ fontSize: '0.92rem', fontWeight: '900', color: '#064e3b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✅ Rate Accepted (₹{myExistingBid.final_rate || currentRate}/MT)
          </div>
          <div style={{ fontSize: '0.78rem', color: '#047857', fontWeight: '700' }}>
            Dispatched: <strong>{dispatchedQty} MT</strong> | Remaining: <strong>{remainingQty} MT</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
            {isFullyDispatched ? (
              <span style={{ background: '#059669', color: '#ffffff', padding: '5px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '900' }}>
                🎉 100% Fully Dispatched
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenDispatchModal(req, myExistingBid)}
                className="btn btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.84rem', fontWeight: '900', borderRadius: '8px', background: '#0284c7', color: '#ffffff', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                🚚 Dispatch New Truck
              </button>
            )}
            <button type="button" onClick={() => setSelectedHistorySub(myExistingBid)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', textDecoration: 'underline' }}>
              📜 History
            </button>
          </div>
        </div>
      );
    }

    // CASE A — ADMIN COUNTER OFFER
    if (isCounteredByAdmin) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#fffbeb', border: '1.5px solid #f59e0b', padding: '12px 16px', borderRadius: '12px', minWidth: '260px' }}>
          <div style={{ fontSize: '0.82rem', color: '#78350f', fontWeight: '700' }}>
            Your Original Bid: <strong style={{ color: '#92400e' }}>₹{origRate}/MT</strong>
          </div>
          <div style={{ fontSize: '0.98rem', fontWeight: '900', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚠ ADMIN COUNTER OFFER: <span style={{ background: '#fef3c7', padding: '4px 12px', borderRadius: '6px', border: '1.5px solid #f59e0b', fontSize: '1.1rem', color: '#92400e' }}>₹{adminCounter}/MT</span>
          </div>

          {showCounterInput ? (
            <form onSubmit={handleSendTransporterCounter} style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="Your Rate"
                className="form-control"
                value={transporterCounterRateInput}
                onChange={(e) => setTransporterCounterRateInput(e.target.value)}
                style={{ width: '110px', height: '36px', fontSize: '0.9rem', fontWeight: '800' }}
                required
              />
              <button type="submit" disabled={isResponding} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.82rem', height: '36px' }}>
                {isResponding ? '⏳...' : 'Send Counter'}
              </button>
              <button type="button" onClick={() => setActiveTransporterCounterSubId(null)} className="btn" style={{ padding: '6px 12px', fontSize: '0.82rem', height: '36px', background: '#cbd5e1' }}>
                Cancel
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                disabled={isResponding}
                onClick={handleAcceptAdminCounter}
                className="btn btn-success"
                style={{ padding: '7px 16px', fontSize: '0.84rem', fontWeight: '900', borderRadius: '8px', background: '#16a34a', color: '#ffffff', border: 'none', cursor: isResponding ? 'not-allowed' : 'pointer' }}
              >
                {isResponding ? '⏳...' : `✓ Accept Counter Offer (₹${adminCounter})`}
              </button>
              <button
                type="button"
                disabled={isResponding}
                onClick={handleRejectAdminCounter}
                className="btn btn-danger"
                style={{ padding: '7px 14px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', background: '#ef4444', color: '#ffffff', border: 'none', cursor: isResponding ? 'not-allowed' : 'pointer' }}
              >
                ✕ Reject Counter Offer
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTransporterCounterSubId(myExistingBid.id);
                  setTransporterCounterRateInput(String(Math.round((Number(origRate || 0) + Number(adminCounter || 0)) / 2)));
                }}
                className="btn btn-primary"
                style={{ padding: '7px 14px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', background: '#0284c7', color: '#ffffff', border: 'none' }}
              >
                ↔ Counter Offer
              </button>
              <button type="button" onClick={() => setSelectedHistorySub(myExistingBid)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textDecoration: 'underline' }}>
                📜 History
              </button>
            </div>
          )}
        </div>
      );
    }

    // CASE B — TRANSPORTER HAS SENT COUNTER (Waiting for Admin Response)
    if (isCounteredByTransporter) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#eff6ff', border: '1.5px solid #3b82f6', padding: '12px 16px', borderRadius: '12px', minWidth: '260px' }}>
          <div style={{ fontSize: '0.82rem', color: '#1e40af', fontWeight: '700' }}>
            Your Original Bid: <strong style={{ color: '#1e3a8a' }}>₹{origRate}/MT</strong>
          </div>
          <div style={{ fontSize: '0.98rem', fontWeight: '900', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📤 YOUR COUNTER OFFER: <span style={{ background: '#dbeafe', padding: '4px 12px', borderRadius: '6px', border: '1.5px solid #3b82f6', fontSize: '1.1rem', color: '#1e40af' }}>₹{adminCounter || currentRate}/MT</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#d97706', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>⏳ Waiting for Admin Response</span>
            <button type="button" onClick={() => setSelectedHistorySub(myExistingBid)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', textDecoration: 'underline' }}>
              📜 Negotiation History
            </button>
          </div>
        </div>
      );
    }

    // CASE D — COUNTER REJECTED
    if (isRejected) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#fef2f2', border: '1.5px solid #ef4444', padding: '10px 14px', borderRadius: '10px', minWidth: '240px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#b91c1c' }}>
            ✕ Counter Offer Rejected
          </div>
          <div style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>
            Your Original Quote: <strong>₹{origRate}/MT</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => {
                setActiveTransporterCounterSubId(myExistingBid.id);
                setTransporterCounterRateInput(String(origRate));
              }}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: '800', borderRadius: '8px', background: '#0284c7' }}
            >
              ↔ Submit New Quote
            </button>
            <button type="button" onClick={() => setSelectedHistorySub(myExistingBid)} style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', textDecoration: 'underline' }}>
              📜 History
            </button>
          </div>
        </div>
      );
    }

    // DEFAULT STATUS = 'submitted' — Render ONLY the exact Current Bid pill badge (matching Image 2)
    return (
      <div className="current-bid-preview submitted" style={{
        background: '#dcfce7',
        border: '1.5px solid #16a34a',
        padding: '6px 16px',
        borderRadius: '12px',
        color: '#065f46',
        fontSize: '0.95rem',
        fontWeight: '800',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '180px',
        gap: '24px',
        whiteSpace: 'nowrap',
        boxShadow: '0 1px 3px rgba(22, 163, 74, 0.12)'
      }}>
        <span style={{ color: '#047857', fontWeight: '800', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          ✓ Current Bid:
        </span>
        <strong style={{ color: '#064e3b', fontWeight: '900', fontSize: '1.15rem', letterSpacing: '-0.01em' }}>
          ₹{currentRate}/MT
        </strong>
      </div>
    );
  };

  // FAST 1-LINE INLINE SUBMIT HANDLER (Supports Double/Re-Quoted Bids 🚀)
  const handleExpressQuickSubmit = async (req, explicitRateValue = null) => {
    if (!currentTransporter) {
      alert('Please select or log in to a Transporter Account first.');
      return;
    }

    const parentReqId = req.requirement_id || req.id;
    const targetItemId = req.item_id || req.sub_indent_id || req.id;
    const subIndentNo = req.sub_indent_no || req.request_no || req.id;
    const rateKey = getSubIndentKey(req);
    const transId = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';
    const bidKey = `${String(parentReqId).trim()}::${String(targetItemId).trim()}::${String(transId).trim()}`;

    // 🔒 1. SINGLE CLICK & DOUBLE SUBMISSION LOCK PROTECTION
    if (submittingItems[bidKey] || submittingItems[rateKey] || submittingItems[req.id]) {
      return;
    }

    // 🔍 2. PREVENT STALE STATE BUG: Read rate directly with multiple robust fallbacks
    const normalizedDirect = String(explicitRateValue ?? '').replace(/[₹,\s]/g, '').trim();
    let rawInput = normalizedDirect;

    if (!rawInput) {
      const stateVal = quickRates[rateKey] !== undefined ? quickRates[rateKey] : (quickRates[req.id] !== undefined ? quickRates[req.id] : quickRates[targetItemId]);
      rawInput = String(stateVal ?? '').replace(/[₹,\s]/g, '').trim();
    }

    if (!rawInput) {
      const el = document.getElementById(`rate_input_${req.item_id || req.sub_indent_no || req.id}`) ||
                 document.getElementById(`rate_input_${targetItemId}`) ||
                 document.getElementById(`rate_input_${req.id}`) ||
                 document.getElementById(`rate_input_${subIndentNo}`);
      if (el && el.value) {
        rawInput = String(el.value).replace(/[₹,\s]/g, '').trim();
      }
    }

    const rateVal = Number(rawInput);

    // 🛡️ 3. VALIDATE RATE: Accepts any positive finite number (> 0, e.g. 22, 22.5, 44, 55, 2450)
    if (!rawInput || !Number.isFinite(rateVal) || rateVal <= 0) {
      alert('Please enter a valid freight rate greater than ₹0.');
      return;
    }

    setSubmittingItems((prev) => ({
      ...prev,
      [bidKey]: true,
      [rateKey]: true,
      [req.id]: true
    }));

    try {
      const qtyVal = Number(req.required_qty || req.quantity_mt || 0);
      const totalCalcAmount = parseFloat((rateVal * qtyVal).toFixed(2));

      // ⏱️ 4. 15-SECOND NETWORK TIMEOUT PROTECTION
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Persist bid directly to MySQL rate_submissions table via API
      const result = await submitBid({
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
      }, { signal: controller.signal });

      clearTimeout(timeoutId);

      if (!result || (result.success === false && !result.submission)) {
        throw new Error(result?.error?.message || result?.message || 'Quote submission failed');
      }

      // ⚡ 1. Immediate Local State Update using the EXACT server response
      const savedBid = result?.data || result?.submission || result?.bid || {
        id: `sub_${transId}_${targetItemId}_${Date.now()}`,
        requirement_id: parentReqId,
        rate_request_id: parentReqId,
        item_id: targetItemId,
        sub_indent_id: targetItemId,
        request_no: subIndentNo,
        sub_indent_no: subIndentNo,
        transporter_id: transId,
        transporter_name: currentTransporter?.company_name || transId,
        rate_per_unit: rateVal,
        rate_per_mt: rateVal,
        original_rate: rateVal,
        quoted_quantity_mt: qtyVal,
        total_amount: totalCalcAmount,
        bid_status: 'Submitted',
        status: 'Submitted',
        negotiation_status: 'Submitted',
        submitted_at: new Date().toISOString()
      };

      if (typeof updateLocalRateSubmission === 'function') {
        updateLocalRateSubmission(savedBid);
      }

      setSuccessNotice(`⚡ Quote rate ₹${rateVal.toLocaleString()}/MT submitted for ${subIndentNo}!`);
      setQuickRates((prev) => ({ ...prev, [rateKey]: '', [req.id]: '' }));
      setTimeout(() => setSuccessNotice(''), 5000);

      // ⚡ 2. Safely re-fetch fresh MySQL database state so hasSubmittedQuote remains permanently true
      await safeRefreshRequirements();

      // ♿ ACCESSIBILITY: Auto-advance focus to the next unsubmitted item input
      focusNextUnsubmittedItem(targetItemId);
    } catch (err) {
      console.error('Quote submission error:', err);
      if (err.name === 'AbortError') {
        alert('Network request timed out. Please check your connection and click Quote again.');
      } else {
        alert(err.message || 'Unable to submit quote. Please try again.');
      }
    } finally {
      // 🔓 ALWAYS RELEASE LOCK IN FINALLY
      setSubmittingItems((prev) => ({
        ...prev,
        [bidKey]: false,
        [rateKey]: false,
        [req.id]: false
      }));
    }
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

    const normalizedModalRate = String(bidForm.rate_per_unit ?? '').replace(/[₹,\s]/g, '').trim();
    const rateVal = Number(normalizedModalRate);
    if (!normalizedModalRate || !Number.isFinite(rateVal) || rateVal <= 0) {
      alert('Please enter a valid freight rate greater than ₹0.');
      return;
    }

    let updatedSubmissions = [...(db.rate_submissions || [])];
    const transIdForModal = currentTransporter?.id || currentTransporter?.code || currentTransporter?.username || 'transporter';
    const existingIdx = updatedSubmissions.findIndex(
      (s) => (String(s.rate_request_id) === String(selectedReqForBid.id) || String(s.rate_request_id) === String(selectedReqForBid.request_no)) &&
             (String(s.transporter_id) === String(transIdForModal) || String(s.transporter_id) === String(currentTransporter?.code) || String(s.transporter_id) === String(currentTransporter?.username))
    );

    if (existingIdx >= 0 && isBidFrozen(updatedSubmissions[existingIdx])) {
      alert(`🛑 RATE FROZEN: Your agreed rate of ₹${updatedSubmissions[existingIdx].rate_per_unit || updatedSubmissions[existingIdx].final_rate}/MT has already been accepted/awarded and cannot be changed.`);
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
          final_rate: agreedRate,
          bid_status: 'COUNTER_ACCEPTED',
          counter_offer_status: 'ACCEPTED',
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
  const handleLegacyAllocationDispatchSubmit = (e, alloc) => {
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

            <div
              onClick={() => setActiveTab('my_bids')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('my_bids'); }}
              style={{
                background: activeTab === 'my_bids' ? 'rgba(52, 211, 153, 0.18)' : 'rgba(255,255,255,0.06)',
                border: activeTab === 'my_bids' ? '1.5px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: activeTab === 'my_bids' ? '0 0 16px rgba(52, 211, 153, 0.35)' : 'none',
                padding: '10px 16px',
                borderRadius: '12px',
                textAlign: 'right',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
              title="Click to view all your submitted freight bids"
            >
              <div style={{ fontSize: '0.74rem', color: activeTab === 'my_bids' ? '#34d399' : 'var(--text-muted)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                <History size={13} /> MY SUBMITTED BIDS ➔
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399', marginTop: '2px' }}>
                {dashboardSummary.submittedBids !== undefined ? dashboardSummary.submittedBids : mySubmissions.length} Bids
              </div>
            </div>

            <div
              onClick={() => setActiveTab('allocations')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('allocations'); }}
              style={{
                background: activeTab === 'allocations' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255,255,255,0.06)',
                border: activeTab === 'allocations' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: activeTab === 'allocations' ? '0 0 16px rgba(56, 189, 248, 0.35)' : 'none',
                padding: '10px 16px',
                borderRadius: '12px',
                textAlign: 'right',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
              title="Click to view all your awarded freight contracts and dispatch trucks"
            >
              <div style={{ fontSize: '0.74rem', color: activeTab === 'allocations' ? '#38bdf8' : 'var(--text-muted)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                <Truck size={13} /> MY CONTRACTS ➔
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8', marginTop: '2px' }}>
                {dashboardSummary.contracts !== undefined ? dashboardSummary.contracts : totalContractsCount} Total
              </div>
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

      {/* TAB 1: Available Open Requirements */}
      {activeTab === 'open_requests' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>
              Available Freight Requirements for Bidding
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Enter your quote rate directly on the line and click Quote for 1-second submission!</p>
          </div>

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
                                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                    Click anywhere on this batch row to open sub-indents
                                  </div>
                                </td>

                                <td>
                                  <div style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.95rem' }}>{(totalBatchQty || 0).toLocaleString()} MT Total</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{group.items.length} Cargo Items</div>
                                </td>

                                <td>
                                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>-</div>
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
                                           <span style={{ fontSize: '0.78rem', background: '#e0f2fe', color: '#0284c7', border: '1px solid #7dd3fc', padding: '4px 12px', borderRadius: '20px', fontWeight: '800' }}>
                                             📦 Multi-Route Sub-Indents ({group.items.length} Items)
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
                                                const myExistingBid = findMyBid(req, db.rate_submissions, currentTransporter, currentUser);
                                                const currentBidRate = getBidRate(myExistingBid);
                                                const hasSubmittedQuote = currentBidRate !== null;
                                                const isAwarded = req.status === 'Awarded';
                                                const subKey = getSubIndentKey(req);
                                                const isSubmitting = submittingItems[subKey] || submittingItems[req.id];
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
                                                      {req.source_item_id && (
                                                        <span className="badge badge-warning" style={{
                                                          fontSize: '0.7rem',
                                                          background: '#fef3c7',
                                                          color: '#b45309',
                                                          border: '1px solid #f59e0b',
                                                          padding: '2px 6px',
                                                          borderRadius: '4px',
                                                          fontWeight: '800',
                                                          display: 'inline-flex',
                                                          alignItems: 'center',
                                                          gap: '3px',
                                                          marginTop: '2px'
                                                        }}>
                                                          🔄 RE-OPENED FOR QUOTE
                                                        </span>
                                                      )}
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
                                                      {hasSubmittedQuote ? (
                                                        renderTransporterNegotiationCell(myExistingBid, req)
                                                      ) : (isAwarded || (req.dispatch_status && req.dispatch_status !== 'PENDING')) ? (
                                                        <span style={{
                                                          fontSize: '0.8rem',
                                                          background: '#f1f5f9',
                                                          color: '#64748b',
                                                          border: '1px solid #cbd5e1',
                                                          padding: '5px 12px',
                                                          borderRadius: '8px',
                                                          fontWeight: '800',
                                                          display: 'inline-flex',
                                                          alignItems: 'center',
                                                          gap: '4px'
                                                        }}>
                                                          🔒 Not Selected
                                                        </span>
                                                      ) : (
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                                          <div style={{ position: 'relative' }}>
                                                            <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                                                            <input
                                                              id={`rate_input_${req.item_id || req.sub_indent_no || req.id}`}
                                                              type="number"
                                                              inputMode="decimal"
                                                              min="1"
                                                              step="0.01"
                                                              placeholder="Rate"
                                                              aria-label={`Enter quote rate for ${displayCode}`}
                                                              className="form-control"
                                                              disabled={isSubmitting}
                                                              value={currentInputRate}
                                                              onChange={(e) => {
                                                                const val = e.target.value;
                                                                const key = getSubIndentKey(req);
                                                                setQuickRates((prev) => ({
                                                                  ...prev,
                                                                  [key]: val,
                                                                  [req.id]: val
                                                                }));
                                                              }}
                                                              onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  handleExpressQuickSubmit(req, currentInputRate);
                                                                }
                                                              }}
                                                              style={{ paddingLeft: '22px', fontSize: '0.86rem', fontWeight: '800', height: '36px', width: '110px' }}
                                                            />
                                                          </div>

                                                          <button
                                                            type="button"
                                                            aria-label={`Submit quote for ${displayCode}`}
                                                            className="btn btn-primary"
                                                            disabled={isSubmitting}
                                                            onClick={(e) => {
                                                              e.preventDefault();
                                                              e.stopPropagation();
                                                              handleExpressQuickSubmit(req, currentInputRate);
                                                            }}
                                                            style={{
                                                              padding: '6px 14px',
                                                              fontSize: '0.8rem',
                                                              whiteSpace: 'nowrap',
                                                              height: '36px',
                                                              borderRadius: '8px',
                                                              fontWeight: '900',
                                                              display: 'inline-flex',
                                                              alignItems: 'center',
                                                              gap: '4px',
                                                              cursor: isSubmitting ? 'not-allowed' : 'pointer'
                                                            }}
                                                          >
                                                            {isSubmitting ? '⏳ Submitting...' : '🚀 Quote'}
                                                          </button>
                                                        </div>
                                                      )}
                                                    </td>

                                                    <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                                                      {hasSubmittedQuote ? (
                                                        <span className="badge badge-awarded" style={{
                                                          fontSize: '0.76rem',
                                                          padding: '6px 12px',
                                                          background: '#dcfce7',
                                                          color: '#047857',
                                                          border: '1px solid #86efac',
                                                          borderRadius: '8px',
                                                          fontWeight: '900'
                                                        }}>
                                                          ✓ Quote Submitted
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

                                      {/* BATCH QUOTE ACTION FOOTER BELOW TABLE 🚀 */}
                                      {(() => {
                                        const unquotedItems = (group.items || []).filter((reqItem) => {
                                          const isQuoted = Boolean(findMyBid(reqItem));
                                          return !isQuoted && reqItem.status !== 'Awarded';
                                        });

                                        const unquotedCount = unquotedItems.length;

                                        return (
                                          <div style={{
                                            marginTop: '16px',
                                            paddingTop: '16px',
                                            borderTop: '2px dashed #cbd5e1',
                                            textAlign: 'center',
                                            background: unquotedCount > 0 ? 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' : '#f0fdf4',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            border: unquotedCount > 0 ? '1px dashed #94a3b8' : '1px solid #bbf7d0'
                                          }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: '900', color: unquotedCount > 0 ? '#0284c7' : '#047857', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                              ⚡ BATCH QUOTE ACTION
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: unquotedCount > 0 ? '#64748b' : '#15803d', marginTop: '2px', marginBottom: '14px', fontWeight: '600' }}>
                                              {unquotedCount > 0
                                                ? 'Type rates into the input boxes above and submit all pending quotes together in 1-Click'
                                                : `All ${group.items.length} sub-indents in this batch have active quotes recorded.`}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                              {unquotedCount > 0 ? (
                                                <button
                                                  id="submit_all_batch_bids_btn"
                                                  type="button"
                                                  onClick={() => handleBatchSubmitAll(group.batchKey, group.items)}
                                                  aria-label="Submit all pending batch bids"
                                                  className="btn btn-primary"
                                                  style={{
                                                    padding: '10px 24px',
                                                    fontSize: '0.88rem',
                                                    fontWeight: '900',
                                                    background: 'linear-gradient(135deg, #0284c7 0%, #059669 100%)',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                                                  }}
                                                  title="Submit individual typed rates for all pending batch sub-indents in 1-Click"
                                                >
                                                  <Send size={16} /> 🚀 Submit All Batch Bids ({unquotedCount})
                                                </button>
                                              ) : (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#dcfce7', color: '#047857', border: '1.5px solid #16a34a', padding: '8px 18px', borderRadius: '10px', fontWeight: '900', fontSize: '0.88rem' }}>
                                                  ✓ All Batch Quotes Submitted
                                                </div>
                                              )}

                                              <button
                                                id="close_batch_btn_footer"
                                                type="button"
                                                onClick={() => toggleBatchExpand(group.batchKey)}
                                                aria-label="Close batch folder"
                                                className="btn"
                                                style={{
                                                  background: '#0284c7',
                                                  color: '#ffffff',
                                                  border: 'none',
                                                  padding: '10px 18px',
                                                  fontSize: '0.88rem',
                                                  fontWeight: '800',
                                                  borderRadius: '10px',
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                📂 Close Batch 🔼
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })()}

                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        }

                        // SINGLE ITEM ROW
                      const req = group.items[0];
                      const myExistingBid = findMyBid(req, db.rate_submissions, currentTransporter, currentUser);
                      const currentBidRate = getBidRate(myExistingBid);
                      const hasSubmittedQuote = currentBidRate !== null;
                      const isAwarded = req.status === 'Awarded';
                      const isSubmitting = submittingItems[req.id];
                      const currentInputRate = quickRates[req.id] || '';
                      const displayCode = req.request_no || req.title;

                      return (
                        <tr
                          key={req.id}
                          style={{
                            background: hasSubmittedQuote
                              ? 'rgba(16, 185, 129, 0.06)'
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
                            {req.source_item_id && (
                              <span className="badge badge-warning" style={{
                                fontSize: '0.7rem',
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #f59e0b',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontWeight: '800',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                marginTop: '2px'
                              }}>
                                🔄 RE-OPENED FOR QUOTE
                              </span>
                            )}
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
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
                            {hasSubmittedQuote ? (
                              renderTransporterNegotiationCell(myExistingBid, req)
                            ) : (isAwarded || (req.dispatch_status && req.dispatch_status !== 'PENDING')) ? (
                              <span style={{
                                fontSize: '0.8rem',
                                background: '#f1f5f9',
                                color: '#64748b',
                                border: '1px solid #cbd5e1',
                                padding: '5px 12px',
                                borderRadius: '8px',
                                fontWeight: '800',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                🔒 Not Selected
                              </span>
                            ) : (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ position: 'relative' }}>
                                  <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>₹</span>
                                  <input
                                    id={`rate_input_${req.id}`}
                                    type="number"
                                    inputMode="decimal"
                                    min="1"
                                    step="0.01"
                                    placeholder="Rate"
                                    aria-label={`Enter quote rate for ${displayCode}`}
                                    className="form-control"
                                    disabled={isSubmitting}
                                    value={currentInputRate}
                                    onChange={(e) => setQuickRates({ ...quickRates, [req.id]: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleExpressQuickSubmit(req, currentInputRate);
                                      }
                                    }}
                                    style={{ paddingLeft: '22px', fontSize: '0.88rem', fontWeight: '700', height: '36px', width: '110px' }}
                                  />
                                </div>
                                <button
                                  type="button"
                                  aria-label={`Submit quote for ${displayCode}`}
                                  className="btn btn-primary"
                                  disabled={isSubmitting}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleExpressQuickSubmit(req, currentInputRate);
                                  }}
                                  style={{
                                    padding: '6px 14px',
                                    fontSize: '0.8rem',
                                    whiteSpace: 'nowrap',
                                    height: '36px',
                                    borderRadius: '8px',
                                    fontWeight: '900',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    cursor: isSubmitting ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {isSubmitting ? '⏳ Submitting...' : '🚀 Quote'}
                                </button>
                              </div>
                            )}
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {hasSubmittedQuote ? (
                              <span className="badge badge-awarded" style={{
                                fontSize: '0.76rem',
                                padding: '6px 12px',
                                background: '#dcfce7',
                                color: '#047857',
                                border: '1px solid #86efac',
                                borderRadius: '8px',
                                fontWeight: '900'
                              }}>
                                ✓ Quote Submitted
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
        </div>
      )}

      {/* TAB 2: Allocations & Truck Dispatch */}
      {activeTab === 'allocations' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Awarded Freight Contracts & Dispatch Management</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                All finalized freight requirements and delivery contracts awarded to {currentTransporter.company_name}
              </p>
            </div>

            {/* Sub-Filters: All, Active Pending, Completed */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setAllocationFilter('all')}
                className={allocationFilter === 'all' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                All Contracts ({totalContractsCount})
              </button>
              <button
                onClick={() => setAllocationFilter('active')}
                className={allocationFilter === 'active' ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              >
                🚚 Active / In-Progress
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

          {/* 1. Modern Awarded / Finalized Requirement Contracts */}
          {myFinalizedItems
            .filter(({ item, parentReq }) => {
              const dispatches = (db.truck_dispatches || []).filter((d) => {
                if (item && item.id) {
                  return d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no;
                }
                return d.requirement_id === parentReq.id;
              });
              const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.loaded_quantity_mt || curr.dispatched_qty) || 0), 0);
              const allocatedQty = parseFloat(item.quantity_mt || item.required_qty || parentReq.quantity_mt || parentReq.required_qty || 0);
              const remainingBalance = Math.max(0, allocatedQty - totalDispatched);
              const isReleasedForRequote = item.dispatch_status === 'RELEASED_FOR_REQUOTE' || item.allocation_status === 'RELEASED_FOR_REQUOTE';
              const isCompleted = (!isReleasedForRequote && remainingBalance <= 0) || item.dispatch_status === 'FULLY_DISPATCHED';

              if (allocationFilter === 'active') return !isCompleted;
              if (allocationFilter === 'completed') return isCompleted;
              return true;
            })
            .map(({ item, parentReq, myBid, uniqueKey }) => {
              const reqNo = parentReq.req_no || parentReq.request_no || parentReq.id;
              const subCode = item.sub_indent_no || `${reqNo}/${item.id || '01'}`;
              const originCity = item.pickup_origin || parentReq.pickup_origin || parentReq.origin_city || '-';
              const destCity = item.drop_location || parentReq.drop_location || parentReq.dest_city || '-';
              const cargo = item.product_name || parentReq.product_name || parentReq.material_type || 'Cargo';
              const totalQty = parseFloat(item.quantity_mt || item.required_qty || parentReq.quantity_mt || parentReq.required_qty || 0);
              const finalRate = Number(myBid.final_rate || myBid.rate_per_mt || myBid.rate_per_unit || 0);
              const isAccepted = String(myBid.acceptance_status || '').toUpperCase() === 'ACCEPTED';

              const dispatches = (db.truck_dispatches || []).filter((d) => {
                if (item && item.id) {
                  return d.requirement_item_id === item.id || d.requirement_item_id === item.sub_indent_no;
                }
                return d.requirement_id === parentReq.id;
              });
              const totalDispatched = dispatches.reduce((acc, curr) => acc + (parseFloat(curr.loaded_quantity_mt || curr.dispatched_qty) || 0), 0);
              const remainingBalance = Math.max(0, totalQty - totalDispatched);
              const isReleasedForRequote = item.dispatch_status === 'RELEASED_FOR_REQUOTE' || item.allocation_status === 'RELEASED_FOR_REQUOTE';
              const isCompleted = (!isReleasedForRequote && remainingBalance <= 0) || item.dispatch_status === 'FULLY_DISPATCHED';

              return (
                <div
                  key={uniqueKey}
                  style={{
                    background: isReleasedForRequote
                      ? 'rgba(245, 158, 11, 0.04)'
                      : isCompleted
                      ? 'rgba(16, 185, 129, 0.04)'
                      : 'rgba(255,255,255,0.03)',
                    border: isReleasedForRequote
                      ? '1px solid #f59e0b'
                      : isCompleted
                      ? '1px solid #10b981'
                      : '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '20px',
                    marginBottom: '24px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span className={isReleasedForRequote ? "badge badge-warning" : isCompleted ? "badge badge-awarded" : isAccepted ? "badge badge-open" : "badge badge-warning"}>
                          {isReleasedForRequote
                            ? '🔄 REMAINING QUANTITY RELEASED FOR RE-QUOTE'
                            : isCompleted
                            ? '✓ CONTRACT COMPLETED'
                            : isAccepted
                            ? '✅ ACTIVE CONTRACT'
                            : '🏆 AWAITING ACCEPTANCE'}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: '800' }}>
                          {subCode}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          (Parent: {reqNo})
                        </span>
                      </div>
                      <h4 style={{ fontSize: '1.2rem', fontWeight: '800' }}>{cargo} Delivery</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                        📍 {originCity} ➔ 📍 {destCity}
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Agreed Freight Rate</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#34d399' }}>₹{finalRate}/MT</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Allocated: <strong>{totalQty} MT</strong> | Dispatched: <strong style={{ color: '#38bdf8' }}>{totalDispatched} MT</strong> | {isReleasedForRequote ? <span>Released: <strong style={{ color: '#fbbf24' }}>{remainingBalance} MT</strong></span> : <span>Balance: <strong style={{ color: isCompleted ? '#34d399' : '#fbbf24' }}>{remainingBalance} MT</strong></span>}
                      </div>
                    </div>
                  </div>

                  {isReleasedForRequote ? (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ fontSize: '1.4rem' }}>🔄</div>
                      <div>
                        <div style={{ color: '#fbbf24', fontWeight: '800', fontSize: '0.9rem' }}>
                          Remaining Quantity ({remainingBalance} MT) Released for Fresh Re-Quote
                        </div>
                        <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem', marginTop: '2px' }}>
                          Dispatched {totalDispatched} MT under this contract. Further truck dispatch for the released balance is closed. Existing dispatch history and LR records remain fully preserved.
                        </div>
                      </div>
                    </div>
                  ) : !isAccepted ? (
                    <div style={{
                      background: 'rgba(245, 158, 11, 0.12)',
                      border: '1px solid #f59e0b',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{ color: '#fbbf24', fontWeight: '800', fontSize: '0.9rem' }}>
                          🏆 Quote Finalized at ₹{finalRate}/MT
                        </div>
                        <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                          Please accept the final negotiated freight rate to unlock truck dispatching.
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={submittingItems[`accept_${myBid.id}`]}
                        onClick={() => handleAcceptFinalRateClick(item, myBid, parentReq)}
                        className="btn btn-success"
                        style={{ padding: '8px 20px', fontWeight: '800', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {submittingItems[`accept_${myBid.id}`] ? '⏳ Accepting...' : '🤝 Accept Final Rate'}
                      </button>
                    </div>
                  ) : !isCompleted ? (
                    <div style={{
                      background: 'rgba(56, 189, 248, 0.08)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div>
                        <div style={{ color: '#38bdf8', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={16} color="#34d399" /> Rate Accepted — Ready for Truck Dispatch
                        </div>
                        <div style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>
                          Remaining capacity to dispatch: <strong style={{ color: '#fbbf24' }}>{remainingBalance} MT</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDispatchModal(item, myBid)}
                        className="btn btn-primary"
                        style={{ padding: '8px 20px', fontWeight: '800', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Truck size={16} /> Dispatch New Truck
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#34d399',
                      fontWeight: '800',
                      fontSize: '0.88rem'
                    }}>
                      <CheckCircle2 size={18} /> 100% Contract Quantity Fully Dispatched ({totalQty} MT)
                    </div>
                  )}

                  {/* Dispatches list if any */}
                  {dispatches.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        DISPATCHED TRUCKS & LR HISTORY ({dispatches.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {dispatches.map((disp) => (
                          <div key={disp.id} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800' }}>
                              <span style={{ color: '#38bdf8' }}>{disp.truck_number}</span>
                              <span style={{ color: '#34d399' }}>{disp.loaded_quantity_mt || disp.dispatched_qty} MT</span>
                            </div>
                            <div style={{ color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                              LR: {disp.lr_number}
                            </div>
                            <div style={{ color: 'var(--text-sub)', marginTop: '2px' }}>
                              Driver: {disp.driver_name} ({disp.driver_mobile || disp.driver_phone})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {/* 2. Legacy Allocations */}
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

                          <form onSubmit={(e) => handleLegacyAllocationDispatchSubmit(e, alloc)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>My Submitted Freight Bids & Counter-Offers History</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Comprehensive log of all freight bids submitted by {currentTransporter.company_name}
              </p>
            </div>
            <span className="badge badge-open" style={{ fontSize: '0.82rem', padding: '6px 14px', fontWeight: '800' }}>
              Total Bids: {mySubmissions.length}
            </span>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Req No. & Sub-Indent</th>
                  <th>Route & Cargo</th>
                  <th>Submitted Quote</th>
                  <th>Est. Total Amount</th>
                  <th>Bid Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mySubmissions.map((sub) => {
                  const req = (db.rate_requests || []).find((r) => r.id === sub.rate_request_id || r.id === sub.requirement_id || r.req_no === sub.requirement_id || r.req_no === sub.request_no);
                  const childItem = req?.items?.find((i) => i.id === sub.item_id || i.sub_indent_no === sub.item_id || i.sub_indent_no === sub.sub_indent_no);
                  const targetItem = childItem || (req?.items && req.items.length === 1 ? req.items[0] : req);

                  const isNegotiating = sub.counter_offer_status === 'PENDING' || sub.bid_status === 'COUNTER_OFFERED';
                  const isFrozen = isBidFrozen(sub);
                  // A requirement is only deleted/cancelled if explicitly marked cancelled by admin
                  const isReqDeleted = Boolean(
                    req?.status === 'Cancelled' ||
                    req?.status === 'CANCELLED' ||
                    sub?.bid_status === 'CANCELLED'
                  );

                  const bidStatusUpper = String(sub.bid_status || sub.status || '').toUpperCase();
                  const counterOfferStatus = String(sub.counter_offer_status || '').toUpperCase();
                  const isFinalized = Boolean(sub.is_finalized) || isFrozen || counterOfferStatus === 'ACCEPTED' || bidStatusUpper === 'COUNTER_ACCEPTED' || bidStatusUpper === 'FINALIZED' || Number(sub.final_rate) > 0;
                  const isAccepted = String(sub.acceptance_status || '').toUpperCase() === 'ACCEPTED';
                  const finalRate = Number(sub.final_rate || sub.rate_per_mt || sub.rate_per_unit || 0);

                  const dispatchStatus = targetItem?.dispatch_status || req?.dispatch_status;
                  const isAwardedToOther = Boolean(
                    dispatchStatus &&
                    dispatchStatus !== 'PENDING' &&
                    !isFinalized
                  );

                  const submittedRate = Number(sub.rate_per_mt || sub.rate_per_unit || sub.original_rate || 0);
                  const reqNo = req?.req_no || req?.request_no || sub.request_no || sub.requirement_id || 'REQ';
                  const subIndentNo = targetItem?.sub_indent_no || sub.sub_indent_no || (childItem ? `${reqNo}/${childItem.id}` : reqNo);
                  const originCity = targetItem?.pickup_origin || req?.pickup_origin || req?.origin_city || sub.origin_city || sub.pickup_origin || '-';
                  const destCity = targetItem?.drop_location || req?.drop_location || req?.dest_city || sub.dest_city || sub.drop_location || '-';
                  const cargo = targetItem?.product_name || req?.product_name || req?.material_type || sub.material_type || sub.product_name || 'Cargo';
                  const qtyMt = Number(targetItem?.quantity_mt || targetItem?.required_qty || req?.quantity_mt || req?.required_qty || sub.quoted_quantity_mt || 0);

                  return (
                    <tr
                      key={sub.id}
                      style={{
                        background: isReqDeleted
                          ? 'rgba(239, 68, 68, 0.08)'
                          : isFinalized
                          ? 'rgba(52, 211, 153, 0.06)'
                          : isAwardedToOther
                          ? 'rgba(100, 116, 139, 0.06)'
                          : isNegotiating
                          ? 'rgba(245, 158, 11, 0.08)'
                          : 'transparent'
                      }}
                    >
                      <td>
                        {isReqDeleted ? (
                          <div>
                            <span className="badge badge-danger" style={{ marginBottom: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444' }}>
                              🗑️ CANCELLED BY ADMIN
                            </span>
                            <div style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Requirement Deleted</div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                              <span className="badge badge-open" style={{ fontFamily: 'monospace', fontWeight: '800' }}>
                                {subIndentNo}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                              Batch: {reqNo}
                            </div>
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: '700', color: '#ffffff' }}>
                          📍 {originCity} ➔ 📍 {destCity}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                          {cargo} ({qtyMt} MT)
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff' }}>
                          ₹{submittedRate.toLocaleString()} / MT
                        </div>
                        {sub.counter_offer_rate && isNegotiating && (
                          <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: '700' }}>
                            Counter Offer: ₹{sub.counter_offer_rate}/MT
                          </div>
                        )}
                      </td>

                      <td>
                        <div style={{ fontWeight: '700', color: '#38bdf8' }}>
                          ₹{(submittedRate * (qtyMt || 1)).toLocaleString()}
                        </div>
                      </td>

                      <td>
                        {isReqDeleted ? (
                          <span className="badge badge-danger" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444' }}>
                            🗑️ Cancelled
                          </span>
                        ) : (targetItem?.dispatch_status === 'RELEASED_FOR_REQUOTE' || targetItem?.allocation_status === 'RELEASED_FOR_REQUOTE') ? (
                          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.25)', border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🔄 Released for Re-Quote
                          </span>
                        ) : isFinalized ? (
                          <span className="badge badge-awarded" style={{ background: '#dcfce7', color: '#047857', border: '1px solid #86efac', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {isAccepted ? '✅ Rate Accepted' : `🏆 Rate Finalized (₹${finalRate}/MT)`}
                          </span>
                        ) : isAwardedToOther ? (
                          <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            🔒 Not Selected
                          </span>
                        ) : isNegotiating ? (
                          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.25)', border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: '800' }}>
                            💬 Action Required
                          </span>
                        ) : (
                          <span className="badge badge-open" style={{ fontWeight: '800' }}>
                            ⏳ Under Review
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          {isFinalized && !isAccepted && targetItem && (targetItem?.dispatch_status !== 'RELEASED_FOR_REQUOTE' && targetItem?.allocation_status !== 'RELEASED_FOR_REQUOTE') && (
                            <button
                              type="button"
                              disabled={submittingItems[`accept_${sub.id}`]}
                              onClick={() => handleAcceptFinalRateClick(targetItem, sub, req)}
                              className="btn btn-success"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: '800' }}
                              title="Accept finalized freight rate"
                            >
                              {submittingItems[`accept_${sub.id}`] ? '⏳ Accepting...' : '🤝 Accept'}
                            </button>
                          )}

                          {isFinalized && isAccepted && targetItem && (targetItem?.dispatch_status !== 'RELEASED_FOR_REQUOTE' && targetItem?.allocation_status !== 'RELEASED_FOR_REQUOTE') && (
                            <button
                              type="button"
                              onClick={() => handleOpenDispatchModal(targetItem, sub)}
                              className="btn btn-primary"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Dispatch truck for this contract"
                            >
                              <Truck size={13} /> Dispatch
                            </button>
                          )}

                          {isNegotiating && sub.counter_rate_per_unit && !isFrozen && !isReqDeleted && (
                            <button
                              type="button"
                              onClick={() => handleAcceptCounterRate(sub)}
                              className="btn btn-success"
                              style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                            >
                              <Snowflake size={13} /> Match ₹{sub.counter_rate_per_unit}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedHistorySub(sub)}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                            title="View Bid Negotiation History"
                          >
                            📜 History
                          </button>

                          {req && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('open_requests');
                                const batchKey = req.id || req.req_no;
                                setExpandedBatches((prev) => ({ ...prev, [batchKey]: true }));
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '5px 8px', fontSize: '0.75rem', border: '1px solid #38bdf8', color: '#38bdf8' }}
                              title="View in Open Requirements Table"
                            >
                              📂 View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {mySubmissions.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '48px 20px' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📝</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main, #ffffff)', marginBottom: '4px' }}>
                        No bids submitted yet
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Submit competitive quotes on available open freight requirements to win transportation contracts.
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('open_requests')}
                        className="btn btn-primary"
                        style={{ padding: '8px 20px', fontWeight: '800' }}
                      >
                        ⚡ Browse Open Requirements
                      </button>
                    </td>
                  </tr>
                )}
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

      {/* 🚚 Truck Dispatch Input Form Modal */}
      {dispatchingReqItem && (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.88)', zIndex: 9998, backdropFilter: 'blur(6px)' }}>
          <div className="modal-content" style={{ maxWidth: '640px', width: '95%', background: '#ffffff', color: '#0f172a', borderRadius: '16px', padding: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '10px' }}>
                  <Truck size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: '#0f172a' }}>🚚 Dispatch Truck & Generate LR</h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '700' }}>
                    Ref: {dispatchingReqItem.req.sub_indent_no || dispatchingReqItem.req.request_no || dispatchingReqItem.req.id}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setDispatchingReqItem(null)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* Read-Only Context Summary */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', marginBottom: '18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Route:</span>{' '}
                <strong>{dispatchingReqItem.req.origin_city || dispatchingReqItem.req.pickup_origin || 'Origin'} ➔ {dispatchingReqItem.req.dest_city || dispatchingReqItem.req.drop_location || 'Destination'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Cargo:</span>{' '}
                <strong>{dispatchingReqItem.req.product_name || dispatchingReqItem.req.material_type || 'Bulk Goods'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Finalized Rate:</span>{' '}
                <strong style={{ color: '#059669', fontSize: '0.95rem' }}>₹{dispatchingReqItem.myBid.final_rate || dispatchingReqItem.myBid.rate_per_mt}/MT</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Remaining Balance:</span>{' '}
                <strong style={{ color: '#d97706', fontSize: '0.95rem' }}>
                  {dispatchingReqItem.remainingQty} MT
                </strong>{' '}
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  (of {dispatchingReqItem.totalQty} MT)
                </span>
              </div>
            </div>

            {/* Transporter Input Form */}
            <form onSubmit={handleDispatchTruckSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                    Truck Number (e.g. MH31FC4512) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MH31FC4512"
                    className="form-control"
                    value={dispatchFormData.truck_number}
                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, truck_number: e.target.value.toUpperCase() })}
                    style={{ fontWeight: '800', fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                    Loaded Quantity (MT) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    max={dispatchingReqItem.remainingQty}
                    step="0.001"
                    placeholder={`Max ${dispatchingReqItem.remainingQty} MT`}
                    className="form-control"
                    value={dispatchFormData.loaded_quantity_mt}
                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, loaded_quantity_mt: e.target.value })}
                    style={{ fontWeight: '800' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                  Driver Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="form-control"
                  value={dispatchFormData.driver_name}
                  onChange={(e) => setDispatchFormData({ ...dispatchFormData, driver_name: e.target.value })}
                  style={{ fontWeight: '700' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                    Driver Mobile Number *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="98XXXXXXXX"
                    className="form-control"
                    value={dispatchFormData.driver_mobile}
                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, driver_mobile: e.target.value })}
                    style={{ fontWeight: '700' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>
                    Driver License Number (DL) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="MH31 20210012345"
                    className="form-control"
                    value={dispatchFormData.driver_license}
                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, driver_license: e.target.value.toUpperCase() })}
                    style={{ fontWeight: '700', fontFamily: 'monospace', textTransform: 'uppercase' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button
                  type="button"
                  disabled={isSubmittingDispatch}
                  onClick={() => setDispatchingReqItem(null)}
                  className="btn"
                  style={{ background: '#cbd5e1', color: '#1e293b', border: 'none', padding: '9px 18px', borderRadius: '8px', fontWeight: '800' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDispatch}
                  className="btn btn-primary"
                  style={{ padding: '9px 24px', fontSize: '0.9rem', fontWeight: '900', borderRadius: '8px', background: '#0284c7', color: '#ffffff', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)' }}
                >
                  {isSubmittingDispatch ? '⏳ Dispatching & Generating LR...' : '✈ Dispatch & Generate LR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📜 Negotiation History Modal */}
      {selectedHistorySub && (
        <NegotiationHistoryModal
          submission={selectedHistorySub}
          isOpen={Boolean(selectedHistorySub)}
          onClose={() => setSelectedHistorySub(null)}
        />
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
