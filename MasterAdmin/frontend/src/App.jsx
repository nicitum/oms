import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import logo from './assets/logo_1.png';
import Dashboard from './components/Dashboard';
import Clients from './components/Clients';
import { FiAlertCircle } from 'react-icons/fi';

function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://147.93.110.150:3001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        navigate('/dashboard');
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (error) {
      setError('Network error. Please try again later.');
    } finally {
      setIsLoading(false);
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
        background: 'linear-gradient(135deg, #0a2540 0%, #1a4980 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 50%)',
          pointerEvents: 'none'
        }} />
        <img 
          src={logo} 
          alt="Order Appu Management Panel" 
          style={{ 
            maxWidth: 240, 
            width: '100%', 
            borderRadius: '24px', 
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)', 
            marginBottom: '2rem', 
            background: '#fff', 
            padding: '1.5rem',
            transform: isAnimating ? 'translateY(20px)' : 'translateY(0)',
            opacity: isAnimating ? 0 : 1,
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
          }} 
        />
        <h2 style={{ 
          color: '#fff', 
          fontWeight: 800, 
          fontSize: '2rem', 
          textAlign: 'center', 
          letterSpacing: '1px', 
          textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          transform: isAnimating ? 'translateY(20px)' : 'translateY(0)',
          opacity: isAnimating ? 0 : 1,
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s'
        }}>
          Order Appu Management Panel
        </h2>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minHeight: '100vh' }}>
        <div className="login-container" style={{ marginRight: '6vw', marginLeft: 0 }}>
          <div className="login-logo">
            MA
          </div>
          <h1 className="login-title">Master Admin Login</h1>
          <p className="login-desc">Sign in to access your admin dashboard</p>
          {error && (
            <div className="error-message">
              <FiAlertCircle size={18} />
              {error}
            </div>
          )}
          <form className="login-form" onSubmit={handleSubmit}>
            <input
              type="text"
              name="username"
              placeholder="Username"
              className="login-input"
              value={formData.username}
              onChange={handleChange}
              disabled={isLoading}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              className="login-input"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              required
            />
            <button
              type="submit"
              className="login-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  Signing in<span className="spinner" />
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
          <div className="login-footer">&copy; {new Date().getFullYear()} Master Admin Panel</div>
        </div>
      </div>
      <div style={{
        position: 'fixed',
        left: 24,
        bottom: 24,
        textAlign: 'left',
        color: '#fff',
        fontSize: '1rem',
        letterSpacing: '0.5px',
        zIndex: 100,
        pointerEvents: 'none',
        userSelect: 'none',
        fontWeight: 500,
        opacity: 0.9,
        transform: isAnimating ? 'translateY(20px)' : 'translateY(0)',
        opacity: isAnimating ? 0 : 0.9,
        transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s'
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