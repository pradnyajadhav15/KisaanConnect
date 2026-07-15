import React from 'react';
import PropTypes from 'prop-types';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated, hasRole, getUserRole } from '../../services/authService';
const ProtectedRoute = ({ requiredRole }) => {
  const location  = useLocation();
  const isAuth    = isAuthenticated();
  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (!hasRole(requiredRole)) {
    const role = getUserRole();
    const fallback = role === 'farmer'   ? '/farmer'
                   : role === 'consumer' ? '/consumer'
                   : role === 'admin'    ? '/admin'
                   : '/unauthorized';
    return <Navigate to={fallback} replace />;
  }
  return <Outlet />;
};
ProtectedRoute.propTypes = {
  requiredRole: PropTypes.oneOf(['farmer', 'consumer', 'admin']).isRequired,
};
export default ProtectedRoute;
