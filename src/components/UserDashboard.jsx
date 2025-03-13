import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const UserDashboard = () => {
    const [announcements, setAnnouncements] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { currentUser } = useAuth();

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const announcementsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                isUnread: !doc.data().read?.[currentUser.uid]
            }));

            setAnnouncements(announcementsList);
            setUnreadCount(announcementsList.filter(a => a.isUnread).length);
        } catch (err) {
            console.error('Error fetching announcements:', err);
        }
    };

    const markAsRead = async (announcementId) => {
        try {
            const announcementRef = doc(db, 'announcements', announcementId);
            await updateDoc(announcementRef, {
                [`read.${currentUser.uid}`]: true
            });
            fetchAnnouncements();
        } catch (err) {
            console.error('Error marking announcement as read:', err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold">Announcements</h2>
                        {unreadCount > 0 && (
                            <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm">
                {unreadCount} new
              </span>
                        )}
                    </div>

                    <div className="space-y-6">
                        {announcements.map((announcement) => (
                            <div
                                key={announcement.id}
                                className={`border rounded-lg p-4 ${announcement.isUnread ? 'bg-blue-50' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-grow">
                                        <p className="text-gray-900 mb-2">{announcement.content}</p>
                                        {announcement.imageUrl && (
                                            <img
                                                src={announcement.imageUrl}
                                                alt="Announcement"
                                                className="mt-2 max-h-48 object-cover rounded"
                                            />
                                        )}
                                        <p className="text-sm text-gray-500 mt-2">
                                            Posted on {announcement.createdAt?.toDate().toLocaleDateString()}
                                        </p>
                                    </div>
                                    {announcement.isUnread && (
                                        <button
                                            onClick={() => markAsRead(announcement.id)}
                                            className="ml-4 text-sm text-blue-600 hover:text-blue-800"
                                        >
                                            Mark as reads
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;