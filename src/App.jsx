import React from 'react';
import { BrowserRouter as Router, Route, Navigate, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import Login from './components/Login.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import UserDashboard from './components/UserDashboard.jsx';
import MaintenanceRequest from './components/MaintenanceRequest.jsx';
import Booking from './components/Booking.jsx';
import CommunityForum from './components/CommunityForum.jsx';
import ContactManagement from './components/contactManagement.jsx';
import Navbar from './components/navbar.jsx';
import UserProfile from './components/UserProfile.jsx';
import ChangePassword from './components/ChangePassword.jsx';


// ProtectedRoute component with role-based access
const ProtectedRoute = ({ children, requiredRole }) => {
    const { currentUser, userRole, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (requiredRole && userRole !== requiredRole) {
        return <Navigate to={userRole === 'admin' ? '/admin' : '/user'} />;
    }

    return children;
};

const App = () => {
    return (
        
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    {/* Admin routes */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requiredRole="admin">
                             <AdminDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/maintenance"
                        element={
                            <ProtectedRoute requiredRole="admin">
                                <Navbar />
                                <MaintenanceRequest />
                            </ProtectedRoute>
                        }
                    />
                
                    {/* User routes */}
                    <Route
                        path="/user"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <UserDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/user/maintenance"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <MaintenanceRequest />
                            </ProtectedRoute>
                        }
                    />
                    
                    {/* New Profile Routes */}
                    <Route
                        path="/user/profile"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <UserProfile />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/user/change-password"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <ChangePassword />
                            </ProtectedRoute>
                        }
                    />
                    
                    {/* Root redirect */}
                    <Route path="/" element={<Navigate to="/login" />} />
                    
                    {/* Maintenance redirect based on role */}
                    <Route 
                        path="/maintenance" 
                        element={
                            <ProtectedRoute>
                                {({ userRole }) => (
                                    <Navigate 
                                        to={userRole === 'admin' ? '/admin/maintenance' : '/user/maintenance'} 
                                        replace 
                                    />
                                )}
                            </ProtectedRoute>
                        } 
                    />
                    <Route
                        path="/user/resources"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <Booking />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/user/forum"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <CommunityForum />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/user/community"
                        element={
                            <ProtectedRoute requiredRole="user">
                                <Navbar />
                                <ContactManagement />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </Router>
        </AuthProvider>
            
    );
};

export default App;