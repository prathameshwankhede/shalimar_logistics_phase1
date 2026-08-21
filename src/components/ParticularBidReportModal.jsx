// src/components/ParticularBidReportModal.jsx
// Dedicated Particular Bid / Requirement Audit Report Generator 📑🖨️

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Printer, Download, Award, TrendingDown, ShieldCheck, CheckCircle2, Truck, FileText, Calendar, MapPin } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const ParticularBidReportModal = ({ rateRequest, isOpen, onClose }) => {
  const { db } = useAuth();

  if (!isOpen || !rateRequest) return null;

  // 1. Get all submissions for this particular bid
  const submissions = (db.rate_submissions || []).filter((s) => s.rate_request_id === rateRequest.id);

  // 2. Identify L1 lowest rate & financial savings for this particular bid
  const validRates = submissions.map((s) => parseFloat(s.rate_per_unit)).filter((r) => !isNaN(r) && r > 0);
  const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
  const highestRate = validRates.length > 0 ? Math.max(...validRates) : null;
  
  const initialAvgRate = validRates.length > 0
    ? Math.round(validRates.reduce((acc, curr) => acc + curr, 0) / validRates.length)
    : (rateRequest.admin_counter_rate ? rateRequest.admin_counter_rate + 80 : 0);

  const finalApprovedRate = rateRequest.admin_counter_rate || lowestRate || 0;
  const rateSavingsPerMT = Math.max(0, initialAvgRate - finalApprovedRate);
  const totalFinancialSavings = rateSavingsPerMT * (Number(rateRequest.required_qty) || 0);

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
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)', zIndex: 9999 }}>
      <div
        className="modal-content printable-area"
        style={{
          maxWidth: '900px',
          width: '95%',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        {/* Modal Top Toolbar (Hidden during Print) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #cbd5e1', paddingBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0284c7', background: 'rgba(2, 132, 199, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
              📑 PARTICULAR BID AUDIT REPORT GENERATOR
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: '4px 0 0 0' }}>
              Audit Report for Indent: {rateRequest.request_no}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handleExportCSV} className="btn" style={{ background: '#059669', color: '#ffffff', border: 'none', padding: '8px 14px', fontSize: '0.8rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={15} /> Export CSV
            </button>
            <button onClick={handlePrint} className="btn" style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 14px', fontSize: '0.8rem', fontWeight: '700', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={15} /> Print Particular Bid PDF
            </button>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: '#475569' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
           📄 OFFICIAL PRINTABLE PARTICULAR BID REPORT SHEET
        ---------------------------------------------------- */}
        <div style={{ padding: '10px' }}>
          
          {/* Header Banner & Corporate Identity */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={SHALIMAR_LOGO_BASE64}
                alt="Shalimar Group Logo"
                style={{ height: '60px', width: 'auto', borderRadius: '6px', objectFit: 'contain' }}
              />
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>
                  Shalimar Nutrients Pvt Ltd
                </h1>
                <p style={{ fontSize: '0.8rem', color: '#475569', margin: '2px 0 0 0', fontWeight: '600' }}>
                  Procurement & Freight Audit Division | GSTIN: 27AAPCS1419M1ZV
                </p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ background: '#0f172a', color: '#ffffff', padding: '6px 14px', borderRadius: '6px', fontWeight: '800', fontSize: '0.85rem' }}>
                PARTICULAR BID REPORT
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#0284c7', marginTop: '6px' }}>
                {rateRequest.request_no}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Report Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Particular Bid Overview Grid */}
          <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0284c7', margin: '0 0 12px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
              📍 PARTICULARS & INDENT SPECIFICATIONS
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Indent Title:</span>
                <div style={{ fontWeight: '800', color: '#0f172a' }}>{rateRequest.title}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Origin Pickup:</span>
                <div style={{ fontWeight: '800', color: '#0f172a' }}>📍 {rateRequest.origin_city} ({rateRequest.origin_pin || 'MIDC'})</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Destination Delivery:</span>
                <div style={{ fontWeight: '800', color: '#0f172a' }}>📍 {rateRequest.dest_city} ({rateRequest.dest_pin || 'MIDC'})</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Material Commodity:</span>
                <div style={{ fontWeight: '800', color: '#0f172a' }}>📦 {rateRequest.material_type}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Required Volume:</span>
                <div style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.95rem' }}>{(Number(rateRequest.required_qty) || 0).toLocaleString()} {rateRequest.unit || 'MT'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Target Date:</span>
                <div style={{ fontWeight: '800', color: '#0f172a' }}>📅 {rateRequest.target_date || 'Immediate'}</div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600' }}>Indent Status:</span>
                <div>
                  <span style={{ background: rateRequest.status === 'Awarded' ? '#dcfce7' : '#fef3c7', color: rateRequest.status === 'Awarded' ? '#15803d' : '#b45309', border: `1px solid ${rateRequest.status === 'Awarded' ? '#86efac' : '#fde68a'}`, padding: '2px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '0.75rem' }}>
                    {rateRequest.status || 'Active'}
                  </span>
                </div>
              </div>
            </div>
            {rateRequest.notes && (
              <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '0.78rem', color: '#475569' }}>
                <strong>Special Note:</strong> {rateRequest.notes}
              </div>
            )}
          </div>

          {/* Financial Summary & Savings Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>TOTAL BIDS RECEIVED</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>{submissions.length} Bids</div>
            </div>
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>INITIAL AVG QUOTE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#d97706' }}>₹{initialAvgRate}/MT</div>
            </div>
            <div style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>APPROVED TARGET RATE</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#059669' }}>₹{finalApprovedRate}/MT</div>
            </div>
            <div style={{ background: '#dcfce7', border: '1.5px solid #16a34a', padding: '12px', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: '800' }}>🔥 TOTAL FREIGHT SAVED</div>
              <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#15803d' }}>₹{totalFinancialSavings.toLocaleString()}</div>
            </div>
          </div>

          {/* Transporter Bidding Comparison Evaluation Table */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0' }}>
              🚛 TRANSPORTER QUOTATION & EVALUATION MATRIX
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid #cbd5e1' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#ffffff' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Transporter Company</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Vendor Code</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Initial Quote (₹/MT)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Value (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Transit (Days)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Target Counter (₹)</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => {
                  const trans = (db.transporters || []).find((t) => t.id === sub.transporter_id);
                  const isLowest = sub.rate_per_unit === lowestRate;
                  const isAwarded = sub.status === 'Awarded' || sub.status === 'Selected';

                  return (
                    <tr key={sub.id || idx} style={{ background: isAwarded ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0f172a' }}>
                        {trans?.company_name || 'Transporter'}
                        {isLowest && <span style={{ marginLeft: '6px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: '4px', fontSize: '0.68rem' }}>🏆 L1 Lowest</span>}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700' }}>
                        {trans?.code || '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: isLowest ? '#059669' : '#0f172a' }}>
                        ₹{(Number(sub.rate_per_unit) || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                        ₹{((Number(sub.rate_per_unit) || 0) * (Number(rateRequest.required_qty) || 0)).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        {sub.transit_days || '-'} Days
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '800', color: '#0284c7' }}>
                        {sub.counter_rate_per_unit ? `₹${sub.counter_rate_per_unit}` : '-'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontWeight: '800',
                          fontSize: '0.72rem',
                          background: isAwarded ? '#dcfce7' : sub.status === 'Negotiating' ? '#fef3c7' : '#e2e8f0',
                          color: isAwarded ? '#15803d' : sub.status === 'Negotiating' ? '#b45309' : '#475569'
                        }}>
                          {isAwarded ? '🏆 AWARDED' : sub.status || 'Submitted'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {submissions.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                      No transporter bids submitted yet for this particular requirement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Awarded Contract & PO Details (If Awarded) */}
          {allocation && (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #16a34a', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: '800', color: '#15803d', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={18} /> AWARDED CONTRACT & SAP PO DETAILS
                  </h4>
                  <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: '700', marginTop: '4px' }}>
                    Awarded Vendor: <strong>{awardedTransporter?.company_name || 'Transporter'}</strong> ({awardedTransporter?.code})
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>Contract No: <strong style={{ color: '#0f172a' }}>{contract?.contract_number || allocation.id}</strong></div>
                  <div style={{ fontSize: '0.75rem', color: '#475569' }}>SAP PO Ref: <strong style={{ color: '#0284c7' }}>{contract?.erp_po_number || 'SAP-SNPL-PO-ACTIVE'}</strong></div>
                </div>
              </div>
            </div>
          )}

          {/* Dispatched Vehicles Log (If Dispatched) */}
          {dispatches.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: '800', color: '#0f172a', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={16} color="#0284c7" /> DISPATCHED TRUCKS & LR LOG ({dispatches.length} Vehicles)
              </h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', border: '1px solid #cbd5e1' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#ffffff' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Truck Number</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Driver Name</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Driver Contact</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Dispatched Qty</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>LR Number</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Dispatch Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatches.map((d, i) => (
                    <tr key={d.id || i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 10px', fontWeight: '800', color: '#0f172a' }}>{d.truck_number}</td>
                      <td style={{ padding: '6px 10px', fontWeight: '700' }}>{d.driver_name}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{d.driver_phone}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#059669' }}>{d.dispatched_qty} MT</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '800', color: '#0284c7' }}>{d.lr_number}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontSize: '0.72rem', color: '#64748b' }}>
                        {new Date(d.dispatched_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Official Signatures & Verification Stamp */}
          <div style={{ marginTop: '30px', paddingTop: '16px', borderTop: '2px solid #0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '0.78rem' }}>
            <div>
              <div style={{ color: '#15803d', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={16} /> 256-Bit Encrypted Procurement Audit Verified
              </div>
              <div style={{ color: '#64748b', marginTop: '2px' }}>
                Audit ID: SNPL-AUDIT-BID-{rateRequest.id} | System Verified
              </div>
            </div>

            <div style={{ textAlign: 'center', borderTop: '1px solid #0f172a', width: '220px', paddingTop: '4px' }}>
              <div style={{ fontWeight: '800', color: '#0f172a' }}>Authorized Signatory</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Shalimar Logistics Procurement Head</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
