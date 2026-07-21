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
  return 'Registration failed. Please try again.';
};

const validate = (data) => {
  const username = data.username;
  const password = data.password;
  const confirmPassword = data.confirmPassword;
  const role = data.role;
  const email = data.email;

  if (!username.trim()) return 'Username is required';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return 'Username can only contain letters, numbers, and underscores';
  if (!password) return 'Password is required';
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password !== confirmPassword) return 'Passwords do not match';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Please enter a valid email address';
  if (!role) return 'Please select a role (Farmer or Consumer)';
  return null;
};

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '', name: '', email: '',
    password: '', confirmPassword: '', role: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleRoleSelect = (role) => {
    setFormData((prev) => ({ ...prev, role }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate(formData);
    if (validationError) return setError(validationError);

    setLoading(true);
    try {
      const response = await authApi.registerUser({
        username: formData.username,
        password: formData.password,
        role: formData.role,
        name: formData.name || null,
        email: formData.email || null,
      });

      let token = response.access_token || response.token;
      let userId = response.id || response.user_id || null;
      let role = response.role || formData.role;

      if (!token) {
        const loginResponse = await authApi.loginUser({
          username: formData.username,
          password: formData.password,
        });
        token = loginResponse.access_token || loginResponse.token;
        userId = loginResponse.id || loginResponse.user_id || userId;
        role = loginResponse.role || role;
      }

      saveSession(
        { username: response.username || formData.username, role, id: userId },
        token
      );

      router.push(role === 'farmer' ? '/farmer' : role === 'admin' ? '/admin' : '/consumer');
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '48px auto', padding: 24, border: '1px solid #e0e0e0', borderRadius: 8 }}>
      <h2>Create KisaanConnect Account</h2>

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
            placeholder="Choose a username" disabled={loading} autoComplete="username" required
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: 6 }}>Full Name (optional)</label>
          <input
            type="text" id="name" name="name"
            value={formData.name} onChange={handleChange}
            placeholder="Your name" disabled={loading} autoComplete="name"
            style={{ width: '100%', padding: 8, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 6 }}>Email (optional)</label>
          <input
            type="email" id="email" name="email"
            value={formData.email} onChange={handleChange}
            placeholder="you@example.com" disabled={loading} autoComplete="email"
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
              placeholder="Min. 6 characters" disabled={loading} autoComplete="new-password" required
              style={{ flex: 1, padding: 8, boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShowPassword((p) => !p)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: 6 }}>Confirm Password</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              id="confirmPassword" name="confirmPassword"
              value={formData.confirmPassword} onChange={handleChange}
              placeholder="Confirm your password" disabled={loading} autoComplete="new-password" required
              style={{ flex: 1, padding: 8, boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShowConfirm((p) => !p)}>
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>I am a:</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['farmer', 'consumer'].map((r) => (
              <button
                key={r} type="button"
                onClick={() => handleRoleSelect(r)}
                disabled={loading}
                style={{
                  flex: 1, padding: 10,
                  background: formData.role === r ? '#2e7d32' : '#fff',
                  color: formData.role === r ? '#fff' : '#2e7d32',
                  border: '1px solid #2e7d32', borderRadius: 6, cursor: 'pointer',
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          style={{ width: '100%', padding: 10, background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Login</Link>
      </p>
    </div>
  );
}
