"use client";

import React, { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import '../styles/Navbar.css';
import LanguageTranslator from './LanguageTranslator';
import {
  isAuthenticated, getCurrentUser, logoutUser,
  hasRole, AUTH_EVENT
} from '../services/authService';

// The login lives in localStorage; re-read it whenever it changes (this tab or another).
function subscribeToAuth(onChange) {
  window.addEventListener('storage', onChange);
  window.addEventListener(AUTH_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(AUTH_EVENT, onChange);
  };
}
const readAuth = () => (isAuthenticated() ? JSON.stringify(getCurrentUser()) : '');

const Navbar = () => {
  const authSnapshot = useSyncExternalStore(subscribeToAuth, readAuth, () => '');
  const authenticated = authSnapshot !== '';
  const user = useMemo(() => (authSnapshot ? JSON.parse(authSnapshot) : null), [authSnapshot]);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [logoOk,        setLogoOk]        = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Close the mobile menu when the page changes.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  const handleLogout = useCallback(() => {
    logoutUser();
    setMenuOpen(false);
    router.push('/');
  }, [router]);

  const dashboardLink = authenticated
    ? hasRole('farmer')
      ? { to: '/farmer',   label: 'Farmer Dashboard'   }
      : { to: '/consumer', label: 'Consumer Dashboard'  }
    : null;

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-container">
        <div className="logo-container">
          <Link href="/" aria-label="KisaanConnect Home">
            {logoOk ? (
              <img
                src="/images/logo-icon.png"
                alt=""
                className="logo"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span className="logo-mark" aria-hidden="true">K</span>
            )}
            <h1 className="brand-name">KisaanConnect</h1>
          </Link>
        </div>

        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(p => !p)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span /><span /><span />
        </button>

        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {dashboardLink && (
            <Link href={dashboardLink.to} className="nav-link">
              {dashboardLink.label}
            </Link>
          )}
          {!authenticated && (
            <>
              <Link href="/farmer"   className="nav-link">Farmer</Link>
              <Link href="/consumer" className="nav-link">Consumer</Link>
            </>
          )}
          <Link href="/adopt-farm" className="nav-link adopt-farm-link">Adopt a Farm</Link>
          <Link href="/ngo"        className="nav-link">NGO Support</Link>
        </div>

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
                <Link href="/login">
                  <button className="login-button">Log in</button>
                </Link>
                <Link href="/register">
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