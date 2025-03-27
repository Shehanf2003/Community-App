import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './navbar';

const UserDashboard = () => {
    const [announcements, setAnnouncements] = useState([]);
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
                isNew: !doc.data().viewed?.[currentUser.uid]
            }));

            setAnnouncements(announcementsList);
        } catch (err) {
            console.error('Error fetching announcements:', err);
        }
    };

    const markAsViewed = async (announcementId) => {
        try {
            const announcementRef = doc(db, 'announcements', announcementId);
            
            // Update the viewed status in Firestore
            await updateDoc(announcementRef, {
                [`viewed.${currentUser.uid}`]: true
            });
            
            // Update local state to reflect the change
            setAnnouncements(prev => 
                prev.map(announcement => 
                    announcement.id === announcementId 
                        ? { ...announcement, isNew: false }
                        : announcement
                )
            );
        } catch (err) {
            console.error('Error marking announcement as viewed:', err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
          
            <div className="py-6 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white shadow rounded-lg p-6">
                        <h2 className="text-2xl font-bold mb-6">Announcements</h2>

                        <div className="space-y-6">
                            {announcements.map((announcement) => (
                                <div
                                    key={announcement.id}
                                    className={`border rounded-lg p-4 ${announcement.isNew ? 'bg-blue-50' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow">
                                            <p className={`text-gray-900 mb-2 ${announcement.isNew ? 'font-bold' : 'font-normal'}`}>
                                                {announcement.content}
                                                {announcement.isNew && (
                                                    <span className="ml-2 text-sm text-red-500">New</span>
                                                )}
                                            </p>
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
                                        {announcement.isNew && (
                                            <button
                                                onClick={() => markAsViewed(announcement.id)}
                                                className="ml-4 text-sm text-blue-600 hover:text-blue-800"
                                            >
                                                Mark as read
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDashboard;