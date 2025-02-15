import { useState, useEffect } from 'react';
import { getAuth, createUserWithEmailAndPassword, EmailAuthProvider,reauthenticateWithCredential,signInWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc,  updateDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Trash2 } from "lucide-react";


const AdminDashboard = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [role, setRole] = useState('user');
    const [users, setUsers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [maintenanceRequests, setMaintenanceRequests] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleteUserPassword, setDeleteUserPassword] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('users');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [replyText, setReplyText] = useState('');

    const { currentUser } = useAuth();
    const auth = getAuth();
    const db = getFirestore();
    

    useEffect(() => {
        fetchUsers();
        fetchAnnouncements();
        fetchMaintenanceRequests();
    }, []);

    const fetchUsers = async () => {
        try {
            const usersCollection = collection(db, 'users');
            const usersSnapshot = await getDocs(usersCollection);
            const usersList = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersList);
        } catch (err) {
            setError('Error fetching users: ' + err.message);
        }
    };

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

    const fetchAnnouncements = async () => {
        try {
            const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const announcementsList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAnnouncements(announcementsList);
        } catch (err) {
            setError('Error fetching announcements: ' + err.message);
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

    const handleRegisterUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!username.trim()) {
            setError('Username is required');
            setLoading(false);
            return;
        }

        try {
            // Check if username already exists
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usernameExists = usersSnapshot.docs.some(
                doc => doc.data().username?.toLowerCase() === username.toLowerCase()
            );

            if (usernameExists) {
                setError('Username already exists');
                setLoading(false);
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email,
                username,
                role,
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString()
            });

            setSuccess('User registered successfully!');
            setEmail('');
            setPassword('');
            setUsername('');
            setRole('user');
            fetchUsers();
        } catch (err) {
            setError('Failed to register user: ' + err.message);
        } finally {
            setLoading(false);
        }
    };


    const initiateDeleteUser = (user) => {
        if (user.id === currentUser.uid) {
            setError('Cannot delete the current user');
            return;
        }
        setUserToDelete(user);
        setShowDeleteConfirm(true);
        setError('');
        setSuccess('');
    };

    const handleDeleteUser = async () => {
        if (!userToDelete || !deleteUserPassword) {
            setError('Password is required to delete user');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // First, reauthenticate the current admin user
            const credential = EmailAuthProvider.credential(
                currentUser.email,
                deleteUserPassword
            );
            await reauthenticateWithCredential(currentUser, credential);

            // Delete from Firestore first
            await deleteDoc(doc(db, 'users', userToDelete.id));

            // Create a new Auth instance for the user to be deleted
            const secondaryAuth = getAuth();
            
            try {
                // Sign out the current admin temporarily
                await auth.signOut();

                // Sign in as the user to be deleted
                const userCredential = await signInWithEmailAndPassword(
                    secondaryAuth,
                    userToDelete.email,
                    userToDelete.initialPassword // This would need to be stored when creating the user
                );

                // Delete the user from Authentication
                await deleteUser(userCredential.user);

                // Sign back in as admin
                await signInWithEmailAndPassword(auth, currentUser.email, deleteUserPassword);

                setSuccess('User deleted successfully from both Authentication and Firestore!');
                setShowDeleteConfirm(false);
                setDeleteUserPassword('');
                setUserToDelete(null);
                fetchUsers();
            } catch (authError) {
                // If we can't delete the Authentication user, restore Firestore document
                await setDoc(doc(db, 'users', userToDelete.id), userToDelete);
                setError('Failed to delete user from Authentication. The user may need to be deleted manually from the Firebase Console.');
            }
        } catch (err) {
            setError('Failed to delete user: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAnnouncementSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        setSuccess('');

        try {
            const announcementData = {
                content: newAnnouncement,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                read: {}
            };

            await addDoc(collection(db, 'announcements'), announcementData);
            
            setSuccess('Announcement posted successfully!');
            setNewAnnouncement('');
            fetchAnnouncements();
        } catch (err) {
            setError('Failed to post announcement: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white shadow rounded-lg p-6">
                    <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

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
                    {/* Tab Navigation */}
                    <div className="flex border-b mb-6">
                        <button
                            className={`px-4 py-2 mr-2 ${activeTab === 'users' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                            onClick={() => setActiveTab('users')}
                        >
                            User Management
                        </button>
                        <button
                            className={`px-4 py-2 mr-2 ${activeTab === 'maintenance' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                            onClick={() => setActiveTab('maintenance')}
                        >
                            Maintenance Requests
                        </button>
                        <button
                            className={`px-4 py-2 ${activeTab === 'announcements' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-600'}`}
                            onClick={() => setActiveTab('announcements')}
                        >
                            Announcements
                        </button>
                    </div>

                        {/* Tab Content */}
                        {activeTab === 'users' && (
                        <div>
                             <div className="bg-gray-50 p-6 rounded-lg mb-6">
                        <h3 className="text-xl font-semibold mb-4">Register New User</h3>
                        <form onSubmit={handleRegisterUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Role
                                </label>
                                <select
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                {loading ? 'Registering...' : 'Register User'}
                            </button>
                        </form>
                        <div className="bg-white shadow rounded-lg p-6 mb-6">
                        <h3 className="text-xl font-semibold mb-4">Registered Users</h3>
                        {users.map((user) => (
                            <div 
                                key={user.id} 
                                className="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-2"
                            >
                                <div>
                                    <span className="font-medium">{user.username}</span>
                                    <span className="text-sm text-gray-500 ml-2">({user.email})</span>
                                    <span className="text-sm text-gray-500 ml-2">{user.role}</span>
                                </div>
                                <button 
                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    onClick={() => initiateDeleteUser(user)}
                                    disabled={loading || user.id === currentUser.uid}
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {showDeleteConfirm && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                                <h3 className="text-lg font-medium mb-4">Confirm User Deletion</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Please enter your admin password to confirm deletion of user: {userToDelete?.email}
                                </p>
                                <input
                                    type="password"
                                    className="w-full border rounded p-2 mb-4"
                                    placeholder="Your admin password"
                                    value={deleteUserPassword}
                                    onChange={(e) => setDeleteUserPassword(e.target.value)}
                                />
                                <div className="flex justify-end space-x-3">
                                    <button
                                        className="px-4 py-2 text-gray-600"
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setDeleteUserPassword('');
                                            setUserToDelete(null);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                        onClick={handleDeleteUser}
                                        disabled={loading}
                                    >
                                        {loading ? 'Deleting...' : 'Delete User'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    </div>
                        </div>
                    )}

                  
                    {activeTab === 'announcements' && (
                        <div>
                                               <div className="bg-white shadow rounded-lg p-6">
                        <h3 className="text-xl font-semibold mb-4">Post Announcement</h3>
                        <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">
                                    Announcement Content
                                </label>
                                <textarea
                                    required
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                    rows="4"
                                    value={newAnnouncement}
                                    onChange={(e) => setNewAnnouncement(e.target.value)}
                                    placeholder="Type your announcement here..."
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                {isSubmitting ? 'Posting...' : 'Post Announcement'}
                            </button>
                        </form>
                    </div>

                    <div className="mt-6">
                        <h3 className="text-xl font-semibold mb-4">Recent Announcements</h3>
                        <div className="space-y-4">
                            {announcements.map((announcement) => (
                                <div key={announcement.id} className="border rounded-lg p-4">
                                    <p className="text-gray-900 mb-2">{announcement.content}</p>
                                    <p className="text-sm text-gray-500 mt-2">
                                        Posted on {announcement.createdAt?.toDate().toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                        </div>
                    )}
                                    
                                    {activeTab === 'maintenance' && (
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <h3 className="text-xl font-semibold mb-4">Maintenance Requests</h3>
                                                
                                                {maintenanceRequests.map((request) => (
                                                    <div key={request.id} className="bg-white shadow rounded-lg p-4 space-y-3">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h4 className="font-medium">{request.title}</h4>
                                                                <p className="text-sm text-gray-500">
                                                                    Submitted by: {request.userName} | Location: {request.location}
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
                                                                            {comment.createdAt?.toDate().toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        
                                                        <div className="mt-3">
                                                            <textarea
                                                                className="w-full border rounded-md p-2 text-sm"
                                                                placeholder="Write a reply..."
                                                                value={selectedRequest === request.id ? replyText : ''}
                                                                onChange={(e) => {
                                                                    setSelectedRequest(request.id);
                                                                    setReplyText(e.target.value);
                                                                }}
                                                            />
                                                            <button
                                                                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                                                                onClick={() => handleMaintenanceReply(request.id, replyText)}
                                                                disabled={loading || !replyText.trim()}
                                                            >
                                                                Send Reply
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                </div>
                            </div>
    );
};

export default AdminDashboard;