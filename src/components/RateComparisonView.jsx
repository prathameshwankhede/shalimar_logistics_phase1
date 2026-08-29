// src/components/RateComparisonView.jsx
// Rate Comparison Dashboard with Counter-Offer Acceptance Locking 🛡️ (Contracts CANNOT be awarded until Transporter accepts Admin Counter-Offer)

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, TrendingDown, Clock, Sparkles, MessageSquare, Snowflake, Send, X, AlertCircle, Lock, FileText, Printer } from 'lucide-react';
import { ParticularBidReportModal } from './ParticularBidReportModal';
import { NegotiationHistoryModal } from './NegotiationHistoryModal';
import { getRequirementRates, awardRequirementRate, sendAdminCounter, finalizeBid } from '../api/rateSubmissionApi';

export const RateComparisonView = ({ rateRequest, onBack }) => {
  const { db, updateDB, currentUser, addSecurityLog, refreshRequirements, refreshDB } = useAuth();

  const safeRefreshRequirements = async () => {
    try {
      if (typeof refreshRequirements === 'function') {
        await refreshRequirements();
      } else if (typeof refreshDB === 'function') {
        await refreshDB();
      }
    } catch (e) {
      console.error('Data refresh error:', e);
    }
  };

  const [showParticularReportModal, setShowParticularReportModal] = useState(false);
  const [selectedHistorySub, setSelectedHistorySub] = useState(null);
  const [liveRates, setLiveRates] = useState([]);
  const [loadingRates, setLoadingRates] = useState(true);
  
  // Negotiation state
  const [activeCounterSub, setActiveCounterSub] = useState(null);
  const [counterForm, setCounterForm] = useState({
    counter_rate: '',
    note: ''
  });

  const [notice, setNotice] = useState('');

  const selectedItemId = rateRequest?.item_id || rateRequest?.sub_indent_id || rateRequest?.selectedItemId || rateRequest?.selectedItem?.id;
  const selectedSubNo = rateRequest?.sub_indent_no || rateRequest?.selectedItem?.sub_indent_no || rateRequest?.sub_code;

  useEffect(() => {
    let isMounted = true;
    const loadRates = async () => {
      if (!rateRequest?.id && !rateRequest?.req_no) return;
      try {
        setLoadingRates(true);
        const reqId = rateRequest.id || rateRequest.req_no;
        const itemId = selectedItemId || selectedSubNo;
        const res = await getRequirementRates(reqId, itemId);
        if (res && res.success && Array.isArray(res.rates) && isMounted) {
          setLiveRates(res.rates);
        }
      } catch (err) {
        console.warn('Live rates fetch notice:', err.message);
      } finally {
        if (isMounted) setLoadingRates(false);
      }
    };
    loadRates();
  }, [rateRequest?.id, rateRequest?.req_no, selectedItemId, selectedSubNo]);

  // Fetch all submissions for this rate request (MySQL Live + Local Fallback 🛡️)
  const rawSubmissions = liveRates.length > 0 ? liveRates : (db.rate_submissions || []);
  const submissions = rawSubmissions.filter((s) => {
    const matchesReq =
      String(s.rate_request_id) === String(rateRequest?.id) ||
      String(s.rate_request_id) === String(rateRequest?.request_no) ||
      String(s.rate_request_id) === String(rateRequest?.req_no) ||
      String(s.requirement_id) === String(rateRequest?.id) ||
      String(s.requirement_id) === String(rateRequest?.request_no) ||
      String(s.requirement_id) === String(rateRequest?.req_no);
    if (!matchesReq) return false;
    if (selectedItemId || selectedSubNo) {
      return (
        String(s.item_id) === String(selectedItemId) ||
        String(s.item_id) === String(selectedSubNo)
      );
    }
    return true;
  });

  // Calculate unique transporter count for current sub-indent
  const uniqueTransporters = new Set(submissions.map((s) => s.transporter_id).filter(Boolean));
  const uniqueTransportersCount = uniqueTransporters.size;

  // Identify lowest rate (L1)
  const validRates = submissions.map((s) => parseFloat(s.rate_per_mt || s.rate_per_unit || 0)).filter((r) => r > 0);
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

  // Admin Sends Counter Rate
  const handleSendCounterOffer = async (e, broadcastToAll = false) => {
    if (e) e.preventDefault();

    const counterRateVal = parseFloat(counterForm.counter_rate);
    if (!counterRateVal || counterRateVal <= 0) {
      alert('Please enter a valid counter rate per MT.');
      return;
    }

    const noteText = counterForm.note || `Admin counter offer: ₹${counterRateVal}/MT`;

    try {
      if (activeCounterSub) {
        await sendAdminCounter(activeCounterSub.id, { counter_rate: counterRateVal, message: noteText });
        setNotice(`📢 Counter Offer ₹${counterRateVal}/MT sent to ${activeCounterSub.transporter_name || activeCounterSub.transporter_id}!`);
      } else if (submissions.length > 0) {
        for (const sub of submissions) {
          if (sub.bid_status !== 'finalized') {
            await sendAdminCounter(sub.id, { counter_rate: counterRateVal, message: noteText }).catch(() => {});
          }
        }
        setNotice(`📢 Counter Offer ₹${counterRateVal}/MT broadcasted to bidders!`);
      }
      setActiveCounterSub(null);
      setCounterForm({ counter_rate: '', note: '' });
      setTimeout(() => setNotice(''), 5000);
      await safeRefreshRequirements();
    } catch (err) {
      alert(err.message || 'Failed to send counter offer.');
    }
  };

  const [finalizingId, setFinalizingId] = useState(null);

  // Admin Finalizes Agreed Rate 🏆
  const handleAdminFinalizeBid = async (sub) => {
    if (!sub || !sub.id) return;
    const agreedRate = sub.final_rate || sub.counter_offer_rate || sub.counter_rate || sub.rate_per_mt || sub.rate_per_unit;
    const transporterName = sub.transporter_name || sub.company_name || 'this transporter';

    if (!window.confirm(`Confirm Finalize Rate:\n\nTransporter: ${transporterName}\nAgreed Rate: ₹${agreedRate}/MT\n\nDo you want to finalize this rate now?`)) {
      return;
    }

    try {
      setFinalizingId(sub.id);
      await finalizeBid(sub.id, { final_rate: agreedRate });
      setNotice(`🏆 Bid finalized successfully at ₹${agreedRate}/MT for ${transporterName}!`);
      setTimeout(() => setNotice(''), 5000);
      if (typeof refreshRequirements === 'function') {
        await refreshRequirements();
      }
      if (typeof updateDB === 'function') {
        await updateDB();
      }
    } catch (err) {
      console.error('Finalize bid error:', err);
      alert(err.message || 'Failed to finalize bid.');
    } finally {
      setFinalizingId(null);
    }
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
                  Total {uniqueTransportersCount} Transporter(s) submitted quote(s). Lowest quote: <strong>₹{lowestRate}/MT</strong>.
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
                      {sub.counter_rate_per_unit || sub.counter_rate ? (
                        <div style={{ background: isFrozen ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)', padding: '6px 10px', borderRadius: '6px', border: isFrozen ? '1px solid #38bdf8' : '1px solid #f59e0b', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '0.72rem', color: isFrozen ? '#38bdf8' : '#fbbf24', fontWeight: '700', display: 'block' }}>
                              {isFrozen ? '❄️ ACCEPTED TARGET' : '💬 ADMIN COUNTER'}
                            </span>
                            <strong style={{ color: '#ffffff', fontSize: '1rem' }}>₹{sub.counter_rate_per_unit || sub.counter_rate}/MT</strong>
                          </div>
                          {!isFrozen && !existingAllocation && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveCounterSub(sub);
                                setCounterForm({ counter_rate: sub.counter_rate || sub.counter_rate_per_unit || '', note: '' });
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.72rem', border: '1px solid #f59e0b', color: '#fbbf24', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ✏ Edit
                            </button>
                          )}
                        </div>
                      ) : existingAllocation ? (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None Sent</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCounterSub(sub);
                            setCounterForm({ counter_rate: sub.counter_rate || Math.round((sub.rate_per_unit || sub.rate_per_mt) * 0.92), note: '' });
                          }}
                          className="btn btn-primary"
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            fontWeight: '900',
                            borderRadius: '6px',
                            border: '1.5px solid #38bdf8',
                            color: '#ffffff',
                            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          title="Send target counter rate to transporter"
                        >
                          <MessageSquare size={14} /> Counter Rate
                        </button>
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
                  </tr>
                );
              })}

              {submissions.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
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
              Transporter original quote: <strong>₹{activeCounterSub.original_rate || activeCounterSub.rate_per_unit}/MT</strong>. Enter your revised target rate to negotiate.
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
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

      {/* Negotiation History Timeline Modal */}
      {selectedHistorySub && (
        <NegotiationHistoryModal
          submission={selectedHistorySub}
          isOpen={Boolean(selectedHistorySub)}
          onClose={() => setSelectedHistorySub(null)}
        />
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
