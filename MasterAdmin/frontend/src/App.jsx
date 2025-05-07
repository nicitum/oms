import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import logo from './assets/logo_1.png';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="app-bg" style={{ minHeight: '100vh', width: '100vw', display: 'flex', position: 'relative' }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 2vw',
        background: 'linear-gradient(135deg, #0d1b3f 0%, #233a7d 100%)',
      }}>
        <img src={logo} alt="Order Appu Management Panel" style={{ maxWidth: 220, width: '100%', borderRadius: '1.5rem', boxShadow: '0 4px 24px 0 rgba(31, 38, 135, 0.10)', marginBottom: '2rem', background: '#fff', padding: '1rem' }} />
        <h2 style={{ color: '#fff', fontWeight: 800, fontSize: '1.7rem', textAlign: 'center', letterSpacing: '1px', textShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          Order Appu Management Panel
        </h2>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: '100vh' }}>
        <div className="login-container" style={{ marginRight: '6vw', marginLeft: 0, padding: '3.5rem 2.5rem' }}>
          <div className="login-logo">
            MA
          </div>
          <h1 className="login-title">Master Admin Login</h1>
          <p className="login-desc">Sign in to access your admin dashboard</p>
          {error && <div style={{ color: '#ef5350', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Username"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="login-btn"
            >
              Login
            </button>
          </form>
          <div className="login-footer">&copy; {new Date().getFullYear()} Master Admin Panel</div>
        </div>
      </div>
      <div style={{
        position: 'fixed',
        left: 18,
        bottom: 12,
        textAlign: 'left',
        color: '#ffff',
        fontSize: '1.05rem',
        letterSpacing: '0.5px',
        zIndex: 100,
        pointerEvents: 'none',
        userSelect: 'none',
        fontWeight: 600,
        textShadow: '0 1px 6px rgba(31,38,135,0.10)'
      }}>
        @Powered by Nicitum Technologies
      </div>
    </div>
  );
}

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/clients" 
          element={
            <ProtectedRoute>
              <Clients />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;