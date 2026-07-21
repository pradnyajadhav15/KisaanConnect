'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { loginUser as saveSession } from '../../lib/authService';
import * as authApi from '../../lib/authApi';

const parseError = (err) => {
  if (typeof err === 'string') return err;
  if (err instanceof Error) {
    const msg = err.message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed.detail) return parsed.detail;
      if (parsed.msg) return parsed.msg;
    } catch {
      return msg || 'An error occurred';
    }
  }
  return 'Invalid username or password. Please try again.';
};

export default function LoginPage() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.username.trim()) return setError('Username is required');
    if (!formData.password) return setError('Password is required');

    setLoading(true);
    try {
      const response = await authApi.loginUser(formData);
      const actualRole = response.role;

      saveSession(
        {
          username: response.username || formData.username,
          role: actualRole,
          id: response.id || response.user_id || null,
        },
        response.access_token || response.token
      );

      router.push(actualRole === 'farmer' ? '/farmer' : actualRole === 'admin' ? '/admin' : '/consumer');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '48px auto', padding: 24, border: '1px solid #e0e0e0', borderRadius: 8 }}>
      <h2>Login to KisaanConnect</h2>

      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: 10, borderRadius: 6, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="username" style={{ display: 'block', marginBottom: 6 }}>Username</label>
          <input
            type="text" id="username" name="username"
            value={formData.username} onChange={handleChange}
            placeholder="Enter your username" disabled={loading}
            autoComplete="username" required
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={{ display: 'block', marginBottom: 6 }}>Password</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password" name="password"
              value={formData.password} onChange={handleChange}
              placeholder="Enter your password" disabled={loading}
              autoComplete="current-password" required
              style={{ flex: 1, padding: 8, boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          style={{ width: '100%', padding: 10, background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Don't have an account? <Link href="/register">Register</Link>
      </p>
    </div>
  );
}
