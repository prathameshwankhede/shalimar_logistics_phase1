// src/components/ParticularBidReportModal.jsx
// Clean Batch & Requirement "COMPARATIVE FREIGHT RATE STATEMENT" (Phase 1 Modern Schema) 📑📊✨

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Printer, Download, ShieldCheck, FileSpreadsheet, Building2, MapPin, Truck, CheckCircle2 } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const ParticularBidReportModal = ({ rateRequest, isOpen, onClose }) => {
  const { db } = useAuth();

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
  const statementTypeLabel = isBatchReport ? `BATCH NO. ${reqNoStr}` : `BID NO. ${reqNoStr}`;
  const statementTitleCode = reqNoStr;

  // Calculate total batch tonnage
  const totalVolumeMT = childItems.length > 0
    ? childItems.reduce((sum, item) => sum + (Number(item.quantity_mt || item.required_qty) || 0), 0)
    : Number(rateRequest.total_quantity_mt || rateRequest.quantity_mt || rateRequest.required_qty || 0);

  // 1. Build route rows list for ALL items in this requirement/batch
  const routeRows = childItems.length > 0
    ? childItems.map((item, idx) => {
        const origin = item.pickup_origin || rateRequest.pickup_origin || rateRequest.origin_city || 'Origin Plant';
        const dest = item.drop_location || rateRequest.drop_location || rateRequest.dest_city || 'Destination Plant';
        const product = item.product_name || item.material_type || rateRequest.product_name || 'Agri Commodity';
        const qty = Number(item.quantity_mt || item.required_qty || 0);
        const subIndent = item.sub_indent_no || `${reqNoStr}/${(idx + 1).toString().padStart(2, '0')}`;
        return {
          id: item.id,
          subIndentNo: subIndent,
          origin,
          dest,
          product,
          locationName: `${dest} (${origin} ➔ ${dest})`,
          qty,
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
        itemObj: rateRequest
      }];

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

  // Print PDF Statement with print-mode class
  const handlePrint = () => {
    document.body.classList.add('printing-report');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-report');
      }, 500);
    }, 60);
  };

  // Keyboard shortcut Ctrl+P / browser print listener
  React.useEffect(() => {
    if (!isOpen) return;

    const handleBeforePrint = () => {
      document.body.classList.add('printing-report');
    };

    const handleAfterPrint = () => {
      document.body.classList.remove('printing-report');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      document.body.classList.remove('printing-report');
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [isOpen]);

  // Export CSV for the clean batch statement
  const handleExportCSV = () => {
    const headerTitle = `${statementTypeLabel} COMPARATIVE FREIGHT RATE STATEMENT ${currentDateStr}`;
    const transporterHeaderNames = transporterColumns.map((t) => (t?.name || "").toUpperCase());

    const csvRows = [
      [headerTitle, ...Array(transporterHeaderNames.length + 3).fill('')],
      ['SUB-INDENT', 'COMMODITY', 'ROUTE / LOCATION', 'QTY (MT)', ...transporterHeaderNames, 'Minimum Rate', 'Remark']
    ];

    routeRows.forEach((rowObj) => {
      const itemSubs = (db?.rate_submissions || []).filter((s) => {
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

      const rowData = [
        rowObj.subIndentNo,
        rowObj.product,
        rowObj.locationName,
        rowObj.qty
      ];

      transporterColumns.forEach((tCol) => {
        const transMatchIds = [tCol.id, tCol.code, tCol.username].filter(Boolean).map(String);
        const sub = itemSubs.find((s) => transMatchIds.includes(String(s.transporter_id)));
        const rawRate = sub ? (sub.rate_per_mt ?? sub.rate_per_unit ?? sub.final_rate ?? sub.original_rate) : null;
        rowData.push(rawRate !== null && !isNaN(Number(rawRate)) ? `₹${rawRate}` : '-');
      });

      rowData.push(minRate > 0 ? `₹${minRate}` : '-');

      const alloc = (db?.allocations || []).find((a) =>
        (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
        (!a.item_id || String(a.item_id) === String(rowObj.id))
      );
      const winner = alloc ? (db?.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;
      const remarkText = alloc
        ? `Awarded to ${winner?.company_name || 'Transporter'} @ ₹${alloc.agreed_rate}/MT`
        : minRate > 0
        ? `L1 Lowest Quote: ₹${minRate}/MT`
        : 'Awaiting Bids';

      rowData.push(remarkText);
      csvRows.push(rowData);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `COMPARATIVE_STATEMENT_${statementTitleCode.replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          maxWidth: '1360px',
          width: '96vw',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          maxHeight: '94vh',
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
            marginBottom: '20px',
            borderBottom: '2px solid #e2e8f0',
            paddingBottom: '14px',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: '900',
                color: '#0284c7',
                background: '#e0f2fe',
                border: '1px solid #7dd3fc',
                padding: '4px 12px',
                borderRadius: '6px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              {isBatchReport ? '📂 MULTI-ITEM BATCH STATEMENT REPORT' : '📑 SINGLE BID STATEMENT REPORT'}
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', margin: '6px 0 0 0', letterSpacing: '-0.01em' }}>
              {statementTypeLabel} COMPARATIVE FREIGHT RATE STATEMENT
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleExportCSV}
              className="btn"
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '9px 16px',
                fontSize: '0.82rem',
                fontWeight: '800',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)'
              }}
            >
              <Download size={16} /> Export Batch CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn"
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '9px 18px',
                fontSize: '0.82rem',
                fontWeight: '800',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Printer size={16} /> Print Batch PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#475569',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close Report"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
           📊 CLEAN BATCH FREIGHT STATEMENT SHEET
        ---------------------------------------------------- */}
        <div style={{ padding: '4px' }}>
          
          {/* Header Corporate Title Card */}
          <div
            style={{
              background: '#f0f7fc',
              border: '1.5px solid #bfe0fb',
              borderRadius: '12px',
              padding: '18px 24px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <img
                src={SHALIMAR_LOGO_BASE64}
                alt="Shalimar Logo"
                style={{
                  height: '56px',
                  width: 'auto',
                  borderRadius: '6px',
                  background: '#ffffff',
                  padding: '4px',
                  border: '1px solid #cbd5e1',
                  objectFit: 'contain'
                }}
              />
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {statementTypeLabel} COMPARATIVE FREIGHT RATE STATEMENT {currentDateStr}
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#0284c7', marginTop: '3px', fontWeight: '800' }}>
                  {companyInfo.name} | Logistics Procurement Division
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                  {companyInfo.reg_office} • GSTIN: {companyInfo.gstin}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #7dd3fc',
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontWeight: '900',
                  fontSize: '0.9rem',
                  fontFamily: 'monospace',
                  display: 'inline-block'
                }}
              >
                {reqNoStr}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '5px', fontWeight: '700' }}>
                Sub-Indents: <strong>{routeRows.length} Route{routeRows.length > 1 ? 's' : ''}</strong> | Total Volume: <strong style={{ color: '#059669' }}>{(totalVolumeMT || 0).toLocaleString()} MT Total</strong>
              </div>
            </div>
          </div>

          {/* CLEAN BATCH FREIGHT MATRIX TABLE */}
          <div style={{ overflowX: 'auto', border: '1.5px solid #bfe0fb', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'sans-serif' }}>
              <thead>
                <tr style={{ background: '#f0f7fc', color: '#0f172a', borderBottom: '2px solid #bfe0fb' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '180px' }}>
                    SUB-INDENT & COMMODITY
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '220px' }}>
                    ROUTE (ORIGIN ➔ DESTINATION)
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', width: '100px' }}>
                    QTY (MT)
                  </th>
                  {transporterColumns.map((tCol, idx) => (
                    <th key={tCol.id || idx} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #cbd5e1', minWidth: '140px', color: '#0369a1' }}>
                      <div style={{ textTransform: 'uppercase' }}>{(tCol?.name || "").toUpperCase()}</div>
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700', fontFamily: 'monospace' }}>
                        ({tCol.code})
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', background: '#dcfce7', color: '#15803d', borderRight: '1px solid #cbd5e1', minWidth: '120px' }}>
                    MINIMUM RATE
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '900', background: '#fef3c7', color: '#b45309', minWidth: '180px' }}>
                    REMARK / STATUS
                  </th>
                </tr>
              </thead>
              <tbody>
                {routeRows.map((rowObj, rIdx) => {
                  const itemSubs = (db?.rate_submissions || []).filter((s) => {
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

                  const alloc = (db?.allocations || []).find((a) =>
                    (String(a.rate_request_id) === String(rateRequest.id) || String(a.requirement_id) === String(rateRequest.id)) &&
                    (!a.item_id || String(a.item_id) === String(rowObj.id))
                  );
                  const winnerTrans = alloc ? (db?.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;

                  return (
                    <tr key={rowObj.id || rIdx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      
                      {/* SUB-INDENT & COMMODITY */}
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                        <div style={{ color: '#0284c7', fontFamily: 'monospace', fontWeight: '900', fontSize: '0.85rem' }}>
                          {rowObj.subIndentNo}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px', fontWeight: '700' }}>
                          📦 {rowObj.product}
                        </div>
                      </td>

                      {/* ROUTE (ORIGIN -> DESTINATION) */}
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          📍 <span style={{ color: '#0284c7' }}>{rowObj.origin}</span> ➔ <span style={{ color: '#059669' }}>{rowObj.dest}</span>
                        </div>
                      </td>

                      {/* QTY (MT) */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', color: '#0f172a', borderRight: '1px solid #cbd5e1', fontSize: '0.88rem' }}>
                        {rowObj.qty} MT
                      </td>

                      {/* TRANSPORTER RATES */}
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
                              padding: '12px 14px',
                              textAlign: 'center',
                              fontWeight: '900',
                              fontSize: '0.9rem',
                              borderRight: '1px solid #cbd5e1',
                              background: isMin ? '#dcfce7' : 'transparent',
                              color: isMin ? '#15803d' : rateVal ? '#0f172a' : '#94a3b8'
                            }}
                          >
                            {rateVal !== null ? (
                              <div>
                                ₹{rateVal}
                                {isMin && (
                                  <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: '900', marginTop: '1px' }}>
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

                      {/* MINIMUM RATE */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', fontSize: '0.95rem', color: '#15803d', background: '#dcfce7', borderRight: '1px solid #cbd5e1' }}>
                        {minRate > 0 ? `₹${minRate}` : '-'}
                      </td>

                      {/* REMARK / STATUS */}
                      <td style={{ padding: '12px 14px', fontSize: '0.8rem', fontWeight: '800' }}>
                        {alloc ? (
                          <div style={{ color: '#15803d', display: 'flex', flexDirection: 'column' }}>
                            <span>🏆 Awarded: {winnerTrans?.company_name || 'Transporter'}</span>
                            <span style={{ fontSize: '0.72rem', color: '#0284c7', fontFamily: 'monospace' }}>
                              Rate: ₹{alloc.agreed_rate}/MT
                            </span>
                          </div>
                        ) : minRate > 0 ? (
                          <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={14} /> Lowest Quote: ₹{minRate}/MT
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
            </table>
          </div>

          {/* Statement Audit Seal & Signature Footer */}
          <div
            style={{
              background: '#f0f7fc',
              border: '1.5px solid #bfe0fb',
              borderRadius: '12px',
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ fontSize: '0.82rem', color: '#0369a1', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} /> OFFICIAL {(companyInfo?.name || "").toUpperCase()} BATCH COMPARATIVE FREIGHT STATEMENT
            </div>

            <div style={{ textAlign: 'right', borderTop: '1.5px solid #0284c7', paddingTop: '6px', minWidth: '220px' }}>
              <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.85rem' }}>Authorized Procurement Head</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{companyInfo.name}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
