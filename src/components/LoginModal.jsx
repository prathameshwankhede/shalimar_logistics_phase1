// src/components/LoginModal.jsx
// Enterprise 256-Bit Encrypted Authentication Portal 🛡️⚡

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeInput, checkBruteForceLock, recordLoginAttempt } from '../utils/securityEngine';
import { ArrowRight, ShieldAlert, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const LoginModal = () => {
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    const cleanUsername = sanitizeInput(username.trim());
    if (!cleanUsername || !password) {
      setError('Please enter both your Username/Vendor Code and Password.');
      return;
    }

    const lockStatus = checkBruteForceLock(cleanUsername);
    if (lockStatus.locked) {
      setError(`🛑 ACCOUNT LOCKOUT: Too many failed attempts. Try again in ${lockStatus.remainingSec}s.`);
      return;
    }

    const res = login(cleanUsername, password);
    if (!res.success) {
      recordLoginAttempt(cleanUsername, false);
      setError(`${res.error} (Security Audit Event Logged 🛡️)`);
    } else {
      recordLoginAttempt(cleanUsername, true);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div 
        className="glass-panel" 
        style={{ 
          maxWidth: '440px', 
          width: '100%', 
          padding: '40px 36px', 
          borderRadius: '24px',
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
        }}
      >
        
        {/* Shalimar Corporate Logo Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src={SHALIMAR_LOGO_BASE64}
            alt="Shalimar Group Logo"
            style={{ height: '80px', width: 'auto', borderRadius: '12px', marginBottom: '14px', objectFit: 'contain' }}
          />

          <h2 style={{ fontSize: '1.45rem', fontWeight: '900', color: '#ffffff', margin: '4px 0', letterSpacing: '-0.02em' }}>
            Shalimar Nutrients Pvt Ltd
          </h2>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, fontWeight: '600' }}>
            Enterprise Transport Procurement Portal
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'monospace', fontWeight: '800', background: 'rgba(56, 189, 248, 0.12)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              GSTIN: 27AAPCS1419M1ZV
            </span>
            <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: '700', background: 'rgba(16, 185, 129, 0.12)', padding: '3px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} /> 256-Bit SSL Encrypted
            </span>
          </div>
        </div>

        {/* Security Alert Banner */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '20px',
            color: '#fca5a5',
            fontSize: '0.84rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, fontWeight: '600', lineHeight: '1.4' }}>{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Username / Code Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#cbd5e1', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Username / Vendor Code
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                <User size={18} />
              </div>
              <input
                type="text"
                className="form-control"
                placeholder="Enter Username or Vendor Code"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
                style={{
                  paddingLeft: '44px',
                  height: '46px',
                  fontSize: '0.9rem',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1.5px solid rgba(56, 189, 248, 0.3)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  fontWeight: '700'
                }}
              />
            </div>
          </div>

          {/* Password Field with Eye Toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#cbd5e1', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                style={{
                  paddingLeft: '44px',
                  paddingRight: '44px',
                  height: '46px',
                  fontSize: '0.9rem',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1.5px solid rgba(56, 189, 248, 0.3)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  fontWeight: '700'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Device Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="rememberDevice"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
            />
            <label htmlFor="rememberDevice" style={{ fontSize: '0.82rem', color: '#94a3b8', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <ShieldCheck size={14} color="#34d399" /> Keep session active on this trusted device
            </label>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="btn" 
            style={{ 
              width: '100%', 
              height: '48px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '800',
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 8px 25px rgba(2, 132, 199, 0.4)',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            Sign In to Enterprise Portal <ArrowRight size={18} />
          </button>
        </form>

        {/* Corporate Security Footer */}
        <div style={{ marginTop: '28px', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: '600', lineHeight: '1.5' }}>
            🛡️ Authorized Corporate Access Only. All authentication attempts are logged, encrypted, and monitored for security.
          </div>
        </div>

      </div>
    </div>
  );
};
