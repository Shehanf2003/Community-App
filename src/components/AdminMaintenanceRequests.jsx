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
            console.warn('Email sendng failed:', emailResult.error);
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
      //fix this
      const sendMaintenanceReplyEmail = async (requestId, commentId) => {
        try {
            const idToken = await getIdToken(auth.currentUser);
    
            const response = await fetch('/api/sendMaintenanceReplyNotification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, requestId, commentId })
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
    
    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold">Maintenance Requests</h1>
        </div>
    );
};

export default MaintenanceRequests;