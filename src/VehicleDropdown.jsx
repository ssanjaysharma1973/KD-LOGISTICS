import React, { useState } from 'react';
import { Edit2, Trash2, ChevronDown } from 'lucide-react';

export default function VehicleDropdown({ vehicles, onSelect, onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const handleSelectVehicle = (vehicle) => {
    setSelectedVehicle(vehicle);
    onSelect(vehicle);
    setIsOpen(false);
  };

  return (
    <div style={{position: 'relative', width: '100%', maxWidth: '400px'}}>
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '12px 16px',
          border: '1px solid #cccccc',
          borderRadius: '6px',
          backgroundColor: '#ffffff',
          color: '#000000',
          fontSize: '14px',
          fontWeight: '500',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onMouseEnter={(e) => e.target.style.borderColor = '#0066cc'}
        onMouseLeave={(e) => e.target.style.borderColor = '#cccccc'}
      >
        <span>
          {selectedVehicle 
            ? `🚗 ${selectedVehicle.vehicle_no}` 
            : '🚗 Select Vehicle...'}
        </span>
        <ChevronDown 
          size={18} 
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#ffffff',
            border: '1px solid #cccccc',
            borderRadius: '6px',
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          {vehicles.length === 0 ? (
            <div style={{padding: '16px 12px', textAlign: 'center', color: '#999999', fontSize: '13px'}}>
              No vehicles available
            </div>
          ) : (
            vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #eeeeee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div 
                  onClick={() => handleSelectVehicle(vehicle)}
                  style={{flex: 1, cursor: 'pointer'}}
                >
                  <div style={{fontSize: '13px', fontWeight: '600', color: '#000000'}}>
                    {vehicle.vehicle_no}
                  </div>
                  <div style={{fontSize: '12px', color: '#666666', marginTop: '2px'}}>
                    {vehicle.driver_name} • {vehicle.route_from} → {vehicle.route_to}
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{display: 'flex', gap: '8px', marginLeft: '12px'}}>
                  <button
                    onClick={() => {
                      onEdit(vehicle);
                      setIsOpen(false);
                    }}
                    style={{
                      backgroundColor: '#e0e8ff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      color: '#0066cc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Edit vehicle"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete vehicle ${vehicle.vehicle_no}?`)) {
                        onDelete(vehicle.id, vehicle.vehicle_no);
                        setIsOpen(false);
                        if (selectedVehicle?.id === vehicle.id) {
                          setSelectedVehicle(null);
                        }
                      }
                    }}
                    style={{
                      backgroundColor: '#ffe0e0',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 8px',
                      cursor: 'pointer',
                      color: '#cc0000',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Delete vehicle"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected Vehicle Details */}
      {selectedVehicle && (
        <div style={{marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '12px', color: '#000000'}}>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
            <div>
              <span style={{fontWeight: '600'}}>Vehicle:</span> {selectedVehicle.vehicle_no}
            </div>
            <div>
              <span style={{fontWeight: '600'}}>Driver:</span> {selectedVehicle.driver_name}
            </div>
            <div>
              <span style={{fontWeight: '600'}}>Route:</span> {selectedVehicle.route_from} → {selectedVehicle.route_to}
            </div>
            {selectedVehicle.standard_route_no && (
              <div>
                <span style={{fontWeight: '600'}}>Route No:</span> {selectedVehicle.standard_route_no}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
