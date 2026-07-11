import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../../services/authService';
import * as authApi from '../../services/api/authApi';
import '../../styles/auth/Auth.css';

// --------------------------------------------------
// ERROR PARSER (same logic as Login)
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
  return 'Registration failed. Please try again.';
};

// --------------------------------------------------
// VALIDATION
// --------------------------------------------------
const validate = ({ username, password, confirmPassword, role, email }) => {
  if (!username.trim())      return 'Username is required';
  if (username.length < 3)   return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username))
                             return 'Username can only contain letters, numbers, and underscores';
  if (!password)             return 'Password is required';
  // Aligned with backend min_length=6 (frontend may stay stricter if you prefer)
  if (password.length < 6)   return 'Password must be at least 6 characters';
  if (password !== confirmPassword) return 'Passwords do not match';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                             return 'Please enter a valid email address';
  if (!role)                 return 'Please select a role (Farmer or Consumer)';
  return null;
};


// --------------------------------------------------
// COMPONENT
// --------------------------------------------------
const Register = () => {
  const [formData, setFormData] = useState({
    username: '', name: '', email: '',
    password: '', confirmPassword: '', role: ''
  });
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleRoleSelect = (role) => {
    setFormData(prev => ({ ...prev, role }));
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
        role:     formData.role,
        name:     formData.name || null,
        email:    formData.email || null,
      });

      let token  = response.access_token || response.token;
      let userId = response.id ?? response.user_id ?? null;
      let role   = response.role || formData.role;

      // Fallback: if register didn't return a token, log in to get one.
      if (!token) {
        const loginResponse = await authApi.loginUser({
          username: formData.username,
          password: formData.password,
        });
        token  = loginResponse.access_token || loginResponse.token;
        userId = loginResponse.id ?? loginResponse.user_id ?? userId;
        role   = loginResponse.role || role;
      }

      loginUser(
        { username: response.username ?? formData.username, role, id: userId },
        token
      );

      navigate(role === 'farmer' ? '/farmer' : '/consumer', { replace: true });

    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Create KisaanConnect Account</h2>

        {error && (
          <div className="auth-error" role="alert">{error}</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text" id="username" name="username"
              value={formData.username} onChange={handleChange}
              placeholder="Choose a username (letters, numbers, underscores)"
              disabled={loading} autoComplete="username" required
            />
            <small className="form-text">Min. 3 characters — letters, numbers, underscores only.</small>
          </div>

          <div className="form-group">
            <label htmlFor="name">Full Name <span className="optional">(optional)</span></label>
            <input
              type="text" id="name" name="name"
              value={formData.name} onChange={handleChange}
              placeholder="Your name"
              disabled={loading} autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email <span className="optional">(optional, for account recovery)</span></label>
            <input
              type="email" id="email" name="email"
              value={formData.email} onChange={handleChange}
              placeholder="you@example.com"
              disabled={loading} autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password" name="password"
                value={formData.password} onChange={handleChange}
                placeholder="Create a password (min. 6 characters)"
                disabled={loading} autoComplete="new-password" required
              />
              <button type="button" className="password-toggle-btn"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <small className="form-text">Min. 6 characters.</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-container">
              <input
                type={showConfirm ? 'text' : 'password'}
                id="confirmPassword" name="confirmPassword"
                value={formData.confirmPassword} onChange={handleChange}
                placeholder="Confirm your password"
                disabled={loading} autoComplete="new-password" required
              />
              <button type="button" className="password-toggle-btn"
                onClick={() => setShowConfirm(p => !p)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                {showConfirm ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>I am a:</label>
            <div className="role-selector" role="group" aria-label="Role selection">
              {['farmer', 'consumer'].map(r => (
                <button
                  key={r} type="button"
                  className={`role-buttons ${formData.role === r ? 'active' : ''}`}
                  onClick={() => handleRoleSelect(r)}
                  disabled={loading}
                  aria-pressed={formData.role === r}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;