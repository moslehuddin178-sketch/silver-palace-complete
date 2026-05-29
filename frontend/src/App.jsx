import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import { Spinner } from './components/ui';
import Login       from './pages/auth/Login';
import Dashboard   from './pages/dashboard/Dashboard';
import Products    from './pages/products/Products';
import Customers   from './pages/customers/Customers';
import POS         from './pages/pos/POS';
import Sales       from './pages/sales/Sales';
import Reports     from './pages/reports/Reports';
import Settings    from './pages/settings/Settings';
import AIAssistant from './pages/ai/AIAssistant';
import ForgotPassword from './pages/auth/forgotPassword';
import ResetPassword  from './pages/auth/resetPassword';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!user)   return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (user)    return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration:3000, style:{ borderRadius:'10px', fontSize:'14px' }}} />
        <Routes>
          <Route path="/login"     element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard   /></ProtectedRoute>} />
          <Route path="/products"  element={<ProtectedRoute><Products    /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers   /></ProtectedRoute>} />
          <Route path="/pos"       element={<ProtectedRoute><POS         /></ProtectedRoute>} />
          <Route path="/sales"     element={<ProtectedRoute><Sales       /></ProtectedRoute>} />
          <Route path="/reports"   element={<ProtectedRoute><Reports     /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><Settings    /></ProtectedRoute>} />
          <Route path="/ai"        element={<ProtectedRoute><AIAssistant /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/forgot-password"      element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<PublicRoute><ResetPassword  /></PublicRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}