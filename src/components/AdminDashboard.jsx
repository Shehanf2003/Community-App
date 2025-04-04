import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from './AdminUserManagement';
import Announcements from './AdminAnnouncements';
import MaintenanceRequests from './AdminMaintenanceRequests';
import { Users, Wrench, Megaphone, LogOut, AlertTriangle, CheckCircle, X, BarChart2 } from 'lucide-react';

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isPanelExpanded, setIsPanelExpanded] = useState(true);
    
    // Array of valid tabs with icons and labels
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={20} /> },
        { id: 'users', label: 'User Management', icon: <Users size={20} /> },
        { id: 'maintenance', label: 'Maintenance Requests', icon: <Wrench size={20} /> },
        { id: 'announcements', label: 'Announcements', icon: <Megaphone size={20} /> }
    ];
    
    const { currentUser, logout } = useAuth();

    // Auto-dismiss success message
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                setSuccess('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    // Check URL hash for direct tab access
    useEffect(() => {
        const hash = window.location.hash.replace('#', '');
        if (hash && tabs.some(tab => tab.id === hash)) {
            setActiveTab(hash);
        }
    }, []);

    // Update URL hash when tab changes for bookmarkable tabs
    useEffect(() => {
        window.location.hash = activeTab;
    }, [activeTab]);

    const handleLogout = async () => {
        try {
            setIsLoading(true);
            await logout();
            // Using window.location.href instead of navigate since we don't know which router is being used
            window.location.href = '/login';
        } catch (error) {
            setError('Failed to logout: ' + error.message);
            setIsLoading(false);
        }
    };

    const handleTabClick = (tabId) => {
        if (tabId !== activeTab) {
            setActiveTab(tabId);
            // Clear messages when switching tabs
            setError('');
            setSuccess('');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* Sidebar */}
            <div className={`${isPanelExpanded ? 'w-64' : 'w-20'} bg-indigo-800 text-white transition-all duration-300 ease-in-out flex flex-col`}>
                <div className="p-4 border-b border-indigo-700 flex items-center justify-between">
                    {isPanelExpanded ? (
                        <h1 className="text-xl font-bold">Admin Panel</h1>
                    ) : (
                        <span className="mx-auto">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </span>
                    )}
                    <button 
                        onClick={() => setIsPanelExpanded(!isPanelExpanded)}
                        className="text-indigo-200 hover:text-white"
                    >
                        {isPanelExpanded ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        )}
                    </button>
                </div>

                <nav className="flex-1 pt-4">
                    <ul>
                        {tabs.map((tab) => (
                            <li key={tab.id}>
                                <button
                                    onClick={() => handleTabClick(tab.id)}
                                    className={`flex items-center w-full py-3 px-4 ${
                                        activeTab === tab.id
                                            ? 'bg-indigo-900 text-white'
                                            : 'text-indigo-200 hover:bg-indigo-700'
                                    } transition-colors`}
                                >
                                    <span className="mr-3">{tab.icon}</span>
                                    {isPanelExpanded && <span>{tab.label}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="p-4 border-t border-indigo-700">
                    <button
                        onClick={handleLogout}
                        disabled={isLoading}
                        className="flex items-center w-full py-2 px-3 rounded hover:bg-indigo-700 text-indigo-200 hover:text-white transition-colors"
                    >
                        <LogOut size={18} className="mr-3" />
                        {isPanelExpanded && (
                            isLoading ? 'Logging out...' : 'Logout'
                        )}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {tabs.find(tab => tab.id === activeTab)?.label || 'Admin Dashboard'}
                        </h1>

                        <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-600">
                                Logged in as: <span className="font-medium">{currentUser.email}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    {/* Notifications */}
                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center">
                            <AlertTriangle size={20} className="text-red-500 mr-3" />
                            <div className="flex-1 text-red-700">{error}</div>
                            <button 
                                onClick={() => setError('')}
                                className="text-red-500 hover:text-red-700"
                                aria-label="Dismiss"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-center">
                            <CheckCircle size={20} className="text-green-500 mr-3" />
                            <div className="flex-1 text-green-700">{success}</div>
                            <button 
                                onClick={() => setSuccess('')}
                                className="text-green-500 hover:text-green-700"
                                aria-label="Dismiss"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    )}

                    {/* Dashboard Tab */}
                    {activeTab === 'dashboard' && (
                        <div className="bg-white shadow rounded-lg p-6">
                            <h2 className="text-xl font-semibold mb-4">Admin Dashboard Overview</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                    <div className="flex items-center">
                                        <div className="p-3 rounded-full bg-indigo-100 mr-4">
                                            <Users size={24} className="text-indigo-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-indigo-800 font-medium">User Management</p>
                                            <button 
                                                onClick={() => setActiveTab('users')}
                                                className="text-xs text-indigo-600 hover:text-indigo-800 mt-1"
                                            >
                                                View users →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                                    <div className="flex items-center">
                                        <div className="p-3 rounded-full bg-green-100 mr-4">
                                            <Megaphone size={24} className="text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-green-800 font-medium">Announcements</p>
                                            <button 
                                                onClick={() => setActiveTab('announcements')}
                                                className="text-xs text-green-600 hover:text-green-800 mt-1"
                                            >
                                                Manage announcements →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
                                    <div className="flex items-center">
                                        <div className="p-3 rounded-full bg-amber-100 mr-4">
                                            <Wrench size={24} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm text-amber-800 font-medium">Maintenance Requests</p>
                                            <button 
                                                onClick={() => setActiveTab('maintenance')}
                                                className="text-xs text-amber-600 hover:text-amber-800 mt-1"
                                            >
                                                View requests →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User Management Tab */}
                    {activeTab === 'users' && (
                        <UserManagement 
                            currentUser={currentUser}
                            setError={setError}
                            setSuccess={setSuccess} 
                        />
                    )}

                    {/* Announcements Tab */}
                    {activeTab === 'announcements' && (
                        <Announcements 
                            currentUser={currentUser} 
                            setError={setError}
                            setSuccess={setSuccess}
                        />
                    )}
                                    
                    {/* Maintenance Requests Tab */}
                    {activeTab === 'maintenance' && (
                        <MaintenanceRequests 
                            currentUser={currentUser} 
                            setError={setError}
                            setSuccess={setSuccess}
                        />
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;