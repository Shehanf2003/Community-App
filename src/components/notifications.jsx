import React, { useState, useEffect } from "react";
import { Bell} from "lucide-react";
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
    serverTimestamp 
} from 'firebase/firestore';

const Notifications = () => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const { currentUser } = useAuth();
    const db = getFirestore();

    useEffect(() => {
        if (!currentUser?.uid) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            where('read', '==', false),
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
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true
        });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 rounded-full hover:bg-gray-100 relative"
            >
                <Bell className="w-6 h-6 text-gray-700" />
                {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full">
                        {notifications.length}
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
                                    <p className="font-medium text-sm">
                                        Maintenance Request: {notification.maintenanceTitle}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {notification.content}
                                    </p>
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
