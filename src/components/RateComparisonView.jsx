// src/components/RateComparisonView.jsx
// Rate Comparison Dashboard with Counter-Offer Acceptance Locking 🛡️ (Contracts CANNOT be awarded until Transporter accepts Admin Counter-Offer)

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, CheckCircle2, TrendingDown, Clock, Sparkles, MessageSquare, Snowflake, Send, X, AlertCircle, Lock, FileText, Printer } from 'lucide-react';
import { ParticularBidReportModal } from './ParticularBidReportModal';

export const RateComparisonView = ({ rateRequest, onBack }) => {
  const { db, updateDB, currentUser, addSecurityLog } = useAuth();
  const [showParticularReportModal, setShowParticularReportModal] = useState(false);
  
  // Negotiation state
  const [activeCounterSub, setActiveCounterSub] = useState(null);
  const [counterForm, setCounterForm] = useState({
    counter_rate: '',
    note: ''
  });

  const [notice, setNotice] = useState('');

  // Fetch all submissions for this rate request (Flexible ID & Request No matching 🛡️)
  const submissions = (db.rate_submissions || []).filter((s) =>
    String(s.rate_request_id) === String(rateRequest?.id) ||
    String(s.rate_request_id) === String(rateRequest?.request_no)
  );

  // Identify lowest rate (L1)
  const validRates = submissions.map((s) => s.rate_per_unit).filter((r) => r && !isNaN(r));
  const lowestRate = validRates.length > 0 ? Math.min(...validRates) : null;
  const highestRate = validRates.length > 0 ? Math.max(...validRates) : null;
  const potentialSavings = lowestRate && highestRate ? (highestRate - lowestRate) * (rateRequest?.required_qty || 0) : 0;

  // Check if requirement is already awarded
  const existingAllocation = (db.allocations || []).find((a) =>
    String(a.rate_request_id) === String(rateRequest?.id) ||
    String(a.rate_request_id) === String(rateRequest?.request_no)
  );
  const allocatedTransporter = existingAllocation
    ? (db.transporters || []).find((t) =>
        String(t.id) === String(existingAllocation.transporter_id) ||
        String(t.code) === String(existingAllocation.transporter_id) ||
        String(t.username) === String(existingAllocation.transporter_id)
      )
    : null;

  // Admin Sends Counter Rate (Broadcast to ALL Transporters for this requirement 📡)
  const handleSendCounterOffer = (e, broadcastToAll = true) => {
    if (e) e.preventDefault();

    const counterRateVal = parseFloat(counterForm.counter_rate);
    if (!counterRateVal || counterRateVal <= 0) {
      alert('Please enter a valid counter rate per MT.');
      return;
    }

    const noteText = counterForm.note || `Lowest competitive bid rate: ₹${counterRateVal}/MT`;

    // 1. Update rate_requests master record with global admin_counter_rate
    const updatedRateRequests = (db.rate_requests || []).map((req) => {
      if (req.id === rateRequest.id) {
        return {
          ...req,
          admin_counter_rate: counterRateVal,
          counter_note: noteText,
          counter_broadcast_at: new Date().toISOString()
        };
      }
      return req;
    });

    // 2. Update all submissions for this rate request
    const updatedSubmissions = (db.rate_submissions || []).map((s) => {
      if (s.rate_request_id === rateRequest.id) {
        if (broadcastToAll || (activeCounterSub && s.id === activeCounterSub.id)) {
          if (!s.is_frozen && s.status !== 'Awarded') {
            return {
              ...s,
              counter_rate_per_unit: counterRateVal,
              counter_note: noteText,
              status: 'Negotiating',
              counter_sent_at: new Date().toISOString()
            };
          }
        }
      }
      return s;
    });

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: updatedRateRequests,
        rate_submissions: updatedSubmissions
      },
      `PROPOSE_COUNTER_RATE (₹${counterRateVal}/MT broadcasted to ${broadcastToAll ? 'ALL TRANSPORTERS' : 'transporter'} for ${rateRequest.request_no})`,
      currentUser?.username || 'admin',
      currentUser?.role || 'admin',
      'COUNTER_BROADCAST_SENT 📢'
    );

    updateDB(updatedDb);
    setNotice(`📢 Counter Offer ₹${counterRateVal}/MT BROADCASTED to ALL TRANSPORTERS for ${rateRequest.request_no}!`);
    setActiveCounterSub(null);
    setCounterForm({ counter_rate: '', note: '' });

    setTimeout(() => setNotice(''), 5000);
  };

  // Admin Freezes Rate (Locks the rate)
  const handleFreezeRate = (sub) => {
    // 🛑 Cannot freeze if counter offer is pending transporter acceptance
    if (sub.status === 'Negotiating' && sub.counter_rate_per_unit && !sub.is_frozen) {
      alert(`🛑 COUNTER OFFER PENDING: Transporter must first accept your counter-offer rate of ₹${sub.counter_rate_per_unit}/MT from their portal before rate can be frozen.`);
      return;
    }

    const finalRate = sub.counter_rate_per_unit || sub.rate_per_unit;

    const updatedSubmissions = db.rate_submissions.map((s) => {
      if (s.id === sub.id) {
        return {
          ...s,
          rate_per_unit: finalRate,
          is_frozen: true,
          status: 'Rate Frozen',
          frozen_at: new Date().toISOString()
        };
      }
      return s;
    });

    const targetTransporter = db.transporters.find((t) => t.id === sub.transporter_id);

    const updatedDb = addSecurityLog(
      { ...db, rate_submissions: updatedSubmissions },
      `FREEZE_AGREED_RATE (₹${finalRate}/MT - ${targetTransporter?.company_name || 'Transporter'})`,
      currentUser?.username || 'admin',
      currentUser?.role || 'admin',
      'LOCKED_FROZEN ❄️'
    );

    updateDB(updatedDb);
    setNotice(`Rate Frozen ❄️ at ₹${finalRate}/MT! Ready for Contract Award.`);
    setTimeout(() => setNotice(''), 3000);
  };

  // Admin Awards Contract
  const handleAwardContract = (sub) => {
    // 🛑 STRICT RULE: Cannot award contract if counter-offer is pending acceptance by Transporter
    if (sub.status === 'Negotiating' && sub.counter_rate_per_unit && !sub.is_frozen) {
      alert(`🛑 COUNTER ACCEPTANCE REQUIRED: You have proposed a counter rate of ₹${sub.counter_rate_per_unit}/MT. Contract CANNOT be awarded until the Transporter accepts this counter offer from their login portal.`);
      return;
    }

    const finalRate = sub.counter_rate_per_unit || sub.rate_per_unit;
    const allocId = `alloc_${Date.now()}`;

    const newAllocation = {
      id: allocId,
      rate_request_id: rateRequest.id,
      transporter_id: sub.transporter_id,
      submission_id: sub.id,
      allocated_qty: rateRequest.required_qty,
      agreed_rate: finalRate,
      total_contract_value: finalRate * rateRequest.required_qty,
      allocated_at: new Date().toISOString(),
      status: 'In Progress'
    };

    // Auto-create contract record
    const contractId = `contract_${Date.now()}`;
    const newContract = {
      id: contractId,
      allocation_id: allocId,
      contract_number: `CNT-SNPL-2026-${(rateRequest?.dest_city || "").substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      erp_po_number: `SAP-SNPL-PO-${Math.floor(10000 + Math.random() * 90000)}`,
      transporter_id: sub.transporter_id,
      payment_status: 'Advance Pending',
      advance_amount: Math.round(finalRate * rateRequest.required_qty * 0.3),
      loading_amount: Math.round(finalRate * rateRequest.required_qty * 0.4),
      settlement_amount: Math.round(finalRate * rateRequest.required_qty * 0.3),
      created_at: new Date().toISOString()
    };

    // Update rate request status to 'Awarded' and submissions
    const updatedRateRequests = db.rate_requests.map((r) =>
      r.id === rateRequest.id ? { ...r, status: 'Awarded' } : r
    );

    const updatedSubmissions = db.rate_submissions.map((s) => {
      if (s.rate_request_id === rateRequest.id) {
        return {
          ...s,
          status: s.id === sub.id ? 'Selected' : 'Closed'
        };
      }
      return s;
    });

    const targetTransporter = db.transporters.find((t) => t.id === sub.transporter_id);

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: updatedRateRequests,
        rate_submissions: updatedSubmissions,
        allocations: [...db.allocations, newAllocation],
        contracts: [...db.contracts, newContract]
      },
      `AWARD_CONTRACT_SAP_SYNC (${newContract.contract_number} to ${targetTransporter?.company_name} - ₹${newAllocation.total_contract_value.toLocaleString()})`,
      currentUser?.username || 'admin',
      currentUser?.role || 'admin',
      'CONTRACT_AWARDED 🏆'
    );

    updateDB(updatedDb);
  };

  return (
    <div>
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span className="badge badge-open">{rateRequest.request_no}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Created: {new Date(rateRequest.created_at).toLocaleDateString()}</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>{rateRequest.title}</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', marginTop: '4px' }}>
              📍 <strong>{rateRequest.origin_city}</strong> (PIN: {rateRequest.origin_pin}) ➔ 📍 <strong>{rateRequest.dest_city}</strong> (PIN: {rateRequest.dest_pin})
            </p>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowParticularReportModal(true)}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: '800',
                padding: '8px 14px',
                fontSize: '0.82rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
              }}
            >
              <Printer size={15} /> 📄 Particular Bid Audit Report
            </button>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Requirement</div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#0284c7' }}>
                {(Number(rateRequest?.required_qty) || 0).toLocaleString()} {rateRequest?.unit || 'MT'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Cargo: {rateRequest?.material_type}</div>
            </div>
          </div>
        </div>

        {/* 📡 GLOBAL COUNTER OFFER BROADCAST BAR FOR ALL TRANSPORTERS (HIDDEN WHEN BID IS AWARDED / FINALIZED) */}
        {rateRequest?.status !== 'Awarded' ? (
          <div className="glass-panel-glow" style={{
            marginTop: '16px',
            padding: '16px 20px',
            border: '1.5px solid #f59e0b',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
              <div style={{ background: '#f59e0b', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={22} color="#ffffff" />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📡 BROADCAST COUNTER OFFER TO ALL TRANSPORTERS
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {rateRequest?.admin_counter_rate ? (
                    <>Active Counter Offer: <strong style={{ color: '#d97706', fontSize: '0.88rem' }}>₹{rateRequest.admin_counter_rate}/MT</strong> (Broadcasted to all bidders)</>
                  ) : (
                    'Set a target counter rate here to broadcast to ALL transporters for this requirement 📢'
                  )}
                </div>
              </div>
            </div>

            <form
              onSubmit={(e) => handleSendCounterOffer(e, true)}
              style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, maxWidth: '520px' }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#fbbf24', fontWeight: '800' }}>₹</span>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 2650"
                  className="form-control"
                  value={counterForm.counter_rate}
                  onChange={(e) => setCounterForm({ ...counterForm, counter_rate: e.target.value })}
                  style={{ paddingLeft: '28px', fontSize: '0.92rem', height: '42px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid #f59e0b', color: '#fbbf24', fontWeight: '800', borderRadius: '8px' }}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  color: '#ffffff',
                  boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: '900',
                  height: '42px',
                  borderRadius: '8px',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                <Send size={15} /> 📡 Broadcast Counter Offer To All
              </button>
            </form>
          </div>
        ) : (
          <div style={{
            marginTop: '16px',
            padding: '12px 18px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1.5px solid #10b981',
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#059669',
            fontWeight: '800',
            fontSize: '0.88rem'
          }}>
            <CheckCircle2 size={20} color="#10b981" />
            <span>✓ Freight Requirement Awarded & Finalized. Bidding & Counter-Offer Broadcasts are Closed.</span>
          </div>
        )}

        {/* Savings Metric Header Card */}
        {submissions.length > 1 && (
          <div style={{
            marginTop: '16px',
            padding: '12px 18px',
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Sparkles size={20} color="#34d399" />
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff' }}>Rate Negotiation & Comparison Engine</span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                  Total {submissions.length} Transporters submitted quotes. Lowest quote: <strong>₹{lowestRate}/MT</strong>.
                </p>
              </div>
            </div>

            {potentialSavings > 0 && (
              <div style={{ background: 'rgba(16, 185, 129, 0.25)', padding: '6px 14px', borderRadius: '20px', border: '1px solid #10b981' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#34d399' }}>
                  💵 Potential Savings: ₹{(Number(potentialSavings) || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {notice && (
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
          <CheckCircle2 size={20} /> {notice}
        </div>
      )}

      {/* Awarded State Card if already selected */}
      {existingAllocation && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid #10b981',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: '700', fontSize: '1.1rem', marginBottom: '6px' }}>
              <CheckCircle2 size={22} />
              Contract Awarded to {allocatedTransporter?.company_name}
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)' }}>
              Awarded Quantity: <strong>{(Number(existingAllocation?.allocated_qty) || 0).toLocaleString()} MT</strong> @ Agreed Rate <strong>₹{existingAllocation.agreed_rate}/MT</strong> (Total Value: ₹{(Number(existingAllocation?.total_contract_value) || 0).toLocaleString()})
            </p>
          </div>
          <span className="badge badge-awarded" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            ALLOCATED & ACTIVE
          </span>
        </div>
      )}

      {/* Rate Comparison Matrix Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingDown size={18} color="#38bdf8" /> Transporter Quotes & Counter-Offer Matrix
        </h3>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Transporter</th>
                <th>Quote Rate / MT</th>
                <th>Admin Counter-Offer</th>
                <th>Total Value ({rateRequest?.required_qty} MT)</th>
                <th>Status & L1 Flag</th>
                <th>Remarks / Negotiation Note</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const transporter = (db.transporters || []).find(
                  (t) =>
                    String(t.id) === String(sub.transporter_id) ||
                    String(t.code) === String(sub.transporter_id) ||
                    String(t.username) === String(sub.transporter_id) ||
                    (t.company_name && sub.transporter_id && String(t.company_name).toLowerCase().includes(String(sub.transporter_id).toLowerCase()))
                );
                const isL1 = sub.rate_per_unit === lowestRate;
                const isSelected = sub.status === 'Selected';
                const isNegotiating = sub.status === 'Negotiating' && sub.counter_rate_per_unit && !sub.is_frozen;
                const isFrozen = sub.is_frozen || sub.status === 'Rate Frozen';

                return (
                  <tr
                    key={sub.id}
                    style={{
                      background: isFrozen ? 'rgba(56, 189, 248, 0.1)' : isL1 ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                      borderLeft: isFrozen ? '4px solid #38bdf8' : isL1 ? '4px solid #10b981' : 'none'
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                        {transporter?.company_name || 'Transporter'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Contact: {transporter?.contact_person} ({transporter?.mobile})
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '1.15rem', fontWeight: '800', color: isL1 ? '#34d399' : 'var(--text-main)' }}>
                        ₹{(Number(sub?.rate_per_unit) || 0).toLocaleString()}
                        <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-muted)' }}> / MT</span>
                      </div>
                    </td>

                    <td>
                      {sub.counter_rate_per_unit ? (
                        <div style={{ background: isFrozen ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)', padding: '4px 8px', borderRadius: '6px', border: isFrozen ? '1px solid #38bdf8' : '1px solid #f59e0b', display: 'inline-block' }}>
                          <span style={{ fontSize: '0.72rem', color: isFrozen ? '#38bdf8' : '#fbbf24', fontWeight: '700', display: 'block' }}>
                            {isFrozen ? '❄️ ACCEPTED TARGET' : '💬 ADMIN COUNTER'}
                          </span>
                          <strong style={{ color: '#ffffff', fontSize: '1rem' }}>₹{sub.counter_rate_per_unit}/MT</strong>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None Sent</span>
                      )}
                    </td>

                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--text-sub)' }}>
                        ₹{((sub.counter_rate_per_unit || sub.rate_per_unit) * rateRequest.required_qty).toLocaleString()}
                      </div>
                    </td>

                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        {isFrozen ? (
                          <span className="badge badge-open" style={{ background: 'rgba(56, 189, 248, 0.25)', border: '1px solid #38bdf8', color: '#ffffff' }}>
                            ❄️ RATE ACCEPTED & FROZEN
                          </span>
                        ) : isNegotiating ? (
                          <span className="badge badge-warning" style={{ background: 'rgba(245, 158, 11, 0.25)', border: '1px solid #f59e0b', color: '#fbbf24' }}>
                            💬 Awaiting Transporter Acceptance
                          </span>
                        ) : isL1 ? (
                          <span className="l1-badge">
                            🔥 L1 LOWEST RATE
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Submitted</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '200px' }}>
                        {sub.counter_note ? (
                          <span style={{ color: '#fbbf24' }}>💬 Admin: {sub.counter_note}</span>
                        ) : (
                          sub.notes || 'No remarks'
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      {isSelected ? (
                        <span className="badge badge-awarded" style={{ padding: '6px 12px' }}>
                          ✓ Selected
                        </span>
                      ) : existingAllocation ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Contract Closed</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          
                          {/* Send Counter Rate Button */}
                          <button
                            onClick={() => {
                              setActiveCounterSub(sub);
                              setCounterForm({ counter_rate: sub.counter_rate_per_unit || Math.round(sub.rate_per_unit * 0.92), note: '' });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                            title="Send target rate to transporter"
                          >
                            <MessageSquare size={14} color="#f59e0b" /> Counter Rate
                          </button>

                          {/* Freeze / Award Contract Button Logic */}
                          {isNegotiating ? (
                            <button
                              disabled
                              className="btn btn-secondary"
                              style={{ opacity: 0.65, cursor: 'not-allowed', padding: '6px 10px', fontSize: '0.78rem', border: '1px solid #f59e0b', color: '#fbbf24' }}
                              title="Contract cannot be awarded until Transporter accepts counter offer"
                            >
                              <Lock size={13} color="#f59e0b" /> Awaiting Acceptance
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAwardContract(sub)}
                              className={isFrozen ? 'btn btn-success' : isL1 ? 'btn btn-success' : 'btn btn-primary'}
                              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                            >
                              <Award size={14} /> Award Contract
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {submissions.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No quotes submitted yet by transporters for this requirement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Counter-Offer Form Modal */}
      {activeCounterSub && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>Send Counter Rate to Transporter</h3>
              </div>
              <button onClick={() => setActiveCounterSub(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '16px' }}>
              Transporter original quote: <strong>₹{activeCounterSub.rate_per_unit}/MT</strong>. Enter your revised target rate to negotiate. Contract can only be awarded after Transporter accepts.
            </p>

            <form onSubmit={handleSendCounterOffer}>
              <div className="form-group">
                <label className="form-label">Admin Target Counter Rate (₹ / MT)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 460"
                  value={counterForm.counter_rate}
                  onChange={(e) => setCounterForm({ ...counterForm, counter_rate: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Negotiation Message / Note for Transporter</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="e.g. Target budget is ₹460/MT for bulk delivery. Please confirm if acceptable."
                  value={counterForm.note}
                  onChange={(e) => setCounterForm({ ...counterForm, note: e.target.value })}
                ></textarea>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setActiveCounterSub(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Send size={15} /> Send Counter Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Particular Bid Audit Report Modal */}
      {showParticularReportModal && (
        <ParticularBidReportModal
          rateRequest={rateRequest}
          isOpen={showParticularReportModal}
          onClose={() => setShowParticularReportModal(false)}
        />
      )}

    </div>
  );
};
