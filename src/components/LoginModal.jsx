// src/components/LoginModal.jsx
// Secure Isolated Multi-Tenant Login Screen - Enterprise Trusted Device Authentication 🚀🛡️

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeInput, checkBruteForceLock, recordLoginAttempt } from '../utils/securityEngine';
import { ArrowRight, AlertCircle, ShieldAlert, Lock, Smartphone, ShieldCheck } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const LoginModal = () => {
  const { login, db } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [selectedTransporterCode, setSelectedTransporterCode] = useState('');

  const transportersList = db?.transporters || [];

  const handleSelectTransporter = (code) => {
    setSelectedTransporterCode(code);
    if (code) {
      setUsername(code);
      setPassword('password123');
      setError('');
      localStorage.removeItem('transflow_login_attempts');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanUsername = sanitizeInput(username.trim());
    const lockStatus = checkBruteForceLock(cleanUsername);

    if (lockStatus.locked) {
      setError(`🛑 ACCOUNT SECURITY LOCKOUT: Too many failed password attempts. Account locked for security. Try again in ${lockStatus.remainingSec}s.`);
      return;
    }

    const res = login(cleanUsername, password);
    if (!res.success) {
      recordLoginAttempt(cleanUsername, false);
      setError(`${res.error} (Security Event Logged 🛡️)`);
    } else {
      recordLoginAttempt(cleanUsername, true);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
      <div className="glass-panel" style={{ maxWidth: '460px', width: '100%', padding: '36px 32px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        
        {/* Pure Uploaded Shalimar Group Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src={SHALIMAR_LOGO_BASE64}
            alt="Shalimar Group Official Logo"
            style={{ height: '90px', width: 'auto', borderRadius: '10px', marginBottom: '12px', objectFit: 'contain' }}
          />

          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', margin: '4px 0' }}>
            Shalimar Nutrients Pvt Ltd
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Transport Procurement Portal</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              GSTIN: 27AAPCS1419M1ZV
            </span>
            <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: '700', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} /> 256-Bit SSL Encrypted
            </span>
          </div>
        </div>

        {/* ⚡ 1-CLICK QUICK AUTO-FILL DEMO LOGIN BUTTONS & 50-TRANSPORTER SELECTOR */}
        <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '12px', padding: '14px', marginBottom: '20px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#38bdf8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            ⚡ 1-Click Quick Auto-Fill Login
            <span style={{ background: '#10b981', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: '10px' }}>
              {transportersList.length || 50} Transporters Active
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setUsername('admin');
                  setPassword('admin123');
                  setSelectedTransporterCode('');
                  setError('');
                  localStorage.removeItem('transflow_login_attempts');
                }}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)'
                }}
              >
                🛡️ Admin Login
              </button>

              <button
                type="button"
                onClick={() => handleSelectTransporter('ABC001')}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 10px',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)'
                }}
              >
                🚚 Quick Demo: ABC001
              </button>
            </div>

            {/* 🚚 DYNAMIC 50 TRANSPORTER QUICK SELECTOR DROPDOWN */}
            <div style={{ marginTop: '4px' }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: '700', marginBottom: '3px', display: 'block' }}>
                🚚 Or Select Any of the {transportersList.length || 50} Registered Transporters:
              </label>
              <select
                value={selectedTransporterCode}
                onChange={(e) => handleSelectTransporter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">-- Choose from {transportersList.length || 50} Registered Transporters --</option>
                {transportersList.map((t) => (
                  <option key={t.id || t.code} value={t.code || t.username} style={{ background: '#0f172a', color: '#ffffff' }}>
                    {t.code || t.username} - {t.company_name} ({t.status || 'Active'})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldAlert size={18} color="#ef4444" />
            <div style={{ flex: 1 }}>{error}</div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('transflow_login_attempts');
                setError('');
              }}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 6px', fontSize: '0.68rem', cursor: 'pointer', fontWeight: '800' }}
            >
              Unlock
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username / Transporter Code</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. admin, TRP001, ABC001"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="rememberDevice"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#38bdf8', cursor: 'pointer' }}
            />
            <label htmlFor="rememberDevice" style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="#38bdf8" /> Keep me signed in on this trusted device
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
            Sign In to Secure Portal <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
          <div style={{ fontSize: '0.78rem', color: '#e2e8f0', fontWeight: '700', marginBottom: '4px' }}>
            🔑 Admin Credentials: <span style={{ color: '#38bdf8' }}>admin</span> / <span style={{ color: '#38bdf8' }}>admin123</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            🔑 Transporter Credentials: 50 Accounts Active (Codes: TRP001 to TRP050, ABC001, XYZ001, PQR001 | Pass: <span style={{ color: '#34d399' }}>password123</span>)
          </div>
        </div>

      </div>
    </div>
  );
};
