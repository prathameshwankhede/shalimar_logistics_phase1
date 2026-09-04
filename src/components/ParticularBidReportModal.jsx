import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Printer, Download, ShieldCheck, FileSpreadsheet, Building2, MapPin, Truck, CheckCircle2, Clock, Sparkles, TrendingDown, MessageSquare, AlertCircle, ArrowRight } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';
import { exportComparativeStatementExcel } from '../utils/exportComparativeStatementExcel';
import { getRequirementRates } from '../api/rateSubmissionApi';

export const ParticularBidReportModal = ({ rateRequest, isOpen, onClose, initialMode = 'STANDARD' }) => {
  const { db } = useAuth();
  const [reportMode, setReportMode] = useState(initialMode); // 'STANDARD' | 'COUNTER'
  const [liveSubmissions, setLiveSubmissions] = useState([]);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const printableAreaRef = useRef(null);

  // Fetch live rate submissions directly from MySQL on mount
  useEffect(() => {
    let isMounted = true;
    const fetchLiveRates = async () => {
      if (!rateRequest?.id && !rateRequest?.req_no) return;
      try {
        const reqId = rateRequest.id || rateRequest.req_no;
        const res = await getRequirementRates(reqId);
        if (res && res.success && Array.isArray(res.rates) && isMounted) {
          setLiveSubmissions(res.rates);
        }
      } catch (err) {
        console.warn('Live rates fetch for statement modal notice:', err.message);
      }
    };
    fetchLiveRates();
    return () => { isMounted = false; };
  }, [rateRequest?.id, rateRequest?.req_no]);

  // Combine live rates with db fallback
  const allSubmissions = liveSubmissions.length > 0 ? liveSubmissions : (db?.rate_submissions || []);

  if (!isOpen || !rateRequest) return null;

  // Organization Info from db
  const companyInfo = db?.company || {
    name: 'Shalimar Nutrients Pvt Ltd',
    gstin: '27AAPCS1419M1ZV',
    reg_office: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028'
  };

  const reqNoStr = rateRequest.req_no || rateRequest.request_no || rateRequest.id || '';
  const childItems = Array.isArray(rateRequest.items) && rateRequest.items.length > 0
    ? rateRequest.items
    : [];

  const isBatchReport = childItems.length > 1;
  const statementTitleCode = reqNoStr;

  // Calculate total batch tonnage
  const totalVolumeMT = childItems.length > 0
    ? childItems.reduce((sum, item) => sum + (Number(item.quantity_mt || item.required_qty) || 0), 0)
    : Number(rateRequest.total_quantity_mt || rateRequest.quantity_mt || rateRequest.required_qty || 0);

  // 1. Build route rows list for ALL items in this requirement/batch with robust counter rate detection
  const routeRows = childItems.length > 0
    ? childItems.map((item, idx) => {
        const origin = item.pickup_origin || rateRequest.pickup_origin || rateRequest.origin_city || 'Origin Plant';
        const dest = item.drop_location || rateRequest.drop_location || rateRequest.dest_city || 'Destination Plant';
        const product = item.product_name || item.material_type || rateRequest.product_name || 'Agri Commodity';
        const qty = Number(item.quantity_mt || item.required_qty || 0);
        const subIndent = item.sub_indent_no || `${reqNoStr}/${(idx + 1).toString().padStart(2, '0')}`;

        // Find counter rate from submissions for this specific item
        const matchingSubs = allSubmissions.filter((s) => {
          const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                           String(s.rate_request_id) === String(rateRequest.id) ||
                           String(s.requirement_id) === String(reqNoStr);
          const matchItem = !s.item_id || s.item_id === 'MAIN' ||
                            String(s.item_id) === String(item.id) ||
                            String(s.item_id) === String(subIndent);
          return matchReq && matchItem;
        });

        const subCounter = matchingSubs.find(s => Number(s.counter_offer_rate ?? s.counter_rate ?? s.counter_rate_per_unit) > 0);
        const subCounterVal = subCounter ? Number(subCounter.counter_offer_rate ?? subCounter.counter_rate ?? subCounter.counter_rate_per_unit) : null;

        const rawCounter = item.admin_counter_rate || item.counter_offer_rate || item.remaining_finalized_rate || subCounterVal || rateRequest.admin_counter_rate || rateRequest.counter_offer_rate || rateRequest.remaining_finalized_rate || 0;
        const adminCounterRate = Number(rawCounter) > 0 ? Number(rawCounter) : null;

        return {
          id: item.id,
          subIndentNo: subIndent,
          origin,
          dest,
          product,
          locationName: `${dest} (${origin} ➔ ${dest})`,
          qty,
          adminCounterRate,
          itemObj: item
        };
      })
    : [{
        id: rateRequest.id,
        subIndentNo: reqNoStr,
        origin: rateRequest.pickup_origin || rateRequest.origin_city || 'Origin Plant',
        dest: rateRequest.drop_location || rateRequest.dest_city || 'Destination Plant',
        product: rateRequest.product_name || rateRequest.material_type || 'Agri Commodity',
        locationName: `${rateRequest.drop_location || rateRequest.dest_city || 'Plant'} (${rateRequest.pickup_origin || 'Origin'} ➔ ${rateRequest.drop_location || 'Plant'})`,
        qty: Number(rateRequest.total_quantity_mt || rateRequest.quantity_mt || rateRequest.required_qty || 0),
        adminCounterRate: (() => {
          const matchingSubs = allSubmissions.filter((s) => {
            const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                             String(s.rate_request_id) === String(rateRequest.id) ||
                             String(s.requirement_id) === String(reqNoStr);
            return matchReq;
          });
          const subCounter = matchingSubs.find(s => Number(s.counter_offer_rate ?? s.counter_rate ?? s.counter_rate_per_unit) > 0);
          const subCounterVal = subCounter ? Number(subCounter.counter_offer_rate ?? subCounter.counter_rate ?? subCounter.counter_rate_per_unit) : null;
          const rawCounter = rateRequest.admin_counter_rate || rateRequest.counter_offer_rate || rateRequest.remaining_finalized_rate || subCounterVal || 0;
          return Number(rawCounter) > 0 ? Number(rawCounter) : null;
        })(),
        itemObj: rateRequest
      }];

  // Check if any counter rate exists across the requirement or its items or submissions
  const hasCounterRate = routeRows.some((r) => r.adminCounterRate !== null) ||
    allSubmissions.some((s) => {
      const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                       String(s.rate_request_id) === String(rateRequest.id) ||
                       String(s.requirement_id) === String(reqNoStr);
      return matchReq && Boolean(s.counter_offer_rate || s.counter_rate || s.counter_offer_status);
    });

  // 2. Transporters List
  const orgTransporters = (db?.transporters || []).filter((t) => t.status !== 'Inactive');
  const transporterColumns = [];

  if (orgTransporters.length > 0) {
    orgTransporters.forEach((t) => {
      transporterColumns.push({
        id: String(t.id),
        name: t.company_name,
        code: t.code || t.username || 'TR',
        username: t.username
      });
    });
  }

  // Ensure at least 3 columns for visual balance
  const defaultFallbacks = ['TRANSPORTER A', 'TRANSPORTER B', 'TRANSPORTER C'];
  while (transporterColumns.length < 3) {
    const idx = transporterColumns.length;
    transporterColumns.push({
      id: `trans_fallback_${idx}`,
      name: defaultFallbacks[idx] || `TRANSPORTER ${String.fromCharCode(65 + idx)}`,
      code: `TR-${String.fromCharCode(65 + idx)}`,
      username: `TR-${String.fromCharCode(65 + idx)}`
    });
  }

  const currentDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // 🚚 DISPATCH & LIFTING CHRONICLE CALCULATIONS
  const relevantDispatches = (db?.truck_dispatches || []).filter((d) => {
    if (!d) return false;
    const matchReqId = String(d.requirement_id || '') === String(rateRequest.id);
    const matchReqNo = reqNoStr && (
      String(d.req_no || '') === String(reqNoStr) ||
      String(d.sub_indent_no || '').startsWith(String(reqNoStr)) ||
      String(d.requirement_id || '') === String(reqNoStr)
    );
    return matchReqId || matchReqNo;
  }).sort((a, b) => new Date(a.dispatched_at || 0) - new Date(b.dispatched_at || 0));

  const totalDispatchedQty = relevantDispatches.reduce(
    (acc, d) => acc + (Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0),
    0
  );
  const remainingBalanceQty = Math.max(0, totalVolumeMT - totalDispatchedQty);

  // Calculate Overall Counter & Negotiation Metrics
  let totalL1Cost = 0;
  let totalCounterCost = 0;
  let totalAgreedCost = 0;
  let totalCounterSavings = 0;

  routeRows.forEach((r) => {
    const itemSubs = allSubmissions.filter((s) => {
      const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                       String(s.rate_request_id) === String(rateRequest.id) ||
                       String(s.requirement_id) === String(reqNoStr);
      const matchItem = !s.item_id || s.item_id === 'MAIN' ||
                        String(s.item_id) === String(r.id) ||
                        String(s.item_id) === String(r.subIndentNo);
      return matchReq && matchItem;
    });

    const validRates = itemSubs
      .map((s) => Number(s.rate_per_mt ?? s.rate_per_unit ?? s.final_rate ?? s.original_rate))
      .filter((rate) => !isNaN(rate) && rate > 0);
    const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;

    const subWithCounter = itemSubs.find(s => Number(s.counter_offer_rate ?? s.counter_rate ?? s.counter_rate_per_unit) > 0);
    const subCounterVal = subWithCounter ? Number(subWithCounter.counter_offer_rate ?? subWithCounter.counter_rate ?? subWithCounter.counter_rate_per_unit) : null;
    const counterRate = r.adminCounterRate || subCounterVal || (minRate > 0 ? minRate : 0);

    const alloc = (db?.allocations || []).find((a) =>
      (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
      (!a.item_id || String(a.item_id) === String(r.id))
    );
    const agreedRate = alloc ? Number(alloc.agreed_rate) : counterRate > 0 ? counterRate : minRate;

    totalL1Cost += (r.qty * minRate);
    totalCounterCost += (r.qty * (counterRate || minRate));
    totalAgreedCost += (r.qty * agreedRate);

    if (minRate > 0 && counterRate > 0 && minRate > counterRate) {
      totalCounterSavings += (r.qty * (minRate - counterRate));
    }
  });

  const statementTypeLabel = isBatchReport ? `BATCH NO. ${reqNoStr}` : `BID NO. ${reqNoStr}`;
  const displayTitle = reportMode === 'COUNTER'
    ? `${statementTypeLabel} COUNTER RATE NEGOTIATION STATEMENT`
    : `${statementTypeLabel} COMPARATIVE FREIGHT RATE STATEMENT`;

  // 🖨️ COMPLETE MULTI-PAGE A4 LANDSCAPE PRINT ENGINE
  const handlePrint = () => {
    try {
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = '0';
      document.body.appendChild(printFrame);

      const isCounterMode = reportMode === 'COUNTER';

      const thTransHtml = transporterColumns.map((tCol) => `
        <th style="padding: 6px 8px; text-align: center; font-weight: 900; border: 1px solid #94a3b8; background-color: #f1f5f9; color: #0369a1;">
          ${(tCol.name || '').toUpperCase()}
          <div style="font-size: 8.5px; color: #64748b; font-family: monospace; font-weight: normal;">(${tCol.code})</div>
        </th>
      `).join('');

      const tableRowsHtml = routeRows.map((rowObj, rIdx) => {
        const itemSubs = allSubmissions.filter((s) => {
          const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                           String(s.rate_request_id) === String(rateRequest.id) ||
                           String(s.requirement_id) === String(reqNoStr);
          const matchItem = !s.item_id || s.item_id === 'MAIN' ||
                            String(s.item_id) === String(rowObj.id) ||
                            String(s.item_id) === String(rowObj.subIndentNo);
          return matchReq && matchItem;
        });

        const validRates = itemSubs
          .map((s) => Number(s.rate_per_mt ?? s.rate_per_unit ?? s.final_rate ?? s.original_rate))
          .filter((r) => !isNaN(r) && r > 0);
        const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;

        const subWithCounter = itemSubs.find(s => Number(s.counter_offer_rate ?? s.counter_rate ?? s.counter_rate_per_unit) > 0);
        const subCounterVal = subWithCounter ? Number(subWithCounter.counter_offer_rate ?? subWithCounter.counter_rate ?? subWithCounter.counter_rate_per_unit) : null;
        const counterRate = rowObj.adminCounterRate || subCounterVal || (rateRequest.counter_offer_rate ? Number(rateRequest.counter_offer_rate) : null) || (rateRequest.admin_counter_rate ? Number(rateRequest.admin_counter_rate) : null);

        const alloc = (db?.allocations || []).find((a) =>
          (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
          (!a.item_id || String(a.item_id) === String(rowObj.id))
        );
        const winnerTrans = alloc ? (db?.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;

        const transColsHtml = transporterColumns.map((tCol) => {
          const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
          const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
          const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
          const rateVal = rawRate !== null && !isNaN(Number(rawRate)) && Number(rawRate) > 0 ? Number(rawRate) : null;
          const isMin = rateVal !== null && rateVal === minRate && minRate > 0;

          if (isCounterMode) {
            const isAccepted = sub && (
              sub.counter_offer_status === 'accepted' ||
              sub.is_frozen === true ||
              (sub.final_rate && Number(sub.final_rate) === Number(counterRate)) ||
              (rateVal !== null && counterRate !== null && Number(rateVal) <= Number(counterRate))
            );
            const isRequoted = sub && sub.counter_offer_status === 'requoted';

            return `
              <td style="text-align: center; font-weight: 800; border: 1px solid #cbd5e1; padding: 6px 8px; ${isAccepted ? 'background-color: #dcfce7 !important; color: #15803d !important;' : ''}">
                ${rateVal !== null ? `
                  <div style="font-size: 10px;">₹${rateVal}</div>
                  ${isAccepted ? '<span style="font-size: 8px; font-weight: 900; color: #15803d; background: #bbf7d0; padding: 1px 4px; border-radius: 3px;">✅ ACCEPTED</span>' : isRequoted ? '<span style="font-size: 8px; font-weight: 800; color: #0284c7; background: #e0f2fe; padding: 1px 4px; border-radius: 3px;">📝 REQUOTED</span>' : '<span style="font-size: 7.5px; color: #64748b;">(Pending)</span>'}
                ` : '-'}
              </td>
            `;
          }

          return `
            <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px; ${isMin ? 'background-color: #dcfce7 !important; color: #15803d !important;' : ''}">
              ${rateVal !== null ? `₹${rateVal}${isMin ? '<br><span style="font-size: 8px; color: #15803d">🏆 L1 LOWEST</span>' : ''}` : '-'}
            </td>
          `;
        }).join('');

        if (isCounterMode) {
          const savingsPerMT = (minRate > 0 && counterRate > 0 && minRate > counterRate) ? (minRate - counterRate) : 0;
          const totalSavings = savingsPerMT * rowObj.qty;

          return `
            <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">
                <div style="font-family: monospace; font-weight: 900; color: #0284c7; font-size: 11px;">${rowObj.subIndentNo}</div>
                <div style="font-size: 9.5px; color: #475569; font-weight: 700;">📦 ${rowObj.product}</div>
              </td>
              <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">
                <span style="color: #0284c7; font-weight: 800;">${rowObj.origin}</span> ➔ <span style="color: #059669; font-weight: 800;">${rowObj.dest}</span>
              </td>
              <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px;">${rowObj.qty} MT</td>
              <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px; color: #0369a1; background: #f0f9ff;">
                ${minRate > 0 ? `₹${minRate}` : '-'}
              </td>
              <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px; color: #c2410c; background: #fff7ed;">
                ${counterRate > 0 ? `🎯 ₹${counterRate}` : '-'}
              </td>
              ${transColsHtml}
              <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px; color: #15803d; background: #dcfce7;">
                ${alloc ? `₹${alloc.agreed_rate}` : counterRate > 0 ? `₹${counterRate}` : minRate > 0 ? `₹${minRate}` : '-'}
              </td>
              <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px; color: ${savingsPerMT > 0 ? '#15803d' : '#64748b'};">
                ${savingsPerMT > 0 ? `₹${savingsPerMT}/MT<br><span style="font-size: 8.5px; color: #15803d;">(₹${totalSavings.toLocaleString()})</span>` : '₹0'}
              </td>
            </tr>
          `;
        }

        const remark = alloc
          ? `<strong style="color: #15803d">🏆 Awarded: ${winnerTrans?.company_name || 'Transporter'} @ ₹${alloc.agreed_rate}/MT</strong>`
          : minRate > 0
          ? `<span style="color: #059669; font-weight: 700">Lowest Quote: ₹${minRate}/MT</span>`
          : '<span style="color: #94a3b8">Awaiting Quotes</span>';

        return `
          <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">
              <div style="font-family: monospace; font-weight: 900; color: #0284c7; font-size: 11px;">${rowObj.subIndentNo}</div>
              <div style="font-size: 9.5px; color: #475569; font-weight: 700;">📦 ${rowObj.product}</div>
            </td>
            <td style="border: 1px solid #cbd5e1; padding: 6px 8px;">
              <span style="color: #0284c7; font-weight: 800;">${rowObj.origin}</span> ➔ <span style="color: #059669; font-weight: 800;">${rowObj.dest}</span>
            </td>
            <td style="text-align: center; font-weight: 900; border: 1px solid #cbd5e1; padding: 6px 8px;">${rowObj.qty} MT</td>
            ${transColsHtml}
            <td style="text-align: center; font-weight: 900; background-color: #dcfce7 !important; color: #15803d !important; border: 1px solid #cbd5e1; padding: 6px 8px;">
              ${minRate > 0 ? `₹${minRate}` : '-'}
            </td>
            <td style="font-size: 9.5px; border: 1px solid #cbd5e1; padding: 6px 8px;">${remark}</td>
          </tr>
        `;
      }).join('');

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${displayTitle}</title>
  <style>
    @page { size: A4 landscape; margin: 6mm 8mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #0f172a;
      background: #ffffff !important;
      font-size: 9.5px;
      line-height: 1.3;
    }
    .header-box {
      border: 1.5px solid #0284c7;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f0f7fc !important;
      page-break-inside: avoid;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-left img { height: 44px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; background: #ffffff; }
    .header-title { font-size: 13px; font-weight: 900; margin: 0; color: #0f172a; }
    .header-sub { font-size: 10px; color: #0284c7; font-weight: 800; margin-top: 2px; }
    .header-addr { font-size: 8.5px; color: #64748b; margin-top: 1px; }
    .badge {
      background-color: #e0f2fe !important;
      color: #0369a1 !important;
      border: 1px solid #7dd3fc;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 900;
      font-size: 11px;
      font-family: monospace;
      text-align: right;
    }
    .metrics { font-size: 9px; color: #64748b; margin-top: 3px; font-weight: 700; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    th { border: 1px solid #94a3b8; padding: 6px 8px; background-color: #f1f5f9 !important; font-weight: 900; }
    td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: middle; }
    .footer-box {
      border: 1.5px solid #0284c7;
      border-radius: 6px;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f0f7fc !important;
      margin-top: 10px;
      page-break-inside: avoid;
    }
    .seal-text { font-size: 10px; color: #0369a1; font-weight: 800; }
    .sign-box { text-align: right; border-top: 1.5px solid #0284c7; padding-top: 4px; min-width: 160px; }
    .sign-title { font-weight: 900; font-size: 10px; color: #0f172a; }
    .sign-sub { font-size: 8px; color: #64748b; }
  </style>
</head>
<body>
  <div class="header-box">
    <div class="header-left">
      <img src="${SHALIMAR_LOGO_BASE64}" alt="Shalimar Logo" />
      <div>
        <div class="header-title">${displayTitle} ${currentDateStr}</div>
        <div class="header-sub">${companyInfo.name} | Logistics Procurement Division</div>
        <div class="header-addr">${companyInfo.reg_office} • GSTIN: ${companyInfo.gstin}</div>
      </div>
    </div>
    <div>
      <div class="badge">${reqNoStr}</div>
      <div class="metrics">Sub-Indents: <strong>${routeRows.length} Routes</strong> | Total Volume: <strong style="color: #059669">${(totalVolumeMT || 0).toLocaleString()} MT</strong></div>
    </div>
  </div>

  ${isCounterMode ? `
  <div style="display: flex; gap: 10px; margin-bottom: 8px;">
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; padding: 5px 12px; border-radius: 6px; font-size: 9px;">
      <span style="color: #64748b;">INITIAL L1 TOTAL:</span> <strong style="color: #0369a1;">₹${totalL1Cost.toLocaleString()}</strong>
    </div>
    <div style="background: #fff7ed; border: 1px solid #fed7aa; padding: 5px 12px; border-radius: 6px; font-size: 9px;">
      <span style="color: #64748b;">TARGET COUNTER TOTAL:</span> <strong style="color: #c2410c;">₹${totalCounterCost.toLocaleString()}</strong>
    </div>
    <div style="background: #dcfce7; border: 1px solid #86efac; padding: 5px 12px; border-radius: 6px; font-size: 9px;">
      <span style="color: #15803d;">ESTIMATED NET SAVINGS:</span> <strong style="color: #15803d;">₹${totalCounterSavings.toLocaleString()} 🎉</strong>
    </div>
  </div>
  ` : ''}

  <div style="font-size: 10.5px; font-weight: 900; color: #0369a1; margin-bottom: 6px;">
    ${isCounterMode ? '📢 SECTION 1: COUNTER RATE & TRANSPORTER NEGOTIATION MATRIX' : '📊 SECTION 1: COMPARATIVE FREIGHT RATE MATRIX (TRANSPORTER QUOTES)'}
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align: left; width: 17%;">SUB-INDENT & COMMODITY</th>
        <th style="text-align: left; width: 20%;">ROUTE (ORIGIN ➔ DESTINATION)</th>
        <th style="text-align: center; width: 7%;">QTY (MT)</th>
        ${isCounterMode ? `
          <th style="text-align: center; width: 9%; background: #f0f9ff !important; color: #0369a1;">INITIAL L1</th>
          <th style="text-align: center; width: 10%; background: #fff7ed !important; color: #c2410c;">ADMIN COUNTER</th>
          ${thTransHtml}
          <th style="text-align: center; width: 9%; background: #dcfce7 !important; color: #15803d;">FINAL RATE</th>
          <th style="text-align: center; width: 9%;">NET SAVINGS</th>
        ` : `
          ${thTransHtml}
          <th style="text-align: center; width: 11%; background-color: #dcfce7 !important; color: #15803d !important;">MINIMUM RATE</th>
          <th style="text-align: left; width: 16%; background-color: #fef3c7 !important; color: #b45309 !important;">REMARK / STATUS</th>
        `}
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="footer-box">
    <div class="seal-text">🛡️ OFFICIAL ${companyInfo.name.toUpperCase()} FREIGHT STATEMENT</div>
    <div class="sign-box">
      <div class="sign-title">Authorized Procurement Head</div>
      <div class="sign-sub">${companyInfo.name}</div>
    </div>
  </div>
</body>
</html>
      `;

      const frameDoc = printFrame.contentWindow.document;
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => {
          try {
            document.body.removeChild(printFrame);
          } catch (e) {}
        }, 4000);
      }, 300);
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print', err);
      window.print();
    }
  };

  // 📥 1-CLICK DIRECT HIGH-RES PDF DOWNLOAD
  const handleDownloadPDF = async () => {
    try {
      setIsDownloadingPDF(true);
      const targetEl = printableAreaRef.current;
      if (!targetEl) throw new Error('Printable element not found');

      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(targetEl, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const renderHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (renderHeight > pdfHeight) {
        let heightLeft = renderHeight;
        let position = 0;
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, renderHeight);
        heightLeft -= pdfHeight;
        while (heightLeft > 0) {
          position = heightLeft - renderHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, renderHeight);
          heightLeft -= pdfHeight;
        }
      } else {
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, renderHeight);
      }

      const filePrefix = reportMode === 'COUNTER' ? 'Counter_Negotiation_Statement_' : 'Comparative_Statement_';
      pdf.save(`${filePrefix}${String(reqNoStr).replace(/[\/\\]/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF download error:', err);
      handlePrint();
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  // 📥 1-CLICK EXECUTIVE EXCEL WORKBOOK EXPORT (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportComparativeStatementExcel({
        rateRequest,
        routeRows,
        transporterColumns,
        submissions: allSubmissions,
        allocations: db?.allocations || [],
        dispatches: db?.truck_dispatches || [],
        company: companyInfo,
        statementTypeLabel,
        activeReportMode: reportMode
      });
    } catch (err) {
      console.warn('Executive Excel export error:', err);
      alert('Excel export error: ' + err.message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.85)',
        zIndex: 9999,
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="modal-content modal-report modal-wide printable-area"
        style={{
          maxWidth: '1420px',
          width: '97vw',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '22px 26px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          maxHeight: '95vh',
          overflowY: 'auto',
          border: '1px solid #cbd5e1',
          boxSizing: 'border-box',
          margin: '0 auto'
        }}
      >
        {/* Modal Top Control Bar (Hidden during Print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '14px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Left: Statement Title & Mode Switcher */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: '900',
                  color: '#0284c7',
                  background: '#e0f2fe',
                  border: '1px solid #7dd3fc',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                {isBatchReport ? '📂 MULTI-ITEM BATCH STATEMENT' : '📑 SINGLE BID STATEMENT'}
              </span>

              {hasCounterRate && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '900',
                    color: '#c2410c',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Sparkles size={13} color="#ea580c" /> Admin Counter Active
                </span>
              )}
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: '#0f172a', margin: '6px 0 0 0', letterSpacing: '-0.01em' }}>
              {displayTitle}
            </h3>
          </div>

          {/* Center: Report Mode Switcher Tabs */}
          <div
            style={{
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
              display: 'inline-flex',
              gap: '4px',
              border: '1px solid #cbd5e1'
            }}
          >
            <button
              type="button"
              onClick={() => setReportMode('STANDARD')}
              style={{
                background: reportMode === 'STANDARD' ? '#ffffff' : 'transparent',
                color: reportMode === 'STANDARD' ? '#0284c7' : '#64748b',
                border: reportMode === 'STANDARD' ? '1px solid #7dd3fc' : 'none',
                fontWeight: '800',
                fontSize: '0.8rem',
                padding: '7px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: reportMode === 'STANDARD' ? '0 2px 6px rgba(2, 132, 199, 0.15)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <FileSpreadsheet size={15} /> 1. Comparative Rate Statement
            </button>

            <button
              type="button"
              onClick={() => setReportMode('COUNTER')}
              style={{
                background: reportMode === 'COUNTER' ? '#ffffff' : 'transparent',
                color: reportMode === 'COUNTER' ? '#c2410c' : '#64748b',
                border: reportMode === 'COUNTER' ? '1px solid #fed7aa' : 'none',
                fontWeight: '800',
                fontSize: '0.8rem',
                padding: '7px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: reportMode === 'COUNTER' ? '0 2px 6px rgba(194, 65, 12, 0.15)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={15} color={reportMode === 'COUNTER' ? '#ea580c' : '#64748b'} /> 2. Counter Rate & Savings Report 📢
            </button>
          </div>

          {/* Right: Export & Print Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExportingExcel}
              className="btn"
              style={{
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: '800',
                borderRadius: '8px',
                cursor: isExportingExcel ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                opacity: isExportingExcel ? 0.7 : 1
              }}
              title="Download Executive Excel (.xlsx) containing both Comparative Matrix & Counter Negotiation Statement"
            >
              <FileSpreadsheet size={15} />
              {isExportingExcel ? 'Generating Excel...' : 'Export Executive Excel (.xlsx) 📊'}
            </button>

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
              className="btn"
              style={{
                background: reportMode === 'COUNTER' ? 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: '800',
                borderRadius: '8px',
                cursor: isDownloadingPDF ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                opacity: isDownloadingPDF ? 0.7 : 1
              }}
              title="Download High-Resolution Statement PDF"
            >
              <Download size={15} />
              {isDownloadingPDF ? 'Generating PDF...' : `Download ${reportMode === 'COUNTER' ? 'Counter' : 'Statement'} PDF 📄`}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn"
              style={{
                background: '#475569',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                fontSize: '0.8rem',
                fontWeight: '800',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(71, 85, 105, 0.3)'
              }}
            >
              <Printer size={15} /> Print 🖨️
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '7px 11px',
                cursor: 'pointer',
                color: '#475569',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close Report"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
           📊 STATEMENT SHEET CONTAINER (Export / Print Target)
        ---------------------------------------------------- */}
        <div ref={printableAreaRef} style={{ padding: '6px', background: '#ffffff' }}>
          
          {/* Header Corporate Title Card */}
          <div
            style={{
              background: reportMode === 'COUNTER' ? '#fff7ed' : '#f0f7fc',
              border: `1.5px solid ${reportMode === 'COUNTER' ? '#fed7aa' : '#bfe0fb'}`,
              borderRadius: '12px',
              padding: '16px 22px',
              marginBottom: '18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={SHALIMAR_LOGO_BASE64}
                alt="Shalimar Logo"
                style={{
                  height: '52px',
                  width: 'auto',
                  borderRadius: '6px',
                  background: '#ffffff',
                  padding: '4px',
                  border: '1px solid #cbd5e1',
                  objectFit: 'contain'
                }}
              />
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '900', margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {displayTitle} {currentDateStr}
                </h2>
                <div style={{ fontSize: '0.8rem', color: reportMode === 'COUNTER' ? '#c2410c' : '#0284c7', marginTop: '2px', fontWeight: '800' }}>
                  {companyInfo.name} | Logistics Procurement Division
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                  {companyInfo.reg_office} • GSTIN: {companyInfo.gstin}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  background: reportMode === 'COUNTER' ? '#ffedd5' : '#e0f2fe',
                  color: reportMode === 'COUNTER' ? '#c2410c' : '#0369a1',
                  border: `1px solid ${reportMode === 'COUNTER' ? '#fdba74' : '#7dd3fc'}`,
                  padding: '5px 14px',
                  borderRadius: '8px',
                  fontWeight: '900',
                  fontSize: '0.88rem',
                  fontFamily: 'monospace',
                  display: 'inline-block'
                }}
              >
                {reqNoStr}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px', fontWeight: '700' }}>
                Sub-Indents: <strong>{routeRows.length} Route{routeRows.length > 1 ? 's' : ''}</strong> | Total Volume: <strong style={{ color: '#059669' }}>{(totalVolumeMT || 0).toLocaleString()} MT Total</strong>
              </div>
            </div>
          </div>

          {/* COUNTER REPORT EXECUTIVE SAVINGS SUMMARY CARDS (When Counter Mode Active) */}
          {reportMode === 'COUNTER' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '12px',
                marginBottom: '18px'
              }}
            >
              <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Initial L1 Freight Outlay</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0369a1', marginTop: '2px' }}>₹{totalL1Cost.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>Based on lowest transporter initial bids</div>
              </div>

              <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#c2410c', textTransform: 'uppercase' }}>Admin Target Counter Outlay</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#c2410c', marginTop: '2px' }}>₹{totalCounterCost.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#9a3412', marginTop: '2px' }}>At proposed Admin Counter Target rates</div>
              </div>

              <div style={{ background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#15803d', textTransform: 'uppercase' }}>Projected Negotiation Savings</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#15803d', marginTop: '2px' }}>
                  ₹{totalCounterSavings.toLocaleString()} 🎉
                </div>
                <div style={{ fontSize: '0.7rem', color: '#166534', marginTop: '2px' }}>
                  {totalL1Cost > 0 ? `${((totalCounterSavings / totalL1Cost) * 100).toFixed(1)}% Cost Reduction` : 'Net Bachat'}
                </div>
              </div>

              <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', color: '#0369a1', textTransform: 'uppercase' }}>Agreed / Final Contract Value</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>₹{totalAgreedCost.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#0284c7', marginTop: '2px' }}>Final procurement commitment</div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------
             TABLE 1: FREIGHT MATRIX TABLE (Standard OR Counter)
          ---------------------------------------------------- */}
          <div style={{ overflowX: 'auto', border: '1.5px solid #cbd5e1', borderRadius: '12px', marginBottom: '22px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', fontFamily: 'sans-serif' }}>
              <thead>
                <tr style={{ background: reportMode === 'COUNTER' ? '#fff7ed' : '#f0f7fc', color: '#0f172a', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '160px' }}>
                    SUB-INDENT & COMMODITY
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '200px' }}>
                    ROUTE (ORIGIN ➔ DESTINATION)
                  </th>
                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '90px' }}>
                    QTY (MT)
                  </th>

                  {reportMode === 'COUNTER' ? (
                    <>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '100px', background: '#f0f9ff', color: '#0369a1' }}>
                        INITIAL L1
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '120px', background: '#ffedd5', color: '#c2410c' }}>
                        ADMIN COUNTER 🎯
                      </th>
                      {transporterColumns.map((tCol, idx) => (
                        <th key={tCol.id || idx} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '130px', color: '#0369a1' }}>
                          <div style={{ textTransform: 'uppercase' }}>{(tCol?.name || "").toUpperCase()}</div>
                          <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: '700', fontFamily: 'monospace' }}>
                            ({tCol.code})
                          </div>
                        </th>
                      ))}
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '110px', background: '#dcfce7', color: '#15803d' }}>
                        FINAL RATE
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', width: '120px', background: '#f0fdf4', color: '#166534' }}>
                        NET SAVINGS (₹)
                      </th>
                    </>
                  ) : (
                    <>
                      {transporterColumns.map((tCol, idx) => (
                        <th key={tCol.id || idx} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '130px', color: '#0369a1' }}>
                          <div style={{ textTransform: 'uppercase' }}>{(tCol?.name || "").toUpperCase()}</div>
                          <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: '700', fontFamily: 'monospace' }}>
                            ({tCol.code})
                          </div>
                        </th>
                      ))}
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', background: '#dcfce7', color: '#15803d', borderRight: '1px solid #cbd5e1', minWidth: '110px' }}>
                        MINIMUM RATE
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '900', background: '#fef3c7', color: '#b45309', minWidth: '170px' }}>
                        REMARK / STATUS
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {routeRows.map((rowObj, rIdx) => {
                  const itemSubs = allSubmissions.filter((s) => {
                    const matchReq = String(s.requirement_id) === String(rateRequest.id) ||
                                     String(s.rate_request_id) === String(rateRequest.id) ||
                                     String(s.requirement_id) === String(reqNoStr);
                    const matchItem = !s.item_id || s.item_id === 'MAIN' ||
                                      String(s.item_id) === String(rowObj.id) ||
                                      String(s.item_id) === String(rowObj.subIndentNo);
                    return matchReq && matchItem;
                  });

                  const validRates = itemSubs
                    .map((s) => Number(s.rate_per_mt ?? s.rate_per_unit ?? s.final_rate ?? s.original_rate))
                    .filter((r) => !isNaN(r) && r > 0);
                  const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;

                  // Robust counter rate resolution from all sources
                  const subWithCounter = itemSubs.find(s => Number(s.counter_offer_rate ?? s.counter_rate ?? s.counter_rate_per_unit) > 0);
                  const subCounterVal = subWithCounter ? Number(subWithCounter.counter_offer_rate ?? subWithCounter.counter_rate ?? subWithCounter.counter_rate_per_unit) : null;
                  const counterRate = rowObj.adminCounterRate || subCounterVal || (rateRequest.counter_offer_rate ? Number(rateRequest.counter_offer_rate) : null) || (rateRequest.admin_counter_rate ? Number(rateRequest.admin_counter_rate) : null);

                  const alloc = (db?.allocations || []).find((a) =>
                    (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
                    (!a.item_id || String(a.item_id) === String(rowObj.id))
                  );
                  const winnerTrans = alloc ? (db?.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;

                  if (reportMode === 'COUNTER') {
                    const savingsPerMT = (minRate > 0 && counterRate > 0 && minRate > counterRate) ? (minRate - counterRate) : 0;
                    const totalSavings = savingsPerMT * rowObj.qty;
                    const finalAgreedRate = alloc ? Number(alloc.agreed_rate) : counterRate > 0 ? counterRate : minRate;

                    return (
                      <tr key={rowObj.id || rIdx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                        {/* Sub-Indent */}
                        <td style={{ padding: '10px 12px', fontWeight: '800', borderRight: '1px solid #cbd5e1' }}>
                          <div style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: '900', fontSize: '0.82rem' }}>
                            {rowObj.subIndentNo}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1px', fontWeight: '700' }}>
                            📦 {rowObj.product}
                          </div>
                        </td>

                        {/* Route */}
                        <td style={{ padding: '10px 12px', fontWeight: '800', borderRight: '1px solid #cbd5e1' }}>
                          <div style={{ fontSize: '0.82rem' }}>
                            📍 <span style={{ color: '#0284c7' }}>{rowObj.origin}</span> ➔ <span style={{ color: '#059669' }}>{rowObj.dest}</span>
                          </div>
                        </td>

                        {/* Quantity */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                          {rowObj.qty} MT
                        </td>

                        {/* Initial L1 */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', background: '#f0f9ff', color: '#0369a1', fontSize: '0.88rem' }}>
                          {minRate > 0 ? `₹${minRate}` : '-'}
                        </td>

                        {/* Admin Counter Target */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', background: '#fff7ed', color: '#c2410c', fontSize: '0.92rem' }}>
                          {counterRate > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              🎯 ₹{counterRate}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>

                        {/* Transporter Response Cells */}
                        {transporterColumns.map((tCol) => {
                          const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
                          const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
                          const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
                          const rateVal = rawRate !== null && !isNaN(Number(rawRate)) && Number(rawRate) > 0 ? Number(rawRate) : null;

                          const isAccepted = sub && (
                            sub.counter_offer_status === 'accepted' ||
                            sub.is_frozen === true ||
                            (sub.final_rate && Number(sub.final_rate) === Number(counterRate)) ||
                            (rateVal !== null && counterRate !== null && Number(rateVal) <= Number(counterRate))
                          );
                          const isRequoted = sub && sub.counter_offer_status === 'requoted';

                          return (
                            <td
                              key={tCol.id}
                              style={{
                                padding: '10px 12px',
                                textAlign: 'center',
                                fontWeight: '800',
                                fontSize: '0.85rem',
                                borderRight: '1px solid #cbd5e1',
                                background: isAccepted ? '#dcfce7' : 'transparent',
                                color: isAccepted ? '#15803d' : rateVal ? '#0f172a' : '#94a3b8'
                              }}
                            >
                              {rateVal !== null ? (
                                <div>
                                  <div style={{ fontWeight: '900' }}>₹{rateVal}</div>
                                  {isAccepted ? (
                                    <div style={{ fontSize: '0.68rem', fontWeight: '900', color: '#15803d', background: '#bbf7d0', padding: '1px 5px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                                      ✅ ACCEPTED
                                    </div>
                                  ) : isRequoted ? (
                                    <div style={{ fontSize: '0.68rem', fontWeight: '800', color: '#0284c7', background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px', marginTop: '2px', display: 'inline-block' }}>
                                      📝 REQUOTED
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>
                                      (Pending)
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>-</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Final Rate */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', background: '#dcfce7', color: '#15803d', fontSize: '0.92rem' }}>
                          {finalAgreedRate > 0 ? `₹${finalAgreedRate}` : '-'}
                        </td>

                        {/* Net Savings */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', background: savingsPerMT > 0 ? '#f0fdf4' : 'transparent', color: savingsPerMT > 0 ? '#15803d' : '#64748b', fontSize: '0.85rem' }}>
                          {savingsPerMT > 0 ? (
                            <div>
                              <div>₹{savingsPerMT}/MT</div>
                              <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: '800' }}>
                                (₹{totalSavings.toLocaleString()})
                              </div>
                            </div>
                          ) : (
                            <span>₹0</span>
                          )}
                        </td>
                      </tr>
                    );
                  }

                  // STANDARD COMPARATIVE STATEMENT ROW
                  return (
                    <tr key={rowObj.id || rIdx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                        <div style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: '900', fontSize: '0.82rem' }}>
                          {rowObj.subIndentNo}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '1px', fontWeight: '700' }}>
                          📦 {rowObj.product}
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.82rem' }}>
                          📍 <span style={{ color: '#0284c7' }}>{rowObj.origin}</span> ➔ <span style={{ color: '#059669' }}>{rowObj.dest}</span>
                        </div>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', fontSize: '0.85rem' }}>
                        {rowObj.qty} MT
                      </td>

                      {transporterColumns.map((tCol) => {
                        const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
                        const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
                        const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
                        const rateVal = rawRate !== null && !isNaN(Number(rawRate)) && Number(rawRate) > 0 ? Number(rawRate) : null;
                        const isMin = rateVal !== null && rateVal === minRate && minRate > 0;

                        return (
                          <td
                            key={tCol.id}
                            style={{
                              padding: '10px 12px',
                              textAlign: 'center',
                              fontWeight: '900',
                              fontSize: '0.88rem',
                              borderRight: '1px solid #cbd5e1',
                              background: isMin ? '#dcfce7' : 'transparent',
                              color: isMin ? '#15803d' : rateVal ? '#0f172a' : '#94a3b8'
                            }}
                          >
                            {rateVal !== null ? (
                              <div>
                                ₹{rateVal}
                                {isMin && (
                                  <div style={{ fontSize: '0.66rem', color: '#15803d', fontWeight: '900', marginTop: '1px' }}>
                                    🏆 L1 LOWEST
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>-</span>
                            )}
                          </td>
                        );
                      })}

                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', fontSize: '0.92rem', color: '#15803d', background: '#dcfce7', borderRight: '1px solid #cbd5e1' }}>
                        {minRate > 0 ? `₹${minRate}` : '-'}
                      </td>

                      <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontWeight: '800' }}>
                        {alloc ? (
                          <div style={{ color: '#15803d', display: 'flex', flexDirection: 'column' }}>
                            <span>🏆 Awarded: {winnerTrans?.company_name || 'Transporter'}</span>
                            <span style={{ fontSize: '0.7rem', color: '#0284c7', fontFamily: 'monospace' }}>
                              Rate: ₹{alloc.agreed_rate}/MT
                            </span>
                          </div>
                        ) : minRate > 0 ? (
                          <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> Lowest Quote: ₹${minRate}/MT
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>
                            Awaiting Quotes
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Total Footer Row */}
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: '900', borderTop: '2px solid #cbd5e1' }}>
                  <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', borderRight: '1px solid #cbd5e1' }}>
                    TOTAL BATCH VOLUME / FREIGHT:
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                    {totalVolumeMT.toFixed(3)} MT
                  </td>
                  {reportMode === 'COUNTER' ? (
                    <>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0369a1', borderRight: '1px solid #cbd5e1' }}>
                        ₹{totalL1Cost.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#c2410c', borderRight: '1px solid #cbd5e1' }}>
                        ₹{totalCounterCost.toLocaleString()}
                      </td>
                      <td colSpan={transporterColumns.length} style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', borderRight: '1px solid #cbd5e1' }}>
                        -
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#15803d', borderRight: '1px solid #cbd5e1' }}>
                        ₹{totalAgreedCost.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#15803d', background: '#dcfce7' }}>
                        ₹{totalCounterSavings.toLocaleString()} 🎉
                      </td>
                    </>
                  ) : (
                    <>
                      <td colSpan={transporterColumns.length + 2} style={{ padding: '10px 12px', textAlign: 'right', color: '#15803d' }}>
                        Estimated L1 Total: <strong>₹{totalL1Cost.toLocaleString()}</strong>
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ----------------------------------------------------
             🚚 SECTION 2: MATERIAL LIFTING & DISPATCH CHRONICLE
          ---------------------------------------------------- */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                background: '#f0f9ff',
                border: '1.5px solid #bae6fd',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '900', color: '#0369a1', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={18} color="#0284c7" /> Material Lifting & Dispatch Chronicle
                </h4>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                  Audit trail of truck dispatches, loaded quantities (pehle vs baad me), and remaining balance tracking.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '5px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: '700' }}>TOTAL ORDER</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '900', color: '#0f172a' }}>{totalVolumeMT.toFixed(3)} MT</div>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #7dd3fc', borderRadius: '8px', padding: '5px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: '#0284c7', fontWeight: '700' }}>TOTAL LIFTED</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '900', color: '#0284c7' }}>{totalDispatchedQty.toFixed(3)} MT</div>
                </div>

                <div style={{ background: '#ffffff', border: `1px solid ${remainingBalanceQty <= 0.001 ? '#86efac' : '#fde047'}`, borderRadius: '8px', padding: '5px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.64rem', color: remainingBalanceQty <= 0.001 ? '#15803d' : '#b45309', fontWeight: '700' }}>REMAINING BALANCE</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: '900', color: remainingBalanceQty <= 0.001 ? '#15803d' : '#b45309' }}>
                    {remainingBalanceQty.toFixed(3)} MT
                  </div>
                </div>
              </div>
            </div>

            {relevantDispatches.length > 0 ? (
              <div style={{ overflowX: 'auto', border: '1.5px solid #bae6fd', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontFamily: 'sans-serif' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', width: '130px' }}>STAGE / PHASE</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '800', minWidth: '140px' }}>LR NUMBER</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', width: '100px' }}>DISPATCH DATE</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '800', minWidth: '140px' }}>TRANSPORTER</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '800', minWidth: '110px' }}>TRUCK NO.</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: '800', minWidth: '130px' }}>DRIVER & MOBILE</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', width: '110px' }}>LOADED QTY</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', width: '90px' }}>RATE / MT</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', width: '110px' }}>FREIGHT (₹)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', width: '120px' }}>CUMULATIVE (MT)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', width: '120px' }}>REMAINING (MT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let cumul = 0;
                      return relevantDispatches.map((d, idx) => {
                        const qty = Number(d.loaded_quantity_mt ?? d.dispatched_qty ?? d.loaded_qty) || 0;
                        const rate = Number(d.finalized_rate ?? d.freight_rate) || 0;
                        const gross = Math.round(qty * rate * 100) / 100;
                        cumul += qty;
                        const rem = Math.max(0, totalVolumeMT - cumul);

                        const isFirst = idx === 0;
                        const dateStr = d.dispatched_at
                          ? new Date(d.dispatched_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '-';

                        return (
                          <tr key={d.id || idx} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: '900',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  background: isFirst ? '#e0f2fe' : '#dcfce7',
                                  color: isFirst ? '#0369a1' : '#15803d',
                                  border: `1px solid ${isFirst ? '#7dd3fc' : '#86efac'}`
                                }}
                              >
                                {isFirst ? '1st Dispatch (Pehle)' : `${idx + 1}th Dispatch (Baad me)`}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontWeight: '800', color: '#0284c7' }}>
                              {d.lr_number || d.lr_no || d.id}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '0.74rem', color: '#475569' }}>
                              {dateStr}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0f172a' }}>
                              {d.transporter_name || 'Vendor'}
                              <span style={{ fontSize: '0.66rem', color: '#64748b', marginLeft: '3px' }}>({d.transporter_code})</span>
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0f172a' }}>
                              {d.truck_number || d.truck_no}
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '0.74rem' }}>
                              <div style={{ fontWeight: '700', color: '#0f172a' }}>{d.driver_name || 'Driver'}</div>
                              <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.68rem' }}>{d.driver_mobile || '-'}</div>
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '900', color: '#059669', fontSize: '0.82rem' }}>
                              {qty} MT
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0f172a' }}>
                              ₹{rate}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                              ₹{gross.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#0284c7' }}>
                              {cumul.toFixed(3)} MT
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '900', color: rem <= 0.001 ? '#059669' : '#d97706' }}>
                              {rem.toFixed(3)} MT
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                ⏳ <strong>No truck dispatches recorded yet for this requirement.</strong> Once the winning transporter dispatches trucks, full loading chronicle (pehle vs baad me vs remaining) will appear here.
              </div>
            )}
          </div>

          {/* Statement Audit Seal & Signature Footer */}
          <div
            style={{
              background: '#f0f7fc',
              border: '1.5px solid #bfe0fb',
              borderRadius: '12px',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#0369a1', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} /> OFFICIAL {(companyInfo?.name || "").toUpperCase()} FREIGHT STATEMENT
            </div>

            <div style={{ textAlign: 'right', borderTop: '1.5px solid #0284c7', paddingTop: '4px', minWidth: '200px' }}>
              <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.82rem' }}>Authorized Procurement Head</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{companyInfo.name}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
