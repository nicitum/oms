import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_OPTIONS = ['Active', 'Banned', 'Hold'];

const getStatusWithExpiry = (client) => {
  if (!client.expiry_date) return client.status || '';
  
  const today = new Date();
  const expiryDate = new Date(client.expiry_date);
  const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return 'Expired';
  } else if (diffDays <= 1) {
    return 'About to Expire';
  }
  return client.status || '';
};

const StatusBadge = ({ status }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'Active':
        return { backgroundColor: '#10B981', animation: 'none' };
      case 'Banned':
        return { backgroundColor: '#EF4444', animation: 'none' };
      case 'Hold':
        return { backgroundColor: '#F59E0B', animation: 'none' };
      case 'Expired':
        return { 
          backgroundColor: '#991B1B',
          animation: 'pulse 2s infinite'
        };
      case 'About to Expire':
        return { 
          backgroundColor: '#DC2626',
          animation: 'bounce 1s infinite'
        };
      default:
        return { backgroundColor: '#6B7280', animation: 'none' };
    }
  };

  return (
    <span style={{
      ...styles.statusBadge,
      ...getStatusStyle()
    }}>
      {status}
    </span>
  );
};

// Placeholder Logout component (replace with actual implementation if available)
const Logout = ({ onLogout }) => {
  return (
    <button onClick={onLogout} style={styles.logoutButton}>
      Logout
    </button>
  );
};

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    license_no: '',
    issue_date: today,
    expiry_date: '',
    status: '',
    duration: '',
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch('http://147.93.110.150:3001/api/clients', {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setClients(data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setShowForm(false);
    setIsEditMode(false);
  };

  const handleAddClientClick = () => {
    setSelectedClient(null);
    setShowForm(true);
    setIsEditMode(false);
    setFormData({
      client_id: '',
      client_name: '',
      license_no: '',
      issue_date: today,
      expiry_date: '',
      status: '',
      duration: '',
    });
  };

  const handleEditClientClick = () => {
    if (selectedClient) {
      setShowForm(true);
      setIsEditMode(true);
      setFormData({
        client_id: selectedClient.client_id,
        client_name: selectedClient.client_name,
        license_no: selectedClient.license_no,
        issue_date: today, // Always set to today
        expiry_date: '', // Will be calculated based on duration
        status: selectedClient.status || '',
        duration: selectedClient.duration,
      });
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let updatedForm = { ...formData, [name]: value };

    if (name === 'duration') {
      const duration = parseInt(value);
      if (!isNaN(duration) && duration > 0) {
        const issueDate = new Date(today);
        const expiryDate = new Date(issueDate);
        expiryDate.setDate(expiryDate.getDate() + duration);
        updatedForm.expiry_date = expiryDate.toISOString().split('T')[0];
        updatedForm.issue_date = today; // Ensure issue date stays as today
      } else {
        updatedForm.expiry_date = '';
      }
    }

    setFormData(updatedForm);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');

    // Validate form data
    if (!formData.client_name || !formData.license_no || !formData.duration) {
      alert('Please fill in all required fields (Client Name, License No, Duration).');
      return;
    }

    const url = isEditMode
      ? 'http://147.93.110.150:3001/api/update_client'
      : 'http://147.93.110.150:3001/api/add_client';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          status: formData.status || '',
          expiry_date: formData.expiry_date || null,
        }),
      });

      if (response.ok) {
        alert(isEditMode ? 'Client updated successfully!' : 'Client added successfully!');
        fetchClients();
        setShowForm(false);
        setIsEditMode(false);
        setSelectedClient(null);
      } else {
        const errorData = await response.json();
        alert(`Failed to ${isEditMode ? 'update' : 'add'} client: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'submitting'} form:`, error);
      alert(`Error ${isEditMode ? 'updating' : 'submitting'} form. Please try again.`);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    // Assuming username is stored in localStorage or can be derived from token
    const username = localStorage.getItem('username') || 'testuser'; // Replace with actual username retrieval

    try {
      const response = await fetch('http://147.93.110.150:3001/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      if (response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        alert('Logout successful!');
        // Redirect to login page (assuming there's a login route)
        window.location.href = '/';
      } else {
        alert('Failed to logout.');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error logging out. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div style={styles.page}>
      <div style={styles.leftPanel}>
        <div style={styles.headerSection}>
          <h1 style={styles.mainTitle}>CLIENT MANAGEMENT DASHBOARD</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            style={styles.dashboardButton}
          >
            Go to Dashboard
          </button>
        </div>
        {clients.map((client) => (
          <div
            key={client.client_id}
            onClick={() => handleSelectClient(client)}
            style={styles.clientItem}
          >
            {client.license_no}
          </div>
        ))}
        <button style={styles.addButton} onClick={handleAddClientClick}>
          + Add Client
        </button>
        <Logout onLogout={handleLogout} />
      </div>

      <div style={styles.rightPanel}>
        {selectedClient && (
          <div style={styles.detailsContainer}>
            <h2 style={styles.detailsTitle}>Client Information</h2>
            <div style={styles.detailsGrid}>
              <div style={styles.detailColumn}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Client Name</span>
                  <span style={styles.detailValue}>{selectedClient.client_name}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>License No</span>
                  <span style={styles.detailValue}>{selectedClient.license_no}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Issue Date</span>
                  <span style={styles.detailValue}>{formatDate(selectedClient.issue_date)}</span>
                </div>
              </div>
              <div style={styles.detailColumn}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Expiry Date</span>
                  <span style={styles.detailValue}>{formatDate(selectedClient.expiry_date)}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Duration</span>
                  <span style={styles.detailValue}>{selectedClient.duration} days</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Status</span>
                  <StatusBadge status={getStatusWithExpiry(selectedClient)} />
                </div>
              </div>
              <div style={styles.detailColumn}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Created At</span>
                  <span style={styles.detailValue}>{formatDate(selectedClient.created_at)}</span>
                </div>
                
                <div style={styles.detailAction}>
                  <button style={styles.editButton} onClick={handleEditClientClick}>
                    Edit Client
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div>
            <h2 style={styles.subtitle}>{isEditMode ? 'Edit Client' : 'Add New Client'}</h2>
            <form onSubmit={handleFormSubmit} style={styles.form}>
              <input
                type="text"
                name="client_name"
                placeholder="Client Name"
                value={formData.client_name}
                onChange={handleFormChange}
                style={styles.input}
                required
              />
              <input
                type="text"
                name="license_no"
                placeholder="License No"
                value={formData.license_no}
                onChange={handleFormChange}
                style={styles.input}
                required
              />
              <div style={styles.inputGroup}>
                <label style={styles.label}>Issue Date (Today)</label>
                <input
                  type="date"
                  name="issue_date"
                  value={today}
                  style={{ ...styles.input, backgroundColor: '#eee' }}
                  readOnly
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Duration (days)</label>
                <input
                  type="number"
                  name="duration"
                  placeholder="Enter duration in days"
                  value={formData.duration}
                  onChange={handleFormChange}
                  style={styles.input}
                  min="1"
                  required
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Expiry Date (Auto-calculated)</label>
                <input
                  type="date"
                  name="expiry_date"
                  value={formData.expiry_date}
                  style={{ ...styles.input, backgroundColor: '#eee' }}
                  readOnly
                />
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  style={styles.select}
                  required
                >
                  <option value="">Select Status</option>
                  {STATUS_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={styles.submitButton}>
                  {isEditMode ? 'Update' : 'Submit'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{ ...styles.submitButton, backgroundColor: '#ccc' }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  page: {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f0f4f8',
    fontFamily: 'Arial, sans-serif',
  },
  leftPanel: {
    width: '25%',
    backgroundColor: '#ffffff',
    padding: '20px',
    boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
    overflowY: 'auto',
  },
  rightPanel: {
    flex: 1,
    padding: '40px',
    backgroundColor: 'white',
    overflowY: 'auto',
  },
  mainTitle: {
    color: '#003366',
    fontSize: '26px',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '20px',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#003366',
    fontSize: '20px',
    marginBottom: '20px',
  },
  clientItem: {
    padding: '10px',
    borderBottom: '1px solid #ccc',
    cursor: 'pointer',
    color: '#003366',
  },
  addButton: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
  },
  editButton: {
    padding: '10px 20px',
    backgroundColor: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#004080',
      transform: 'translateY(-1px)',
    },
  },
  logoutButton: {
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#cc0000',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxWidth: '400px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500',
  },
  input: {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'border-color 0.2s ease',
    '&:focus': {
      borderColor: '#003366',
      outline: 'none',
    }
  },
  submitButton: {
    padding: '10px',
    backgroundColor: '#003366',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  detailsContainer: {
    backgroundColor: '#ffffff',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    border: '1px solid #eaeaea',
  },
  detailsTitle: {
    color: '#003366',
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '25px',
    borderBottom: '2px solid #003366',
    paddingBottom: '10px',
  },
  detailsGrid: {
    display: 'flex',
    gap: '40px',
    flexWrap: 'wrap',
  },
  detailColumn: {
    flex: '1 1 250px',
    minWidth: '250px',
  },
  detailItem: {
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#f1f5f9',
    },
  },
  detailLabel: {
    display: 'block',
    fontWeight: '600',
    color: '#64748b',
    fontSize: '13px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  detailValue: {
    display: 'block',
    color: '#1e293b',
    fontSize: '15px',
    fontWeight: '500',
  },
  detailAction: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'flex-start',
  },
  headerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '15px',
    marginBottom: '20px',
  },
  dashboardButton: {
    padding: '8px 16px',
    backgroundColor: '#1a4980',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    width: '100%',
    '&:hover': {
      backgroundColor: '#0a2540',
    },
  },
  statusBadge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '9999px',
    color: 'white',
    fontWeight: '500',
    fontSize: '14px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  select: {
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    width: '100%',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    '&:focus': {
      borderColor: '#003366',
      outline: 'none',
      boxShadow: '0 0 0 2px rgba(0,51,102,0.2)',
    }
  },
  '@keyframes pulse': {
    '0%, 100%': {
      opacity: 1,
    },
    '50%': {
      opacity: 0.5,
    }
  },
  '@keyframes bounce': {
    '0%, 100%': {
      transform: 'translateY(0)',
    },
    '50%': {
      transform: 'translateY(-3px)',
    }
  },
};

export default Clients;