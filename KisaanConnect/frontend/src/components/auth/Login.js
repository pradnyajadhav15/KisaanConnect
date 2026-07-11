import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../../services/authService';
import * as authApi from '../../services/api/authApi';
import '../../styles/auth/Auth.css';

// --------------------------------------------------
// ERROR PARSER
// --------------------------------------------------
const parseError = (err) => {
  if (typeof err === 'string') return err;

  if (err instanceof Error) {
    const msg = err.message;
    try {
      const parsed = JSON.parse(msg);
      if (parsed.detail) return parsed.detail;
      if (parsed.msg)    return parsed.msg;
    } catch {
      return msg || 'An error occurred';
    }
  }

  if (err?.detail) return err.detail;

  return 'Invalid username or password. Please try again.';
};


// --------------------------------------------------
// COMPONENT
// --------------------------------------------------
const Login = () => {
  // role removed from login — the server is the source of truth for role
  const [formData, setFormData]       = useState({ username: '', password: '' });
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(''); // clear error on input
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.username.trim()) return setError('Username is required');
    if (!formData.password)        return setError('Password is required');

    setLoading(true);
    try {
      const response = await authApi.loginUser(formData);

      // Trust the role the SERVER returns, never a client-side selection.
      const actualRole = response.role;

      loginUser(
        {
          username: response.username ?? formData.username,
          role:     actualRole,
          id:       response.id ?? response.user_id ?? null,
        },
        response.access_token || response.token
      );

      navigate(actualRole === 'farmer' ? '/farmer' : '/consumer', { replace: true });

    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login to KisaanConnect</h2>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              disabled={loading}
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                disabled={loading}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(prev => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;