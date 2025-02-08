import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, updateDoc, doc, where } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../contexts/AuthContext';

const MaintenanceRequest = () => {
  const [requests, setRequests] = useState([]);
  const [newRequest, setNewRequest] = useState({
    title: '',
    description: '',
    priority: 'medium',
    location: '',
  });
  const [loading, setLoading] = useState(false);
  const { currentUser, userRole } = useAuth();

  useEffect(() => {
    let q;
    if (userRole === 'admin') {
      q = query(collection(db, 'maintenance_requests'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'maintenance_requests'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRequests(requestsData);
    });

    return () => unsubscribe();
  }, [currentUser.uid, userRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'maintenance_requests'), {
        ...newRequest,
        userId: currentUser.uid,
        userName: currentUser.displayName,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedTo: null,
        comments: []
      });

      setNewRequest({
        title: '',
        description: '',
        priority: 'medium',
        location: ''
      });
    } catch (error) {
      console.error('Error submitting request:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (requestId, newStatus) => {
    try {
      const requestRef = doc(db, 'maintenance_requests', requestId);
      await updateDoc(requestRef, {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const addComment = async (requestId, comment) => {
    try {
      const requestRef = doc(db, 'maintenance_requests', requestId);
      await updateDoc(requestRef, {
        comments: [...requests.find(r => r.id === requestId).comments, {
          content: comment,
          userId: currentUser.uid,
          userName: currentUser.displayName,
          createdAt: new Date()
        }],
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="bg-white shadow-lg rounded-lg mb-6">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Submit Maintenance Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Request Title"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newRequest.title}
                onChange={(e) => setNewRequest({ ...newRequest, title: e.target.value })}
                required
              />
            </div>
            <div>
              <textarea
                placeholder="Description"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newRequest.description}
                onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                required
                rows={4}
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Location"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newRequest.location}
                onChange={(e) => setNewRequest({ ...newRequest, location: e.target.value })}
                required
              />
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newRequest.priority}
                onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        {requests.map((request) => (
          <div key={request.id} className="bg-white shadow-lg rounded-lg mb-4">
            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{request.title}</h3>
                  <p className="text-sm text-gray-500">
                    Submitted by {request.userName} on{' '}
                    {new Date(request.createdAt.toDate()).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  request.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {request.status}
                </span>
              </div>
              
              <p className="mt-4">{request.description}</p>
              <div className="flex items-center space-x-2 mt-4">
                <span className="text-sm text-gray-500">Location: {request.location}</span>
                <span className="text-sm text-gray-500">Priority: {request.priority}</span>
              </div>

              {userRole === 'admin' && (
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={() => updateStatus(request.id, 'in_progress')}
                    disabled={request.status === 'in_progress'}
                    className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => updateStatus(request.id, 'completed')}
                    disabled={request.status === 'completed'}
                    className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Mark Completed
                  </button>
                </div>
              )}

              <div className="mt-6">
                <h4 className="font-semibold mb-2">Comments</h4>
                {request.comments?.map((comment, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded mb-2">
                    <p>{comment.content}</p>
                    <p className="text-sm text-gray-500">
                      {comment.userName} - {new Date(comment.createdAt.toDate()).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MaintenanceRequest;