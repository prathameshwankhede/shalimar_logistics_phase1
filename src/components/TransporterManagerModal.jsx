// src/components/TransporterManagerModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, X, Shield, Building, Phone, Mail, FileText, CheckCircle } from 'lucide-react';
import { validateMobile, validateEmail, validateName } from '../utils/validationRules';

export const TransporterManagerModal = ({ isOpen, onClose }) => {
  const { db, updateDB } = useAuth();

  const [formData, setFormData] = useState({
    company_name: '',
    code: '',
    contact_person: '',
    mobile: '',
    email: '',
    address: '',
    gst_pan: '',
    username: '',
    password: '',
    status: 'Active'
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Real-time live field-level validation
    if (field === 'mobile') {
      const v = validateMobile(value);
      setFieldErrors((prev) => ({ ...prev, mobile: value && !v.valid ? v.message : null }));
    }
    if (field === 'email') {
      const v = validateEmail(value);
      setFieldErrors((prev) => ({ ...prev, email: value && !v.valid ? v.message : null }));
    }
    if (field === 'contact_person') {
      const v = validateName(value);
      setFieldErrors((prev) => ({ ...prev, contact_person: value && !v.valid ? v.message : null }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    // 🛡️ Live Enterprise Validation Rules
    const mobileVal = validateMobile(formData.mobile);
    if (!mobileVal.valid) {
      setFieldErrors((prev) => ({ ...prev, mobile: mobileVal.message }));
      setErrorMsg(`📱 Mobile Error: ${mobileVal.message}`);
      return;
    }

    const emailVal = validateEmail(formData.email);
    if (!emailVal.valid) {
      setFieldErrors((prev) => ({ ...prev, email: emailVal.message }));
      setErrorMsg(`✉️ Email Error: ${emailVal.message}`);
      return;
    }

    const nameVal = validateName(formData.contact_person);
    if (!nameVal.valid) {
      setFieldErrors((prev) => ({ ...prev, contact_person: nameVal.message }));
      setErrorMsg(`👤 Contact Person Error: ${nameVal.message}`);
      return;
    }

    const transId = `trans_${Date.now()}`;
    const userId = `usr_${Date.now()}`;

    const newTransporter = {
      id: transId,
      company_name: formData.company_name,
      code: formData.code || formData.username.toUpperCase(),
      contact_person: nameVal.clean,
      mobile: mobileVal.clean,
      email: emailVal.clean,
      address: formData.address,
      gstin: formData.gst_pan && formData.gst_pan.length === 15 ? formData.gst_pan : null,
      pan: formData.gst_pan && formData.gst_pan.length === 10 ? formData.gst_pan : null,
      username: formData.username,
      password: formData.password,
      status: formData.status,
      created_at: new Date().toISOString()
    };

    const newUser = {
      id: userId,
      username: formData.username,
      password: formData.password,
      name: `${formData.company_name} Admin`,
      role: 'transporter',
      transporter_id: transId,
      created_at: new Date().toISOString()
    };

    const updatedDb = {
      ...db,
      transporters: [...(db.transporters || []), newTransporter],
      users: [...(db.users || []), newUser]
    };

    updateDB(updatedDb);

    setSuccessMessage(`Transporter Account '${formData.company_name}' (${formData.username}) created successfully!`);
    
    // Reset form
    setFormData({
      company_name: '',
      code: '',
      contact_person: '',
      mobile: '',
      email: '',
      address: '',
      gst_pan: '',
      username: '',
      password: '',
      status: 'Active'
    });
    setFieldErrors({});

    setTimeout(() => {
      setSuccessMessage('');
      onClose();
    }, 1800);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '680px', padding: '28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px' }}>
              <UserPlus size={20} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Register New Transporter Account</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Admin panel to onboard transporters and assign login credentials</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#fca5a5',
            fontSize: '0.85rem',
            fontWeight: '700'
          }}>
            {errorMsg}
          </div>
        )}

        {successMessage && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid #10b981',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#34d399',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={18} />
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Transporter Company Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Speed Cargo Logistics"
                value={formData.company_name}
                onChange={(e) => {
                  const val = e.target.value;
                  const autoUser = val ? val.split(' ')[0].toUpperCase() + '001' : '';
                  setFormData({
                    ...formData,
                    company_name: val,
                    username: formData.username || autoUser,
                    code: formData.code || (val ? val.split(' ')[0].toUpperCase() + '001' : '')
                  });
                }}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Transporter Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. SCL001"
                value={formData.code}
                onChange={(e) => handleFieldChange('code', e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Contact Person Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="Rajesh Sharma"
                value={formData.contact_person}
                onChange={(e) => handleFieldChange('contact_person', e.target.value)}
                style={{
                  border: fieldErrors.contact_person ? '2px solid #ef4444' : undefined,
                  background: fieldErrors.contact_person ? 'rgba(239, 68, 68, 0.08)' : undefined
                }}
                required
              />
              {fieldErrors.contact_person && (
                <div style={{ color: '#fca5a5', fontSize: '0.75rem', fontWeight: '800', marginTop: '4px' }}>
                  ⚠️ {fieldErrors.contact_person}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                type="tel"
                className="form-control"
                placeholder="e.g. 9823012345"
                value={formData.mobile}
                onChange={(e) => handleFieldChange('mobile', e.target.value)}
                style={{
                  border: fieldErrors.mobile ? '2px solid #ef4444' : undefined,
                  background: fieldErrors.mobile ? 'rgba(239, 68, 68, 0.08)' : undefined
                }}
                required
              />
              {fieldErrors.mobile && (
                <div style={{ color: '#fca5a5', fontSize: '0.75rem', fontWeight: '800', marginTop: '4px' }}>
                  ⚠️ {fieldErrors.mobile}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="contact@speedcargo.com"
                value={formData.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                style={{
                  border: fieldErrors.email ? '2px solid #ef4444' : undefined,
                  background: fieldErrors.email ? 'rgba(239, 68, 68, 0.08)' : undefined
                }}
                required
              />
              {fieldErrors.email && (
                <div style={{ color: '#fca5a5', fontSize: '0.75rem', fontWeight: '800', marginTop: '4px' }}>
                  ⚠️ {fieldErrors.email}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">GST / PAN Number</label>
              <input
                type="text"
                className="form-control"
                placeholder="27ABCDE1234F1Z5"
                value={formData.gst_pan}
                onChange={(e) => setFormData({ ...formData, gst_pan: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Office Address</label>
            <input
              type="text"
              className="form-control"
              placeholder="Plot 12, Logistics Park, Highway Road"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              required
            />
          </div>

          {/* Login Credentials Section */}
          <div className="glass-panel-subtle" style={{ padding: '16px', borderRadius: '12px', marginBottom: '16px', border: '1.5px solid #0284c7' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: '800', color: '#0284c7', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={16} color="#0284c7" /> Login Credentials for Transporter
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. SCL001"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Temporary Password</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="password123"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Account Status</label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-success">
              <UserPlus size={16} /> Save & Create Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
