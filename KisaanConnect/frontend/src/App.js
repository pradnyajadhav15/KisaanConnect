import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/App.css';

import Navbar          from './components/Navbar';
import HomePage        from './components/HomePage';
import FarmerDashboard from './components/farmer/FarmerDashboard';
import ConsumerDashboard from './components/consumer/ConsumerDashboard';
import NgoDashboard    from './components/ngo/NgoDashboard';
import Chatbot         from './components/Chatbot';
import Login           from './components/auth/Login';
import Register        from './components/auth/Register';
import ProtectedRoute  from './components/auth/ProtectedRoute';
import AdoptFarm       from './components/AdoptFarm';
import FarmerDetail    from './components/FarmerDetail';

const Unauthorized = () => (
  <div className="coming-soon">
    <h2>Access Denied</h2>
    <p>You don't have permission to view this page.</p>
  </div>
);

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />

        <main className="main-content">
          <Routes>
            {/* Public */}
            <Route path="/"         element={<HomePage />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/ngo"      element={<NgoDashboard />} />
            <Route path="/adopt-farm"     element={<AdoptFarm />} />
            <Route path="/adopt-farm/:id" element={<FarmerDetail />} />
            <Route path="/unauthorized"   element={<Unauthorized />} />

            {/* Protected */}
            <Route element={<ProtectedRoute requiredRole="farmer" />}>
              <Route path="/farmer" element={<FarmerDashboard />} />
            </Route>

            <Route element={<ProtectedRoute requiredRole="consumer" />}>
              <Route path="/consumer" element={<ConsumerDashboard />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <Chatbot />
      </div>
    </Router>
  );
}

export default App;