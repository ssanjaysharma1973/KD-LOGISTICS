import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://kd-logistics-production.up.railway.app';

export default function BillingDashboard() {
  const [billings, setBillings] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    client_id: '',
    description: '',
    amount: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'pending',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch billings
      const billingRes = await fetch(`${API_BASE}/api/billings/list`);
      const billingData = await billingRes.json();
      setBillings(billingData.billings || generateDummyBillings());

      // Fetch clients
      const clientRes = await fetch(`${API_BASE}/api/clients`);
      const clientData = await clientRes.json();
      setClients(clientData.clients || []);

      setError(null);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setBillings(generateDummyBillings());
    } finally {
      setLoading(false);
    }
  };

  const generateDummyBillings = () => {
    return [
      { id: 1, client_id: 2, description: 'Monthly Transport Charges - March', amount: 50000, invoice_date: '2024-03-01', due_date: '2024-03-15', payment_date: '2024-03-14', status: 'paid', trips: 12 },
      { id: 2, client_id: 3, description: 'Monthly Transport Charges - March', amount: 35000, invoice_date: '2024-03-01', due_date: '2024-03-15', payment_date: null, status: 'pending', trips: 8 },
      { id: 3, client_id: 4, description: 'Monthly Transport Charges - March', amount: 45000, invoice_date: '2024-03-01', due_date: '2024-03-15', payment_date: null, status: 'overdue', trips: 10 },
      { id: 4, client_id: 2, description: 'Additional Charges - Special Handling', amount: 5000, invoice_date: '2024-03-10', due_date: '2024-03-20', payment_date: '2024-03-19', status: 'paid', trips: 2 },
      { id: 5, client_id: 5, description: 'Monthly Transport Charges - March', amount: 28000, invoice_date: '2024-03-01', due_date: '2024-03-15', payment_date: null, status: 'pending', trips: 6 },
      { id: 6, client_id: 3, description: 'Fuel Surcharge', amount: 8000, invoice_date: '2024-03-15', due_date: '2024-03-25', payment_date: null, status: 'pending', trips: 1 },
    ];
  };

  const handleAddBilling = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/billings/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();

      if (data.success) {
        setBillings([...billings, data.billing]);
        setFormData({
          client_id: '',
          description: '',
          amount: '',
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: '',
          status: 'pending',
        });
        setShowAddForm(false);
      } else {
        setError(data.message || 'Failed to create billing');
      }
    } catch (err) {
      setError('Error creating billing: ' + err.message);
    }
  };

  const handleMarkPaid = async (billingId) => {
    try {
      const res = await fetch(`${API_BASE}/api/billings/${billingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', payment_date: new Date().toISOString() }),
      });
      const data = await res.json();

      if (data.success) {
        setBillings(billings.map(b => b.id === billingId ? { ...b, status: 'paid', payment_date: new Date().toLocaleDateString() } : b));
      }
    } catch (err) {
      setError('Failed to mark payment');
    }
  };

  const filteredBillings = billings.filter(b => {
    const client = clients.find(c => c.id === b.client_id);
    const matchesClient = selectedClient === 'all' || b.client_id === parseInt(selectedClient);
    const matchesSearch = (client?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         b.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = paymentStatus === 'all' || b.status === paymentStatus;
    return matchesClient && matchesSearch && matchesStatus;
  });

  const stats = {
    total: billings.length,
    paid: billings.filter(b => b.status === 'paid').length,
    pending: billings.filter(b => b.status === 'pending').length,
    overdue: billings.filter(b => b.status === 'overdue').length,
    totalRevenue: billings.reduce((sum, b) => sum + (b.amount || 0), 0),
    paidRevenue: billings.filter(b => b.status === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0),
    pendingRevenue: billings.filter(b => b.status !== 'paid').reduce((sum, b) => sum + (b.amount || 0), 0),
  };

  const getClientName = (clientId) => clients.find(c => c.id === clientId)?.name || 'N/A';

  const getStatusStyles = (status) => {
    switch(status) {
      case 'paid':
        return { bg: '#d1fae5', text: '#065f46', icon: '✅', label: 'Paid' };
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e', icon: '⏳', label: 'Pending' };
      case 'overdue':
        return { bg: '#fee2e2', text: '#991b1b', icon: '⚠️', label: 'Overdue' };
      default:
        return { bg: '#f1f5f9', text: '#334155', icon: '❓', label: status };
    }
  };

  return (
    <div style={{
      padding: '20px',
      background: '#f8fafc',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h2 style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#1e293b',
            margin: '0 0 4px 0',
          }}>
            💰 Billing & Revenue
          </h2>
          <p style={{
            fontSize: 12,
            color: '#64748b',
            margin: 0,
          }}>
            Invoice and payment management
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            background: '#10b981',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseOver={(e) => e.target.style.background = '#059669'}
          onMouseOut={(e) => e.target.style.background = '#10b981'}
        >
          ➕ Create Invoice
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px',
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: 6,
          color: '#991b1b',
          marginBottom: 16,
          fontSize: 12,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Add Billing Form */}
      {showAddForm && (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1e293b',
            margin: '0 0 12px 0',
          }}>
            ➕ Create Invoice
          </h3>
          <form onSubmit={handleAddBilling} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Client
              </label>
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              >
                <option value="">Select client</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Invoice description"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Amount (₹)
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0"
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 12,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <button type="submit" style={{ flex: 1, padding: '8px 14px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Create
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ flex: 1, padding: '8px 14px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Revenue Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #10b98115 0%, #10b98105 100%)',
          border: '1px solid #10b98130',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Revenue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
            ₹{(stats.totalRevenue / 100000).toFixed(1)}L
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>From {stats.total} invoices</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #10b98115 0%, #10b98105 100%)',
          border: '1px solid #10b98130',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Paid Revenue</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
            ₹{(stats.paidRevenue / 100000).toFixed(1)}L
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stats.paid} invoices paid</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f5940e15 0%, #f5940e05 100%)',
          border: '1px solid #f5940e30',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Pending Amount</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>
            ₹{(stats.pendingRevenue / 100000).toFixed(1)}L
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stats.pending + stats.overdue} outstanding</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #ef444415 0%, #ef444405 100%)',
          border: '1px solid #ef444430',
          borderRadius: 12,
          padding: 16,
        }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Overdue Amount</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444' }}>
            ₹{(billings.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.amount, 0) / 100000).toFixed(1)}L
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{stats.overdue} overdue invoices</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Search client or invoice..."
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 12,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            minWidth: 150,
          }}
        >
          <option value="all">All Clients</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            fontSize: 12,
            minWidth: 140,
          }}
        >
          <option value="all">All Status</option>
          <option value="paid">✅ Paid</option>
          <option value="pending">⏳ Pending</option>
          <option value="overdue">⚠️ Overdue</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Loading invoices...
          </div>
        ) : filteredBillings.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            No invoices found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Client</th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Description</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Amount</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Due Date</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderRight: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#64748b' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredBillings.map((billing, idx) => {
                  const styles = getStatusStyles(billing.status);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                        {getClientName(billing.client_id)}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', borderRight: '1px solid #e2e8f0' }}>
                        {billing.description}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#1e293b', borderRight: '1px solid #e2e8f0' }}>
                        ₹{billing.amount.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b', borderRight: '1px solid #e2e8f0', fontSize: 11 }}>
                        {new Date(billing.due_date).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', borderRight: '1px solid #e2e8f0' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 10,
                          fontWeight: 600,
                          background: styles.bg,
                          color: styles.text,
                        }}>
                          {styles.icon} {styles.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {billing.status === 'pending' || billing.status === 'overdue' ? (
                          <button
                            onClick={() => handleMarkPaid(billing.id)}
                            style={{
                              padding: '4px 8px',
                              background: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Mark Paid
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>✅ Paid</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
