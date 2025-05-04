import React, { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCheck, Megaphone, Settings, MoreVertical, Wrench } from "lucide-react";
import { useAuth } from '../contexts/AuthContext';
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
    Timestamp,
    writeBatch
} from 'firebase/firestore';

const Notifications = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'unread', 'read'
    const [showDropdown, setShowDropdown] = useState(false);
    const [userRegistrationDate, setUserRegistrationDate] = useState(null);
    const dropdownRef = useRef(null);
    const notificationRef = useRef(null);
    const { currentUser } = useAuth();
    const db = getFirestore();

    // First, fetch the user's registration date
    useEffect(() => {
        if (!currentUser?.uid) return;
        
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
                }
            } catch (err) {
                console.error('Error fetching user registration date:', err);
                // Set a fallback date to avoid errors (show all announcements)
                setUserRegistrationDate(new Date(0));
            }
        };

        fetchUserData();
    }, [currentUser, db]);

    // Load all notifications, including read ones - after we have the registration date
    useEffect(() => {
        if (!currentUser?.uid || userRegistrationDate === null) return;
        setLoading(true);
        setError(null);

        try {
            const personalQuery = query(
                collection(db, 'notifications'),
                where('userId', '==', currentUser.uid),
                orderBy('createdAt', 'desc')
            );

            const announcementQuery = query(
                collection(db, 'announcements'),
                orderBy('createdAt', 'desc')
            );

            const unsubscribePersonal = onSnapshot(personalQuery, (snapshot) => {
                const personalNotifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    type: doc.data().type,
                    ...doc.data(),
                    isPersonal: true
                }));
                updateNotificationsAndCount(personalNotifications, 'personal');
                setLoading(false);
            }, (err) => {
                console.error("Error fetching personal notifications:", err);
                setError("Failed to load your notifications");
                setLoading(false);
            });

            const unsubscribeAnnouncements = onSnapshot(announcementQuery, (snapshot) => {
                // Filter announcements to only include those created after the user registered
                const announcements = snapshot.docs
                    .map(doc => ({
                        id: doc.id,
                        type: 'announcement',
                        isAnnouncement: true,
                        content: doc.data().content,
                        createdAt: doc.data().createdAt,
                        title: doc.data().title || 'Community Announcement',
                        imageUrl: doc.data().imageUrl,
                        read: doc.data().read?.[currentUser.uid] || false,
                        targetType: doc.data().targetType,
                        targetUsers: doc.data().targetUsers
                    }))
                    .filter(announcement => {
                        // Parse announcement date
                        const announcementDate = announcement.createdAt?.toDate 
                            ? announcement.createdAt.toDate() 
                            : new Date(announcement.createdAt);
                        
                        // Check if the announcement was created after the user registered
                        const isAfterRegistration = announcementDate > userRegistrationDate;
                        
                        // Check if the announcement is targeted to this user
                        const isTargetedToUser = 
                            announcement.targetType === undefined || // Legacy announcements
                            announcement.targetType === 'all' ||
                            (announcement.targetType === 'specific' && 
                            announcement.targetUsers && 
                            announcement.targetUsers.includes(currentUser.uid));
                        
                        // Only include announcements created after registration AND targeted to this user
                        return isAfterRegistration && isTargetedToUser;
                    });

                updateNotificationsAndCount(announcements, 'announcement');
                setLoading(false);
            }, (err) => {
                console.error("Error fetching announcements:", err);
                setError("Failed to load community announcements");
                setLoading(false);
            });

            return () => {
                unsubscribePersonal();
                unsubscribeAnnouncements();
            };
        } catch (err) {
            console.error("Error setting up notification listeners:", err);
            setError("Something went wrong");
            setLoading(false);
        }
    }, [currentUser, db, userRegistrationDate]);

    // Handle clicks outside the dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Update for keyboard accessibility (Escape to close)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsExpanded(false);
                setShowDropdown(false);
            }
        };

        if (isExpanded) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isExpanded]);

    const updateNotificationsAndCount = (newNotifications, type) => {
        setNotifications(currentNotifications => {
            const otherTypes = currentNotifications.filter(n => 
                type === 'personal' ? n.isAnnouncement : !n.isAnnouncement
            );
            const merged = [...otherTypes, ...newNotifications].sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return dateB - dateA;
            });
            
            // Update unread count
            const unreadItems = merged.filter(n => !n.read);
            setUnreadCount(unreadItems.length);
            
            return merged;
        });
    };

    const markAsRead = async (notification, e) => {
        // Prevent the event from bubbling up to parent elements
        if (e) {
            e.stopPropagation();
        }

        try {
            if (notification.isAnnouncement) {
                const announcementRef = doc(db, 'announcements', notification.id);
                // First get the current document to preserve existing read states
                const announcementDoc = await getDoc(announcementRef);
                const currentRead = announcementDoc.data()?.read || {};
                
                await updateDoc(announcementRef, {
                    read: {
                        ...currentRead,
                        [currentUser.uid]: true
                    }
                });
            } else {
                const notificationRef = doc(db, 'notifications', notification.id);
                await updateDoc(notificationRef, {
                    read: true,
                    viewedAt: Timestamp.now()
                });
            }
    
            // Update local state immediately
            setNotifications(currentNotifications => {
                return currentNotifications.map(n => {
                    if (n.id === notification.id) {
                        return { ...n, read: true };
                    }
                    return n;
                });
            });
            
            // Update unread count
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
            setError("Couldn't mark notification as read");
        }
    };
    
    const markAllAsRead = async () => {
        try {
            const batch = writeBatch(db);
            const unreadNotifications = notifications.filter(n => !n.read);
            
            for (const notification of unreadNotifications) {
                if (notification.isAnnouncement) {
                    const announcementRef = doc(db, 'announcements', notification.id);
                    const announcementDoc = await getDoc(announcementRef);
                    const currentRead = announcementDoc.data()?.read || {};
                    
                    batch.update(announcementRef, {
                        read: {
                            ...currentRead,
                            [currentUser.uid]: true
                        }
                    });
                } else {
                    const notificationRef = doc(db, 'notifications', notification.id);
                    batch.update(notificationRef, {
                        read: true,
                        viewedAt: Timestamp.now()
                    });
                }
            }
            
            await batch.commit();
            
            // Update local state
            setNotifications(currentNotifications => {
                return currentNotifications.map(n => ({ ...n, read: true }));
            });
            
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            setError("Couldn't mark all notifications as read");
        }
    };

    const handleBellClick = () => {
        setIsExpanded(!isExpanded);
        // Close the dropdown menu if it's open
        setShowDropdown(false);
    };

    const toggleDropdown = (e) => {
        e.stopPropagation();
        setShowDropdown(!showDropdown);
    };

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            markAsRead(notification);
        }
        
        // Here you could add navigation logic based on notification type
        // For example, navigate to maintenance request details:
        // if (notification.type === 'maintenance_reply') {
        //     navigate(`/maintenance/${notification.maintenanceId}`);
        // }
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        
        const now = new Date();
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'just now';
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        if (days < 7) return `${days}d ago`;
        
        return date.toLocaleDateString();
    };

    const getNotificationIcon = (notification) => {
        switch (notification.type) {
            case 'announcement':
                return <Megaphone className="w-5 h-5 text-blue-500" />;
            case 'maintenance_reply':
                return <Wrench className="w-5 h-5 text-amber-500" />;
            default:
                return <Bell className="w-5 h-5 text-gray-500" />;
        }
    };

    const filteredNotifications = () => {
        switch (activeTab) {
            case 'unread':
                return notifications.filter(n => !n.read);
            case 'read':
                return notifications.filter(n => n.read);
            default:
                return notifications;
        }
    };

    return (
        <div className="relative" ref={notificationRef}>
            <button
                onClick={handleBellClick}
                className="p-2 rounded-full hover:bg-gray-100 relative transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                aria-haspopup="true"
                aria-expanded={isExpanded}
            >
                <Bell className="w-6 h-6 text-gray-700" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isExpanded && (
                <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-xl w-96 max-w-[calc(100vw-2rem)] z-50 border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                        <h2 className="text-lg font-semibold">Notifications</h2>
                        <div className="flex items-center space-x-1">
                            {unreadCount > 0 && (
                                <button 
                                    onClick={markAllAsRead}
                                    className="p-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 transition-colors flex items-center"
                                    aria-label="Mark all as read"
                                    title="Mark all as read"
                                >
                                    <CheckCheck className="w-4 h-4 mr-1" />
                                    Mark all read
                                </button>
                            )}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={toggleDropdown}
                                    className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                                    aria-label="Notification options"
                                    title="Options"
                                >
                                    <MoreVertical className="w-5 h-5 text-gray-600" />
                                </button>
                                
                                {showDropdown && (
                                    <div className="absolute right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-20 py-1 w-48">
                                        <button
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                            onClick={() => setActiveTab('all')}
                                        >
                                            <Bell className="w-4 h-4 mr-2" />
                                            All notifications
                                        </button>
                                        <button
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                            onClick={() => setActiveTab('unread')}
                                        >
                                            <Bell className="w-4 h-4 mr-2" />
                                            Unread only
                                        </button>
                                        <button
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                            onClick={() => setActiveTab('read')}
                                        >
                                            <CheckCheck className="w-4 h-4 mr-2" />
                                            Read only
                                        </button>
                                        <hr className="my-1" />
                                        <button
                                            className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left"
                                        >
                                            <Settings className="w-4 h-4 mr-2" />
                                            Notification settings
                                        </button>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={() => setIsExpanded(false)}
                                className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                                aria-label="Close notifications"
                                title="Close"
                            >
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Tab navigation */}
                    <div className="flex border-b">
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'all' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'unread' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('unread')}
                        >
                            Unread {unreadCount > 0 && `(${unreadCount})`}
                        </button>
                        <button
                            className={`flex-1 py-2 text-sm font-medium ${activeTab === 'read' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                            onClick={() => setActiveTab('read')}
                        >
                            Read
                        </button>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[450px] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                        {error && (
                            <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                                <p className="flex items-center">
                                    <span className="mr-2">⚠️</span>
                                    {error}
                                </p>
                            </div>
                        )}
                        
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                                <p className="text-sm">Loading notifications...</p>
                            </div>
                        ) : filteredNotifications().length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                <Bell className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm font-medium mb-1">No notifications found</p>
                                <p className="text-xs text-gray-400">
                                    {activeTab === 'unread' 
                                        ? "You've read all your notifications" 
                                        : activeTab === 'read' 
                                        ? "You don't have any read notifications"
                                        : "You don't have any notifications"}
                                </p>
                            </div>
                        ) : (
                            filteredNotifications().map(notification => (
                                <div
                                    key={notification.id}
                                    className={`group border-b cursor-pointer transition-colors duration-200 hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}
                                    onClick={() => handleNotificationClick(notification)}
                                >
                                    <div className="flex p-4">
                                        <div className="flex-shrink-0 mr-3 mt-1">
                                            {getNotificationIcon(notification)}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            {notification.type === 'announcement' && (
                                                <div className="flex flex-col">
                                                    <h3 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                                                        {notification.title || 'Community Announcement'}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.content}</p>
                                                    {notification.imageUrl && (
                                                        <div className="mt-2 mr-2">
                                                            <img 
                                                                src={notification.imageUrl} 
                                                                alt="Announcement image" 
                                                                className="rounded-md h-24 object-cover w-full"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {notification.type === 'maintenance_reply' && (
                                                <div className="flex flex-col">
                                                    <h3 className={`text-sm ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                                                        Maintenance Request: {notification.maintenanceTitle}
                                                    </h3>
                                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.content}</p>
                                                </div>
                                            )}
                                            {notification.type !== 'announcement' && notification.type !== 'maintenance_reply' && (
                                                <p className={`text-sm ${!notification.read ? 'font-medium' : 'text-gray-600'}`}>
                                                    {notification.content}
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-xs text-gray-400">
                                                    {getTimeAgo(notification.createdAt)}
                                                </p>
                                                {!notification.read && (
                                                    <button
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                                                        onClick={(e) => markAsRead(notification, e)}
                                                        aria-label="Mark as read"
                                                    >
                                                        Mark as read
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {!notification.read && (
                                            <div className="flex-shrink-0 ml-2 self-start">
                                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
