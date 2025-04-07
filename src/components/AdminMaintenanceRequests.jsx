import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { Wrench, AlertTriangle, CheckCircle, MessageSquare, Search, Filter, Calendar, X, RefreshCw, UserCircle, MapPin, PenSquare, Trash, SlidersHorizontal, Clock, Image as ImageIcon } from 'lucide-react';
import { getIdToken, getAuth } from 'firebase/auth';
import MaintenanceRequestImage from './MaintenanceRequestImage'; 

const MaintenanceRequests = ({ currentUser }) => {
    const [maintenanceRequests, setMaintenanceRequests] = useState([]);
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [showFilters, setShowFilters] = useState(false);
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest', 'priority'
    const [requestToDelete, setRequestToDelete] = useState(null);
    const [quickReplies, setQuickReplies] = useState([
        "We've received your maintenance request and will address it soon.",
        "A technician has been assigned to your request and will visit within 48 hours.",
        "Your maintenance issue has been resolved. Please let us know if you need further assistance.",
        "We need more information about your request. Could you please provide additional details?"
    ]);
    const [expandedRequests, setExpandedRequests] = useState({});

    const db = getFirestore();
    const auth = getAuth();

    useEffect(() => {
        fetchMaintenanceRequests();
    }, []);

    useEffect(() => {
        // Apply filters and search whenever the source data or filter criteria change
        applyFiltersAndSearch();
    }, [maintenanceRequests, statusFilter, priorityFilter, searchTerm, sortOrder]);

    const applyFiltersAndSearch = () => {
        let filtered = [...maintenanceRequests];

        // Apply status filter
        if (statusFilter !== 'All') {
            filtered = filtered.filter(request => request.status === statusFilter);
        }

        // Apply priority filter
        if (priorityFilter !== 'All') {
            filtered = filtered.filter(request => request.priority === priorityFilter);
        }

        // Apply search
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(request => 
                request.title?.toLowerCase().includes(term) ||
                request.description?.toLowerCase().includes(term) ||
                request.userName?.toLowerCase().includes(term) ||
                request.fullName?.toLowerCase().includes(term) ||
                request.location?.toLowerCase().includes(term)
            );
        }

        // Apply sorting
        if (sortOrder === 'newest') {
            filtered.sort((a, b) => {
                if (!a.createdAt || !b.createdAt) return 0;
                const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt.toDate();
                const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt.toDate();
                return dateB - dateA;
            });
        } else if (sortOrder === 'oldest') {
            filtered.sort((a, b) => {
                if (!a.createdAt || !b.createdAt) return 0;
                const dateA = a.createdAt instanceof Date ? a.createdAt : a.createdAt.toDate();
                const dateB = b.createdAt instanceof Date ? b.createdAt : b.createdAt.toDate();
                return dateA - dateB;
            });
        } else if (sortOrder === 'priority') {
            const priorityOrder = {
                'Emergency': 0,
                'High Priority': 1,
                'Medium Priority': 2,
                'Low Priority': 3,
                'Unassigned': 4
            };
            
            filtered.sort((a, b) => {
                const priorityA = priorityOrder[a.priority] || 5;
                const priorityB = priorityOrder[b.priority] || 5;
                return priorityA - priorityB;
            });
        }

        setFilteredRequests(filtered);
    };

    const fetchMaintenanceRequests = async () => {
        setLoading(true);
        setError('');
        try {
            const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            // Process each request document
            const requestsPromises = querySnapshot.docs.map(async docSnapshot => {
                const requestData = docSnapshot.data();
                const requestWithId = {
                    id: docSnapshot.id,
                    ...requestData
                };
                
                // If there's no fullName but we have a userId, try to fetch the user's fullName
                if (!requestData.fullName && requestData.userId) {
                    try {
                        const userDocRef = doc(db, 'users', requestData.userId);
                        const userSnapshot = await getDoc(userDocRef);
                        
                        if (userSnapshot.exists()) {
                            const userData = userSnapshot.data();
                            requestWithId.fullName = userData.fullName || userData.username || '';
                        }
                    } catch (error) {
                        console.error("Error fetching user details:", error);
                        // Continue with the request data we have
                    }
                }
                
                return requestWithId;
            });
            
            const requestsList = await Promise.all(requestsPromises);
            setMaintenanceRequests(requestsList);
        } catch (err) {
            setError('Error fetching maintenance requests: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMaintenanceStatusChange = async (requestId, newStatus) => {
        setActionLoading(true);
        try {
            const requestRef = doc(db, 'maintenance_requests', requestId);
            await updateDoc(requestRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            });
            
            // Create a notification for the user when status changes to Completed
            if (newStatus === 'Completed') {
                const request = maintenanceRequests.find(r => r.id === requestId);
                if (request) {
                    const notificationRef = collection(db, 'notifications');
                    await addDoc(notificationRef, {
                        userId: request.userId,
                        type: 'maintenance_status',
                        requestId: requestId,
                        content: `Your maintenance request "${request.title}" has been completed.`,
                        read: false,
                        createdAt: serverTimestamp(),
                        maintenanceTitle: request.title
                    });
                }
            }
            
            await fetchMaintenanceRequests(); // Refresh the list
            setSuccess(`Status updated to "${newStatus}" successfully`);
            
            // Auto dismiss success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            setError('Error updating status: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handlePriorityChange = async (requestId, newPriority) => {
        setActionLoading(true);
        try {
            const requestRef = doc(db, 'maintenance_requests', requestId);
            await updateDoc(requestRef, {
                priority: newPriority,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            });
            await fetchMaintenanceRequests(); // Refresh the list
            setSuccess(`Priority updated to "${newPriority}" successfully`);
            
            // Auto dismiss success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            setError('Error updating priority: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    const handleMaintenanceReply = async (requestId, replyText) => {
        if (!replyText.trim()) return;
        setActionLoading(true);
        
        try {
          const requestRef = doc(db, 'maintenance_requests', requestId);
          const request = maintenanceRequests.find(r => r.id === requestId);
          
          // Create a new Date object for the comment timestamp
          const currentDate = new Date();
          
          // Create comment ID for reference
          const commentId = `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          // Add the reply to maintenance request with a regular timestamp
          await updateDoc(requestRef, {
            comments: [...(request.comments || []), {
              id: commentId,
              content: replyText,
              createdAt: currentDate,
              createdBy: currentUser.uid,
              isAdminReply: true
            }],
            lastUpdated: serverTimestamp() // This is fine outside the array
          });
      
          // Create notification for the user
          const notificationRef = collection(db, 'notifications');
          await addDoc(notificationRef, {
            userId: request.userId,
            type: 'maintenance_reply',
            requestId: requestId,
            content: replyText,
            read: false,
            createdAt: serverTimestamp(), // This is fine for a new document
            maintenanceTitle: request.title
          });
          
          // Send email notification
          const emailResult = await sendMaintenanceReplyEmail(requestId, commentId);
      
          // Clear the reply text for this request
          if (selectedRequest === requestId) {
            setReplyText('');
            setSelectedRequest(null);
          }
      
          await fetchMaintenanceRequests();
          
          let successMessage = 'Reply sent successfully';
          if (emailResult.success) {
            successMessage += ' and email notification sent to the user.';
          } else {
            successMessage += '. However, email notification could not be sent.';
            console.warn('Email sending failed:', emailResult.error);
          }
          
          setSuccess(successMessage);
          
          // Auto dismiss success message after 3 seconds
          setTimeout(() => setSuccess(''), 5000);
        } catch (error) {
          setError('Error sending reply: ' + error.message);
        } finally {
          setActionLoading(false);
        }
      };
      const sendMaintenanceReplyEmail = async (requestId, commentId) => {
        try {
          // Get current user's ID token
          const idToken = await getIdToken(auth.currentUser);
          
          const response = await fetch('/api/sendMaintenanceReplyNotification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              idToken,
              requestId,
              commentId
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            console.error('Error sending maintenance reply email:', data.error);
            return { success: false, error: data.error };
          }
          
          return { success: true };
        } catch (error) {
          console.error('Error sending maintenance reply email:', error);
          return { success: false, error: error.message };
        }
      };
    
    const handleDeleteRequest = async (requestId) => {
        setActionLoading(true);
        try {
            const requestRef = doc(db, 'maintenance_requests', requestId);
            await updateDoc(requestRef, {
                status: 'Cancelled',
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid,
                isCancelled: true
            });
            
            // Remove from requestToDelete state
            setRequestToDelete(null);
            
            await fetchMaintenanceRequests(); // Refresh the list
            setSuccess('Request cancelled successfully');
            
            // Auto dismiss success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            setError('Error cancelling request: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };
    
    const resetFilters = () => {
        setStatusFilter('All');
        setPriorityFilter('All');
        setSearchTerm('');
        setSortOrder('newest');
    };
    
    const toggleRequestExpansion = (requestId) => {
        setExpandedRequests(prev => ({
            ...prev,
            [requestId]: !prev[requestId]
        }));
    };
    
    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown date';
        
        const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
        
        // Check if date is valid
        if (isNaN(date)) return 'Invalid date';
        
        // Format the date
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };
    
    const getStatusColor = (status) => {
        switch(status) {
            case 'Pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'In Progress':
                return 'bg-blue-100 text-blue-800';
            case 'Completed':
                return 'bg-green-100 text-green-800';
            case 'Cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    
    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'Emergency':
                return 'bg-red-100 text-red-800';
            case 'High Priority':
                return 'bg-orange-100 text-orange-800';
            case 'Medium Priority':
                return 'bg-yellow-100 text-yellow-800';
            case 'Low Priority':
                return 'bg-blue-100 text-blue-800';
            case 'Unassigned':
                return 'bg-gray-100 text-gray-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };
    
    const useQuickReply = (reply) => {
        setReplyText(reply);
    };

    return (
        <div className="space-y-6 p-4 max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                <div className="flex items-center mb-4 sm:mb-0">
                    <Wrench className="mr-2 h-5 w-5 text-blue-600" />
                    <h2 className="text-2xl font-bold text-gray-800">Maintenance Requests</h2>
                </div>
                
                <div className="flex space-x-2">
                    <button 
                        onClick={() => fetchMaintenanceRequests()}
                        className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        disabled={loading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    
                    <button 
                        onClick={() => setShowFilters(!showFilters)}
                        className="flex items-center px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <SlidersHorizontal className="h-4 w-4 mr-1" />
                        {showFilters ? 'Hide Filters' : 'Show Filters'}
                    </button>
                </div>
            </div>
            
            {/* Stats summary moved to the top */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <p className="text-sm font-medium text-gray-500">Total Requests</p>
                    <p className="text-2xl font-bold text-gray-800">{maintenanceRequests.length}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <p className="text-sm font-medium text-gray-500">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                        {maintenanceRequests.filter(r => r.status === 'Pending').length}
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <p className="text-sm font-medium text-gray-500">In Progress</p>
                    <p className="text-2xl font-bold text-blue-600">
                        {maintenanceRequests.filter(r => r.status === 'In Progress').length}
                    </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4 text-center">
                    <p className="text-sm font-medium text-gray-500">Completed</p>
                    <p className="text-2xl font-bold text-green-600">
                        {maintenanceRequests.filter(r => r.status === 'Completed').length}
                    </p>
                </div>
            </div>
            
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="flex-grow">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                    <button 
                        className="text-red-500 hover:text-red-700"
                        onClick={() => setError('')}
                        aria-label="Dismiss"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            )}

            {success && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="flex-grow">
                        <p className="text-sm text-green-700">{success}</p>
                    </div>
                    <button 
                        className="text-green-500 hover:text-green-700"
                        onClick={() => setSuccess('')}
                        aria-label="Dismiss"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            )}
            
            {/* Search and Filters */}
            <div className={`${showFilters ? 'block' : 'hidden'} bg-white rounded-lg shadow-md p-4 mb-4`}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                        <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                id="search"
                                className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-12 sm:text-sm border-gray-300 rounded-md"
                                placeholder="Search requests..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                    <button 
                                        onClick={() => setSearchTerm('')}
                                        className="text-gray-400 hover:text-gray-500"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            id="status-filter"
                            className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>
                    </div>
                    
                    <div>
                        <label htmlFor="priority-filter" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select
                            id="priority-filter"
                            className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                        >
                            <option value="All">All Priorities</option>
                            <option value="Emergency">Emergency</option>
                            <option value="High Priority">High Priority</option>
                            <option value="Medium Priority">Medium Priority</option>
                            <option value="Low Priority">Low Priority</option>
                            <option value="Unassigned">Unassigned</option>
                        </select>
                    </div>
                    
                    <div>
                        <label htmlFor="sort-order" className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                        <select
                            id="sort-order"
                            className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="priority">Priority (Highest First)</option>
                        </select>
                    </div>
                </div>
                
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={resetFilters}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>
            
            {/* Maintenance Requests List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="bg-white shadow rounded-lg p-8 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                        <p className="text-gray-500">Loading maintenance requests...</p>
                    </div>
                ) : filteredRequests.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                        {filteredRequests.map((request) => (
                            <div key={request.id} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                                <div className="p-4">
                                    <div className="flex flex-col md:flex-row justify-between">
                                        <div className="flex-grow mb-2 md:mb-0">
                                            <div className="flex items-center">
                                                <h3 className="font-semibold text-lg text-gray-900">{request.title}</h3>
                                                {request.imageUrl && (
                                                <span className="ml-2 flex items-center text-blue-600">
                                                <ImageIcon className="h-4 w-4" />
                                                </span>
                                                )}
                                                <button
                                                    onClick={() => toggleRequestExpansion(request.id)}
                                                    className="ml-2 text-gray-400 hover:text-gray-600"
                                                    aria-label={expandedRequests[request.id] ? "Collapse details" : "Expand details"}
                                                >
                                                    <svg className={`h-5 w-5 transform transition-transform ${expandedRequests[request.id] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                                                    {request.status}
                                                </span>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                                                    {request.priority}
                                                </span>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    <Calendar className="mr-1 h-3 w-3" />
                                                    {request.createdAt ? formatDate(request.createdAt) : 'Unknown date'}
                                                </span>
                                            </div>
                                            
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-3 text-sm text-gray-500">
                                                <div className="flex items-center">
                                                    <UserCircle className="h-4 w-4 mr-1 text-gray-400" />
                                                    {request.userName && !request.userName.includes('@') ? request.userName : (request.fullName || 'Unknown')}
                                                </div>
                                                <div className="flex items-center">
                                                    <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                                                    {request.location || 'No location specified'}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-col sm:flex-row gap-2 md:ml-4">
                                            <select
                                                className={`text-sm border rounded-md p-1.5 ${getStatusColor(request.status)} border-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                                                value={request.status}
                                                onChange={(e) => handleMaintenanceStatusChange(request.id, e.target.value)}
                                                disabled={actionLoading}
                                                aria-label="Change status"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Cancelled">Cancelled</option>
                                            </select>
                                            
                                            <select
                                                className={`text-sm border rounded-md p-1.5 ${getPriorityColor(request.priority)} border-transparent focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                                                value={request.priority}
                                                onChange={(e) => handlePriorityChange(request.id, e.target.value)}
                                                disabled={actionLoading}
                                                aria-label="Change priority"
                                            >
                                                <option value="Unassigned">Unassigned</option>
                                                <option value="Low Priority">Low Priority</option>
                                                <option value="Medium Priority">Medium Priority</option>
                                                <option value="High Priority">High Priority</option>
                                                <option value="Emergency">Emergency</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    {expandedRequests[request.id] && (
                                        <div className="mt-4">
                                            <div className="bg-gray-50 p-3 rounded-md mb-3">
                                                <h4 className="font-medium text-sm text-gray-700 mb-1">Description:</h4>
                                                <p className="text-gray-700 whitespace-pre-line">{request.description}</p>
                                            </div>
                                            {/* Image Section - New */}
                                            {request.imageUrl && (
                                                <div className="mt-4">
                                                    <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                                                        <ImageIcon className="mr-1 h-4 w-4 text-gray-500" />
                                                        Attached Image
                                                    </h4>
                                                    <div className="max-w-md">
                                                        <MaintenanceRequestImage 
                                                            imageUrl={request.imageUrl} 
                                                            altText={`Image for ${request.title}`} 
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                                                                        
                                            {/* Comments Section */}
                                            <div className="mt-4">
                                                <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center">
                                                    <MessageSquare className="mr-1 h-4 w-4 text-gray-500" />
                                                    Comments ({request.comments?.length || 0})
                                                </h4>
                                                
                                                {request.comments && request.comments.length > 0 ? (
                                                    <div className="space-y-2 max-h-64 overflow-y-auto p-1">
                                                        {request.comments.map((comment, index) => (
                                                            <div key={index} className={`p-3 rounded-lg ${comment.isAdminReply ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-gray-50'}`}>
                                                                <p className="text-sm whitespace-pre-line">{comment.content}</p>
                                                                <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                                                                    <span className={`font-medium ${comment.isAdminReply ? 'text-blue-600' : 'text-gray-600'}`}>
                                                                        {comment.isAdminReply ? 'Admin Reply' : 'User Comment'}
                                                                    </span>
                                                                    <span className="flex items-center">
                                                                        <Clock className="h-3 w-3 mr-1" />
                                                                        {comment.createdAt instanceof Date 
                                                                            ? comment.createdAt.toLocaleString() 
                                                                            : comment.createdAt?.toDate 
                                                                                ? comment.createdAt.toDate().toLocaleString()
                                                                                : 'Unknown date'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic">No comments yet.</p>
                                                )}
                                                
                                                {/* Reply Form */}
                                                <div className="mt-3">
                                                    {selectedRequest === request.id ? (
                                                        <div>
                                                            <div className="mb-2">
                                                                <label htmlFor="quick-replies" className="block text-xs font-medium text-gray-700 mb-1">
                                                                    Quick Replies:
                                                                </label>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {quickReplies.map((reply, index) => (
                                                                        <button
                                                                            key={index}
                                                                            type="button"
                                                                            onClick={() => useQuickReply(reply)}
                                                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                                                                        >
                                                                            {reply.length > 30 ? reply.substring(0, 30) + '...' : reply}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            
                                                            <textarea
                                                                className="w-full border rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                                                placeholder="Write a reply to the user..."
                                                                value={replyText}
                                                                onChange={(e) => setReplyText(e.target.value)}
                                                                rows="3"
                                                            />
                                                            <div className="flex flex-wrap gap-2 mt-2">
                                                                <button
                                                                    className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors flex items-center"
                                                                    onClick={() => handleMaintenanceReply(request.id, replyText)}
                                                                    disabled={actionLoading || !replyText.trim()}
                                                                >
                                                                    {actionLoading ? (
                                                                        <>
                                                                            <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                                                            Sending...
                                                                        </>
                                                                    ) : (
                                                                        'Send Reply'
                                                                    )}
                                                                </button>
                                                                <button
                                                                    className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md text-sm hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                                                                    onClick={() => {
                                                                        setSelectedRequest(null);
                                                                        setReplyText('');
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2">
                                                            <button
                                                                className="flex items-center bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-md text-sm transition-colors"
                                                                onClick={() => {
                                                                    setSelectedRequest(request.id);
                                                                    setReplyText('');
                                                                }}
                                                            >
                                                                <MessageSquare className="h-4 w-4 mr-1" />
                                                                Reply to User
                                                            </button>
                                                            
                                                            {request.status !== 'Cancelled' && (
                                                                <button
                                                                    className="flex items-center bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-sm transition-colors"
                                                                    onClick={() => setRequestToDelete(request)}
                                                                >
                                                                    <Trash className="h-4 w-4 mr-1" />
                                                                    Cancel Request
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white shadow rounded-lg p-8 text-center">
                        <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                            <Wrench className="h-full w-full" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">No maintenance requests found</h3>
                        <p className="text-gray-500">
                            {searchTerm || statusFilter !== 'All' || priorityFilter !== 'All' ? 
                                'Try adjusting your filters or search terms' : 
                                'No maintenance requests have been submitted yet'}
                        </p>
                        {(searchTerm || statusFilter !== 'All' || priorityFilter !== 'All') && (
                            <button
                                onClick={resetFilters}
                                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Confirmation Modal for Deleting/Cancelling Request */}
            {requestToDelete && (
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
                                            Cancel Maintenance Request
                                        </h3>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">
                                                Are you sure you want to cancel the maintenance request "{requestToDelete.title}"? This action cannot be undone.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button 
                                    type="button" 
                                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => handleDeleteRequest(requestToDelete.id)}
                                    disabled={actionLoading}
                                >
                                    {actionLoading ? (
                                        <>
                                            <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                                            Processing...
                                        </>
                                    ) : (
                                        'Yes, Cancel Request'
                                    )}
                                </button>
                                <button 
                                    type="button" 
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => setRequestToDelete(null)}
                                    disabled={actionLoading}
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

export default MaintenanceRequests;