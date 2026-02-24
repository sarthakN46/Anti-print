import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Landing from './pages/Landing'; // Import Landing
import RegisterShop from './pages/RegisterShop';
import RegisterUser from './pages/RegisterUser';
import ShopSetup from './pages/ShopSetup';
import ShopDashboard from './pages/ShopDashboard';
import UserDashboard from './pages/UserDashboard';
import { AuthContext } from './context/AuthContext';
import ShopSettings from './pages/ShopSettings';
import ShopHistory from './pages/ShopHistory'; // Import History
import Support from './pages/Support'; // Import Support

// Simple Route Protection Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) => {
  const { user, isLoading } = useContext(AuthContext)!;

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register-shop" element={<RegisterShop />} />
      <Route path="/register-user" element={<RegisterUser />} />
      <Route path="/support" element={<Support />} />

      {/* Protected Routes for Shop Owners */}
      <Route path="/shop/setup" element={
        <ProtectedRoute allowedRoles={['OWNER']}>
          <ShopSetup />
        </ProtectedRoute>
      } />
      
      <Route path="/shop/dashboard" element={
        <ProtectedRoute allowedRoles={['OWNER', 'EMPLOYEE']}>
          <ShopDashboard />
        </ProtectedRoute>
      } />

      <Route path="/shop/history" element={
        <ProtectedRoute allowedRoles={['OWNER', 'EMPLOYEE']}>
          <ShopHistory />
        </ProtectedRoute>
      } />

      <Route path="/user/dashboard" element={
        <ProtectedRoute allowedRoles={['USER', 'OWNER', 'EMPLOYEE']}>
          <UserDashboard />
        </ProtectedRoute>
      } />
      <Route path="/shop/settings" element={
        <ProtectedRoute allowedRoles={['OWNER']}>
          <ShopSettings />
        </ProtectedRoute>
      } />
    </Routes>
    
  );
}

export default App;