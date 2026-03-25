import React, { useState } from 'react';

export default function VehicleFormTable({ vehicle, onClose, onSubmit }) {
  const [formData, setFormData] = useState(vehicle || {
    vehicle_no: '',
    driver_name: '',
    route_from: '',
    route_to: '',
    point1: '',
    point2: '',
    point3: '',
    point4: '',
    standard_route_no: '',
    route_km: '',
    unloading_charge_per_point: '',
    fuel_charge: '',
    maintenance_date: '',
    vehicle_document: '',
    notes: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.vehicle_no || !formData.driver_name || !formData.route_from || !formData.route_to) {
      alert('Please fill in all required fields: Vehicle No, Driver Name, Route From, Route To');
      return;
    }

    onSubmit(formData);
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #cccccc',
    borderRadius: '6px',
    fontSize: '13px',
    backgroundColor: '#ffffff',
    color: '#000000',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: '600',
    color: '#000000',
    padding: '8px 0'
  };

  return (
    <div style={{
      width: '100%',
      backgroundColor: '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden',
      marginTop: '20px'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#0066cc',
        color: '#ffffff',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {vehicle ? '✏️ Edit Vehicle' : '🚗 Add New Vehicle'}
        </h2>
        <button
          onClick={onClose}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '24px',
            color: '#ffffff'
          }}
        >
          ✕
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        
        {/* BASIC VEHICLE INFORMATION */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            BASIC VEHICLE INFORMATION
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Vehicle No <span style={{ color: '#cc0000' }}>*</span></label>
              <input
                type="text"
                name="vehicle_no"
                value={formData.vehicle_no}
                onChange={handleChange}
                placeholder="e.g., MH-02-AB-1234"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Driver Name <span style={{ color: '#cc0000' }}>*</span></label>
              <input
                type="text"
                name="driver_name"
                value={formData.driver_name}
                onChange={handleChange}
                placeholder="e.g., John Doe"
                required
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ROUTE DETAILS */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            ROUTE DETAILS
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Route From <span style={{ color: '#cc0000' }}>*</span></label>
              <input
                type="text"
                name="route_from"
                value={formData.route_from}
                onChange={handleChange}
                placeholder="e.g., Delhi"
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Route To <span style={{ color: '#cc0000' }}>*</span></label>
              <input
                type="text"
                name="route_to"
                value={formData.route_to}
                onChange={handleChange}
                placeholder="e.g., Agra"
                required
                style={inputStyle}
              />
            </div>
          </div>

          {/* Points */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i}>
                <label style={labelStyle}>Point {i}</label>
                <input
                  type="text"
                  name={`point${i}`}
                  value={formData[`point${i}`] || ''}
                  onChange={handleChange}
                  placeholder={`Point ${i}`}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
        </div>

        {/* STANDARD ROUTE */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            STANDARD ROUTE
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Standard Route No</label>
              <input
                type="text"
                name="standard_route_no"
                value={formData.standard_route_no}
                onChange={handleChange}
                placeholder="e.g., RT001"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Route KM</label>
              <input
                type="text"
                name="route_km"
                value={formData.route_km}
                onChange={handleChange}
                placeholder="e.g., 250"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* FINANCIAL CHARGES */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            FINANCIAL CHARGES
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Unloading Charge Per Point</label>
              <input
                type="text"
                name="unloading_charge_per_point"
                value={formData.unloading_charge_per_point}
                onChange={handleChange}
                placeholder="e.g., 500"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Fuel Charge</label>
              <input
                type="text"
                name="fuel_charge"
                value={formData.fuel_charge}
                onChange={handleChange}
                placeholder="e.g., 15"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* MAINTENANCE */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            MAINTENANCE
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Maintenance Date</label>
              <input
                type="date"
                name="maintenance_date"
                value={formData.maintenance_date}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Vehicle Document</label>
              <input
                type="text"
                name="vehicle_document"
                value={formData.vehicle_document}
                onChange={handleChange}
                placeholder="e.g., RC1234"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* NOTES */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', textTransform: 'uppercase' }}>
            ADDITIONAL NOTES
          </h3>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Any additional notes..."
            style={{
              ...inputStyle,
              minHeight: '80px',
              resize: 'vertical'
            }}
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #eeeeee' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#cccccc',
              color: '#000000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#bbbbbb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#cccccc'}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '10px 24px',
              backgroundColor: '#0066cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
          >
            {vehicle ? '💾 Update Vehicle' : '➕ Create Vehicle'}
          </button>
        </div>
      </form>
    </div>
  );
}
