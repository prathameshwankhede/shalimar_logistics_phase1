// src/components/NegotiationHistoryModal.jsx
import React, { useState, useEffect } from 'react';
import { getSubmissionHistory } from '../api/rateSubmissionApi';
import { Clock, History, X } from 'lucide-react';

export const NegotiationHistoryModal = ({ submission, isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !submission?.id) return;
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await getSubmissionHistory(submission.id);
        if (res && res.success && Array.isArray(res.history) && isMounted) {
          setHistory(res.history);
        }
      } catch (err) {
        console.warn('Failed to fetch negotiation history:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchHistory();
  }, [isOpen, submission?.id]);

  if (!isOpen || !submission) return null;

  const displayTransporter = submission.transporter_name || submission.company_name || submission.transporter_id || 'Transporter';
  const displayCode = submission.request_no || submission.item_id || submission.requirement_id || 'Sub-indent';

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="modal-content" style={{
        background: '#0f172a',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '560px',
        width: '100%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: '#f8fafc' }}>
              Negotiation History Timeline
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ fontSize: '0.84rem', color: '#94a3b8', marginBottom: '16px', background: '#1e293b', padding: '8px 12px', borderRadius: '8px' }}>
          Transporter: <strong style={{ color: '#f8fafc' }}>{displayTransporter}</strong> | Requirement: <strong style={{ color: '#38bdf8' }}>{displayCode}</strong>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
            ⏳ Loading negotiation timeline...
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
            No negotiation history recorded yet for this bid.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {history.map((step, idx) => {
              const isAccepted = step.action_type === 'COUNTER_ACCEPTED' || step.action_type === 'BID_FINALIZED';
              const isRejected = step.action_type === 'COUNTER_REJECTED';
              const isTransCounter = step.action_type === 'TRANSPORTER_COUNTER' || step.action_type === 'TRANSPORTER_RESPONSE';
              const isAdminCounter = step.action_type === 'ADMIN_COUNTER';
              const isInitial = step.action_type === 'INITIAL_BID';

              const badgeColor = isAccepted ? '#10b981' : isRejected ? '#ef4444' : isTransCounter ? '#0284c7' : isAdminCounter ? '#f59e0b' : '#10b981';
              const badgeLabel = isAccepted ? '🏆 FINALIZED' : isRejected ? '❌ REJECTED' : isTransCounter ? '🔵 TRANSPORTER' : isAdminCounter ? '🟠 ADMIN' : '🟢 TRANSPORTER';

              return (
                <div key={step.id || idx} style={{
                  background: isAccepted
                    ? 'rgba(16, 185, 129, 0.12)'
                    : isRejected
                    ? 'rgba(239, 68, 68, 0.12)'
                    : isTransCounter
                    ? 'rgba(56, 189, 248, 0.12)'
                    : 'rgba(245, 158, 11, 0.12)',
                  border: `1px solid ${badgeColor}`,
                  borderRadius: '10px',
                  padding: '12px 14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: '900',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: badgeColor,
                      color: '#ffffff'
                    }}>
                      {badgeLabel}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {new Date(step.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#f8fafc', margin: '4px 0' }}>
                    {isInitial && `🟢 Transporter submitted original bid — ₹${step.new_rate}/MT`}
                    {isAdminCounter && `🟠 Admin counter offered — ₹${step.new_rate}/MT`}
                    {isTransCounter && `🔵 Transporter counter offered — ₹${step.new_rate}/MT`}
                    {step.action_type === 'COUNTER_ACCEPTED' && `🟢 Counter offer accepted @ ₹${step.new_rate}/MT`}
                    {step.action_type === 'COUNTER_REJECTED' && `❌ Counter offer rejected`}
                    {step.action_type === 'BID_FINALIZED' && `🟢 Admin accepted & finalized @ ₹${step.new_rate}/MT`}
                  </div>

                  {step.message && (
                    <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '2px' }}>
                      "{step.message}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button onClick={onClose} className="btn" style={{ background: '#334155', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
