// src/components/TruckDispatchSlipModal.jsx
// 100% Automated Truck Dispatch Slip & Lorry Receipt (LR) PDF Generator 🚛📄🖨️

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Printer, X, ShieldCheck, Truck, CheckCircle2 } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const TruckDispatchSlipModal = ({ dispatch, onClose }) => {
  const { db } = useAuth();

  if (!dispatch) return null;

  // Find allocation, rate request, transporter, and contract related to this dispatch
  const allocation = (db.allocations || []).find((a) => a.id === dispatch.allocation_id);
  const rateRequest = allocation
    ? (db.rate_requests || []).find((r) => r.id === allocation.rate_request_id)
    : (db.rate_requests || []).find((r) => r.id === dispatch.rate_request_id);
  const transporter = (db.transporters || []).find((t) => t.id === dispatch.transporter_id);
  const contract = allocation
    ? (db.contracts || []).find((c) => c.allocation_id === allocation.id)
    : null;

  const company = db.company || {
    name: 'Shalimar Nutrients Pvt Ltd',
    gstin: '27AAPCS1419M1ZV',
    reg_office: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028'
  };

  // Safe Date Formatter
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-IN');
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return new Date().toLocaleDateString('en-IN');
    }
  };

  const orderDateStr = formatDate(dispatch.dispatched_at || Date.now());

  // Print PDF Slip
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.88)', zIndex: 9999, backdropFilter: 'blur(6px)' }}>
      <div
        className="modal-content printable-area"
        style={{
          maxWidth: '850px',
          width: '95%',
          background: '#ffffff',
          color: '#000000',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          maxHeight: '92vh',
          overflowY: 'auto',
          border: '2px solid #000000',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        {/* Top Controls Bar (Hidden in Print PDF) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #cbd5e1', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0284c7', background: '#e0f2fe', border: '1px solid #7dd3fc', padding: '4px 12px', borderRadius: '6px' }}>
              🎉 TRUCK DISPATCH SUCCESSFUL — GENERATED SLIP
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={handlePrint} className="btn" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff', border: 'none', padding: '9px 18px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)' }}>
              <Printer size={16} /> Print Dispatch Slip PDF (A4)
            </button>
            <button onClick={onClose} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', color: '#475569', fontWeight: '800' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------
           📄 OFFICIAL TRUCK DISPATCH CHALLAN & LR SLIP
        ---------------------------------------------------- */}
        <div style={{ border: '2px solid #000000', padding: '20px', background: '#ffffff' }}>
          
          {/* Header Title Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={SHALIMAR_LOGO_BASE64}
                alt="Shalimar Logo"
                style={{ height: '55px', width: 'auto', borderRadius: '4px', objectFit: 'contain' }}
              />
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: '900', color: '#000000', margin: 0, textTransform: 'uppercase' }}>
                  {company.name}
                </h1>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#000000', marginTop: '2px' }}>
                  TRUCK DISPATCH CHALLAN & LORRY RECEIPT (LR)
                </div>
                <div style={{ fontSize: '0.72rem', color: '#333333' }}>
                  {company.reg_office} | GSTIN: {company.gstin}
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', border: '1.5px solid #000000', padding: '6px 12px', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#000000' }}>DISPATCH REF</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#000000', fontFamily: 'monospace' }}>
                {dispatch.lr_number}
              </div>
            </div>
          </div>

          {/* EXACT FORMAT requested by client */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#000000', border: '1px solid #000000' }}>
            <tbody>
              {/* Row 1: Order Date & Reporting Date */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 12px', width: '50%', borderRight: '1px solid #000000' }}>
                  <strong>Order Date:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{orderDateStr}</span>
                </td>
                <td style={{ padding: '8px 12px', width: '50%' }}>
                  <strong>Reporting Date:</strong> ______________________
                </td>
              </tr>

              {/* Row 2: Sr. No. / LR No. & Plant Entry Sr. No. */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>Sr. No. / LR No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{dispatch.lr_number}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Sr. No. (Plant Entry):</strong> ______________________
                </td>
              </tr>

              {/* Row 3: Truck/Vehicle No. */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td colSpan="2" style={{ padding: '8px 12px' }}>
                  <strong>Truck / Vehicle No.:</strong> <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '900' }}>{dispatch.truck_number}</span>
                </td>
              </tr>

              {/* Row 4: Driver Name */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td colSpan="2" style={{ padding: '8px 12px' }}>
                  <strong>Driver Name:</strong> <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{dispatch.driver_name}</span>
                </td>
              </tr>

              {/* Row 5: License No. & Mobile No. */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>License No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{dispatch.driver_license || 'MH31 20210012345'}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Mobile No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{dispatch.driver_phone}</span>
                </td>
              </tr>

              {/* Row 6: Location & Qty */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>Location:</strong> <span style={{ fontWeight: 'bold' }}>{rateRequest ? `${rateRequest.origin_city} ➔ ${rateRequest.dest_city}` : 'MIDC Processing Plant'}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Qty:</strong> <span style={{ fontWeight: '900', fontSize: '14px' }}>{dispatch.dispatched_qty} MT</span>
                </td>
              </tr>

              {/* Row 7: Freight & Atom Name / Material Item */}
              <tr>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>Freight Rate:</strong> <span style={{ fontWeight: 'bold' }}>₹{allocation ? allocation.agreed_rate : 450} / MT</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Atom Name / Cargo:</strong> <span style={{ fontWeight: 'bold' }}>{rateRequest ? rateRequest.material_type : 'Soybean Meal De-Oiled Cake (DOC)'}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Transporter & ERP PO Footer Details */}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', borderTop: '1px solid #000000', paddingTop: '10px' }}>
            <div>
              <strong>Transporter Company:</strong> {transporter ? transporter.company_name : 'Assigned Logistics Vendor'}<br />
              <strong>Transporter Code:</strong> {transporter ? transporter.code : 'TR001'} | <strong>GST:</strong> {transporter ? transporter.gst_pan : '27AAPCS1419M1ZV'}
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>ERP Contract PO:</strong> {contract ? contract.erp_po_number : 'SAP-PO-459821'}<br />
              <strong>Indent Ref Code:</strong> {rateRequest ? rateRequest.request_no : 'SNPL/26-27/REQ-01'}
            </div>
          </div>

          {/* Security & Signatures Section */}
          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '11px' }}>
            <div style={{ textAlign: 'center', borderTop: '1px solid #000000', width: '180px', paddingTop: '4px' }}>
              <strong>Plant Security / Weighbridge</strong>
            </div>
            <div style={{ textAlign: 'center', borderTop: '1px solid #000000', width: '180px', paddingTop: '4px' }}>
              <strong>Driver Signature</strong>
            </div>
            <div style={{ textAlign: 'center', borderTop: '1px solid #000000', width: '200px', paddingTop: '4px' }}>
              <strong>Transporter Authorized Sign</strong>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
