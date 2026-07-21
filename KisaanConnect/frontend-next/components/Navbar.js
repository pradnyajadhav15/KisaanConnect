'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { isAuthenticated, getCurrentUser, logoutUser, hasRole, AUTH_EVENT } from '../lib/authService';
import './Navbar.css';

export default function Navbar() {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const checkAuth = useCallback(() => {
    const auth = isAuthenticated();
    setAuthenticated(auth);
    setUser(auth ? getCurrentUser() : null);
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener('storage', checkAuth);
    window.addEventListener(AUTH_EVENT, checkAuth);
    return () => {
      window.removeEventListener('storage', checkAuth);
      window.removeEventListener(AUTH_EVENT, checkAuth);
    };
  }, [checkAuth]);

  const handleLogout = useCallback(() => {
    logoutUser();
    setMenuOpen(false);
    router.push('/');
  }, [router]);

  const dashboardLink = authenticated
    ? hasRole('farmer')
      ? { to: '/farmer', label: 'Farmer Dashboard' }
      : hasRole('admin')
        ? { to: '/admin', label: 'Admin Dashboard' }
        : { to: '/consumer', label: 'Consumer Dashboard' }
    : null;

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar-container">

        <div className="logo-container">
          <Link href="/" aria-label="KisaanConnect Home">
            <img
              src="/images/logo.png"
              alt="KisaanConnect Logo"
              className="logo"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <h1 className="brand-name">KisaanConnect</h1>
          </Link>
        </div>

        <button
          className={'hamburger' + (menuOpen ? ' open' : '')}
          onClick={() => setMenuOpen((p) => !p)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation menu"
        >
          <span /><span /><span />
        </button>

        <div className={'nav-links' + (menuOpen ? ' open' : '')}>
          {dashboardLink && (
            <Link href={dashboardLink.to} className="nav-link">
              {dashboardLink.label}
            </Link>
          )}
          {!authenticated && (
            <>
              <Link href="/farmer" className="nav-link">Farmer Dashboard</Link>
              <Link href="/consumer" className="nav-link">Consumer Dashboard</Link>
            </>
          )}
          <Link href="/marketplace" className="nav-link">Marketplace</Link>
        </div>

        <div className={'auth-buttons-container' + (menuOpen ? ' open' : '')}>
          <div className="auth-buttons">
            {authenticated ? (
              <>
                <span className="welcome-text">
                  {'Welcome, ' + (user ? user.username : '') + '!'}
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
}
