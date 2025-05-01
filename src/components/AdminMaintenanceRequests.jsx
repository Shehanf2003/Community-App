import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const AdminMaintenanceRequests = ({ currentUser }) => {
    const [AdminMaintenanceRequests, setMaintenanceRequests] = useState({});
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const db = getFirestore();
    const auth = getAuth();

    useEffect(() => {
        fetchMaintenanceRequests();
    }, []);

    const fetchMaintenanceRequests = async () => {
        setLoading(true);

        try{
            const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
            const querysnapshot = await getDocs(q);
            
            const requestsList = querysnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setMaintenanceRequests(requestsList);
            setFilteredRequests(requestsList);
            setLoading(false);

        }
    };




    return (
        <div className="p-4">
            <h1 className="text-x1 font-semibold">Maintenance Requests</h1>
        </div>
    );
};

export default AdminMaintenanceRequests;