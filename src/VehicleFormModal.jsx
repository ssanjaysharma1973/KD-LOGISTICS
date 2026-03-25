import React, { useState } from 'react';
import { X } from 'lucide-react';

export default function VehicleFormModal({ vehicle, onClose, onSubmit }) {
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
      alert('Please fill in all required fields');
      return;
    }

    onSubmit(formData);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        overflowY: 'auto'
      }}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10000,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            backgroundColor: '#0066cc',
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <h2 style={{fontSize: '20px', fontWeight: 'bold', margin: 0}}>
            {vehicle ? '✏️ Edit Vehicle' : '🚗 Add Vehicle'}
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div style={{flex: 1, overflowY: 'auto', padding: '24px'}}>
          <form onSubmit={handleSubmit}>
            {/* ===== BASIC INFO ===== */}
            <fieldset style={{borderBottom: '2px solid #eeeeee', paddingBottom: '20px', marginBottom: '20px', border: 'none'}}>
              <legend style={{fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', display: 'block'}}>
                BASIC VEHICLE INFORMATION
              </legend>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Vehicle No <span style={{color: '#cc0000'}}>*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicle_no"
                    value={formData.vehicle_no}
                    onChange={handleChange}
                    placeholder="e.g., MH-02-AB-1234"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Driver Name <span style={{color: '#cc0000'}}>*</span>
                  </label>
                  <input
                    type="text"
                    name="driver_name"
                    value={formData.driver_name}
                    onChange={handleChange}
                    placeholder="e.g., John Doe"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </fieldset>

            {/* ===== ROUTE INFORMATION ===== */}
            <fieldset style={{borderBottom: '2px solid #eeeeee', paddingBottom: '20px', marginBottom: '20px', border: 'none'}}>
              <legend style={{fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', display: 'block'}}>
                ROUTE DETAILS
              </legend>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px'}}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Route From <span style={{color: '#cc0000'}}>*</span>
                  </label>
                  <input
                    type="text"
                    name="route_from"
                    value={formData.route_from}
                    onChange={handleChange}
                    placeholder="e.g., Delhi"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Route To <span style={{color: '#cc0000'}}>*</span>
                  </label>
                  <input
                    type="text"
                    name="route_to"
                    value={formData.route_to}
                    onChange={handleChange}
                    placeholder="e.g., Agra"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px'}}>
                {['point1', 'point2', 'point3', 'point4'].map((point, idx) => (
                  <div key={point}>
                    <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                      Point {idx + 1}
                    </label>
                    <input
                      type="text"
                      name={point}
                      value={formData[point]}
                      onChange={handleChange}
                      placeholder={`Point ${idx + 1}`}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #cccccc',
                        borderRadius: '6px',
                        fontSize: '13px',
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            {/* ===== STANDARD ROUTE ===== */}
            <fieldset style={{borderBottom: '2px solid #eeeeee', paddingBottom: '20px', marginBottom: '20px', border: 'none'}}>
              <legend style={{fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', display: 'block'}}>
                STANDARD ROUTE
              </legend>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Standard Route No
                  </label>
                  <input
                    type="text"
                    name="standard_route_no"
                    value={formData.standard_route_no}
                    onChange={handleChange}
                    placeholder="e.g., RT001"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Route KM
                  </label>
                  <input
                    type="number"
                    name="route_km"
                    value={formData.route_km}
                    onChange={handleChange}
                    placeholder="e.g., 250"
                    step="0.1"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </fieldset>

            {/* ===== FINANCIAL INFO ===== */}
            <fieldset style={{borderBottom: '2px solid #eeeeee', paddingBottom: '20px', marginBottom: '20px', border: 'none'}}>
              <legend style={{fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', display: 'block'}}>
                FINANCIAL CHARGES
              </legend>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Unloading Charge per Point (₹)
                  </label>
                  <input
                    type="number"
                    name="unloading_charge_per_point"
                    value={formData.unloading_charge_per_point}
                    onChange={handleChange}
                    placeholder="e.g., 500"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Fuel Charge (₹)
                  </label>
                  <input
                    type="number"
                    name="fuel_charge"
                    value={formData.fuel_charge}
                    onChange={handleChange}
                    placeholder="e.g., 1500"
                    step="0.01"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </fieldset>

            {/* ===== MAINTENANCE & DOCUMENTS ===== */}
            <fieldset style={{border: 'none'}}>
              <legend style={{fontSize: '14px', fontWeight: 'bold', color: '#0066cc', marginBottom: '12px', display: 'block'}}>
                MAINTENANCE & DOCUMENTS
              </legend>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px'}}>
                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Maintenance Date
                  </label>
                  <input
                    type="date"
                    name="maintenance_date"
                    value={formData.maintenance_date}
                    onChange={handleChange}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                    Vehicle Document Link
                  </label>
                  <input
                    type="text"
                    name="vehicle_document"
                    value={formData.vehicle_document}
                    onChange={handleChange}
                    placeholder="e.g., https://..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #cccccc',
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{fontSize: '13px', fontWeight: '600', color: '#000000', display: 'block', marginBottom: '6px'}}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Add any additional notes..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #cccccc',
                    borderRadius: '6px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    boxSizing: 'border-box',
                    minHeight: '80px',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </fieldset>

            {/* Action Buttons */}
            <div style={{display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end'}}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#eeeeee',
                  color: '#000000',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#dddddd'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#eeeeee'}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0066cc',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#0052a3'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#0066cc'}
              >
                {vehicle ? '✅ Update Vehicle' : '✅ Create Vehicle'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
