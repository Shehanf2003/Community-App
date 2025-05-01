import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const AdminMaintenanceRequests = ({ currentUser }) => {
    const [maintenanceRequests, setMaintenanceRequests] = useState({});
    const [filteredRequests, setFilteredRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const db = getFirestore();
    const auth = getAuth();

    useEffect(() => {
        fetchMaintenanceRequests();
    }, []);

    const fetchMaintenanceRequests = async () => {
        setLoading(true);
        setError('');

        try{
            const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            const requestsPromises = querySnapshot.docs.map(async docSnapshot => {
                const requestData = docSnapshot.data();
                const requestWithId = {
                    id: docSnapshot.id,
                    ...requestData
                };

                if (!requestData.fullName && requestData.userID){
                    try{
                        const userDocRef = doc(db, 'users', requestData.userId); 
                        const userSnapshot = await getDoc(userDocRef); 
                        if (userSnapshot.exists()) { 
                            const userData = userSnapshot.data();
                            requestWithId.fullName = userData.fullName || userData.username || '';
                        }
                    } catch (error) {
                        console.error("Error fetching user details:", error);
                    }
                }
            
                return requestWithId;
            });

            const requestsList = await Promise.all(requestsPromises);
            setMaintenanceRequests(requestsList);
        } catch (err) {
            setError('Error fetching maintenance requests: ' + err.message);
        } finally {
            setLoading(false);
        }
    };




    return (
        <div className="p-4">
            <h1 className="text-xl font-semibold">Maintenance Requests</h1>
        </div>
    );
};

export default MaintenanceRequests;