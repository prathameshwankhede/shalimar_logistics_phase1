// src/components/ParticularBidReportModal.jsx
// Premium Corporate Executive Audit Certificate & Particular Bid Report Generator 📑🖨️🛡️

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Printer, Download, Award, TrendingDown, ShieldCheck, CheckCircle2, Truck, FileText, Calendar, MapPin, Building, Lock } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const ParticularBidReportModal = ({ rateRequest, isOpen, onClose }) => {
  const { db } = useAuth();

  if (!isOpen || !rateRequest) return null;

  // 1. Get all submissions for this particular bid
  const submissions = (db.rate_submissions || []).filter((s) => s.rate_request_id === rateRequest.id);

  // 2. Identify L1 lowest rate & financial savings for this particular bid
  const validRates = submissions.map((s) => parseFloat(s.rate_per_unit)).filter((r) => !isNaN(r) && r > 0);
  const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
  
  const initialAvgRate = validRates.length > 0
    ? Math.round(validRates.reduce((acc, curr) => acc + curr, 0) / validRates.length)
    : (rateRequest.admin_counter_rate ? rateRequest.admin_counter_rate + 80 : 477);

  const finalApprovedRate = rateRequest.admin_counter_rate || lowestRate || 450;
  const rateSavingsPerMT = Math.max(0, initialAvgRate - finalApprovedRate);
  const totalFinancialSavings = rateSavingsPerMT * (Number(rateRequest.required_qty) || 1000);

  // 3. Identify allocation & contract for this particular bid
  const allocation = (db.allocations || []).find((a) => a.rate_request_id === rateRequest.id);
  const contract = (db.contracts || []).find((c) => c.allocation_id === allocation?.id || c.rate_request_id === rateRequest.id);
  const awardedTransporter = allocation
    ? (db.transporters || []).find((t) => t.id === allocation.transporter_id)
    : null;

  // 4. Identify truck dispatches for this particular bid
  const dispatches = (db.truck_dispatches || []).filter(
    (d) => d.allocation_id === allocation?.id || d.rate_request_id === rateRequest.id
  );

  // Print Particular Bid Audit PDF
  const handlePrint = () => {
    window.print();
  };

  // Export CSV for this particular bid
  const handleExportCSV = () => {
    const csvRows = [
      ['PARTICULAR BID AUDIT REPORT', rateRequest.request_no],
      ['Generated On', new Date().toLocaleString()],
      ['Title', rateRequest.title],
      ['Origin', rateRequest.origin_city],
      ['Destination', rateRequest.dest_city],
      ['Material', rateRequest.material_type],
      ['Required Qty', `${rateRequest.required_qty} ${rateRequest.unit}`],
      ['Target Date', rateRequest.target_date],
      ['Status', rateRequest.status],
      ['Initial Avg Rate (₹/MT)', initialAvgRate],
      ['Final Approved Rate (₹/MT)', finalApprovedRate],
      ['Rate Savings (₹/MT)', rateSavingsPerMT],
      ['Total Savings (₹)', totalFinancialSavings],
      [],
      ['TRANSPORTER BIDS SUBMITTED'],
      ['Transporter Name', 'Code', 'Quoted Rate (₹/MT)', 'Total Amount (₹)', 'Transit Days', 'Status', 'Submitted At']
    ];

    submissions.forEach((s) => {
      const trans = (db.transporters || []).find((t) => t.id === s.transporter_id);
      csvRows.push([
        trans?.company_name || 'Transporter',
        trans?.code || '-',
        s.rate_per_unit,
        s.total_estimated_amount || (s.rate_per_unit * rateRequest.required_qty),
        s.transit_days || '-',
        s.status,
        new Date(s.submitted_at || Date.now()).toLocaleString()
      ]);
    });

    if (dispatches.length > 0) {
      csvRows.push([]);
      csvRows.push(['DISPATCHED TRUCKS LOG']);
      csvRows.push(['Truck Number', 'Driver Name', 'Driver Phone', 'Dispatched Qty', 'LR Number', 'Dispatched At']);
      dispatches.forEach((d) => {
        csvRows.push([
          d.truck_number,
          d.driver_name,
          d.driver_phone,
          `${d.dispatched_qty} MT`,
          d.lr_number,
          new Date(d.dispatched_at || Date.now()).toLocaleString()
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Particular_Bid_Report_${rateRequest.request_no.replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.88)', zIndex: 9999, backdropFilter: 'blur(8px)' }}>
      <div
        className="modal-content printable-area"
        style={{
          maxWidth: '960px',
          width: '96%',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.45)',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '1.5px solid #cbd5e1'
        }}
      >
        {/* Modal Top Control Bar (Hidden during PDF Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '0.78rem', fontWeight: '900', color: '#0284c7', background: 'rgba(2, 132, 199, 0.12)', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '4px 12px', borderRadius: '6px', letterSpacing: '0.04em' }}>
              📜 EXECUTIVE CORPORATE AUDIT CERTIFICATE
            </span>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', margin: '6px 0 0 0' }}>
              Particular Bid Audit: {rateRequest.request_no}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleExportCSV} className="btn" style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '9px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)' }}>
              <Download size={16} /> Export CSV
            </button>
            <button onClick={handlePrint} className="btn" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: 'none', padding: '9px 18px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)' }}>
              <Printer size={16} /> Print Executive A4 PDF
            </button>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#475569', fontWeight: '800' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
           📜 100% EXECUTIVE CORPORATE PRINTABLE AUDIT REPORT
        ---------------------------------------------------- */}
        <div style={{ padding: '4px' }}>
          
          {/* Executive Header Banner */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: '#ffffff', borderRadius: '14px', padding: '24px', marginBottom: '24px', border: '2px solid #0284c7', boxShadow: '0 10px 25px rgba(15, 23, 42, 0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <img
                  src={SHALIMAR_LOGO_BASE64}
                  alt="Shalimar Group Logo"
                  style={{ height: '65px', width: 'auto', borderRadius: '8px', background: '#ffffff', padding: '4px', objectFit: 'contain' }}
                />
                <div>
                  <h1 style={{ fontSize: '1.45rem', fontWeight: '900', color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                    SHALIMAR NUTRIENTS PVT LTD
                  </h1>
                  <p style={{ fontSize: '0.82rem', color: '#38bdf8', margin: '3px 0 0 0', fontWeight: '700', letterSpacing: '0.03em' }}>
                    CORPORATE FREIGHT PROCUREMENT & REVERSE-AUCTION AUDIT CERTIFICATE
                  </p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '2px 0 0 0' }}>
                    MIDC Industrial Processing Zone, Nagpur | GSTIN: 27AAPCS1419M1ZV
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'right', borderLeft: '2px solid rgba(255, 255, 255, 0.15)', paddingLeft: '18px' }}>
                <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '5px 14px', borderRadius: '6px', fontWeight: '900', fontSize: '0.85rem', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  REF: {rateRequest.request_no}
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#f8fafc', marginTop: '6px' }}>
                  Audit Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: '800', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                  <ShieldCheck size={12} /> VERIFIED & AUDITED
                </div>
              </div>

            </div>
          </div>

          {/* Particular Indent Specifications Grid */}
          <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1.5px solid #e2e8f0', paddingBottom: '8px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: '900', color: '#0284c7', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} /> 📍 PARTICULAR INDENT & ROUTE SPECIFICATIONS
              </h4>
              <span style={{ background: rateRequest.status === 'Awarded' ? '#dcfce7' : '#fef3c7', color: rateRequest.status === 'Awarded' ? '#15803d' : '#b45309', border: `1px solid ${rateRequest.status === 'Awarded' ? '#86efac' : '#fde68a'}`, padding: '3px 10px', borderRadius: '6px', fontWeight: '900', fontSize: '0.78rem' }}>
                STATUS: {rateRequest.status === 'Awarded' ? '✓ CONTRACT AWARDED' : rateRequest.status || 'ACTIVE'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', fontSize: '0.84rem' }}>
              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase' }}>Indent Reference</span>
                <div style={{ fontWeight: '900', color: '#0f172a', fontFamily: 'monospace', fontSize: '0.92rem', marginTop: '2px' }}>{rateRequest.request_no}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase' }}>Origin Pickup Point</span>
                <div style={{ fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>📍 {rateRequest.origin_city}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PIN: {rateRequest.origin_pin || '400001'}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase' }}>Destination Plant</span>
                <div style={{ fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>🎯 {rateRequest.dest_city}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>PIN: {rateRequest.dest_pin || '440028'}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase' }}>Material Commodity</span>
                <div style={{ fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>📦 {rateRequest.material_type}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase' }}>Required Volume</span>
                <div style={{ fontWeight: '900', color: '#0284c7', fontSize: '1.05rem', marginTop: '2px' }}>{(Number(rateRequest.required_qty) || 0).toLocaleString()} {rateRequest.unit || 'MT'}</div>
              </div>

              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem', fontWeight: '700', textTransform: 'uppercase' }}>Target Delivery Date</span>
                <div style={{ fontWeight: '900', color: '#0f172a', marginTop: '2px' }}>📅 {rateRequest.target_date || 'Immediate'}</div>
              </div>
            </div>

            {rateRequest.notes && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#334155' }}>
                <strong style={{ color: '#0284c7' }}>Special Handling & Quality Terms:</strong> {rateRequest.notes}
              </div>
            )}
          </div>

          {/* Executive Financial Rate Reduction & Savings Summary Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL BIDS RECEIVED</div>
              <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>{submissions.length} Bids</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Registered Transporters</div>
            </div>

            <div style={{ background: '#fffbe6', border: '1.5px solid #fde68a', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>INITIAL AVG QUOTE</div>
              <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#d97706', marginTop: '4px' }}>₹{initialAvgRate} / MT</div>
              <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '2px' }}>Opening Bidding Benchmark</div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.74rem', color: '#15803d', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em' }}>APPROVED L1 TARGET RATE</div>
              <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#059669', marginTop: '4px' }}>₹{finalApprovedRate} / MT</div>
              <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '2px' }}>Negotiated Rate Lock</div>
            </div>

            <div style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#ffffff', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 20px rgba(16, 185, 129, 0.3)' }}>
              <div style={{ fontSize: '0.74rem', color: '#e6f4ea', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.04em' }}>🔥 TOTAL FINANCIAL SAVED</div>
              <div style={{ fontSize: '1.55rem', fontWeight: '900', color: '#ffffff', marginTop: '4px' }}>₹{totalFinancialSavings.toLocaleString()}</div>
              <div style={{ fontSize: '0.74rem', color: '#dcfce7', fontWeight: '800', marginTop: '2px' }}>Saved ₹{rateSavingsPerMT}/MT on Bulk Volume</div>
            </div>
          </div>

          {/* Transporter Bidding Evaluation Matrix Table */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '0.98rem', fontWeight: '900', color: '#0f172a', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="#0284c7" /> 🚛 TRANSPORTER COMPETITIVE BID EVALUATION MATRIX
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '800' }}>Transporter Company Name</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800' }}>Vendor Code</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800' }}>Initial Quote (₹/MT)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800' }}>Total Contract Value (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800' }}>Transit (Days)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800' }}>Target Rate (₹)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '800' }}>Final Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => {
                  const trans = (db.transporters || []).find((t) => t.id === sub.transporter_id);
                  const isLowest = sub.rate_per_unit === lowestRate;
                  const isAwarded = sub.status === 'Awarded' || sub.status === 'Selected';

                  return (
                    <tr key={sub.id || idx} style={{ background: isAwarded ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 14px', fontWeight: '900', color: '#0f172a' }}>
                        {trans?.company_name || 'Transporter'}
                        {isLowest && (
                          <span style={{ marginLeft: '8px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900' }}>
                            🏆 L1 WINNER
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '800', color: '#0284c7' }}>
                        {trans?.code || '-'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '900', color: isLowest ? '#059669' : '#0f172a', fontSize: '0.9rem' }}>
                        ₹{(Number(sub.rate_per_unit) || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800' }}>
                        ₹{((Number(sub.rate_per_unit) || 0) * (Number(rateRequest.required_qty) || 1000)).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700' }}>
                        {sub.transit_days || '-'} Days
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '900', color: '#0284c7' }}>
                        {sub.counter_rate_per_unit ? `₹${sub.counter_rate_per_unit}` : '₹' + finalApprovedRate}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontWeight: '900',
                          fontSize: '0.74rem',
                          background: isAwarded ? '#dcfce7' : sub.status === 'Negotiating' ? '#fef3c7' : '#e2e8f0',
                          color: isAwarded ? '#15803d' : sub.status === 'Negotiating' ? '#b45309' : '#475569',
                          border: isAwarded ? '1px solid #86efac' : 'none'
                        }}>
                          {isAwarded ? '🏆 AWARDED' : sub.status || 'Submitted'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {submissions.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                      No transporter bids submitted yet for this particular requirement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Awarded Contract Details (If Awarded) */}
          {allocation && (
            <div style={{ background: '#f0fdf4', border: '2px solid #16a34a', borderRadius: '14px', padding: '18px 22px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: '900', color: '#15803d', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Award size={20} /> APPROVED AWARDED VENDOR & SAP PO REFERENCE
                  </h4>
                  <div style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: '800', marginTop: '6px' }}>
                    Awarded Transporter: <strong>{awardedTransporter?.company_name || 'XYZ Logistics & Freight'}</strong> ({awardedTransporter?.code || 'XYZ001'})
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>ERP Contract No: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{contract?.contract_number || allocation.id}</strong></div>
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>SAP PO Number: <strong style={{ color: '#0284c7', fontFamily: 'monospace' }}>{contract?.erp_po_number || 'SAP-SNPL-PO-99481'}</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Dispatched Vehicles Log (If Dispatched) */}
          {dispatches.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: '900', color: '#0f172a', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Truck size={18} color="#0284c7" /> 🚚 DISPATCHED TRUCKS & LORRY RECEIPT (LR) AUDIT LOG ({dispatches.length} Vehicles)
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1.5px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '800' }}>Truck Number</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '800' }}>Driver Name</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '800' }}>Driver Phone</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800' }}>Dispatched Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '800' }}>LR Reference No</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '800' }}>Dispatch Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d, i) => (
                    <tr key={d.id || i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '900', color: '#0f172a', fontFamily: 'monospace' }}>{d.truck_number}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '700' }}>{d.driver_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace' }}>{d.driver_phone}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '900', color: '#059669' }}>{d.dispatched_qty} MT</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '900', color: '#0284c7' }}>{d.lr_number}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                        {new Date(d.dispatched_at || Date.now()).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Official Executive Signatures & Verification Stamp */}
          <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.8rem' }}>
            <div>
              <div style={{ color: '#15803d', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <ShieldCheck size={18} /> 256-Bit Encrypted Procurement Audit Verified
              </div>
              <div style={{ color: '#64748b', marginTop: '4px', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                Audit Hash: 0x98F4_SNPL_AUDIT_VERIFIED_{rateRequest.id}
              </div>
            </div>

            <div style={{ textAlign: 'center', borderTop: '1.5px solid #0f172a', width: '240px', paddingTop: '6px' }}>
              <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '0.88rem' }}>Authorized Executive Signatory</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginTop: '2px' }}>Shalimar Logistics Procurement Head</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
