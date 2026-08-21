// src/components/ParticularBidReportModal.jsx
// Clean Batch & Requirement "COMPARATIVE FREIGHT RATE STATEMENT" (Only Batch Items) 📑📊✨

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Printer, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
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

  // 1. Detect Batch Code and find ALL sub-indents in the batch
  const requestNoStr = rateRequest.request_no || '';
  let batchKey = rateRequest.batch_code;
  if (!batchKey && requestNoStr.includes('/')) {
    const parts = requestNoStr.split('/');
    if (parts.length > 3) {
      batchKey = parts.slice(0, 3).join('/');
    }
  }

  const allOrgRequests = (db.rate_requests || []);
  
  // Fetch ALL sub-indents belonging to this batch
  const batchSubItems = batchKey
    ? allOrgRequests.filter((r) => r.batch_code === batchKey || (r.request_no && r.request_no.startsWith(batchKey)))
    : [];

  const isBatchReport = batchSubItems.length > 1;

  // Title for statement
  const statementTitleCode = isBatchReport ? batchKey : rateRequest.request_no;
  const statementTypeLabel = isBatchReport ? `BATCH NO. ${batchKey}` : `BID NO. ${rateRequest.request_no}`;

  // Calculate total batch tonnage & metrics
  const displayItemsList = isBatchReport ? batchSubItems : [rateRequest];
  const totalVolumeMT = displayItemsList.reduce((sum, r) => sum + (Number(r.required_qty) || 0), 0);

  // 2. Get registered transporters or Transporter A, B, C, D
  const orgTransporters = (db.transporters || []).filter((t) => t.status === 'Active' || t.status !== 'Inactive');
  
  const transporterColumns = [];
  if (orgTransporters.length > 0) {
    orgTransporters.forEach((t) => {
      transporterColumns.push({
        id: t.id,
        name: t.company_name,
        code: t.code || t.username || 'TR'
      });
    });
  }
  
  const defaultLabels = ['TRANSPORTER A', 'TRANSPORTER B', 'TRANSPORTER C', 'TRANSPORTER D'];
  while (transporterColumns.length < 4) {
    const idx = transporterColumns.length;
    transporterColumns.push({
      id: `trans_fallback_${idx}`,
      name: defaultLabels[idx] || `TRANSPORTER ${String.fromCharCode(65 + idx)}`,
      code: `TR-${String.fromCharCode(65 + idx)}`
    });
  }

  // 3. Build route rows list STRICTLY FOR THE ITEMS IN THIS BATCH / REQUIREMENT ONLY
  const routeRows = displayItemsList.map((req) => ({
    id: req.id,
    reqNo: req.request_no,
    locationName: `${req.dest_city} (${req.origin_city} ➔ ${req.dest_city})`,
    destCity: req.dest_city,
    qty: req.required_qty,
    rateRequestObj: req
  }));

  const currentDateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Print PDF Statement
  const handlePrint = () => {
    window.print();
  };

  // Export CSV for the clean batch statement
  const handleExportCSV = () => {
    const headerTitle = `${statementTypeLabel} COMPAIRATIVE FREIGHT RATE STATEMENT ${currentDateStr}`;
    const transporterHeaderNames = transporterColumns.map((t) => t.name.toUpperCase());

    const csvRows = [
      [headerTitle, ...Array(transporterHeaderNames.length + 2).fill('')],
      ['ROUTE / LOCATION', ...transporterHeaderNames, 'Minium Rate', 'Remark']
    ];

    routeRows.forEach((rowObj) => {
      const reqObj = rowObj.rateRequestObj;
      const reqSubs = reqObj ? (db.rate_submissions || []).filter((s) => s.rate_request_id === reqObj.id) : [];
      
      const rates = reqSubs.map((s) => parseFloat(s.rate_per_unit)).filter((r) => !isNaN(r) && r > 0);
      const minRate = rates.length > 0 ? Math.min(...rates) : 0;

      const rowData = [rowObj.locationName];

      transporterColumns.forEach((tCol) => {
        const sub = reqSubs.find((s) => s.transporter_id === tCol.id);
        rowData.push(sub ? sub.rate_per_unit : '');
      });

      rowData.push(minRate);

      const alloc = reqObj ? (db.allocations || []).find((a) => a.rate_request_id === reqObj.id) : null;
      const winner = alloc ? (db.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;
      const remarkText = alloc
        ? `L1 Awarded to ${winner?.company_name || 'Transporter'} @ ₹${alloc.agreed_rate}/MT`
        : minRate > 0
        ? `Lowest Quote: ₹${minRate}/MT`
        : '';

      rowData.push(remarkText);
      csvRows.push(rowData);
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BATCH_STATEMENT_${statementTitleCode.replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)', zIndex: 9999, backdropFilter: 'blur(6px)' }}>
      <div
        className="modal-content printable-area"
        style={{
          maxWidth: '1280px',
          width: '98%',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          maxHeight: '94vh',
          overflowY: 'auto',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Modal Top Control Bar (Hidden during Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0284c7', background: '#e0f2fe', border: '1px solid #7dd3fc', padding: '4px 12px', borderRadius: '6px' }}>
              {isBatchReport ? '📂 BATCH STATEMENT REPORT' : '📑 SINGLE BID STATEMENT REPORT'}
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', margin: '4px 0 0 0' }}>
              {statementTypeLabel} COMPARATIVE FREIGHT STATEMENT
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleExportCSV} className="btn" style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '9px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={16} /> Export Batch CSV
            </button>
            <button onClick={handlePrint} className="btn" style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '9px 18px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={16} /> Print Batch PDF
            </button>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#475569', fontWeight: '800' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
           📊 CLEAN BATCH FREIGHT STATEMENT SHEET (NO EXTRA LOCATIONS)
        ---------------------------------------------------- */}
        <div style={{ padding: '4px' }}>
          
          {/* Header Title Bar */}
          <div style={{ background: '#f0f7fc', border: '1.5px solid #bfe0fb', borderRadius: '12px', padding: '18px 24px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={SHALIMAR_LOGO_BASE64}
                alt="Shalimar Logo"
                style={{ height: '52px', width: 'auto', borderRadius: '6px', background: '#ffffff', padding: '3px', border: '1px solid #cbd5e1', objectFit: 'contain' }}
              />
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '900', margin: 0, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {statementTypeLabel} COMPAIRATIVE FREIGHT RATE STATEMENT {currentDateStr}
                </h2>
                <div style={{ fontSize: '0.82rem', color: '#0284c7', marginTop: '2px', fontWeight: '800' }}>
                  {companyInfo.name} | Logistics Procurement Division
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '1px' }}>
                  {companyInfo.reg_office}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #7dd3fc', padding: '4px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                {isBatchReport ? `BATCH REF: ${batchKey}` : `REQ REF: ${rateRequest.request_no}`}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px', fontWeight: '700' }}>
                Sub-Indents: <strong>{displayItemsList.length} Routes</strong> | Total Volume: <strong style={{ color: '#059669' }}>{totalVolumeMT.toLocaleString()} MT Batch Total</strong>
              </div>
            </div>
          </div>

          {/* CLEAN BATCH FREIGHT MATRIX TABLE */}
          <div style={{ overflowX: 'auto', border: '1.5px solid #bfe0fb', borderRadius: '12px', marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'sans-serif' }}>
              <thead>
                <tr style={{ background: '#f0f7fc', color: '#0f172a', borderBottom: '2px solid #bfe0fb' }}>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '900', borderRight: '1px solid #e2e8f0', minWidth: '220px', textTransform: 'uppercase' }}>
                    ROUTE / LOCATION
                  </th>
                  {transporterColumns.map((tCol, idx) => (
                    <th key={tCol.id || idx} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', borderRight: '1px solid #e2e8f0', minWidth: '150px', color: '#0369a1' }}>
                      {tCol.name.toUpperCase()}
                      <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: '700', fontFamily: 'monospace' }}>
                        ({tCol.code})
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', background: '#dcfce7', color: '#15803d', borderRight: '1px solid #e2e8f0', minWidth: '120px' }}>
                    Minium Rate
                  </th>
                  <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '900', background: '#fef3c7', color: '#b45309', minWidth: '180px' }}>
                    Remark
                  </th>
                </tr>
              </thead>
              <tbody>
                {routeRows.map((rowObj, rIdx) => {
                  const reqObj = rowObj.rateRequestObj;
                  const reqSubs = reqObj ? (db.rate_submissions || []).filter((s) => s.rate_request_id === reqObj.id) : [];

                  const validRates = reqSubs.map((s) => parseFloat(s.rate_per_unit)).filter((r) => !isNaN(r) && r > 0);
                  const minRate = validRates.length > 0 ? Math.min(...validRates) : 0;

                  const alloc = reqObj ? (db.allocations || []).find((a) => a.rate_request_id === reqObj.id) : null;
                  const winnerTrans = alloc ? (db.transporters || []).find((tr) => tr.id === alloc.transporter_id) : null;

                  return (
                    <tr key={rowObj.id || rIdx} style={{ background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                      
                      {/* ROUTE / LOCATION */}
                      <td style={{ padding: '10px 14px', fontWeight: '800', color: '#0f172a', borderRight: '1px solid #cbd5e1' }}>
                        <div>
                          {rowObj.locationName}
                        </div>
                        {rowObj.reqNo && rowObj.reqNo !== '-' && (
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontFamily: 'monospace', fontWeight: '700', marginTop: '2px' }}>
                            Code: {rowObj.reqNo} {rowObj.qty ? `| ${rowObj.qty} MT` : ''}
                          </div>
                        )}
                      </td>

                      {/* TRANSPORTER REAL QUOTE RATES */}
                      {transporterColumns.map((tCol) => {
                        const sub = reqSubs.find((s) => s.transporter_id === tCol.id);
                        const isMin = sub && parseFloat(sub.rate_per_unit) === minRate && minRate > 0;

                        return (
                          <td
                            key={tCol.id}
                            style={{
                              padding: '10px 14px',
                              textAlign: 'center',
                              fontWeight: '900',
                              fontSize: '0.9rem',
                              borderRight: '1px solid #cbd5e1',
                              background: isMin ? '#dcfce7' : 'transparent',
                              color: isMin ? '#15803d' : sub ? '#0f172a' : '#cbd5e1'
                            }}
                          >
                            {sub ? (
                              <div>
                                ₹{sub.rate_per_unit}
                                {isMin && (
                                  <div style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: '900', marginTop: '1px' }}>
                                    🏆 L1 LOWEST
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>-</span>
                            )}
                          </td>
                        );
                      })}

                      {/* MINIMUM RATE */}
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '900', fontSize: '0.95rem', color: '#15803d', background: '#dcfce7', borderRight: '1px solid #cbd5e1' }}>
                        {minRate > 0 ? `₹${minRate}` : '0'}
                      </td>

                      {/* REMARK */}
                      <td style={{ padding: '10px 14px', fontSize: '0.78rem', fontWeight: '800' }}>
                        {alloc ? (
                          <div style={{ color: '#15803d', display: 'flex', flexDirection: 'column' }}>
                            <span>🏆 Awarded: {winnerTrans?.company_name || 'Transporter'}</span>
                            <span style={{ fontSize: '0.72rem', color: '#0284c7', fontFamily: 'monospace' }}>
                              Rate: ₹{alloc.agreed_rate}/MT
                            </span>
                          </div>
                        ) : minRate > 0 ? (
                          <span style={{ color: '#059669' }}>
                            Lowest ₹{minRate}/MT
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>
                            -
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Statement Audit Seal Footer */}
          <div style={{ background: '#f0f7fc', border: '1.5px solid #bfe0fb', borderRadius: '12px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: '#0369a1', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={18} /> OFFICIAL {companyInfo.name.toUpperCase()} BATCH COMPARATIVE FREIGHT STATEMENT
            </div>

            <div style={{ textAlign: 'right', borderTop: '1px solid #0284c7', paddingTop: '4px', width: '220px' }}>
              <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.85rem' }}>Authorized Procurement Head</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{companyInfo.name}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
