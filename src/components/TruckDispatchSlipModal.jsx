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
    : (db.rate_requests || []).find((r) => r.id === (dispatch.requirement_id || dispatch.rate_request_id));
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
  const lrNumber = dispatch.lr_number || dispatch.lr_no || dispatch.id || 'LR-SNPL-PENDING';
  const truckNumber = dispatch.truck_number || dispatch.truck_no || 'N/A';
  const driverName = dispatch.driver_name || 'Driver';
  const driverLicense = dispatch.driver_license || 'N/A';
  const driverMobile = dispatch.driver_mobile || dispatch.driver_phone || 'N/A';
  const loadedQty = dispatch.loaded_quantity_mt || dispatch.dispatched_qty || dispatch.loaded_qty || 0;
  const freightRate = dispatch.finalized_rate || dispatch.freight_rate || (allocation ? allocation.agreed_rate : 450);
  const routeLocation = (dispatch.pickup_origin && dispatch.drop_location)
    ? `${dispatch.pickup_origin} ➔ ${dispatch.drop_location}`
    : (rateRequest ? `${rateRequest.origin_city || rateRequest.pickup_origin || 'Nagpur'} ➔ ${rateRequest.dest_city || rateRequest.drop_location || 'Destination'}` : 'MIDC Processing Plant');
  const cargoName = dispatch.product_name || (rateRequest ? (rateRequest.product_name || rateRequest.material_type) : 'Agri-Commodities / Bulk Cargo');
  const transporterName = dispatch.transporter_name || (transporter ? transporter.company_name : 'Assigned Logistics Vendor');
  const transporterCode = dispatch.transporter_code || (transporter ? transporter.code : 'TR001');
  const transporterGst = dispatch.gst_pan || (transporter ? transporter.gst_pan : '27AAPCS1419M1ZV');
  const reqNoStr = dispatch.sub_indent_no || dispatch.req_no || (rateRequest ? (rateRequest.sub_indent_no || rateRequest.request_no) : 'SNPL/26-27/REQ-01');

  // Print PDF Slip via Bulletproof Standalone Print Engine (Guaranteed Clean A4 Print)
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

      const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Truck Dispatch Challan - ${lrNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #000000;
      background: #ffffff !important;
      font-size: 12px;
    }
    .slip-container {
      border: 2px solid #000000;
      padding: 20px;
      background: #ffffff;
    }
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-left img {
      height: 52px;
      width: auto;
      object-fit: contain;
    }
    .company-title {
      font-size: 17px;
      font-weight: 900;
      text-transform: uppercase;
      margin: 0;
    }
    .slip-title {
      font-size: 11px;
      font-weight: bold;
      margin-top: 2px;
    }
    .company-sub {
      font-size: 10px;
      color: #333333;
    }
    .lr-badge {
      border: 1.5px solid #000000;
      padding: 6px 12px;
      border-radius: 4px;
      text-align: right;
    }
    .lr-badge-label {
      font-size: 9px;
      font-weight: bold;
    }
    .lr-badge-no {
      font-size: 13px;
      font-weight: 900;
      font-family: monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border: 1px solid #000000;
    }
    td {
      padding: 8px 12px;
      border: 1px solid #000000;
      vertical-align: middle;
    }
    .meta-footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      border-top: 1px solid #000000;
      padding-top: 10px;
    }
    .sign-section {
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      font-size: 11px;
    }
    .sign-box {
      text-align: center;
      border-top: 1px solid #000000;
      width: 170px;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="slip-container">
    <div class="header-bar">
      <div class="header-left">
        <img src="${SHALIMAR_LOGO_BASE64}" alt="Shalimar Logo" />
        <div>
          <div class="company-title">${company.name}</div>
          <div class="slip-title">TRUCK DISPATCH CHALLAN & LORRY RECEIPT (LR)</div>
          <div class="company-sub">${company.reg_office} | GSTIN: ${company.gstin}</div>
        </div>
      </div>
      <div class="lr-badge">
        <div class="lr-badge-label">DISPATCH REF / LR NO</div>
        <div class="lr-badge-no">${lrNumber}</div>
      </div>
    </div>

    <table>
      <tbody>
        <tr>
          <td style="width: 50%;"><strong>Order Date:</strong> <span style="font-family: monospace; font-weight: bold;">${orderDateStr}</span></td>
          <td style="width: 50%;"><strong>Reporting Date:</strong> ______________________</td>
        </tr>
        <tr>
          <td><strong>Sr. No. / LR No.:</strong> <span style="font-family: monospace; font-weight: bold;">${lrNumber}</span></td>
          <td><strong>Sr. No. (Plant Entry):</strong> ______________________</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Truck / Vehicle No.:</strong> <span style="font-family: monospace; font-size: 14px; font-weight: 900;">${truckNumber}</span></td>
        </tr>
        <tr>
          <td colspan="2"><strong>Driver Name:</strong> <span style="font-weight: bold; font-size: 13px;">${driverName}</span></td>
        </tr>
        <tr>
          <td><strong>License No.:</strong> <span style="font-family: monospace; font-weight: bold;">${driverLicense}</span></td>
          <td><strong>Mobile No.:</strong> <span style="font-family: monospace; font-weight: bold;">${driverMobile}</span></td>
        </tr>
        <tr>
          <td><strong>Location:</strong> <span style="font-weight: bold;">${routeLocation}</span></td>
          <td><strong>Qty:</strong> <span style="font-weight: 900; font-size: 14px;">${loadedQty} MT</span></td>
        </tr>
        <tr>
          <td><strong>Freight Rate:</strong> <span style="font-weight: bold;">₹${freightRate} / MT</span></td>
          <td><strong>Atom Name / Cargo:</strong> <span style="font-weight: bold;">${cargoName}</span></td>
        </tr>
      </tbody>
    </table>

    <div class="meta-footer">
      <div>
        <strong>Transporter Company:</strong> ${transporterName}<br />
        <strong>Transporter Code:</strong> ${transporterCode} | <strong>GST:</strong> ${transporterGst}
      </div>
      <div style="text-align: right;">
        <strong>ERP Contract PO:</strong> ${contract ? contract.erp_po_number : 'SAP-PO-459821'}<br />
        <strong>Indent Ref Code:</strong> ${reqNoStr}
      </div>
    </div>

    <div class="sign-section">
      <div class="sign-box"><strong>Plant Security / Weighbridge</strong></div>
      <div class="sign-box"><strong>Driver Signature</strong></div>
      <div class="sign-box"><strong>Transporter Authorized Sign</strong></div>
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
      }, 250);
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print', err);
      window.print();
    }
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
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#000000' }}>DISPATCH REF / LR NO</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#000000', fontFamily: 'monospace' }}>
                {lrNumber}
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
                  <strong>Sr. No. / LR No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lrNumber}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Sr. No. (Plant Entry):</strong> ______________________
                </td>
              </tr>

              {/* Row 3: Truck/Vehicle No. */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td colSpan="2" style={{ padding: '8px 12px' }}>
                  <strong>Truck / Vehicle No.:</strong> <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '900' }}>{truckNumber}</span>
                </td>
              </tr>

              {/* Row 4: Driver Name */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td colSpan="2" style={{ padding: '8px 12px' }}>
                  <strong>Driver Name:</strong> <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{driverName}</span>
                </td>
              </tr>

              {/* Row 5: License No. & Mobile No. */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>License No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{driverLicense}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Mobile No.:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{driverMobile}</span>
                </td>
              </tr>

              {/* Row 6: Location & Qty */}
              <tr style={{ borderBottom: '1px solid #000000' }}>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>Location:</strong> <span style={{ fontWeight: 'bold' }}>{routeLocation}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Qty:</strong> <span style={{ fontWeight: '900', fontSize: '14px' }}>{loadedQty} MT</span>
                </td>
              </tr>

              {/* Row 7: Freight & Atom Name / Material Item */}
              <tr>
                <td style={{ padding: '8px 12px', borderRight: '1px solid #000000' }}>
                  <strong>Freight Rate:</strong> <span style={{ fontWeight: 'bold' }}>₹{freightRate} / MT</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <strong>Atom Name / Cargo:</strong> <span style={{ fontWeight: 'bold' }}>{cargoName}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Transporter & ERP PO Footer Details */}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '11px', borderTop: '1px solid #000000', paddingTop: '10px' }}>
            <div>
              <strong>Transporter Company:</strong> {transporterName}<br />
              <strong>Transporter Code:</strong> {transporterCode} | <strong>GST:</strong> {transporterGst}
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>ERP Contract PO:</strong> {contract ? contract.erp_po_number : 'SAP-PO-459821'}<br />
              <strong>Indent Ref Code:</strong> {reqNoStr}
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
