// src/components/TransporterDispatchesFolderDirectory.jsx
// 🚚 Live Transporter Dispatches Directory (Folder-Wise & Chronological Date/Time Tracker)

import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  Truck,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  X,
  FileText,
  ShieldCheck,
  MapPin,
  CheckCircle2,
  Phone,
  User,
  Hash
} from 'lucide-react';

export const getTransporterDisplayName = (folder) => {
  if (!folder) return 'Transporter';
  const name = folder.transporter_name || folder.company_name || folder.name || folder.contact_person;
  if (name && name !== 'Transporter' && !String(name).startsWith('trans_')) {
    return name;
  }
  if (folder.dispatches && folder.dispatches.length > 0) {
    for (const d of folder.dispatches) {
      if (d.transporter_name && !String(d.transporter_name).startsWith('trans_') && d.transporter_name !== 'Transporter') {
        return d.transporter_name;
      }
    }
  }
  const code = String(folder.transporter_code || folder.transporter_id || '').toUpperCase();
  if (code.includes('S001') || code.includes('SANJAY')) return 'sanjay';
  if (code.includes('M001') || code.includes('MALPANI')) return 'malpani';
  if (code.includes('R001') || code.includes('RAM')) return 'ram';
  return folder.transporter_code || folder.transporter_id || 'Transporter';
};

export const TransporterDispatchesFolderDirectory = ({
  allDispatches = [],
  transporterFolders = [],
  loading = false,
  onRefresh,
  dispatchAccessRequests = [],
  onApproveRequest,
  onRejectRequest,
  formatDispatchDateTime
}) => {
  const [viewMode, setViewMode] = useState('folders'); // 'folders' | 'table' | 'requests'
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [expandedFolders, setExpandedFolders] = useState({}); // { [transporterId]: boolean }
  const [searchQuery, setSearchQuery] = useState('');
  const [dispatchAccessFilter, setDispatchAccessFilter] = useState('pending');

  const toggleFolder = (id) => {
    setExpandedFolders(prev => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id]
    }));
  };

  // KPIs
  const totalTrucks = allDispatches.length;
  const totalWeight = allDispatches.reduce(
    (sum, d) => sum + (parseFloat(d.loaded_quantity_mt || d.dispatched_qty) || 0),
    0
  );
  const activeTransportersCount = transporterFolders.filter(f => f.dispatches.length > 0).length;
  const totalFreightValue = allDispatches.reduce((sum, d) => {
    const q = parseFloat(d.loaded_quantity_mt || d.dispatched_qty || 0);
    const r = parseFloat(d.finalized_rate || 0);
    return sum + (q * r);
  }, 0);

  return (
    <div className="card glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
      {/* 1. Header Bar with View Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Truck size={26} color="#38bdf8" /> 🚚 🚛 Transporter Dispatches Directory (Date & Time Wise)
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Live truck dispatches organized by Transporter Folders, sorted chronologically with exact date & time stamps.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Sub-view switcher */}
          <button
            type="button"
            onClick={() => setViewMode('folders')}
            className={`btn ${viewMode === 'folders' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Folder size={15} /> 📁 Transporter Folders ({activeTransportersCount})
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={15} /> 📋 All Dispatches ({totalTrucks})
          </button>

          <button
            type="button"
            onClick={() => setViewMode('requests')}
            className={`btn ${viewMode === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '7px 16px', fontSize: '0.82rem', fontWeight: '800', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={15} /> 🛡️ Access Requests ({dispatchAccessRequests.length})
          </button>

          <button
            type="button"
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: '0.82rem', borderRadius: '20px' }}
            title="Refresh live dispatches"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '22px' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(56, 189, 248, 0.35)', padding: '14px 18px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🚛 Total Trucks Dispatched</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#38bdf8', marginTop: '4px' }}>
            {totalTrucks} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Trucks</span>
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(16, 185, 129, 0.35)', padding: '14px 18px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚖️ Total Loaded Weight</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#10b981', marginTop: '4px' }}>
            {totalWeight.toFixed(3)} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>MT</span>
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '14px 18px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏢 Active Transporters</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#f59e0b', marginTop: '4px' }}>
            {activeTransportersCount} <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Vendors</span>
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(168, 85, 247, 0.35)', padding: '14px 18px', borderRadius: '12px', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>💰 Total Freight Value</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '900', color: '#c084fc', marginTop: '4px' }}>
            ₹{totalFreightValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* 3. Search & Transporter Folder Filters */}
      {viewMode !== 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Truck No (e.g. MH39), LR Number, Sub-Indent, Driver..."
              style={{
                width: '100%',
                padding: '9px 14px 9px 40px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                color: '#ffffff',
                fontSize: '0.86rem'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Folder Pills */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedFolder('ALL')}
              className={`btn ${selectedFolder === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800', borderRadius: '18px' }}
            >
              📂 All Folders ({totalTrucks} Trucks)
            </button>

            {transporterFolders
              .filter(f => f.dispatches.length > 0)
              .map((folder) => {
                const isSelected = selectedFolder === String(folder.transporter_id);
                return (
                  <button
                    key={folder.transporter_id}
                    type="button"
                    onClick={() => setSelectedFolder(String(folder.transporter_id))}
                    className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Folder size={14} /> {getTransporterDisplayName(folder)} ({folder.transporter_code || folder.transporter_id}) • {folder.dispatches.length} Trucks
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. VIEW 1: TRANSPORTER FOLDERS DIRECTORY (USER REQUESTED)     */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'folders' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {transporterFolders
            .filter(folder => {
              if (selectedFolder !== 'ALL') {
                return String(folder.transporter_id) === selectedFolder;
              }
              return folder.dispatches.length > 0;
            })
            .map((folder) => {
              const isOpen = expandedFolders[folder.transporter_id] !== false; // Default Open
              const filtered = folder.dispatches.filter(d => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  String(d.truck_number || '').toLowerCase().includes(q) ||
                  String(d.lr_number || '').toLowerCase().includes(q) ||
                  String(d.driver_name || '').toLowerCase().includes(q) ||
                  String(d.sub_indent_no || '').toLowerCase().includes(q) ||
                  String(d.req_no || '').toLowerCase().includes(q)
                );
              });

              return (
                <div
                  key={folder.transporter_id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1.5px solid rgba(56, 189, 248, 0.35)',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolder(folder.transporter_id)}
                    style={{
                      padding: '16px 20px',
                      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                      borderBottom: isOpen ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: '0 4px 14px rgba(56, 189, 248, 0.4)'
                      }}>
                        <FolderOpen size={24} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '1.25rem',
                            fontWeight: '900',
                            color: 'var(--text-main, #0f172a)',
                            letterSpacing: '-0.2px'
                          }}>
                            📁 Transporter: <span style={{ color: '#0284c7', textTransform: 'capitalize' }}>{getTransporterDisplayName(folder)}</span>
                          </span>

                          {folder.transporter_code && (
                            <span style={{
                              fontSize: '0.82rem',
                              background: '#0284c7',
                              color: '#ffffff',
                              padding: '2px 9px',
                              borderRadius: '8px',
                              fontWeight: '900',
                              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)'
                            }}>
                              {folder.transporter_code}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.82rem', color: 'var(--text-sub, #475569)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontWeight: '700' }}>
                          {folder.phone && <span>📞 <strong style={{ color: 'var(--text-main, #0f172a)' }}>{folder.phone}</strong></span>}
                          {folder.lastDispatchedAt && (
                            <span>🕒 Latest Dispatch: <strong style={{ color: '#0284c7' }}>{formatDispatchDateTime(folder.lastDispatchedAt)}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#0284c7', color: '#ffffff', padding: '5px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '900' }}>
                        🚛 {folder.dispatches.length} Trucks
                      </span>
                      <span style={{ background: '#059669', color: '#ffffff', padding: '5px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '900' }}>
                        ⚖️ {folder.totalQuantityMt.toFixed(3)} MT Loaded
                      </span>
                      <span style={{ background: '#7c3aed', color: '#ffffff', padding: '5px 12px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '900' }}>
                        💰 ₹{folder.totalFreightValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        {isOpen ? 'Close Folder' : 'Open Folder'}
                      </button>
                    </div>
                  </div>

                  {/* Folder Dispatches Content */}
                  {isOpen && (
                    <div style={{ padding: '16px' }}>
                      {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.86rem' }}>
                          No dispatches found matching the search criteria in this folder.
                        </div>
                      ) : (
                        <div className="custom-table-container">
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th style={{ minWidth: '170px' }}>📅 Date & Time (Dispatch)</th>
                                <th>📄 LR Number</th>
                                <th>🚛 Truck / Vehicle No</th>
                                <th>👤 Driver Details</th>
                                <th>📦 Req / Sub-Indent</th>
                                <th>📍 Route & Commodity</th>
                                <th style={{ textAlign: 'right' }}>Loaded Qty (MT)</th>
                                <th style={{ textAlign: 'right' }}>Rate (₹/MT)</th>
                                <th style={{ textAlign: 'right' }}>Total Amount (₹)</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((disp) => {
                                const qty = parseFloat(disp.loaded_quantity_mt || disp.dispatched_qty || 0);
                                const rate = parseFloat(disp.finalized_rate || 0);
                                const totalAmt = qty * rate;

                                return (
                                  <tr key={disp.id || disp.lr_number}>
                                    {/* Date & Time */}
                                    <td>
                                      <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Calendar size={14} /> {formatDispatchDateTime(disp.dispatched_at || disp.created_at)}
                                      </div>
                                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                        ID: {disp.id}
                                      </div>
                                    </td>

                                    {/* LR Number */}
                                    <td>
                                      <span style={{
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        padding: '4px 9px',
                                        borderRadius: '6px',
                                        fontFamily: 'monospace',
                                        fontWeight: '900',
                                        fontSize: '0.84rem'
                                      }}>
                                        {disp.lr_number || disp.dispatch_reference || 'LR-PENDING'}
                                      </span>
                                    </td>

                                    {/* Truck Number */}
                                    <td>
                                      <div style={{
                                        background: '#fef08a',
                                        color: '#713f12',
                                        padding: '4px 9px',
                                        borderRadius: '6px',
                                        fontWeight: '900',
                                        fontFamily: 'monospace',
                                        fontSize: '0.86rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}>
                                        🚛 {disp.truck_number || 'N/A'}
                                      </div>
                                    </td>

                                    {/* Driver Details */}
                                    <td>
                                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.84rem' }}>
                                        {disp.driver_name || 'Driver'}
                                      </div>
                                      {disp.driver_mobile && (
                                        <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                                          📞 {disp.driver_mobile}
                                        </div>
                                      )}
                                      {disp.driver_license && (
                                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>
                                          DL: {disp.driver_license}
                                        </div>
                                      )}
                                    </td>

                                    {/* Requirement & Sub-Indent */}
                                    <td>
                                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.84rem' }}>
                                        {disp.req_no || disp.requirement_id}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: '#0284c7', fontFamily: 'monospace', fontWeight: '800' }}>
                                        {disp.sub_indent_no || disp.requirement_item_id}
                                      </div>
                                    </td>

                                    {/* Route & Cargo */}
                                    <td>
                                      <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.84rem' }}>
                                        {disp.product_name || 'Agri Cargo'}
                                      </div>
                                      <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                                        📍 {disp.pickup_origin || 'Origin'} ➔ 🎯 {disp.drop_location || 'Destination'}
                                      </div>
                                    </td>

                                    {/* Loaded Qty */}
                                    <td style={{ textAlign: 'right' }}>
                                      <span style={{ fontSize: '0.94rem', fontWeight: '900', color: '#059669' }}>
                                        {qty.toFixed(3)}
                                      </span>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '3px' }}>MT</span>
                                    </td>

                                    {/* Finalized Rate */}
                                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a', fontSize: '0.86rem' }}>
                                      ₹{rate.toFixed(2)}
                                    </td>

                                    {/* Freight Amount */}
                                    <td style={{ textAlign: 'right', fontWeight: '900', color: '#7c3aed', fontSize: '0.9rem' }}>
                                      ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>

                                    {/* Status */}
                                    <td>
                                      <span style={{
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        padding: '3px 9px',
                                        borderRadius: '6px',
                                        fontWeight: '800',
                                        fontSize: '0.76rem'
                                      }}>
                                        ✅ {disp.dispatch_status || 'Dispatched'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {transporterFolders.filter(f => f.dispatches.length > 0).length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px' }}>
              <FolderOpen size={44} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffffff' }}>No Transporter Dispatches Found Yet</div>
              <p style={{ fontSize: '0.84rem', marginTop: '6px', color: '#94a3b8' }}>
                When any transporter dispatches trucks, their dispatches will appear here organized in their dedicated Transporter Folder.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. VIEW 2: ALL LIVE DISPATCHES (CHRONOLOGICAL TABLE)          */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'table' && (
        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ minWidth: '170px' }}>📅 Date & Time (Dispatch)</th>
                <th>📁 Transporter Folder</th>
                <th>📄 LR Number</th>
                <th>🚛 Truck No</th>
                <th>👤 Driver Details</th>
                <th>📦 Sub-Indent</th>
                <th>📍 Route & Material</th>
                <th style={{ textAlign: 'right' }}>Loaded Qty</th>
                <th style={{ textAlign: 'right' }}>Fixed Rate</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {allDispatches
                .filter(d => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    String(d.truck_number || '').toLowerCase().includes(q) ||
                    String(d.lr_number || '').toLowerCase().includes(q) ||
                    String(d.driver_name || '').toLowerCase().includes(q) ||
                    String(d.transporter_name || '').toLowerCase().includes(q) ||
                    String(d.sub_indent_no || '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => new Date(b.dispatched_at || b.created_at || 0) - new Date(a.dispatched_at || a.created_at || 0))
                .map((disp) => {
                  const qty = parseFloat(disp.loaded_quantity_mt || disp.dispatched_qty || 0);
                  const rate = parseFloat(disp.finalized_rate || 0);
                  const totalAmt = qty * rate;

                  return (
                    <tr key={disp.id || disp.lr_number}>
                      <td>
                        <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} /> {formatDispatchDateTime(disp.dispatched_at || disp.created_at)}
                        </div>
                      </td>

                      <td>
                        <span style={{ background: '#0284c7', color: '#ffffff', padding: '4px 9px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '900' }}>
                          📁 {disp.transporter_name || disp.transporter_id} ({disp.transporter_code || 'T'})
                        </span>
                      </td>

                      <td>
                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace', fontWeight: '900', fontSize: '0.82rem' }}>
                          {disp.lr_number || disp.dispatch_reference || 'LR-PENDING'}
                        </span>
                      </td>

                      <td>
                        <span style={{ background: '#fef08a', color: '#713f12', padding: '3px 8px', borderRadius: '6px', fontWeight: '900', fontFamily: 'monospace', fontSize: '0.84rem' }}>
                          🚛 {disp.truck_number || 'N/A'}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.84rem' }}>{disp.driver_name || 'Driver'}</div>
                        {disp.driver_mobile && <div style={{ fontSize: '0.74rem', color: '#475569' }}>📞 {disp.driver_mobile}</div>}
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.84rem' }}>{disp.req_no}</div>
                        <div style={{ fontSize: '0.74rem', color: '#0284c7', fontFamily: 'monospace', fontWeight: '800' }}>{disp.sub_indent_no}</div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.82rem' }}>{disp.product_name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#475569' }}>📍 {disp.pickup_origin} ➔ 🎯 {disp.drop_location}</div>
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#059669', fontSize: '0.92rem' }}>
                        {qty.toFixed(3)} MT
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: '800', color: '#0f172a', fontSize: '0.86rem' }}>
                        ₹{rate.toFixed(2)}
                      </td>

                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#7c3aed', fontSize: '0.9rem' }}>
                        ₹{totalAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      <td>
                        <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 9px', borderRadius: '6px', fontWeight: '800', fontSize: '0.76rem' }}>
                          ✅ {disp.dispatch_status || 'Dispatched'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

              {allDispatches.length === 0 && (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No truck dispatches recorded in the system yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. VIEW 3: DISPATCH ACCESS REQUESTS QUEUE                     */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'requests' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setDispatchAccessFilter('pending')}
              className={`btn ${dispatchAccessFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800', borderRadius: '20px' }}
            >
              Pending ({dispatchAccessRequests.filter(r => r.authorization_status === 'PENDING').length})
            </button>
            <button
              onClick={() => setDispatchAccessFilter('approved')}
              className={`btn ${dispatchAccessFilter === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800', borderRadius: '20px' }}
            >
              Approved ({dispatchAccessRequests.filter(r => r.authorization_status === 'APPROVED' || r.authorization_status === 'WINNER').length})
            </button>
            <button
              onClick={() => setDispatchAccessFilter('rejected')}
              className={`btn ${dispatchAccessFilter === 'rejected' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800', borderRadius: '20px' }}
            >
              Rejected ({dispatchAccessRequests.filter(r => r.authorization_status === 'REJECTED').length})
            </button>
            <button
              onClick={() => setDispatchAccessFilter('all')}
              className={`btn ${dispatchAccessFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: '800', borderRadius: '20px' }}
            >
              All ({dispatchAccessRequests.length})
            </button>
          </div>

          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Req No / Sub-indent</th>
                  <th>Cargo & Route</th>
                  <th>Qty (Total / Disp / Rem)</th>
                  <th>Fixed Rate</th>
                  <th>Original Winner</th>
                  <th>Requesting Transporter</th>
                  <th>Request Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dispatchAccessRequests
                  .filter(r => {
                    if (dispatchAccessFilter === 'pending') return r.authorization_status === 'PENDING';
                    if (dispatchAccessFilter === 'approved') return r.authorization_status === 'APPROVED' || r.authorization_status === 'WINNER';
                    if (dispatchAccessFilter === 'rejected') return r.authorization_status === 'REJECTED';
                    return true;
                  })
                  .map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: '900', color: '#38bdf8', fontSize: '0.88rem' }}>
                          {req.req_no || 'REQ'}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {req.item_sub_indent_no || req.sub_indent_no || req.requirement_item_id}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.86rem' }}>
                          {req.product_name || req.req_title || 'Cargo'}
                        </div>
                        <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                          📍 {req.item_pickup || req.parent_pickup || 'Origin'} ➔ 🎯 {req.item_drop || req.parent_drop || 'Destination'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0f172a' }}>
                          {Number(req.item_quantity_mt || 0).toLocaleString()} MT Total
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#059669', fontWeight: '700' }}>
                          ✅ {Number(req.dispatched_quantity_mt || 0).toLocaleString()} MT Dispatched
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#d97706', fontWeight: '800' }}>
                          ⏳ {Number(req.remaining_quantity_mt || 0).toLocaleString()} MT Remaining
                        </div>
                      </td>

                      <td>
                        <span style={{ background: '#0284c7', color: '#ffffff', padding: '3px 8px', borderRadius: '6px', fontWeight: '900', fontSize: '0.82rem' }}>
                          ₹{Number(req.fixed_rate || req.rate_per_mt || 0).toFixed(2)}/MT
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '0.84rem' }}>
                          {req.winner_transporter_name || req.winner_transporter_id || 'Winner'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: '800', color: '#0284c7', fontSize: '0.84rem' }}>
                          {req.requesting_transporter_name || req.transporter_name || req.transporter_id}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {req.requesting_transporter_code || req.transporter_code || ''}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: '800' }}>
                          {formatDispatchDateTime(req.requested_at || req.created_at)}
                        </div>
                      </td>

                      <td>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '0.76rem',
                          fontWeight: '900',
                          background: req.authorization_status === 'APPROVED' || req.authorization_status === 'WINNER' ? '#dcfce7' : req.authorization_status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                          color: req.authorization_status === 'APPROVED' || req.authorization_status === 'WINNER' ? '#15803d' : req.authorization_status === 'PENDING' ? '#b45309' : '#b91c1c'
                        }}>
                          {req.authorization_status === 'APPROVED' || req.authorization_status === 'WINNER' ? '✅ Approved' : req.authorization_status === 'PENDING' ? '⏳ Pending' : '❌ Rejected'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {req.authorization_status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => onApproveRequest(req.id)}
                              className="btn btn-success"
                              style={{ padding: '4px 10px', fontSize: '0.78rem', fontWeight: '800', borderRadius: '6px' }}
                            >
                              ✅ Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => onRejectRequest(req.id)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '0.78rem', fontWeight: '800', borderRadius: '6px', color: '#ef4444', borderColor: '#f87171' }}
                            >
                              ❌ Reject
                            </button>
                          </div>
                        ) : req.authorization_status === 'APPROVED' ? (
                          <span style={{ fontSize: '0.76rem', color: '#059669', fontWeight: '800' }}>
                            Approved
                          </span>
                        ) : req.authorization_status === 'REJECTED' ? (
                          <div style={{ fontSize: '0.74rem', color: '#ef4444', textAlign: 'right' }}>
                            Rejected
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>Locked</span>
                        )}
                      </td>
                    </tr>
                  ))}

                {dispatchAccessRequests.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No dispatch access requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
