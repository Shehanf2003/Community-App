import 'react';
import { BrowserRouter as Router, Route, Navigate, Routes, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './components/Login.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import UserDashboard from './components/UserDashboard.jsx';

const AdminRoute = () => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  return userRole === 'admin' ? <Outlet /> : <Navigate to="/user" />;
};

const UserRoute = () => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!currentUser) return <Navigate to="/login" />;
  return userRole === 'user' ? <Outlet /> : <Navigate to="/admin" />;
};

const App = () => {
  return (
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Admin routes */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            {/* User routes */}
            <Route element={<UserRoute />}>
              <Route path="/user" element={<UserDashboard />} />
            </Route>

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/login" />} />

            {/* Fallback redirect for unauthorized access */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </Router>
      </AuthProvider>
  );
};

export default App;