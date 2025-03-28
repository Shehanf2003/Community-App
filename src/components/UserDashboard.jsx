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

}
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
export default UserDashboard;