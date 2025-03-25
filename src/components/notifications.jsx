import React, { useState, useEffect } from "react";
import { Bell } from "lucide-react";
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
    Timestamp
} from 'firebase/firestore';

const Notifications = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { currentUser } = useAuth();
    const db = getFirestore();

    useEffect(() => {
        if (!currentUser?.uid) return;

        const personalQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('read', '==', false),
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
                ...doc.data()
            }));
            updateNotificationsAndCount(personalNotifications, 'personal');
        });

        const unsubscribeAnnouncements = onSnapshot(announcementQuery, (snapshot) => {
            const announcements = snapshot.docs.map(doc => ({
                id: doc.id,
                type: 'announcement',
                isAnnouncement: true,
                content: doc.data().content,
                createdAt: doc.data().createdAt,
                read: doc.data().read?.[currentUser.uid] || false
            })).filter(announcement => !announcement.read);

            updateNotificationsAndCount(announcements, 'announcement');
        });

        return () => {
            unsubscribePersonal();
            unsubscribeAnnouncements();
        };
    }, [currentUser]);

    const updateNotificationsAndCount = (newNotifications, type) => {
        setNotifications(currentNotifications => {
            const otherTypes = currentNotifications.filter(n => 
                type === 'personal' ? n.isAnnouncement : !n.isAnnouncement
            );
            const merged = [...otherTypes, ...newNotifications].sort((a, b) => 
                b.createdAt?.toDate?.() - a.createdAt?.toDate?.()
            );
            setUnreadCount(merged.length);
            return merged;
        });
    };

    const markAsRead = async (notification) => {
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
                const filtered = currentNotifications.filter(n => n.id !== notification.id);
                setUnreadCount(filtered.length);
                return filtered;
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleBellClick = () => {
        setIsExpanded(!isExpanded);
    };

    const renderNotificationContent = (notification) => {
        switch (notification.type) {
            case 'announcement':
                return (
                    <div className="flex flex-col">
                        <p className="font-medium text-sm">New Announcement</p>
                        <p className="text-sm text-gray-600 mt-1">{notification.content}</p>
                    </div>
                );
            case 'maintenance_reply':
                return (
                    <div className="flex flex-col">
                        <p className="font-medium text-sm">Maintenance Request: {notification.maintenanceTitle}</p>
                        <p className="text-sm text-gray-600 mt-1">{notification.content}</p>
                    </div>
                );
            default:
                return (
                    <p className="text-sm text-gray-600">{notification.content}</p>
                );
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleBellClick}
                className="p-2 rounded-full hover:bg-gray-100 relative"
            >
                <Bell className="w-6 h-6 text-gray-700" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isExpanded && (
                <div className="absolute right-0 mt-2 bg-white rounded-lg shadow-md w-80 z-10">
                    <div className="flex items-center justify-between p-4 border-b">
                        <h2 className="text-lg font-semibold">Notifications</h2>
                    </div>
                    <div className="p-4 max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                <Bell className="w-12 h-12 mb-4 opacity-50" />
                                <p className="text-sm">You have no notifications</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className="p-3 hover:bg-gray-50 border-b cursor-pointer transition-colors duration-200"
                                    onClick={() => markAsRead(notification)}
                                >
                                    {renderNotificationContent(notification)}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {notification.createdAt?.toDate().toLocaleString()}
                                    </p>
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

