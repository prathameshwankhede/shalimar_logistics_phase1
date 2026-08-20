// src/components/ERPPaymentModal.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { CreditCard, CheckCircle2, Clock, X, Server, ShieldCheck, DollarSign, ExternalLink } from 'lucide-react';

export const ERPPaymentModal = ({ contract, onClose }) => {
  const { db, updateDB } = useAuth();
  if (!contract) return null;

  const allocation = (db.allocations || []).find((a) => a.id === contract?.allocation_id);
  const rateRequest = allocation ? (db.rate_requests || []).find((r) => r.id === allocation.rate_request_id) : null;
  const transporter = (db.transporters || []).find((t) => t.id === contract?.transporter_id);

  const handleUpdatePaymentStatus = (newStatus) => {
    const updatedContracts = (db.contracts || []).map((c) =>
      c.id === contract?.id ? { ...c, payment_status: newStatus } : c
    );
    updateDB({ ...db, contracts: updatedContracts });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '680px', padding: '28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px' }}>
              <CreditCard size={20} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Contract Order & Payment Processing</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Contract PO #{contract.contract_number}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Contract Order Status Badge Card */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Server size={22} color="#38bdf8" />
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff' }}>Contract Order Status</span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)' }}>
                Order Ref: <strong>{contract.erp_po_number}</strong>
              </p>
            </div>
          </div>
          <span className="badge badge-open" style={{ padding: '6px 12px' }}>
            ✓ ORDER CONFIRMED
          </span>
        </div>

        {/* Total Value Overview */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Awarded Value ({allocation?.allocated_qty} MT @ ₹{allocation?.agreed_rate}/MT)</span>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff' }}>
              ₹{(Number(allocation?.total_contract_value) || 0).toLocaleString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Payment Stage</span>
            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#34d399' }}>
              {contract?.payment_status || 'Pending'}
            </div>
          </div>
        </div>

        {/* 3-Step Payment Milestones */}
        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '12px', color: 'var(--text-main)' }}>Payment Milestones Timeline</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          
          {/* Stage 1: 30% Advance */}
          <div style={{
            background: contract.payment_status !== 'Advance Pending' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
            border: contract.payment_status !== 'Advance Pending' ? '1px solid #10b981' : '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle2 size={20} color={contract.payment_status !== 'Advance Pending' ? '#34d399' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>30% Booking Advance Payment</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Released upon contract confirmation</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ffffff' }}>₹{(Number(contract?.advance_amount) || 0).toLocaleString()}</div>
              {contract.payment_status === 'Advance Pending' ? (
                <button onClick={() => handleUpdatePaymentStatus('Advance Paid')} className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: '4px' }}>
                  Release Advance
                </button>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>PAID ✓</span>
              )}
            </div>
          </div>

          {/* Stage 2: 40% Loading */}
          <div style={{
            background: contract.payment_status === 'In Transit' || contract.payment_status === 'Settled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
            border: contract.payment_status === 'In Transit' || contract.payment_status === 'Settled' ? '1px solid #10b981' : '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={20} color={contract.payment_status === 'In Transit' || contract.payment_status === 'Settled' ? '#34d399' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>40% Loading & Dispatch Payment</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Released upon truck dispatch confirmation</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ffffff' }}>₹{(Number(contract?.loading_amount) || 0).toLocaleString()}</div>
              {contract.payment_status === 'Advance Paid' ? (
                <button onClick={() => handleUpdatePaymentStatus('In Transit')} className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: '4px' }}>
                  Release Loading Pay
                </button>
              ) : contract.payment_status === 'Advance Pending' ? (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending Advance</span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>PAID ✓</span>
              )}
            </div>
          </div>

          {/* Stage 3: 30% Final Settlement */}
          <div style={{
            background: contract.payment_status === 'Settled' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
            border: contract.payment_status === 'Settled' ? '1px solid #10b981' : '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DollarSign size={20} color={contract.payment_status === 'Settled' ? '#34d399' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>30% Final POD Settlement</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Released on final delivery proof receipt</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ffffff' }}>₹{(Number(contract?.settlement_amount) || 0).toLocaleString()}</div>
              {contract.payment_status === 'In Transit' ? (
                <button onClick={() => handleUpdatePaymentStatus('Settled')} className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.75rem', marginTop: '4px' }}>
                  Settle Final Balance
                </button>
              ) : contract.payment_status === 'Settled' ? (
                <span style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: '600' }}>COMPLETED ✓</span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pending In Transit</span>
              )}
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-secondary">
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
