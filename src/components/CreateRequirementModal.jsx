// src/components/CreateRequirementModal.jsx
// Cleaned up Create Requirement Modal with Auto-Sequential Requirement Number Engine (SNPL/26-27/REQ-0001) & Live Security Audit Logging 🛡️

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, MapPin, Send } from 'lucide-react';

export const CreateRequirementModal = ({ isOpen, onClose }) => {
  const { db, updateDB, currentUser, addSecurityLog } = useAuth();

  const titleMasters = db.title_masters || [];
  const companyUnits = db.company_units_plants || db.company_units || db.company_masters || [];
  
  const pickupOpts = Array.from(
    new Set(
      companyUnits
        .map((c) => (c.pickup_origin || c.pickup_location_name || '').trim())
        .filter((val) => val.length > 0)
    )
  );

  const dropOpts = Array.from(
    new Set(
      companyUnits
        .map((c) => (c.drop_location || c.drop_location_name || '').trim())
        .filter((val) => val.length > 0)
    )
  );

  const cityMasters = dropOpts.map((dropLoc, idx) => ({
    id: `cup_drop_${idx}`,
    city: dropLoc,
    pin: '440028'
  }));

  // Title Master State
  const [selectedMasterId, setSelectedMasterId] = useState(titleMasters[0]?.id || '');
  const [currentTitle, setCurrentTitle] = useState(titleMasters[0]?.title || '');

  // Destination City Master State
  const [selectedCityId, setSelectedCityId] = useState(cityMasters[0]?.id || '');
  const [currentCityName, setCurrentCityName] = useState(cityMasters[0]?.city || '');
  const [currentPinCode, setCurrentPinCode] = useState(cityMasters[0]?.pin || '');

  // Pickup Origin State
  const [selectedPickupOrigin, setSelectedPickupOrigin] = useState(pickupOpts[0] || '');

  // Other form fields
  const [formData, setFormData] = useState({
    material_type: titleMasters[0]?.material_type || '',
    required_qty: '',
    unit: 'MT',
    target_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  if (!isOpen) return null;

  // When admin selects a Title from Master Dropdown
  const handleSelectMasterTitle = (e) => {
    const masterId = e.target.value;
    setSelectedMasterId(masterId);

    const masterObj = titleMasters.find((t) => t.id === masterId);
    if (masterObj) {
      setCurrentTitle(masterObj.title);
      setFormData((prev) => ({
        ...prev,
        material_type: masterObj.material_type || prev.material_type
      }));
    }
  };

  // Remove / Delete Selected Master Title
  const handleRemoveSelectedTitleMaster = () => {
    if (!selectedMasterId) return;

    const masterObj = titleMasters.find((t) => t.id === selectedMasterId);
    const titleName = masterObj?.title || 'Selected Master Title';

    if (window.confirm(`Are you sure you want to remove "${titleName}" from Company Master Directory?`)) {
      const updatedMasters = titleMasters.filter((t) => t.id !== selectedMasterId);
      const updatedDb = addSecurityLog(
        { ...db, title_masters: updatedMasters },
        `REMOVE_TITLE_MASTER (${titleName})`,
        currentUser?.username || 'admin',
        'admin',
        'DELETED 🛡️'
      );
      updateDB(updatedDb);

      if (updatedMasters.length > 0) {
        setSelectedMasterId(updatedMasters[0].id);
        setCurrentTitle(updatedMasters[0].title);
      } else {
        setSelectedMasterId('');
        setCurrentTitle('');
      }
    }
  };

  // Quick Inline Add New Title to Master
  const handleAddInlineTitleMaster = (e) => {
    e.preventDefault();
    if (!inlineMasterTitle.trim()) return;

    const newMasterObj = {
      id: `tm_${Date.now()}`,
      title: inlineMasterTitle.trim(),
      material_type: inlineMasterMaterial.trim() || 'General Cargo'
    };

    const updatedMasters = [newMasterObj, ...titleMasters];
    const updatedDb = addSecurityLog(
      { ...db, title_masters: updatedMasters },
      `ADD_TITLE_MASTER (${newMasterObj.title})`,
      currentUser?.username || 'admin',
      'admin',
      'CREATED 🛡️'
    );
    updateDB(updatedDb);

    setSelectedMasterId(newMasterObj.id);
    setCurrentTitle(newMasterObj.title);
    setFormData((prev) => ({
      ...prev,
      material_type: newMasterObj.material_type
    }));

    setInlineMasterTitle('');
    setInlineMasterMaterial('');
    setShowAddMasterTitleForm(false);
  };

  // --- DESTINATION CITY MASTER HANDLERS ---
  const handleSelectCityMaster = (e) => {
    const cityId = e.target.value;
    setSelectedCityId(cityId);

    const cityObj = cityMasters.find((c) => c.id === cityId);
    if (cityObj) {
      setCurrentCityName(cityObj.city);
      setCurrentPinCode(cityObj.pin || '440028');
    }
  };

  const handleRemoveSelectedCityMaster = () => {
    if (!selectedCityId) return;

    const cityObj = cityMasters.find((c) => c.id === selectedCityId);
    const cityName = cityObj?.city || 'Selected City';

    if (window.confirm(`Are you sure you want to remove "${cityName}" from Destination City Master Directory?`)) {
      const updatedCities = cityMasters.filter((c) => c.id !== selectedCityId);
      const updatedDb = addSecurityLog(
        { ...db, city_masters: updatedCities },
        `REMOVE_CITY_MASTER (${cityName})`,
        currentUser?.username || 'admin',
        'admin',
        'DELETED 🛡️'
      );
      updateDB(updatedDb);

      if (updatedCities.length > 0) {
        setSelectedCityId(updatedCities[0].id);
        setCurrentCityName(updatedCities[0].city);
        setCurrentPinCode(updatedCities[0].pin || '');
      } else {
        setSelectedCityId('');
        setCurrentCityName('');
        setCurrentPinCode('');
      }
    }
  };

  const handleAddInlineCityMaster = (e) => {
    e.preventDefault();
    if (!inlineCityName.trim()) return;

    const newCityObj = {
      id: `city_${Date.now()}`,
      city: inlineCityName.trim(),
      pin: inlinePinCode.trim() || '440028'
    };

    const updatedCities = [newCityObj, ...cityMasters];
    const updatedDb = addSecurityLog(
      { ...db, city_masters: updatedCities },
      `ADD_CITY_MASTER (${newCityObj.city})`,
      currentUser?.username || 'admin',
      'admin',
      'CREATED 🛡️'
    );
    updateDB(updatedDb);

    setSelectedCityId(newCityObj.id);
    setCurrentCityName(newCityObj.city);
    setCurrentPinCode(newCityObj.pin);

    setInlineCityName('');
    setInlinePinCode('');
    setShowAddCityForm(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const selectedMaster = titleMasters.find((t) => t.id === selectedMasterId);
    const finalTitle = currentTitle || selectedMaster?.title || `Shalimar Transport Requirement to ${currentCityName}`;

    const newReqId = `req_${Date.now()}`;
    
    // Auto-Sequential Requirement Formatting (SNPL/26-27/REQ-0003, etc.)
    const nextSeq = (db.rate_requests || []).length + 1;
    const seqPadded = String(nextSeq).padStart(4, '0');
    const newReqNo = `SNPL/26-27/REQ-${seqPadded}`;

    const newRequirement = {
      id: newReqId,
      request_no: newReqNo,
      title: finalTitle,
      origin_city: selectedPickupOrigin || pickupOpts[0] || 'yenva',
      origin_pin: '440028',
      dest_city: currentCityName,
      dest_pin: currentPinCode,
      material_type: formData.material_type,
      required_qty: parseFloat(formData.required_qty) || 1000,
      unit: formData.unit,
      target_date: formData.target_date,
      status: 'Open',
      created_at: new Date().toISOString(),
      notes: formData.notes
    };

    const updatedDb = addSecurityLog(
      {
        ...db,
        rate_requests: [newRequirement, ...db.rate_requests]
      },
      `CREATE_REQUIREMENT (${newReqNo} - ${newRequirement.required_qty} MT)`,
      currentUser?.username || 'admin',
      currentUser?.role || 'admin',
      'CREATED 🛡️'
    );

    updateDB(updatedDb);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '680px', padding: '28px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '10px', borderRadius: '10px' }}>
              <PlusCircle size={20} color="#38bdf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Create Transport Requirement</h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Broadcasts requirement to registered transporters on portal</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          
          {/* 1. REQUIREMENT TITLE MASTER SELECTOR BLOCK */}
          <div className="form-group" style={{ background: 'rgba(56, 189, 248, 0.08)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: '16px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontWeight: '700' }}>
                <Bookmark size={16} /> Select from Title Master Template List
              </label>
            </div>

            {/* Master Title Dropdown */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="form-control"
                onChange={handleSelectMasterTitle}
                value={selectedMasterId}
                style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#ffffff', flex: 1, fontWeight: '700' }}
                required
              >
                {titleMasters.length === 0 && <option value="">-- No Saved Master Titles Available --</option>}
                {titleMasters.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    📌 {tm.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. DROP DESTINATION CITY MASTER SELECTOR BLOCK */}
          <div className="form-group" style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)', marginBottom: '16px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label className="form-label" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, fontWeight: '700' }}>
                <MapPin size={16} /> Select Drop Destination City (Master)
              </label>
            </div>

            {/* City Master Dropdown */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select
                className="form-control"
                onChange={handleSelectCityMaster}
                value={selectedCityId}
                style={{ background: 'rgba(15, 23, 42, 0.9)', color: '#ffffff', flex: 1, fontWeight: '700' }}
                required
              >
                {cityMasters.length === 0 && <option value="">-- No Saved Destination Cities Available --</option>}
                {cityMasters.map((c) => (
                  <option key={c.id} value={c.id}>
                    📍 {c.city} (PIN: {c.pin})
                  </option>
                ))}
              </select>
            </div>

            {/* Show Selected PIN Code */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Destination PIN Code:</span>
              <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{currentPinCode || '440028'}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Material / Cargo Type</label>
              <input
                type="text"
                className="form-control"
                placeholder="Soya DOC, Edible Oil, Fertilisers"
                value={formData.material_type}
                onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Required Quantity (MT / Tons)</label>
              <input
                type="number"
                min="1"
                className="form-control"
                placeholder="1000"
                value={formData.required_qty}
                onChange={(e) => setFormData({ ...formData, required_qty: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Target Completion Date</label>
            <input
              type="date"
              className="form-control"
              value={formData.target_date}
              onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Instructions / Terms for Transporters</label>
            <textarea
              className="form-control"
              rows="3"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Send size={16} /> Create & Broadcast Requirement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
