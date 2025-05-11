import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Settings, Key } from 'lucide-react';

function Dashboard() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    // Prevent going back
    window.history.pushState(null, null, window.location.pathname);
    const handlePopState = () => {
      window.history.pushState(null, null, window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);

    // Cleanup listener when component unmounts
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('http://147.93.110.150:3001/api/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username })
      });

      if (response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        navigate('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    try {
      const response = await fetch('http://147.93.110.150:3001/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess('Password changed successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Network error occurred');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Welcome to Dashboard</h1>
        <div>
          <span style={{ marginRight: '1rem' }}>Welcome, {username}!</span>
          <button onClick={handleLogout} className="login-btn" style={{ padding: '0.5rem 1rem' }}>
            Logout
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem', 
        marginBottom: '2rem' 
      }}>
        <div className="dashboard-card" style={{ 
          background: '#fff', 
          padding: '1.5rem', 
          borderRadius: '0.5rem', 
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease'
        }} onClick={() => navigate('/clients')}>
          <h3 style={{ marginBottom: '1rem', color: '#2563eb' }}>Clients Management</h3>
          <p>View and manage client licenses, expiry dates, and status</p>
        </div>
        
        {/* Add more dashboard cards here for other features */}
      </div>

      <div className="settings-section">
        <button 
          onClick={() => setShowChangePassword(!showChangePassword)}
          className="settings-button"
        >
          {showChangePassword ? 'Hide Password Settings' : 'Change Password'}
        </button>

        {showChangePassword && (
          <div className="password-form-container">
            <form onSubmit={handleChangePassword} className="password-form">
              <h3>Change Password</h3>
              {passwordError && <div className="error-message">{passwordError}</div>}
              {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}
              
              <div className="form-group">
                <label>Current Password:</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({
                    ...passwordData,
                    currentPassword: e.target.value
                  })}
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password:</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({
                    ...passwordData,
                    newPassword: e.target.value
                  })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password:</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({
                    ...passwordData,
                    confirmPassword: e.target.value
                  })}
                  required
                />
              </div>

              <button type="submit" className="submit-button">
                Update Password
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;