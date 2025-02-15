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
    and,
    or,
    arrayUnion
} from 'firebase/firestore';

const Notifications = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [viewedNotifications, setViewedNotifications] = useState(new Set());
    const { currentUser } = useAuth();
    const db = getFirestore();

    useEffect(() => {
        if (!currentUser?.uid) return;

        // Create queries for both personal notifications and announcements
        const personalQuery = query(
            collection(db, 'notifications'),
            and(
                where('userId', '==', currentUser.uid),
                where('read', '==', false)
            ),
            orderBy('createdAt', 'desc')
        );

        const announcementQuery = query(
            collection(db, 'announcements'),
            orderBy('createdAt', 'desc')
        );

        // Subscribe to personal notifications
        const unsubscribePersonal = onSnapshot(personalQuery, (snapshot) => {
            const personalNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                type: doc.data().type,
                ...doc.data()
            }));
            setNotifications(currentNotifications => {
                const announcements = currentNotifications.filter(n => n.isAnnouncement);
                return [...personalNotifications, ...announcements].sort((a, b) => 
                    b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
            });
        });

        // Subscribe to announcements
        const unsubscribeAnnouncements = onSnapshot(announcementQuery, (snapshot) => {
            const announcements = snapshot.docs.map(doc => ({
                id: doc.id,
                type: 'announcement',
                isAnnouncement: true,
                content: doc.data().content,
                createdAt: doc.data().createdAt,
                read: doc.data().read?.[currentUser.uid] || false
            })).filter(announcement => !announcement.read);

            setNotifications(currentNotifications => {
                const personal = currentNotifications.filter(n => !n.isAnnouncement);
                return [...personal, ...announcements].sort((a, b) => 
                    b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
            });
        });

        return () => {
            unsubscribePersonal();
            unsubscribeAnnouncements();
        };
    }, [currentUser]);

    const markAsRead = async (notification) => {
        if (notification.isAnnouncement) {
            const announcementRef = doc(db, 'announcements', notification.id);
            await updateDoc(announcementRef, {
                [`read.${currentUser.uid}`]: true
            });
        } else {
            const notificationRef = doc(db, 'notifications', notification.id);
            await updateDoc(notificationRef, {
                read: true
            });
        }
    };

    const handleBellClick = () => {
        if (!isExpanded) {
            const newViewedNotifications = new Set(notifications.map(n => n.id));
            setViewedNotifications(newViewedNotifications);
        }
        setIsExpanded(!isExpanded);
    };

    const unviewedCount = notifications.filter(n => !viewedNotifications.has(n.id)).length;

    const renderNotificationContent = (notification) => {
        switch (notification.type) {
            case 'announcement':
                return (
                    <>
                        <p className="font-medium text-sm">
                            New Announcement
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                            {notification.content}
                        </p>
                    </>
                );
            case 'maintenance_reply':
                return (
                    <>
                        <p className="font-medium text-sm">
                            Maintenance Request: {notification.maintenanceTitle}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                            {notification.content}
                        </p>
                    </>
                );
            default:
                return (
                    <p className="text-sm text-gray-600">
                        {notification.content}
                    </p>
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
                {unviewedCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                        {unviewedCount}
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
                                    className="p-3 hover:bg-gray-50 border-b cursor-pointer"
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

                    <div className="border-t p-3">
                        <button className="w-full text-sm text-blue-600 hover:text-blue-700 text-right">
                            See all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;