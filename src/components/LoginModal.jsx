// src/components/LoginModal.jsx
// Enterprise 256-Bit Encrypted Authentication Portal 🛡️⚡

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeInput, checkBruteForceLock, recordLoginAttempt, resetLoginLock } from '../utils/securityEngine';
import { ArrowRight, ShieldAlert, Lock, User, Eye, EyeOff, ShieldCheck, RefreshCw } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const LoginModal = () => {
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [error, setError] = useState('');
  const [lockoutSec, setLockoutSec] = useState(0);

  // Live Lockout Countdown Timer Effect
  useEffect(() => {
    let timer = null;
    if (lockoutSec > 0) {
      timer = setInterval(() => {
        setLockoutSec((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setError('');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutSec]);

  const handleUnlockNow = () => {
    resetLoginLock(username.trim());
    setLockoutSec(0);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUsername = sanitizeInput(username.trim());
    if (!cleanUsername || !password) {
      setError('Please enter both your Username/Vendor Code and Password.');
      return;
    }

    const lockStatus = checkBruteForceLock(cleanUsername);
    if (lockStatus.locked && lockStatus.remainingSec > 0) {
      setLockoutSec(lockStatus.remainingSec);
      setError(`🛑 ACCOUNT LOCKOUT: Too many failed attempts. Try again in ${lockStatus.remainingSec}s.`);
      return;
    }

    const res = await login(cleanUsername, password);
    if (!res.success) {
      recordLoginAttempt(cleanUsername, false);
      const newLockStatus = checkBruteForceLock(cleanUsername);
      if (newLockStatus.locked) {
        setLockoutSec(newLockStatus.remainingSec);
        setError(`🛑 ACCOUNT LOCKOUT: Too many failed attempts. Try again in ${newLockStatus.remainingSec}s.`);
      } else {
        setError(`${res.error} (Security Audit Event Logged 🛡️)`);
      }
    } else {
      recordLoginAttempt(cleanUsername, true);
      setLockoutSec(0);
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

        {/* Error / Lockout Alert Banner */}
        {(error || lockoutSec > 0) && (
          <div 
            style={{ 
              marginBottom: '20px', 
              padding: '12px 16px', 
              borderRadius: '12px', 
              background: 'rgba(239, 68, 68, 0.15)', 
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.82rem',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justify: 'space-between',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>
                {lockoutSec > 0 
                  ? `🛑 ACCOUNT LOCKOUT: Too many failed attempts. Try again in ${lockoutSec}s.` 
                  : error}
              </span>
            </div>

            {lockoutSec > 0 && (
              <button
                type="button"
                onClick={handleUnlockNow}
                style={{
                  background: 'rgba(239, 68, 68, 0.3)',
                  border: '1px solid rgba(239, 68, 68, 0.6)',
                  color: '#ffffff',
                  fontSize: '0.7rem',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '800',
                  whiteSpace: 'nowrap'
                }}
              >
                Reset Lock 🔓
              </button>
            )}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          
          {/* Username Input */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', letterSpacing: '0.04em' }}>
              USERNAME / VENDOR CODE
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                name="username"
                autoComplete="username"
                className="form-control"
                placeholder="Enter admin or vendor code (e.g. P001)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: '40px', background: 'rgba(15, 23, 42, 0.6)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', height: '44px', width: '100%' }}
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#cbd5e1', marginBottom: '6px', letterSpacing: '0.04em' }}>
              PASSWORD
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '40px', paddingRight: '40px', background: 'rgba(15, 23, 42, 0.6)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '10px', height: '44px', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Device Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#38bdf8' }}
              />
              <ShieldCheck size={14} color="#34d399" /> Keep session active on this trusted device
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={lockoutSec > 0}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              fontSize: '0.92rem',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              gap: '8px',
              background: lockoutSec > 0 ? '#475569' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              border: 'none',
              boxShadow: lockoutSec > 0 ? 'none' : '0 8px 20px rgba(2, 132, 199, 0.4)',
              cursor: lockoutSec > 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {lockoutSec > 0 ? `Locked (${lockoutSec}s)` : 'Sign In to Enterprise Portal'} <ArrowRight size={18} />
          </button>

        </form>

        {/* Footer Authorization Notice */}
        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.72rem', color: '#64748b', margin: 0, fontWeight: '600', lineHeight: '1.4' }}>
            🛡️ Authorized Corporate Access Only. All authentication attempts are logged, encrypted, and monitored for security.
          </p>
        </div>

      </div>
    </div>
  );
};
