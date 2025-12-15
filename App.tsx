import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/Landing.tsx';
import { Dashboard } from './pages/Dashboard.tsx';
import { Generator } from './pages/Generator.tsx';
import { Auth } from './pages/Auth.tsx';
import { Support } from './pages/Support.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { PaymentSuccess } from './pages/PaymentSuccess.tsx';
import { Terms, Privacy, Disclaimer } from './pages/Legal.tsx';
import { UserRole } from './types';

// Simple guard component
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userStr = localStorage.getItem('upscale_user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  if (!user || !user.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Admin Guard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userStr = localStorage.getItem('upscale_user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  if (!user || !user.isAuthenticated || user.role !== UserRole.ADMIN) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/signup" element={<Auth />} />
          <Route path="/support" element={<Support />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/payment-success" 
            element={
              <PrivateRoute>
                <PaymentSuccess />
              </PrivateRoute>
            } 
          />
          {/* Generator is public for Guest Free Previews */}
          <Route 
            path="/generate" 
            element={<Generator />} 
          />
          <Route 
            path="/admin" 
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;