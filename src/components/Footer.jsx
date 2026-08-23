// src/components/Footer.jsx
// Bottom Page Footer with React Portal Security & Audit Trail Center 🛡️⚓

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, X } from 'lucide-react';

export const Footer = () => {
  const { currentUser, db } = useAuth();
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const logs = db.security_audit_logs || [];

  const modalContent = (
    <div
      className="glass-panel"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'var(--bg-dark, #0f172a)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 99999999,
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 32px',
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}
    >
      {/* Top Full Screen Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', padding: '12px', borderRadius: '12px' }}>
            <ShieldCheck size={28} color="#059669" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '900', color: 'var(--text-main)', margin: 0 }}>
              Shalimar Enterprise Security & Audit Trail Center 🛡️
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Immutable ISO-27001 Security Audit Log tracking user sessions, logins, bids, rate freezes, and ERP PO allocations.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSecurityModalOpen(false)}
          className="btn btn-secondary"
          style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #dc2626', color: '#dc2626', fontWeight: '800' }}
        >
          <X size={18} /> Close Fullscreen Audit ✕
        </button>
      </div>

      {/* Full Width Table Container */}
      <div className="custom-table-container" style={{ flex: 1, overflowY: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '180px', color: '#0284c7' }}>Timestamp</th>
              <th style={{ width: '220px', color: '#0284c7' }}>User & Access Role</th>
              <th style={{ color: '#0284c7' }}>Action / Operation Executed</th>
              <th style={{ width: '220px', color: '#0284c7' }}>IP / Network Node</th>
              <th style={{ width: '180px', textAlign: 'right', color: '#0284c7' }}>Security Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontFamily: 'monospace' }}>
                  {log?.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                </td>
                <td>
                  <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.92rem' }}>{log.username}</div>
                  <span className="badge badge-open" style={{ fontSize: '0.7rem', padding: '2px 8px', marginTop: '2px', display: 'inline-block' }}>
                    {(log?.role || "").toUpperCase()}
                  </span>
                </td>
                <td style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.9rem' }}>
                  {log.action}
                </td>
                <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {log.ip}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="badge badge-awarded" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                    {log.status}
                  </span>
                </td>
              </tr>
            ))}

            {logs.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No audit logs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <footer
      className="glass-panel no-print"
      style={{
        marginTop: '40px',
        padding: '16px 24px',
        borderRadius: '16px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}
    >
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>
          © 2026 Shalimar Nutrients Pvt Ltd — Enterprise Transport Procurement & Dispatch Portal
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          Registered Office: MIDC Industrial Area, Nagpur, MH | GSTIN: <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>27AAPCS1419M1ZV</span>
        </div>
      </div>

      {/* ⚓ VERY BOTTOM CORNER SECURITY AUDIT LOGS BUTTON */}
      {isAdmin && (
        <button
          onClick={() => setIsSecurityModalOpen(true)}
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
          title="View System Security & Audit Trail Logs"
        >
          <ShieldCheck size={14} color="#34d399" /> Security & Audit Logs 🛡️
        </button>
      )}

      {/* RENDER MODAL OUTSIDE FOOTER VIA REACT PORTAL DIRECTLY ON DOCUMENT.BODY */}
      {isSecurityModalOpen && ReactDOM.createPortal(modalContent, document.body)}
    </footer>
  );
};
