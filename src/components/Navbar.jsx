import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogOut, Lock, RefreshCw } from 'lucide-react';
import { SHALIMAR_LOGO_BASE64 } from '../assets/logoBase64';

export const Navbar = () => {
  const { currentUser, currentTransporter, logout, quickSwitchUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('transflow_theme', 'light');
  }, []);

  const handleForceCloudSync = () => {
    try {
      localStorage.removeItem('transflow_logistics_db_live_v3');
      window.location.reload();
    } catch (e) {
      window.location.reload();
    }
  };

  return (
    <nav className="glass-panel no-print" style={{ borderRadius: '0 0 16px 16px', marginBottom: '24px', padding: '12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Pure Uploaded Brand Logo & Official Company Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img
            src={SHALIMAR_LOGO_BASE64}
            alt="Shalimar Group Logo"
            style={{ height: '56px', width: 'auto', borderRadius: '8px', objectFit: 'contain' }}
          />

          <div style={{ borderLeft: '2px solid rgba(255, 255, 255, 0.15)', paddingLeft: '14px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-main)', margin: 0 }}>
              Shalimar Nutrients Pvt Ltd
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: '600' }}>
                Transport Procurement Portal
              </span>
              <span style={{ fontSize: '0.72rem', color: '#0284c7', fontFamily: 'monospace', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', padding: '1px 8px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                GSTIN: 27AAPCS1419M1ZV
              </span>
            </div>
          </div>
        </div>

        {/* Clean Portal Role Status Badge & 1-Click Tester Switcher */}
        {isAdmin ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '6px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#0284c7" />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: '800' }}>
                👑 Shalimar Admin Control Center
              </span>
            </div>
            <button
              type="button"
              onClick={() => quickSwitchUser('W001')}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '900', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#ffffff', boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)', cursor: 'pointer' }}
              title="Switch to Transporter Bidding Portal (wankhede chakki) to test quotes"
            >
              🚛 Switch to Transporter Bidding View (W001)
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '6px 14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={15} color="#10b981" />
              <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: '800' }}>
                🚛 Transporter Bidding Session ({currentTransporter?.code || 'W001'})
              </span>
            </div>
            <button
              type="button"
              onClick={() => quickSwitchUser('admin')}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '900', borderRadius: '8px', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', border: 'none', color: '#ffffff', boxShadow: '0 0 12px rgba(2, 132, 199, 0.4)', cursor: 'pointer' }}
              title="Switch back to Admin Control Center"
            >
              👑 Switch to Admin View
            </button>
          </div>
        )}

        {/* User Info & Sign Out */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-main)' }}>
              {currentUser?.name || 'User Account'}
            </div>
            <div style={{ fontSize: '0.72rem', color: isAdmin ? '#0284c7' : '#10b981', fontWeight: '700' }}>
              {isAdmin ? '👑 Logistics Head' : `🚛 ${currentTransporter?.company_name || 'Transporter'}`}
            </div>
          </div>

          <button
            onClick={handleForceCloudSync}
            className="btn btn-secondary"
            title="Force Hard Refresh & Sync with Cloud DB"
            style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', border: '1px solid #0284c7', background: 'rgba(2, 132, 199, 0.1)', borderRadius: '8px' }}
          >
            <RefreshCw size={14} /> 🔄 Live Sync
          </button>

          <button
            onClick={logout}
            className="btn btn-danger"
            title="Sign Out of Portal"
            style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

      </div>
    </nav>
  );
};
