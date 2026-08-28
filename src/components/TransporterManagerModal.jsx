// src/components/TransporterManagerModal.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { createTransporter, deleteTransporter } from '../api/transporterApi';
import { UserPlus, X, Shield, CheckCircle, Trash2 } from 'lucide-react';
import { validateMobile, validateEmail, validateName } from '../utils/validationRules';

export const TransporterManagerModal = ({ isOpen, onClose, editingTransporter = null }) => {
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

  useEffect(() => {
    if (editingTransporter) {
      setFormData({
        id: editingTransporter.id,
        company_name: editingTransporter.company_name || '',
        code: editingTransporter.code || '',
        contact_person: editingTransporter.contact_person || '',
        mobile: editingTransporter.mobile || '',
        email: editingTransporter.email || '',
        address: editingTransporter.address || '',
        gst_pan: editingTransporter.gstin || editingTransporter.pan || editingTransporter.gst_pan || '',
        username: editingTransporter.username || '',
        password: '',
        status: editingTransporter.status || 'Active'
      });
    } else {
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
    }
    setFieldErrors({});
    setErrorMsg('');
    setSuccessMessage('');
  }, [editingTransporter, isOpen]);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

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

    const isEdit = Boolean(formData.id);
    const transId = formData.id || `trans_${Date.now()}`;
    const userId = `usr_${Date.now()}`;

    const transporterPayload = {
      id: transId,
      company_name: formData.company_name,
      code: formData.code || (formData.username ? formData.username.toUpperCase() : 'TR'),
      contact_person: nameVal.clean,
      mobile: mobileVal.clean,
      email: emailVal.clean,
      address: formData.address,
      gstin: formData.gst_pan && formData.gst_pan.length === 15 ? formData.gst_pan : null,
      pan: formData.gst_pan && formData.gst_pan.length === 10 ? formData.gst_pan : null,
      username: formData.username,
      password: formData.password || undefined,
      status: formData.status
    };

    try {
      const apiRes = await createTransporter(transporterPayload);
      if (apiRes && apiRes.error) {
        setErrorMsg(`❌ Save Error: ${typeof apiRes.error === 'string' ? apiRes.error : apiRes.error.message || 'Failed to save transporter'}`);
        return;
      }
    } catch (err) {
      console.warn('POST /api/transporters notice (continuing state sync):', err.message);
    }

    let updatedTransporters = [...(db.transporters || [])];
    if (isEdit) {
      updatedTransporters = updatedTransporters.map((t) => (t.id === transId || t.code === formData.code ? { ...t, ...transporterPayload } : t));
    } else {
      updatedTransporters.push({ ...transporterPayload, created_at: new Date().toISOString() });
    }

    let updatedUsers = [...(db.users || [])];
    if (!isEdit && formData.username) {
      updatedUsers.push({
        id: userId,
        username: formData.username,
        password: formData.password,
        name: `${formData.company_name} Admin`,
        role: 'transporter',
        transporter_id: transId,
        created_at: new Date().toISOString()
      });
    }

    const updatedDb = {
      ...db,
      transporters: updatedTransporters,
      users: updatedUsers
    };

    updateDB(updatedDb);

    setSuccessMessage(`Transporter Account '${formData.company_name}' (${formData.username}) ${isEdit ? 'updated' : 'created'} successfully!`);

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
    }, 1200);
  };

  const handleDeleteInsideModal = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('[DELETE BUTTON CLICKED]', editingTransporter);
    console.log('[DELETE TARGET]', {
      id: editingTransporter?.id,
      code: editingTransporter?.code,
      username: editingTransporter?.username
    });

    if (!editingTransporter || !editingTransporter.id) {
      console.warn('[DELETE ERROR] editingTransporter or editingTransporter.id is missing!', editingTransporter);
      setErrorMsg('Error deleting transporter: Invalid transporter record selected.');
      return;
    }

    const transName = editingTransporter.company_name || editingTransporter.code || 'this transporter';
    if (!window.confirm(`Are you sure you want to delete Transporter '${transName}' (${editingTransporter.code || editingTransporter.username})?\n\nThis will remove it from the MySQL database.`)) {
      return;
    }
    console.log('[DELETE CONFIRMED]');

    try {
      const res = await deleteTransporter(editingTransporter.id);
      if (res && res.success === false) {
        const message = res.message || (typeof res.error === 'string' ? res.error : res.error?.message) || 'Unable to delete transporter.';
        setErrorMsg(`Error deleting transporter: ${message}`);
        return;
      }

      const updatedTransporters = (db.transporters || []).filter((t) => t.id !== editingTransporter.id && t.code !== editingTransporter.code);
      const updatedUsers = (db.users || []).filter((u) => u.transporter_id !== editingTransporter.id && u.username !== editingTransporter.username);

      updateDB({
        ...db,
        transporters: updatedTransporters,
        users: updatedUsers
      });

      setSuccessMessage(res?.message || `Transporter deleted successfully.`);
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Delete transporter error:', err);
      const message =
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.data?.error?.message ||
        (typeof err?.data?.error === 'string' ? err.data.error : null) ||
        err?.message ||
        'Unable to delete transporter.';
      setErrorMsg(`Error deleting transporter: ${message}`);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content glass-panel" style={{ maxWidth: '680px', padding: '28px', boxSizing: 'border-box', position: 'relative', zIndex: 10000 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '10px', borderRadius: '10px' }}>
              <UserPlus size={24} color="#10b981" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0 }}>
                {editingTransporter ? `✏️ Edit Transporter Account: ${editingTransporter.company_name}` : 'Onboard New Logistics Vendor / Transporter'}
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {editingTransporter ? 'Update company details, contact info, and status' : 'Create vendor profile & generate instant portal access credentials'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-close" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '700' }}>
            {errorMsg}
          </div>
        )}

        {successMessage && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} color="#34d399" /> {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Company / Transporter Name</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Speed Cargo Logistics"
                value={formData.company_name}
                onChange={(e) => handleFieldChange('company_name', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vendor Code</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. SCL001"
                value={formData.code}
                onChange={(e) => handleFieldChange('code', e.target.value.toUpperCase())}
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
                placeholder="e.g. Rajesh Kumar"
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
            <div style={{ display: 'grid', gridTemplateColumns: editingTransporter ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px' }}>
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
              {!editingTransporter && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Password</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="password123"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              )}
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
            {editingTransporter ? (
              <button
                type="button"
                onClick={(e) => handleDeleteInsideModal(e)}
                className="btn btn-danger"
                style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', zIndex: 10 }}
              >
                <Trash2 size={16} /> 🗑️ Delete Transporter Account
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-success">
                <UserPlus size={16} /> {editingTransporter ? 'Update Transporter' : 'Save & Create Login'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
