import React, { useState } from 'react';
import { User, Briefcase, LogOut } from 'lucide-react';
import FuelAdvanceRequestForm from './FuelAdvanceRequestForm';
import FuelApprovalDashboard from './FuelApprovalDashboard';
import FuelBillUpload from './FuelBillUpload';
import FuelHistoryView from './FuelHistoryView';

/**
 * Main Fuel Management Page
 * Multi-role interface for drivers, munshi, and finance
 */
const FuelManagementPage = ({ userRole = 'driver', userId, clientId, tripId }) => {
  const [activeSection, setActiveSection] = useState(
    userRole === 'munshi' ? 'approvals' : 'request'
  );
  const [selectedTrip, setSelectedTrip] = useState(tripId);

  // Role-based navigation
  const getNavMenu = () => {
    if (userRole === 'munshi' || userRole === 'finance') {
      return [
        { id: 'approvals', label: '⚡ Approvals', icon: '✓' },
        { id: 'history', label: '📊 All History', icon: '📋' },
      ];
    }
    return [
      { id: 'request', label: '🛢️ Request Advance', icon: '➕' },
      { id: 'upload', label: '📋 Upload Bill', icon: '📸' },
      { id: 'history', label: '📊 My History', icon: '📈' },
    ];
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f3f4f6'
    }}>
      {/* Sidebar */}
      <div style={{
        width: 260,
        backgroundColor: 'white',
        borderRight: '1px solid #e5e7eb',
        padding: 20,
        overflowY: 'auto',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#7c3aed',
            margin: 0,
            marginBottom: 4
          }}>
            KD
          </h1>
          <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
            Logistics Fuel Control
          </p>
        </div>

        {/* User Info */}
        <div style={{
          backgroundColor: '#f9fafb',
          borderRadius: 8,
          padding: 12,
          marginBottom: 24,
          borderLeft: '3px solid #7c3aed'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8
          }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: '#ede9fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {userRole === 'driver' ? (
                <User size={16} color="#7c3aed" />
              ) : (
                <Briefcase size={16} color="#7c3aed" />
              )}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>
                {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                ID: {userId}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 12
          }}>
            Menu
          </div>

          {getNavMenu().map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: activeSection === item.id ? '#ede9fe' : 'transparent',
                border: 'none',
                borderLeft: activeSection === item.id ? '3px solid #7c3aed' : '3px solid transparent',
                borderRadius: 6,
                color: activeSection === item.id ? '#7c3aed' : '#6b7280',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                marginBottom: 6,
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                if (activeSection !== item.id) {
                  e.target.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseOut={(e) => {
                if (activeSection !== item.id) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <button style={{
          width: '100%',
          padding: '10px 12px',
          backgroundColor: 'transparent',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          color: '#6b7280',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 'auto'
        }}>
          <LogOut size={14} />
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 32
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#111',
            margin: 0,
            marginBottom: 8
          }}>
            Fuel Control System
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            Manage fuel advances, approvals, and transactions
          </p>
        </div>

        {/* Content Area */}
        <div style={{
          maxWidth: 1200,
          margin: '0 auto'
        }}>
          {/* Driver: Request Fuel */}
          {userRole === 'driver' && activeSection === 'request' && (
            <div>
              {selectedTrip ? (
                <FuelAdvanceRequestForm
                  tripId={selectedTrip}
                  driverId={userId}
                  onRequestSubmitted={() => setActiveSection('history')}
                />
              ) : (
                <div style={{
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  borderRadius: 8,
                  padding: 20,
                  textAlign: 'center'
                }}>
                  <p style={{ color: '#7f1d1d', fontWeight: 600 }}>
                    Select a trip first
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Driver: Upload Bill */}
          {userRole === 'driver' && activeSection === 'upload' && (
            <FuelBillUpload
              tripId={selectedTrip}
              driverId={userId}
              onBillUploaded={() => setActiveSection('history')}
            />
          )}

          {/* Driver: History */}
          {userRole === 'driver' && activeSection === 'history' && (
            <FuelHistoryView
              driverId={userId}
              clientId={clientId}
            />
          )}

          {/* Munshi/Finance: Approvals */}
          {(userRole === 'munshi' || userRole === 'finance') && activeSection === 'approvals' && (
            <FuelApprovalDashboard
              userRole={userRole}
              clientId={clientId}
            />
          )}

          {/* Munshi/Finance: All History */}
          {(userRole === 'munshi' || userRole === 'finance') && activeSection === 'history' && (
            <div style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 20,
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <p>Comprehensive fuel history report - Coming soon</p>
              <p style={{ fontSize: 12 }}>
                Will include: All advances, approvals, transactions, variance reports, recovery tracking
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FuelManagementPage;
