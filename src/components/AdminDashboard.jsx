import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from './AdminUserManagement';
import Announcements from './AdminAnnouncements';
import MaintenanceRequests from './AdminMaintenanceRequests';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    
    // Array of valid tabs
    const tabs = ['users', 'maintenance', 'announcements'];
    
    const { currentUser, logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            // Using window.location.href instead of navigate since we don't know which router is being used
            window.location.href = '/login';
        } catch (error) {
            setError('Failed to logout: ' + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Admin Dashboard</h2>
                    <button
                        onClick={handleLogout}
                        className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-md text-sm font-medium"
                    >
                        Logout
                    </button>
                </div>           

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                        {success}
                    </div>
                )}
                
                {/* Tab Navigation */}
                <div className="flex border-b mb-6">
                    <button
                        className={`px-4 py-2 mr-2 ${activeTab === 'users' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        onClick={() => setActiveTab('users')}
                    >
                        User Management
                    </button>
                    <button
                        className={`px-4 py-2 mr-2 ${activeTab === 'maintenance' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        onClick={() => setActiveTab('maintenance')}
                    >
                        Maintenance Requests
                    </button>
                    <button
                        className={`px-4 py-2 ${activeTab === 'announcements' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                        onClick={() => setActiveTab('announcements')}
                    >
                        Announcements
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'users' && (
                    <UserManagement currentUser={currentUser} />
                )}

                {activeTab === 'announcements' && (
                    <Announcements currentUser={currentUser} />
                )}
                                
                {activeTab === 'maintenance' && (
                    <MaintenanceRequests currentUser={currentUser} />
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;