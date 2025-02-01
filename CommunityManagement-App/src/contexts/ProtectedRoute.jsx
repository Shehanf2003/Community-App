import { useAuth } from 'AuthContext.jsx';
import { Navigate, Outlet } from 'react-router-dom';

export const AdminRoute = () => {
    const { userRole, currentUser } = useAuth();

    if (!currentUser) return <Navigate to="/login" />;
    return userRole === 'admin' ? <Outlet /> : <Navigate to="/unauthorized" />;
};

export const UserRoute = () => {
    const { userRole, currentUser } = useAuth();

    if (!currentUser) return <Navigate to="/login" />;
    return userRole === 'user' ? <Outlet /> : <Navigate to="/unauthorized" />;
};