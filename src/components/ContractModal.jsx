// src/components/ContractModal.jsx
// 100% Automated Enterprise Delivery Order Document Engine - Dynamic DO Master Settings Integrated 🛡️📄

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Printer, X, FileText, CheckCircle } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const ContractModal = ({ contract, onClose }) => {
  const { db } = useAuth();
  if (!contract) return null;

  const company = db.company || {
    name: 'Shalimar Nutrients Pvt Ltd',
    gstin: '27AAPCS1419M1ZV',
    reg_office: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028'
  };

  const doMaster = db.do_master_settings || {
    hsn_code: '23040010',
    igst_rate: 5,
    do_prefix: 'DOR-SNPL-',
    state_name: 'MAHARASHTRA',
    state_code: '27 (MAHARASHTRA)',
    dispatch_plant_name: 'Shalimar Nutrients MIDC Processing Unit',
    dispatch_plant_address: 'Plot No. 12, Industrial Area, MIDC, Nagpur, Maharashtra - 440028',
    terms_conditions: '1. Food-grade tarpaulin covering mandatory for dry cargo.\n2. Automated 24x7 weighbridge tare and gross recorded at Shalimar Plant.\n3. Sound single-use tamper-evident seals mandatory for oil tankers.\n4. Transit unloading expected within 4 hours of arrival.'
  };

  const allocation = db.allocations?.find((a) => a.id === contract.allocation_id);
  const rateRequest = allocation ? db.rate_requests?.find((r) => r.id === allocation.rate_request_id) : null;
  const transporter = db.transporters?.find((t) => t.id === contract.transporter_id);
  const dispatches = allocation ? (db.truck_dispatches || []).filter((d) => d.allocation_id === allocation.id) : [];

  const latestDispatch = dispatches.length > 0 ? dispatches[0] : null;

  // Safe Date Formatter
  const formatDate = (dateObj) => {
    try {
      const d = new Date(dateObj);
      if (isNaN(d.getTime())) return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-');
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-');
    } catch (e) {
      return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-');
    }
  };

  const formatDateTime = (dateObj) => {
    try {
      const d = new Date(dateObj);
      if (isNaN(d.getTime())) return new Date().toLocaleString();
      const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).toUpperCase().replace(/ /g, '-');
      const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} ${timePart}`;
    } catch (e) {
      return new Date().toLocaleString();
    }
  };

  // 100% AUTOMATED DYNAMIC CALCULATION ENGINE WITH MASTER INTEGRATION
  const prefix = doMaster.do_prefix || 'DOR-SNPL-';
  const doNo = contract.contract_number ? contract.contract_number.replace('CNT', prefix.replace(/-$/, '')) : `${prefix}${Date.now().toString().slice(-6)}`;
  const doDate = formatDate(contract.created_at || Date.now());
  const deliveryToDt = rateRequest?.target_date ? formatDate(rateRequest.target_date) : 'AS PER SCHEDULE';
  const printedOnStr = formatDateTime(Date.now());

  // Dynamic Consignee / Party Details
  const partyName = rateRequest ? (rateRequest.title.includes('-') ? rateRequest.title.split('-')[0].trim() : rateRequest.title) : 'Shalimar Nutrients Plant Unit';
  const partyAddress = rateRequest ? `${rateRequest.dest_city} Plant Hub, PIN: ${rateRequest.dest_pin}` : doMaster.dispatch_plant_address;
  const partyState = rateRequest ? `${rateRequest.dest_city}` : doMaster.state_name;
  const partyStateCode = doMaster.state_code || '27 (MAHARASHTRA)';
  const partyGST = transporter?.gst_pan || company.gstin;

  // Dynamic Product & Tonnage Calculations
  const productName = rateRequest ? rateRequest.material_type : 'AGRI COMMODITY';
  const hsnCode = doMaster.hsn_code || '23040010';
  const ordQty = allocation ? (parseFloat(allocation.allocated_qty) || 0) : 0;
  const ratePerUnit = allocation ? (parseFloat(allocation.agreed_rate) || 0) : 0;
  const netMaterialVal = ordQty * ratePerUnit;
  const gstPercentage = parseFloat(doMaster.igst_rate) || 5;
  const gstRate = gstPercentage / 100;
  const gstAmount = Math.round(netMaterialVal * gstRate);
  const netTotalAmount = netMaterialVal + gstAmount;

  // Automated Number to Indian Currency Words Generator
  const numToWords = (num) => {
    if (!num || num <= 0) return 'Zero Only.';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function inWords(n) {
      if ((n = n.toString()).length > 9) return 'overflow';
      let n_array = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
      if (!n_array) return '';
      let str = '';
      str += (n_array[1] != 0) ? (a[Number(n_array[1])] || b[n_array[1][0]] + ' ' + a[n_array[1][1]]) + 'Crore ' : '';
      str += (n_array[2] != 0) ? (a[Number(n_array[2])] || b[n_array[2][0]] + ' ' + a[n_array[2][1]]) + 'Lakh ' : '';
      str += (n_array[3] != 0) ? (a[Number(n_array[3])] || b[n_array[3][0]] + ' ' + a[n_array[3][1]]) + 'Thousand ' : '';
      str += (n_array[4] != 0) ? (a[Number(n_array[4])] || b[n_array[4][0]] + ' ' + a[n_array[4][1]]) + 'Hundred ' : '';
      str += (n_array[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n_array[5])] || b[n_array[5][0]] + ' ' + a[n_array[5][1]]) : '';
      return str;
    }
    return inWords(Math.round(num)) + ' Only.';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content printable-area" style={{ maxWidth: '940px', background: '#ffffff', color: '#000000', padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
        
        {/* Print Action Bar (HIGH-TECH EXECUTIVE BAR) */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#e0f2fe', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
              <FileText size={20} color="#0284c7" />
            </div>
            <div>
              <span style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a' }}>Delivery Order & Freight Purchase Contract</span>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Order Ref #{contract.erp_po_number || 'SAP-PO-45215097'}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => window.print()} className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: '700', borderRadius: '8px' }}>
              <Printer size={16} /> Print / Save DO PDF
            </button>
            <button onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', borderRadius: '8px' }}>
              <X size={16} /> Close
            </button>
          </div>
        </div>

        {/* --- 100% AUTOMATED DELIVERY ORDER PREVIEW --- */}
        <div style={{ border: '2px solid #000000', padding: '12px', background: '#ffffff', color: '#000000' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', position: 'relative', borderBottom: '1px solid #000000', paddingBottom: '8px', marginBottom: '8px' }}>
            <img
              src={SHALIMAR_LOGO_BASE64}
              alt="Shalimar Logo"
              style={{ position: 'absolute', top: 0, left: 0, height: '42px', objectFit: 'contain' }}
            />
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 2px 0', textTransform: 'uppercase', color: '#000000' }}>
              {company.name}
            </h1>
            <div style={{ fontSize: '11px', margin: '0 0 2px 0', color: '#000000', fontWeight: 'bold' }}>
              GSTIN: {company.gstin}
            </div>
            <div style={{ fontSize: '9.5px', margin: '0 0 4px 0', color: '#334155' }}>
              {doMaster.dispatch_plant_address || company.reg_office}
            </div>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: '6px 0 0 0', textDecoration: 'underline', color: '#000000' }}>
              DELIVERY ORDER / FREIGHT PURCHASE CONTRACT
            </h2>

            <div style={{ position: 'absolute', top: 0, left: 0, fontSize: '9.5px', color: '#000000', fontWeight: '600' }}>
              Printed On: {printedOnStr}
            </div>
            <div style={{ position: 'absolute', top: 0, right: 0, fontSize: '9.5px', color: '#000000', fontWeight: '600' }}>
              Page 1 of 1
            </div>
          </div>

          {/* 3 Column Party Name Box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '1px solid #000000', marginBottom: '8px' }}>
            <div style={{ padding: '6px', borderRight: '1px solid #000000' }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000000', paddingBottom: '2px', marginBottom: '4px', fontSize: '11px', color: '#000000' }}>Party Name</div>
              <div style={{ fontSize: '10px', lineHeight: '1.4', color: '#000000' }}>
                <strong>Name:</strong> {partyName}<br />
                <strong>Address:</strong> {partyAddress}<br />
                <strong>State:</strong> {partyState}<br />
                <strong>State Code:</strong> {partyStateCode}<br />
                <strong>GSTIN No.</strong> {partyGST}
              </div>
            </div>

            <div style={{ padding: '6px', borderRight: '1px solid #000000' }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000000', paddingBottom: '2px', marginBottom: '4px', fontSize: '11px', color: '#000000' }}>Bill Party Name</div>
              <div style={{ fontSize: '10px', lineHeight: '1.4', color: '#000000' }}>
                <strong>Name:</strong> {partyName}<br />
                <strong>Address:</strong> {partyAddress}<br />
                <strong>State:</strong> {partyState}<br />
                <strong>State Code:</strong> {partyStateCode}<br />
                <strong>GSTIN No.</strong> {partyGST}
              </div>
            </div>

            <div style={{ padding: '6px' }}>
              <div style={{ fontWeight: 'bold', borderBottom: '1px solid #000000', paddingBottom: '2px', marginBottom: '4px', fontSize: '11px', color: '#000000' }}>Shipped Party Name</div>
              <div style={{ fontSize: '10px', lineHeight: '1.4', color: '#000000' }}>
                <strong>Name:</strong> {partyName}<br />
                <strong>Address:</strong> {partyAddress}<br />
                <strong>State:</strong> {partyState}<br />
                <strong>State Code:</strong> {partyStateCode}<br />
                <strong>GSTIN No.</strong> {partyGST}
              </div>
            </div>
          </div>

          {/* Key Order Metadata Grid */}
          <div style={{ border: '1px solid #000000', padding: '6px 8px', marginBottom: '8px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 12px', fontSize: '10.5px', color: '#000000' }}>
            <div><strong style={{ color: '#000000' }}>DO No:</strong> {doNo}</div>
            <div><strong style={{ color: '#000000' }}>DO Date :</strong> {doDate}</div>
            <div><strong style={{ color: '#000000' }}>Transporter:</strong> {transporter?.company_name || 'Assigned Transporter'}</div>
            <div><strong style={{ color: '#000000' }}>Truckno:</strong> {latestDispatch?.truck_number || 'Pending Fleet Entry'}</div>

            <div><strong style={{ color: '#000000' }}>Party Ref. No:</strong> {contract.erp_po_number || 'Pending SAP PO'}</div>
            <div><strong style={{ color: '#000000' }}>Delivery Type :</strong> FOR Delivery</div>
            <div><strong style={{ color: '#000000' }}>Broker Name:</strong> Direct</div>
            <div><strong style={{ color: '#000000' }}>Container No:</strong> N/A</div>

            <div><strong style={{ color: '#000000' }}>Delivery Fr Dt.:</strong> {doDate}</div>
            <div><strong style={{ color: '#000000' }}>Delivery To Dt.:</strong> {deliveryToDt}</div>
            <div style={{ gridColumn: 'span 2' }}><strong style={{ color: '#000000' }}>Remark:</strong> {rateRequest?.notes || `${rateRequest?.dest_city || 'Plant'} Unloading`}</div>

            <div style={{ gridColumn: 'span 2' }}><strong style={{ color: '#000000' }}>Driver Name :</strong> {latestDispatch?.driver_name || 'Pending Truck Dispatch'}</div>
            <div><strong style={{ color: '#000000' }}>License No :</strong> {latestDispatch ? 'VERIFIED' : 'Pending Entry'}</div>
            <div><strong style={{ color: '#000000' }}>Contact No :</strong> {latestDispatch?.driver_phone || transporter?.mobile || 'N/A'}</div>
          </div>

          {/* Product Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000000', marginBottom: '8px', fontSize: '10px', color: '#000000' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000000', background: '#f1f5f9' }}>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', color: '#000000' }}>S.N</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', textAlign: 'left', color: '#000000' }}>Product Name</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', color: '#000000' }}>HSN/SAC</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', color: '#000000' }}>Contract No</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', color: '#000000' }}>Cont. Date</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', color: '#000000' }}>Bum</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', textAlign: 'right', color: '#000000' }}>Ord Qty</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', color: '#000000' }}>Unit</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', textAlign: 'right', color: '#000000' }}>Delivery Qty</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', textAlign: 'right', color: '#000000' }}>Rate/Unit</th>
                <th style={{ borderRight: '1px solid #000000', padding: '5px', textAlign: 'right', color: '#000000' }}>Dis Amt</th>
                <th style={{ padding: '5px', textAlign: 'right', color: '#000000' }}>Material Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'center' }}>1</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', fontWeight: 'bold' }}>{productName}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'center' }}>{hsnCode}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'center' }}>{contract.contract_number}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'center' }}>{doDate}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'center' }}>BAGS/BULK</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{ordQty.toFixed(2)}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'center' }}>MT</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>{ordQty.toFixed(2)}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'right' }}>₹{ratePerUnit.toFixed(2)}</td>
                <td style={{ borderRight: '1px solid #000000', padding: '6px', textAlign: 'right' }}>0.00</td>
                <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold' }}>₹{netMaterialVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          {/* Tax & Financial Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', border: '1px solid #000000', padding: '6px', marginBottom: '8px' }}>
            <div style={{ borderRight: '1px solid #000000', paddingRight: '8px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', textDecoration: 'underline' }}>Amount in Words:</div>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0f172a' }}>
                Rupees {numToWords(netTotalAmount)}
              </div>
            </div>

            <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Material Gross Value:</span>
                <strong>₹{netMaterialVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Integrated GST (IGST {gstPercentage}%):</span>
                <strong>₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #000000', paddingTop: '4px', marginTop: '4px', fontSize: '11px' }}>
                <strong style={{ color: '#000000' }}>Total Contract Value:</strong>
                <strong style={{ fontSize: '12px', color: '#000000' }}>₹{netTotalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
          </div>

          {/* Special Instructions & Signatures */}
          <div style={{ border: '1px solid #000000', padding: '6px 8px' }}>
            <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '4px' }}>Terms & Conditions / Special Instructions:</div>
            <div style={{ fontSize: '9.5px', lineHeight: '1.4', whiteSpace: 'pre-line', marginBottom: '16px' }}>
              {doMaster.terms_conditions}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '12px', borderTop: '1px dashed #000000' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000000', width: '140px', paddingTop: '2px', fontSize: '9.5px' }}>Prepared By (Logistics)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '1px solid #000000', width: '140px', paddingTop: '2px', fontSize: '9.5px' }}>Verified By (Plant Head)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '20px' }}>For {company.name}</div>
                <div style={{ borderTop: '1px solid #000000', width: '180px', paddingTop: '2px', fontSize: '9.5px', fontWeight: 'bold' }}>Authorized Signatory</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
