import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { Wrench, AlertTriangle, CheckCircle, MessageSquare, Search, Filter, Calendar, X, RefreshCw, UserCircle, MapPin, PenSquare, Trash, SlidersHorizontal, Clock } from 'lucide-react';
import { getAuth } from 'firebase/auth';
import { use } from 'react';

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
            
            const requestsPromises = querySnapshot.docs.map(async docSnapshot => {
                const requestData = docSnapshot.data();
                const requestWithId = {
                    id: docSnapshot.id,
                    ...requestData
                };

                if (!requestData.fullName && requestData.userID){
                    try{
                        const userDocRef = doc(db, 'users', requestData.userId); 
                        const userSnapshot = await getDoc(userDocRef); 
                        if (userSnapshot.exists()) { 
                            const userData = userSnapshot.data();
                            requestWithId.fullName = userData.fullName || userData.username || '';
                        }
                    } catch (error) {
                        console.error("Error fetching user details:", error);
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




    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold">Maintenance Requests</h1>
        </div>
    );
};

export default MaintenanceRequests;