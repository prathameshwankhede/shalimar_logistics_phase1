// src/components/WhatsAppBroadcastModal.jsx
// Instant 1-Click WhatsApp Freight Indent Broadcast Notification Modal 📱⚡

import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, ExternalLink, Share2, Smartphone } from 'lucide-react';
import { generateWhatsAppLinks } from '../utils/whatsappEngine';

export const WhatsAppBroadcastModal = ({ isOpen, onClose, batchData, transporters = [] }) => {
  const [copied, setCopied] = useState(false);
  const [selectedTransporterPhone, setSelectedTransporterPhone] = useState('');

  if (!isOpen || !batchData) return null;

  const { batchCode, itemsCount, origin, dest, totalQty, materialType, targetDate, rawMessage } = batchData;

  const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const defaultMessage = rawMessage || `🚨 *SHALIMAR NUTRIENTS — NEW FREIGHT BID BROADCAST* 🚨\n\n📦 *Batch Ref*: ${batchCode} (${itemsCount || 1} Indent Items)\n📍 *Route*: ${origin} ➔ ${dest}\n⚖️ *Total Volume*: ${totalQty} MT (${materialType})\n📅 *Target Dispatch Date*: ${targetDate}\n\n👉 *Log in to TransFlow Logistics Portal to submit your competitive freight rates:* \n🔗 ${portalUrl}/\n\n*Shalimar Group Transport Procurement Desk*`;

  const groupWebLink = `https://web.whatsapp.com/send?text=${encodeURIComponent(defaultMessage)}`;
  const groupAppLink = `whatsapp://send?text=${encodeURIComponent(defaultMessage)}`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(defaultMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDirectSendToTransporter = () => {
    if (!selectedTransporterPhone) {
      alert('Please select a registered transporter from the list first.');
      return;
    }
    const links = generateWhatsAppLinks(selectedTransporterPhone, defaultMessage);
    window.open(links.wa_web, '_blank');
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{ background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: '20px' }}
    >
      <div 
        className="glass-panel" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          maxWidth: '580px', 
          width: '100%', 
          maxHeight: '92vh',
          overflowY: 'auto',
          borderRadius: '24px', 
          padding: '24px 28px',
          border: '2px solid #22c55e',
          boxShadow: '0 25px 60px rgba(34, 197, 94, 0.4)',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(20,83,45,0.98) 100%)'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1.5px solid rgba(34, 197, 94, 0.3)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#22c55e', padding: '10px', borderRadius: '12px', boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)' }}>
              <MessageSquare size={24} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ffffff', margin: 0, letterSpacing: '-0.01em' }}>
                📱 Instant WhatsApp Freight Broadcast
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#86efac', margin: '2px 0 0 0', fontWeight: '700' }}>
                Batch Ref: <strong style={{ color: '#ffffff', fontFamily: 'monospace' }}>{batchCode}</strong> ({transporters.length} Transporters Registered)
              </p>
            </div>
          </div>

          <button 
            type="button" 
            onClick={onClose} 
            title="Close Broadcast Modal"
            style={{ 
              background: '#ef4444', 
              border: 'none', 
              color: '#ffffff', 
              borderRadius: '10px', 
              padding: '6px 14px', 
              fontSize: '0.82rem',
              fontWeight: '900',
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            <X size={18} /> Close
          </button>
        </div>

        {/* Live Message Preview Box */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: '800', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              💬 Live Formatted WhatsApp Notification Template
            </label>
            <button
              type="button"
              onClick={handleCopyMessage}
              style={{ background: copied ? '#16a34a' : 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', color: '#ffffff', padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied to Clipboard!' : 'Copy Text'}
            </button>
          </div>

          <div style={{
            background: '#022c22',
            border: '1.5px solid #22c55e',
            borderRadius: '14px',
            padding: '18px 20px',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: '600',
            whiteSpace: 'pre-wrap',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            lineHeight: '1.7',
            letterSpacing: '0.02em',
            boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
            textShadow: '0 1px 2px rgba(0,0,0,0.6)'
          }}>
            {defaultMessage}
          </div>
        </div>

        {/* Direct Send to Specific Registered Transporter */}
        {transporters.length > 0 && (
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '14px', padding: '14px 16px', marginBottom: '22px' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: '800', color: '#cbd5e1', marginBottom: '8px', display: 'block' }}>
              📲 Send Direct WhatsApp Message to Specific Transporter:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                className="form-control"
                value={selectedTransporterPhone}
                onChange={(e) => setSelectedTransporterPhone(e.target.value)}
                style={{ flex: 1, fontSize: '0.85rem', height: '42px', background: '#0f172a', color: '#ffffff', border: '1px solid #22c55e', borderRadius: '8px', fontWeight: '700' }}
              >
                <option value="">-- Choose Registered Vendor --</option>
                {transporters.map((t) => (
                  <option key={t.id || t.code} value={t.mobile}>
                    🚚 {t.company_name} ({t.code || 'Vendor'}) — 📞 {t.mobile || 'No Mobile'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleDirectSendToTransporter}
                style={{ background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', color: '#ffffff', border: 'none', padding: '0 16px', borderRadius: '8px', fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)' }}
              >
                <Send size={16} /> Send Direct
              </button>
            </div>
          </div>
        )}

        {/* 1-Click Broadcast Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <a
            href={groupWebLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              background: 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '0.88rem',
              fontWeight: '900',
              textDecoration: 'none',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 6px 20px rgba(34, 197, 94, 0.4)'
            }}
          >
            <Share2 size={18} /> Broadcast on WhatsApp Web
          </a>

          <a
            href={groupAppLink}
            className="btn"
            style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              border: '1.5px solid #22c55e',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '0.88rem',
              fontWeight: '900',
              textDecoration: 'none',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Smartphone size={18} /> Open WhatsApp App
          </a>
        </div>

        {/* 🚨 LARGE PROMINENT BOTTOM CLOSE BUTTON 🚨 */}
        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.18)',
              color: '#fca5a5',
              border: '1.5px solid #ef4444',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '0.9rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            <X size={18} /> ✕ Close Broadcast Window (Done)
          </button>
        </div>

      </div>
    </div>
  );
};
