import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const UserDashboard = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedAnnouncement, setExpandedAnnouncement] = useState(null);
    const { currentUser } = useAuth();
    const [userRegistrationDate, setUserRegistrationDate] = useState(null);

    useEffect(() => {
        // First fetch the user's registration date, then fetch announcements
        const fetchUserData = async () => {
            try {
                const userDocRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    // Get registration date (convert from ISO string if needed)
                    let registrationDate = userDoc.data().registeredAt;
                    
                    // Handle different date formats (Firestore timestamp or ISO string)
                    if (registrationDate && typeof registrationDate === 'string') {
                        registrationDate = new Date(registrationDate);
                    } else if (registrationDate && registrationDate.toDate) {
                        registrationDate = registrationDate.toDate();
                    } else {
                        // If no registration date exists, use a fallback date (show all announcements)
                        registrationDate = new Date(0); // Jan 1, 1970
                    }
                    
                    setUserRegistrationDate(registrationDate);
                    // Now fetch announcements with the registration date
                    fetchAnnouncements(registrationDate);
                } else {
                    setError("User profile not found. Please contact administrator.");
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('Error fetching user data:', err);
                setError('Failed to load user data. Please try again later.');
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [currentUser.uid]);

    const fetchAnnouncements = async (registrationDate) => {
        setIsLoading(true);
        setError(null);
        try {
            const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            // Filter announcements client-side for visibility based on targeting and registration date
            const announcementsList = querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isNew: !doc.data().read?.[currentUser.uid]
                }))
                .filter(announcement => {
                    // Check if announcement was created after user registration
                    const announcementDate = announcement.createdAt?.toDate ? 
                        announcement.createdAt.toDate() : new Date(announcement.createdAt);
                    
                    const isAfterRegistration = registrationDate ? 
                        announcementDate > registrationDate : true;
                    
                    // Show announcement if:
                    // 1. It's created after user registration, and
                    // 2. It's targeted to all users, or
                    // 3. It's specifically targeted to this user
                    return isAfterRegistration && (
                        announcement.targetType === undefined || // Handle legacy announcements
                        announcement.targetType === 'all' ||
                        (announcement.targetType === 'specific' && 
                         announcement.targetUsers && 
                         announcement.targetUsers.includes(currentUser.uid))
                    );
                });

            setAnnouncements(announcementsList);
        } catch (err) {
            console.error('Error fetching announcements:', err);
            setError('Failed to load announcements. Please try again later.');
        } finally {
            setIsLoading(false);
        }
    };

    const markAsViewed = async (announcementId, event) => {
        event.stopPropagation(); // Prevent toggling the expanded state when clicking the button
        try {
            const announcementRef = doc(db, 'announcements', announcementId);
            
            await updateDoc(announcementRef, {
                [`read.${currentUser.uid}`]: true
            });
            
            setAnnouncements(prev => 
                prev.map(announcement => 
                    announcement.id === announcementId 
                        ? { ...announcement, isNew: false }
                        : announcement
                )
            );
        } catch (err) {
            console.error('Error marking announcement as viewed:', err);
            setError('Failed to mark announcement as read. Please try again.');
        }
    };

    const toggleExpandAnnouncement = (id) => {
        setExpandedAnnouncement(expandedAnnouncement === id ? null : id);
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const refreshAnnouncements = () => {
        if (userRegistrationDate) {
            fetchAnnouncements(userRegistrationDate);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="py-6 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-2xl font-bold">Announcements</h2>
                            <button 
                                onClick={refreshAnnouncements}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <svg className="-ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                )}
                                Refresh
                            </button>
                        </div>

                        {error && (
                            <div className="bg-red-50 border-l-4 border-red-500 p-4 m-6">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-red-700">
                                            {error}
                                        </p>
                                    </div>
                                    <div className="ml-auto pl-3">
                                        <div className="-mx-1.5 -my-1.5">
                                            <button
                                                onClick={() => setError(null)}
                                                className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                            >
                                                <span className="sr-only">Dismiss</span>
                                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="p-6">
                            {isLoading && announcements.length === 0 ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                                </div>
                            ) : announcements.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <h3 className="mt-2 text-lg font-medium text-gray-900">No announcements</h3>
                                    <p className="mt-1 text-sm text-gray-500">There are no new announcements for you at this time.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {announcements.map((announcement) => (
                                        <div
                                            key={announcement.id}
                                            className={`border rounded-lg shadow-sm transition-all duration-200 hover:shadow ${announcement.isNew ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}
                                            onClick={() => toggleExpandAnnouncement(announcement.id)}
                                        >
                                            <div className="p-4 cursor-pointer">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-grow">
                                                        <div className="flex items-center">
                                                            {announcement.isNew && (
                                                                <span className="inline-flex items-center mr-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                    New
                                                                </span>
                                                            )}
                                                            <h3 className={`text-gray-900 ${announcement.isNew ? 'font-bold' : 'font-medium'}`}>
                                                                {announcement.title || 'Announcement'}
                                                            </h3>
                                                        </div>
                                                        
                                                        <p className={`mt-1 text-gray-600 ${expandedAnnouncement === announcement.id ? '' : 'line-clamp-2'}`}>
                                                            {announcement.content}
                                                        </p>
                                                        
                                                        <p className="text-sm text-gray-500 mt-2">
                                                            {formatDate(announcement.createdAt)}
                                                            {announcement.targetType === 'specific' && announcement.targetUsers?.includes(currentUser.uid) && 
                                                                <span className="ml-2 text-blue-600 font-medium">(Sent directly to you)</span>
                                                            }
                                                        </p>
                                                    </div>
                                                    <div className="ml-4 flex-shrink-0 flex items-center">
                                                        {announcement.isNew && (
                                                            <button
                                                                onClick={(e) => markAsViewed(announcement.id, e)}
                                                                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                            >
                                                                Mark as read
                                                            </button>
                                                        )}
                                                        <svg 
                                                            className={`ml-2 h-5 w-5 text-gray-400 transform transition-transform duration-200 ${expandedAnnouncement === announcement.id ? 'rotate-180' : ''}`} 
                                                            xmlns="http://www.w3.org/2000/svg" 
                                                            viewBox="0 0 20 20" 
                                                            fill="currentColor"
                                                        >
                                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {expandedAnnouncement === announcement.id && (
                                                <div className="px-4 pb-4">
                                                    {announcement.imageUrl && (
                                                        <div className="mt-2 mb-4">
                                                            <img
                                                                src={announcement.imageUrl}
                                                                alt="Announcement"
                                                                className="w-full object-cover rounded shadow-sm hover:shadow transition-shadow duration-200 max-h-96"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(announcement.imageUrl, '_blank');
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    
                                                    {announcement.link && (
                                                        <div className="mt-3">
                                                            <a 
                                                                href={announcement.link} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-500"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                Learn more
                                                                <svg className="ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                </svg>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;