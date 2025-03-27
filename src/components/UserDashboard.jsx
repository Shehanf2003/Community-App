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

}

export default UserDashboard;