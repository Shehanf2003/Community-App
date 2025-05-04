import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { Wrench, AlertTriangle, CheckCircle, MessageSquare, Search, Filter, Calendar, X, RefreshCw, UserCircle, MapPin, PenSquare, Trash, SlidersHorizontal, Clock } from 'lucide-react';
import { getIdToken, getAuth } from 'firebase/auth';

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
    ])
    const [expandedRequests, setExpandedRequests] = useState({});

    const db = getFirestore();
    const auth = getAuth();

    useEffect(() => {
        fetchMaintenanceRequests();
    }, []);

    useEffect(() => {
        //Apply filters and search whenever the source data or filler criteria change
        applyFiltersAndSearch();
    }, [maintenanceRequests, statusFilter, priorityFilter, searchTerm, sortOrder])

    const applyFiltersAndSearch = () => {
        let filtered = [...maintenanceRequests];

        //Apply status filter
        if (statusFilter !== 'All') {
            filtered = filtered.filter(request => request.status === statusFilter);
        }

        //Apply priority filter
        if (priorityFilter !== 'All') {
            filtered = filtered.filter(request => request.priority === priorityFilter);
        }

        //Apply search
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

        //Apply sorting
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
    }

    const fetchMaintenanceRequests = async () => {
        setLoading(true);
        setError('');
        try{
            const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            //Process each request document
            const requestsPromises = querySnapshot.docs.map(async docSnapshot => {
                const requestData = docSnapshot.data();
                const requestWithId = {
                    id: docSnapshot.id,
                    ...requestData
                };

                // If there's no fullName but we have a userId, try to fetch the user's fullName
                if (!requestData.fullName && requestData.userId){
                    try{
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

            //Auto dismiss success message after 3 seconds
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
            //Get current user's ID token
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

            // Auto dismiss success messsage after 3 seconds
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
        
        // Check if data is valid
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
//4-
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


        </div>

    );
};

export default MaintenanceRequests;