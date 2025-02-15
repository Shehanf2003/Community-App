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
    or
} from 'firebase/firestore';

const Notifications = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [viewedNotifications, setViewedNotifications] = useState(new Set());
    const { currentUser } = useAuth();
    const db = getFirestore();

    useEffect(() => {
        if (!currentUser?.uid) return;

        // Create a properly structured query using and()
        const q = query(
            collection(db, 'notifications'),
            and(
                where('read', '==', false),
                or(
                    where('userId', '==', currentUser.uid),
                    where('type', '==', 'announcement')
                )
            ),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setNotifications(newNotifications);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const markAsRead = async (notificationId) => {
        const notificationRef = doc(db, 'notifications', notificationId);
        const notification = notifications.find(n => n.id === notificationId);
        
        if (notification.type === 'announcement') {
            // For announcements, update the read map with the current user's ID
            await updateDoc(notificationRef, {
                [`read.${currentUser.uid}`]: true
            });
        } else {
            // For maintenance notifications, mark as read normally
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
                                    onClick={() => markAsRead(notification.id)}
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