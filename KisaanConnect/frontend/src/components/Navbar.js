import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';
import logo from '../assets/images/logo.png';
import LanguageTranslator from './LanguageTranslator';
import {
  isAuthenticated, getCurrentUser, logoutUser,
  hasRole, AUTH_EVENT
} from '../services/authService';

const Navbar = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [user,          setUser]          = useState(null);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location]);

  const checkAuth = useCallback(() => {
    const auth = isAuthenticated();
    setAuthenticated(auth);
    setUser(auth ? getCurrentUser() : null);
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener('storage',  checkAuth);
    window.addEventListener(AUTH_EVENT, checkAuth);
    return () => {
      window.removeEventListener('storage',  checkAuth);
      window.removeEventListener(AUTH_EVENT, checkAuth);
    };
  }, [checkAuth]);

  const handleLogout = useCallback(() => {
    logoutUser();
    setMenuOpen(false);
    navigate('/');
  }, [navigate]);

  // Show dashboard link based on role
  const dashboardLink = authenticated
    ? hasRole('farmer')
      ? { to: '/farmer',   label: 'Farmer Dashboard'   }
      : { to: '/consumer', label: 'Consumer Dashboard'  }
    : null;

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-container">

        {/* Logo */}
        <div className="logo-container">
          <Link to="/" aria-label="KisaanConnect Home">
            <img
              src={logo}
              alt="KisaanConnect Logo"
              className="logo"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <h1 className="brand-name">KisaanConnect</h1>
          </Link>
        </div>

        {/* Hamburger (mobile) */}
        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(p => !p)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span /><span /><span />
        </button>

        {/* Nav links */}
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {dashboardLink && (
            <Link to={dashboardLink.to} className="nav-link">
              {dashboardLink.label}
            </Link>
          )}
          {!authenticated && (
            <>
              <Link to="/farmer"   className="nav-link">Farmer Dashboard</Link>
              <Link to="/consumer" className="nav-link">Consumer Dashboard</Link>
            </>
          )}
          <Link to="/adopt-farm" className="nav-link adopt-farm-link">Adopt a Farm</Link>
          <Link to="/ngo"        className="nav-link">NGO Support</Link>
        </div>

        {/* Auth buttons */}
        <div className={`auth-buttons-container ${menuOpen ? 'open' : ''}`}>
          <div className="auth-buttons">
            <LanguageTranslator />

            {authenticated ? (
              <>
                <span className="welcome-text">
                  Welcome, {user?.username}!
                </span>
                <button className="logout-button" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <button className="login-button">Log in</button>
                </Link>
                <Link to="/register">
                  <button className="signup-button">Sign up</button>
                </Link>
              </>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;