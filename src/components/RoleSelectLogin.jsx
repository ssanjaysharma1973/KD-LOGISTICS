import React, { useState } from 'react';
import './styles/RoleSelectLogin.css';

export default function RoleSelectLogin({ onSelectRole }) {
  const [selectedRole, setSelectedRole] = useState(null);

  const roles = [
    {
      id: 'driver',
      title: '🚗 Driver',
      description: 'Login with Client Code & select vehicle',
      color: '#10b981'
    },
    {
      id: 'munshi',
      title: '👨‍💼 Munshi',
      description: 'Login with Email & PIN',
      color: '#f59e0b'
    },
    {
      id: 'client',
      title: '🏢 Client',
      description: 'Login with Company ID & Password',
      color: '#8b5cf6'
    },
    {
      id: 'admin',
      title: '👨‍💻 Admin/DevAdmin',
      description: 'Login with Username & PIN or Password',
      color: '#3b82f6'
    }
  ];

  const handleSelectRole = (roleId) => {
    setSelectedRole(roleId);
    setTimeout(() => {
      onSelectRole(roleId);
    }, 300);
  };

  return (
    <div className="role-select-container">
      <div className="role-select-header">
        <div className="logo">🚚</div>
        <h1>Fleet Management Portal</h1>
        <p>Select your role to continue</p>
      </div>

      <div className="role-cards-grid">
        {roles.map((role) => (
          <button
            key={role.id}
            className={`role-card ${selectedRole === role.id ? 'active' : ''}`}
            style={{
              borderColor: selectedRole === role.id ? role.color : '#e5e7eb',
              backgroundColor: selectedRole === role.id ? `${role.color}15` : '#ffffff'
            }}
            onClick={() => handleSelectRole(role.id)}
          >
            <div className="role-card-title">{role.title}</div>
            <div className="role-card-description">{role.description}</div>
            <div 
              className="role-card-indicator" 
              style={{ backgroundColor: role.color }}
            />
          </button>
        ))}
      </div>

      <div className="role-select-footer">
        <p>🔒 Secure multi-role authentication system</p>
      </div>
    </div>
  );
}
