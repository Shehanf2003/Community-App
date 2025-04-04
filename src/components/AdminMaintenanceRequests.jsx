import React, { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';

const MaintenanceRequests = ({ currentUser }) => {
    const [maintenanceRequests, setMaintenanceRequests] = useState([]);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const db = getFirestore();

    useEffect(() => {
        fetchMaintenanceRequests();
    }, []);

    const fetchMaintenanceRequests = async () => {
        try {
            const q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const requestsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMaintenanceRequests(requestsList);
        } catch (err) {
            setError('Error fetching maintenance requests: ' + err.message);
        }
    };

    const handleMaintenanceStatusChange = async (requestId, newStatus) => {
        setLoading(true);
        try {
            const requestRef = doc(db, 'maintenance_requests', requestId);
            await updateDoc(requestRef, {
                status: newStatus,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser.uid
            });
            await fetchMaintenanceRequests(); // Refresh the list
            setSuccess('Status updated successfully');
        } catch (error) {
            setError('Error updating status: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMaintenanceReply = async (requestId, replyText) => {
        if (!replyText.trim()) return;
        setLoading(true);
        
        try {
            const requestRef = doc(db, 'maintenance_requests', requestId);
            const request = maintenanceRequests.find(r => r.id === requestId);
            
            // Create a new Date object for the comment timestamp
            const currentDate = new Date();
            
            // Add the reply to maintenance request with a regular timestamp
            await updateDoc(requestRef, {
                comments: [...(request.comments || []), {
                    content: replyText,
                    createdAt: currentDate,
                    createdBy: currentUser.uid,
                    isAdminReply: true
                }],
                lastUpdated: serverTimestamp() // This is fine outside the array
            });
    
            // Create notification for the user
            const notificationRef = collection(db, 'notifications');
            await addDoc(notificationRef, {
                userId: request.userId,
                type: 'maintenance_reply',
                requestId: requestId,
                content: replyText,
                read: false,
                createdAt: serverTimestamp(), // This is fine for a new document
                maintenanceTitle: request.title
            });
    
            // Clear the reply text for this request
            if (selectedRequest === requestId) {
                setReplyText('');
                setSelectedRequest(null);
            }
    
            await fetchMaintenanceRequests();
            setSuccess('Reply sent successfully');
        } catch (error) {
            setError('Error sending reply: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    {success}
                </div>
            )}
            
            <div className="space-y-4">
                <h3 className="text-xl font-semibold mb-4">Maintenance Requests</h3>
                
                {maintenanceRequests.length > 0 ? (
                    maintenanceRequests.map((request) => (
                        <div key={request.id} className="bg-white shadow rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-medium">{request.title}</h4>
                                    <p className="text-sm text-gray-500">
                                        Submitted by: {request.userName || 'Unknown'} | Location: {request.location}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        Priority: {request.priority} | Status: {request.status}
                                    </p>
                                </div>
                                <select
                                    className="text-sm border rounded-md p-1"
                                    value={request.status}
                                    onChange={(e) => handleMaintenanceStatusChange(request.id, e.target.value)}
                                    disabled={loading}
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                            
                            <p className="text-gray-700">{request.description}</p>
                            
                            {request.comments && request.comments.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    <h5 className="font-medium">Comments:</h5>
                                    {request.comments.map((comment, index) => (
                                        <div key={index} className="bg-gray-50 p-2 rounded">
                                            <p className="text-sm">{comment.content}</p>
                                            <p className="text-xs text-gray-500">
                                                {comment.isAdminReply ? 'Admin Reply' : 'User Comment'} - {' '}
                                                {comment.createdAt instanceof Date 
                                                    ? comment.createdAt.toLocaleString() 
                                                    : comment.createdAt?.toDate 
                                                        ? comment.createdAt.toDate().toLocaleString()
                                                        : 'Unknown date'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="mt-3">
                                {selectedRequest === request.id ? (
                                    <div>
                                        <textarea
                                            className="w-full border rounded-md p-2 text-sm"
                                            placeholder="Write a reply..."
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                                                onClick={() => handleMaintenanceReply(request.id, replyText)}
                                                disabled={loading || !replyText.trim()}
                                            >
                                                Send Reply
                                            </button>
                                            <button
                                                className="bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm hover:bg-gray-400"
                                                onClick={() => {
                                                    setSelectedRequest(null);
                                                    setReplyText('');
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm"
                                        onClick={() => {
                                            setSelectedRequest(request.id);
                                            setReplyText('');
                                        }}
                                    >
                                        Reply
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 bg-white p-4 rounded-lg shadow">No maintenance requests found.</p>
                )}
            </div>
        </div>
    );
};

export default MaintenanceRequests;