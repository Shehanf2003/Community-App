import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { Megaphone, PlusCircle, Users, User, Search, Edit, Trash2, AlertTriangle, CheckCircle, X, Calendar, RefreshCw } from 'lucide-react';

const Announcements = ({ currentUser }) => {
    const [announcements, setAnnouncements] = useState([]);
    const [users, setUsers] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [announcementTitle, setAnnouncementTitle] = useState('');
    const [targetAudience, setTargetAudience] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editMode, setEditMode] = useState(false);
    const [currentAnnouncementId, setCurrentAnnouncementId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [formPinned, setFormPinned] = useState(false);
    const [anncFilter, setAnncFilter] = useState('all'); // 'all', 'toAll', 'targeted'
    const [expandedAnnouncement, setExpandedAnnouncement] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    
    const formRef = useRef(null);
    const db = getFirestore();

    // Check admin status whenever currentUser changes
    useEffect(() => {
        if (currentUser?.uid) {
            checkAdminStatus();
        }
    }, [currentUser]);

    // Initial data loading - fetch users and announcements
    useEffect(() => {
        if (currentUser?.uid) {
            fetchUsers();
            fetchAnnouncements();
        }
    }, [currentUser]);

    // Effect to refresh announcements when filter changes
    useEffect(() => {
        if (currentUser?.uid) {
            fetchAnnouncements();
        }
    }, [anncFilter, currentUser]);

    // Effect to auto-dismiss success messages
    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => {
                setSuccess('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    // Scroll to form when edit mode is activated
    useEffect(() => {
        if (editMode && formRef.current) {
            setShowForm(true);
            formRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [editMode]);

    const checkAdminStatus = async () => {
        if (!currentUser?.uid) return;
        
        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            if (userDocSnap.exists()) {
                setIsAdmin(userDocSnap.data()?.role === 'admin');
            } else {
                console.warn('User document does not exist for uid:', currentUser.uid);
                setIsAdmin(false);
            }
        } catch (err) {
            console.error('Error checking admin status:', err);
            setError('Error verifying admin privileges');
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    const fetchAnnouncements = async () => {
        if (!currentUser?.uid) {
            console.warn('Cannot fetch announcements: currentUser is not available');
            return;
        }
        
        setLoading(true);
        setError('');
        
        try {
            console.log('Fetching announcements for user:', currentUser.uid, 'isAdmin:', isAdmin);
            
            // To avoid requiring complex indexes, we'll use a simpler query and filter in JavaScript
            const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
            
            const querySnapshot = await getDocs(q);
            console.log('Fetched', querySnapshot.docs.length, 'announcements');
            
            const announcementsList = querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
                .filter(announcement => {
                    // Ensure we have proper data structure
                    if (!announcement.targetType) {
                        announcement.targetType = 'all'; // Default to 'all' if not specified
                    }
                    
                    // Admin can see all announcements
                    if (isAdmin) {
                        return true;
                    }
                    
                    // Everyone can see announcements targeted to all
                    if (announcement.targetType === 'all') {
                        return true;
                    }
                    
                    // Check if specifically targeted to this user
                    if (announcement.targetType === 'specific' && 
                        announcement.targetUsers && 
                        Array.isArray(announcement.targetUsers) &&
                        announcement.targetUsers.includes(currentUser.uid)) {
                        return true;
                    }
                    
                    return false;
                });
                
            console.log('Filtered to', announcementsList.length, 'announcements for display');
            setAnnouncements(announcementsList);
        } catch (err) {
            console.error('Error fetching announcements:', err);
            setError('Error fetching announcements: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'users'));
            const usersList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersList);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Error loading users for targeting');
        }
    };

    const handleAnnouncementSubmit = async (e) => {
        e.preventDefault();
        
        if (!currentUser?.uid) {
            setError('You must be logged in to post announcements');
            return;
        }
        
        setIsSubmitting(true);
        setError('');
        
        try {
            // Validate form
            if (!newAnnouncement.trim()) {
                setError('Announcement content cannot be empty');
                setIsSubmitting(false);
                return;
            }
            
            if (targetAudience === 'specific' && (!selectedUsers.length)) {
                setError('Please select at least one recipient for targeted announcements');
                setIsSubmitting(false);
                return;
            }
            
            const announcementData = {
                title: announcementTitle.trim() || 'Announcement',
                content: newAnnouncement.trim(),
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                read: {},
                targetType: targetAudience,
                targetUsers: targetAudience === 'specific' ? selectedUsers : [],
                updatedAt: serverTimestamp()
            };

            if (editMode && currentAnnouncementId) {
                // Update existing announcement
                const docRef = doc(db, 'announcements', currentAnnouncementId);
                await updateDoc(docRef, {
                    title: announcementTitle.trim() || 'Announcement',
                    content: newAnnouncement.trim(),
                    targetType: targetAudience,
                    targetUsers: targetAudience === 'specific' ? selectedUsers : [],
                    updatedAt: serverTimestamp()
                });
                setSuccess('Announcement updated successfully!');
            } else {
                // Create new announcement
                await addDoc(collection(db, 'announcements'), announcementData);
                setSuccess('Announcement posted successfully!');
                if (!formPinned) {
                    setShowForm(false);
                }
            }
            
            resetForm();
            await fetchAnnouncements(); // Await to ensure we get updated data
        } catch (err) {
            console.error('Error submitting announcement:', err);
            setError('Failed to ' + (editMode ? 'update' : 'post') + ' announcement: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setNewAnnouncement('');
        setAnnouncementTitle('');
        setTargetAudience('all');
        setSelectedUsers([]);
        setSearchTerm('');
        setEditMode(false);
        setCurrentAnnouncementId(null);
    };

    const handleEditAnnouncement = (announcement) => {
        setAnnouncementTitle(announcement.title || '');
        setNewAnnouncement(announcement.content);
        setTargetAudience(announcement.targetType || 'all');
        if (announcement.targetType === 'specific' && announcement.targetUsers && announcement.targetUsers.length > 0) {
            setSelectedUsers(announcement.targetUsers);
        } else {
            setSelectedUsers([]);
        }
        setEditMode(true);
        setCurrentAnnouncementId(announcement.id);
        setShowForm(true);
        setFormPinned(true);
        // Scroll to form will be handled by useEffect
    };

    const confirmDeleteAnnouncement = (announcement) => {
        setConfirmDelete(announcement);
    };

    const handleDeleteAnnouncement = async () => {
        if (!confirmDelete) return;
        
        setIsSubmitting(true);
        try {
            await deleteDoc(doc(db, 'announcements', confirmDelete.id));
            setSuccess('Announcement deleted successfully!');
            await fetchAnnouncements(); // Await to ensure we get updated data
            setConfirmDelete(null);
        } catch (err) {
            console.error('Error deleting announcement:', err);
            setError('Failed to delete announcement: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelEdit = () => {
        resetForm();
        setFormPinned(false);
        if (!formPinned) {
            setShowForm(false);
        }
    };
    
    const handleUserSelection = (userId) => {
        setSelectedUsers(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };
    
    const getUserName = (userId) => {
        const user = users.find(u => u.id === userId);
        return user?.fullName || user?.username || user?.email || 'Unknown User';
    };
    
    const toggleExpandAnnouncement = (id) => {
        setExpandedAnnouncement(expandedAnnouncement === id ? null : id);
    };
    
    const getFilteredAnnouncements = () => {
        if (anncFilter === 'all') {
            return announcements;
        } else if (anncFilter === 'toAll') {
            return announcements.filter(a => a.targetType === 'all');
        } else if (anncFilter === 'targeted') {
            return announcements.filter(a => a.targetType === 'specific');
        }
        return announcements;
    };
    
    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown date';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (err) {
            console.error('Error formatting date:', err);
            return 'Invalid date';
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4">
            {/* Header with action buttons */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                <div className="flex items-center mb-4 sm:mb-0">
                    <Megaphone className="h-6 w-6 text-indigo-600 mr-2" />
                    <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
                </div>
                
                <div className="flex space-x-3">
                    {isAdmin && (
                        <button
                            onClick={() => { setShowForm(!showForm); setFormPinned(!showForm && formPinned); }}
                            className={`flex items-center px-3 py-2 rounded-md shadow-sm text-sm font-medium transition-colors ${
                                showForm 
                                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                        >
                            {showForm ? (
                                <>
                                    <X className="h-4 w-4 mr-1.5" />
                                    {editMode ? 'Cancel Editing' : 'Hide Form'}
                                </>
                            ) : (
                                <>
                                    <PlusCircle className="h-4 w-4 mr-1.5" />
                                    New Announcement
                                </>
                            )}
                        </button>
                    )}
                    
                    <button 
                        onClick={fetchAnnouncements}
                        className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        title="Refresh announcements"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            
            {/* Notifications */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center mb-6">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                    <p className="text-sm text-red-700">{error}</p>
                    <button 
                        onClick={() => setError('')}
                        className="ml-auto text-red-500 hover:text-red-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            )}
            
            {success && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-center mb-6">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    <p className="text-sm text-green-700">{success}</p>
                    <button 
                        onClick={() => setSuccess('')}
                        className="ml-auto text-green-500 hover:text-green-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            )}
            
            {/* Admin form */}
            {isAdmin && showForm && (
                <div ref={formRef} className="bg-white shadow-md rounded-lg p-6 mb-6 border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-800">
                            {editMode ? 'Edit Announcement' : 'Create New Announcement'}
                        </h2>
                        <button 
                            onClick={() => setFormPinned(!formPinned)}
                            className={`flex items-center text-sm py-1 px-2 rounded ${
                                formPinned 
                                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title={formPinned ? "Form will stay open after posting" : "Form will close after posting"}
                        >
                            {formPinned ? "Pinned" : "Auto-close"}
                        </button>
                    </div>
                    
                    <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="announcement-title" className="block text-sm font-medium text-gray-700 mb-1">
                                Title
                            </label>
                            <input
                                id="announcement-title"
                                type="text"
                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                value={announcementTitle}
                                onChange={(e) => setAnnouncementTitle(e.target.value)}
                                placeholder="Announcement title (optional)"
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="announcement-content" className="block text-sm font-medium text-gray-700 mb-1">
                                Announcement Content <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="announcement-content"
                                required
                                className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                rows="4"
                                value={newAnnouncement}
                                onChange={(e) => setNewAnnouncement(e.target.value)}
                                placeholder="Type your announcement here..."
                            />
                        </div>
                        
                        <div>
                            <label htmlFor="target-audience" className="block text-sm font-medium text-gray-700 mb-1">
                                Target Audience
                            </label>
                            <div className="mt-1 grid grid-cols-2 gap-3">
                                <div
                                    className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                                        targetAudience === 'all'
                                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                            : 'border-gray-300 hover:bg-gray-50'
                                    }`}
                                    onClick={() => setTargetAudience('all')}
                                >
                                    <Users className={`h-5 w-5 mr-2 ${targetAudience === 'all' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                    <div>
                                        <p className={`font-medium ${targetAudience === 'all' ? 'text-indigo-700' : 'text-gray-900'}`}>All Users</p>
                                        <p className="text-xs text-gray-500">Visible to everyone in the community</p>
                                    </div>
                                </div>
                                
                                <div
                                    className={`flex items-center p-3 border rounded-md cursor-pointer transition-colors ${
                                        targetAudience === 'specific'
                                            ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                            : 'border-gray-300 hover:bg-gray-50'
                                    }`}
                                    onClick={() => setTargetAudience('specific')}
                                >
                                    <User className={`h-5 w-5 mr-2 ${targetAudience === 'specific' ? 'text-indigo-600' : 'text-gray-400'}`} />
                                    <div>
                                        <p className={`font-medium ${targetAudience === 'specific' ? 'text-indigo-700' : 'text-gray-900'}`}>Specific Users</p>
                                        <p className="text-xs text-gray-500">Only visible to selected recipients</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {targetAudience === 'specific' && (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label htmlFor="user-search" className="block text-sm font-medium text-gray-700">
                                        Select Recipients <span className="text-red-500">*</span>
                                    </label>
                                    {selectedUsers.length > 0 && (
                                        <span className="text-xs text-gray-500">
                                            {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                                        </span>
                                    )}
                                </div>
                                
                                <div className="mt-1 mb-2 relative rounded-md shadow-sm">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <input
                                        id="user-search"
                                        type="text"
                                        className="block w-full pl-10 pr-12 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                        placeholder="Search users by name or email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                    {searchTerm && (
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer" onClick={() => setSearchTerm('')}>
                                            <X className="h-4 w-4 text-gray-400 hover:text-gray-500" />
                                        </div>
                                    )}
                                </div>
                                
                                {selectedUsers.length > 0 && (
                                    <div className="mb-3">
                                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                                            Selected Recipients
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedUsers.map(userId => (
                                                <div 
                                                    key={userId}
                                                    className="bg-indigo-100 text-indigo-800 text-sm rounded-full px-3 py-1 flex items-center"
                                                >
                                                    <span>{getUserName(userId)}</span>
                                                    <button 
                                                        type="button"
                                                        className="ml-1.5 text-indigo-600 hover:text-indigo-800 focus:outline-none"
                                                        onClick={() => handleUserSelection(userId)}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="mt-2 max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                                    {users.length === 0 ? (
                                        <div className="flex justify-center items-center py-4">
                                            <RefreshCw className="animate-spin h-5 w-5 text-indigo-500 mr-2" />
                                            <span className="text-sm text-gray-500">Loading users...</span>
                                        </div>
                                    ) : (
                                        users
                                            .filter(user => 
                                                (user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                !searchTerm)
                                            )
                                            .map(user => (
                                                <div 
                                                    key={user.id}
                                                    className={`p-3 cursor-pointer border-b hover:bg-gray-50 flex items-center justify-between
                                                    ${selectedUsers.includes(user.id) ? 'bg-indigo-50' : ''}`}
                                                    onClick={() => handleUserSelection(user.id)}
                                                >
                                                    <div className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedUsers.includes(user.id)}
                                                            onChange={() => {}}
                                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                        />
                                                        <div className="ml-3">
                                                            <div className="font-medium text-gray-900">
                                                                {user.fullName || user.username || 'Unnamed User'}
                                                            </div>
                                                            {user.email && <div className="text-sm text-gray-500">{user.email}</div>}
                                                        </div>
                                                    </div>
                                                    
                                                    {user.role === 'admin' && (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                            Admin
                                                        </span>
                                                    )}
                                                </div>
                                            ))
                                    )}
                                    
                                    {users.length > 0 && 
                                     users.filter(user => 
                                        user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        !searchTerm
                                     ).length === 0 && (
                                        <div className="p-3 text-center text-gray-500">
                                            No users match your search criteria
                                        </div>
                                     )}
                                </div>

                                {targetAudience === 'specific' && selectedUsers.length === 0 && (
                                    <p className="mt-2 text-sm text-red-600 flex items-center">
                                        <AlertTriangle className="h-4 w-4 mr-1" />
                                        Please select at least one recipient
                                    </p>
                                )}
                            </div>
                        )}
                        
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting || (targetAudience === 'specific' && selectedUsers.length === 0)}
                                className="flex-1 inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting && <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />}
                                {isSubmitting 
                                    ? (editMode ? 'Updating...' : 'Posting...') 
                                    : (editMode ? 'Update Announcement' : 'Post Announcement')}
                            </button>
                            
                            {(editMode || formPinned) && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>
                )}

            {/* Announcement List */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">Announcements</h2>
                    
                    {isAdmin && (
                        <div className="flex">
                            <button
                                onClick={() => setAnncFilter('all')}
                                className={`px-3 py-1 text-sm rounded-l-md border ${
                                    anncFilter === 'all' 
                                        ? 'bg-indigo-600 text-white border-indigo-600' 
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setAnncFilter('toAll')}
                                className={`px-3 py-1 text-sm border-t border-b ${
                                    anncFilter === 'toAll' 
                                        ? 'bg-indigo-600 text-white border-indigo-600' 
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <Users className="h-3.5 w-3.5 inline mr-1" />
                                Public
                            </button>
                            <button
                                onClick={() => setAnncFilter('targeted')}
                                className={`px-3 py-1 text-sm rounded-r-md border ${
                                    anncFilter === 'targeted' 
                                        ? 'bg-indigo-600 text-white border-indigo-600' 
                                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <User className="h-3.5 w-3.5 inline mr-1" />
                                Targeted
                            </button>
                        </div>
                    )}
                </div>
                
                {loading ? (
                    <div className="flex flex-col items-center justify-center p-8">
                        <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
                        <p className="text-gray-500">Loading announcements...</p>
                    </div>
                ) : getFilteredAnnouncements().length > 0 ? (
                    <div className="divide-y">
                        {getFilteredAnnouncements().map((announcement) => (
                            <div key={announcement.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center mb-1">
                                            <h3 className="font-medium text-gray-900 text-lg">
                                                {announcement.title || 'Announcement'}
                                            </h3>
                                            <button
                                                onClick={() => toggleExpandAnnouncement(announcement.id)}
                                                className="ml-2 text-gray-400 hover:text-gray-600"
                                                aria-label={expandedAnnouncement === announcement.id ? "Collapse" : "Expand"}
                                            >
                                                <svg className={`h-5 w-5 transform transition-transform ${expandedAnnouncement === announcement.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </button>
                                        </div>
                                        
                                        <div className={expandedAnnouncement === announcement.id ? '' : 'line-clamp-2'}>
                                            <p className="text-gray-700 whitespace-pre-line">{announcement.content}</p>
                                        </div>
                                        
                                        <div className="flex flex-wrap mt-2 space-x-2">
                                            <div className="flex items-center text-xs text-gray-500">
                                                <Calendar className="h-3.5 w-3.5 mr-1" />
                                                Posted {formatDate(announcement.createdAt)}
                                                {announcement.updatedAt && announcement.updatedAt !== announcement.createdAt && 
                                                    ` (Updated ${formatDate(announcement.updatedAt)})`}
                                            </div>
                                            
                                            <div className="flex items-center text-xs">
                                                {announcement.targetType === 'all' ? (
                                                    <span className="flex items-center text-green-600">
                                                        <Users className="h-3.5 w-3.5 mr-1" />
                                                        Public Announcement
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center text-indigo-600">
                                                        <User className="h-3.5 w-3.5 mr-1" />
                                                        Targeted ({announcement.targetUsers?.length || 0} recipient{announcement.targetUsers?.length !== 1 ? 's' : ''})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Admin actions */}
                                    {isAdmin && (
                                        <div className="ml-4 flex flex-col space-y-2">
                                            <button
                                                onClick={() => handleEditAnnouncement(announcement)}
                                                className="flex items-center text-xs text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded"
                                            >
                                                <Edit className="h-4 w-4 mr-1" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => confirmDeleteAnnouncement(announcement)}
                                                className="flex items-center text-xs text-red-600 hover:text-red-800 p-1 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Recipient details when expanded */}
                                {isAdmin && expandedAnnouncement === announcement.id && announcement.targetType === 'specific' && (
                                    <div className="mt-4 pt-2 border-t border-gray-200">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recipients:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {announcement.targetUsers?.map(userId => (
                                                <span 
                                                    key={userId}
                                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                                                >
                                                    {getUserName(userId)}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                        <Megaphone className="h-12 w-12 text-gray-300 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No announcements found</h3>
                        <p className="text-sm text-gray-500 max-w-md">
                            {anncFilter !== 'all' 
                                ? `No ${anncFilter === 'toAll' ? 'public' : 'targeted'} announcements available.` 
                                : 'There are no announcements to display.'}
                        </p>
                        {isAdmin && (
                            <button 
                                onClick={() => { setShowForm(true); setAnncFilter('all'); }}
                                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                                <PlusCircle className="h-4 w-4 mr-1.5" />
                                Create Announcement
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Confirmation Modal for Deleting Announcement */}
            {confirmDelete && (
                <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                        <AlertTriangle className="h-6 w-6 text-red-600" />
                                    </div>
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                            Delete Announcement
                                        </h3>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">
                                                Are you sure you want to delete this announcement? This action cannot be undone.
                                            </p>
                                            <div className="mt-3 p-3 bg-gray-50 rounded-md">
                                                <p className="text-sm font-medium text-gray-800">{confirmDelete.title || 'Announcement'}</p>
                                                <p className="text-sm text-gray-600 line-clamp-2">{confirmDelete.content}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button 
                                    type="button" 
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={handleDeleteAnnouncement}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                            Deleting...
                                        </>
                                    ) : (
                                        'Delete'
                                    )}
                                </button>
                                <button 
                                    type="button" 
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => setConfirmDelete(null)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Announcements;