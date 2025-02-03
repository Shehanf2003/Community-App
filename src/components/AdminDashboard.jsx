import { useState, useEffect } from 'react';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { sendAnnouncementEmail } from '../utils/emailService';
import { Trash2 } from "lucide-react";

const AdminDashboard = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [users, setUsers] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const { currentUser } = useAuth();
    const auth = getAuth();
    const db = getFirestore();

    useEffect(() => {
        fetchUsers();
        fetchAnnouncements();
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

    const handleRegisterUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email,
                role,
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString()
            });

            setSuccess('User registered successfully!');
            setEmail('');
            setPassword('');
            setRole('user');
            fetchUsers();
        } catch (err) {
            setError('Failed to register user: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (user) => {
        try {
            setError('');
            setSuccess('');
            setLoading(true);
            
            // Prevent deleting the current user
            if (user.id === currentUser.uid) {
                setError('Cannot delete the current user');
                return;
            }

            await deleteDoc(doc(db, 'users', user.id));
            setSuccess('User deleted successfully!');
            fetchUsers();
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
            
            const userEmails = users.map(user => user.email);
            await sendAnnouncementEmail(newAnnouncement, userEmails);

            setSuccess('Announcement posted and notifications sent successfully!');
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
                    </div>

                    <div className="bg-white shadow rounded-lg p-6 mb-6">
                        <h3 className="text-xl font-semibold mb-4">Registered Users</h3>
                        {users.map((user) => (
                            <div 
                                key={user.id} 
                                className="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-2"
                            >
                                <div>
                                    <span className="font-medium">{user.email}</span>
                                    <span className="text-sm text-gray-500 ml-2">({user.role})</span>
                                </div>
                                <button 
                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    onClick={() => handleDeleteUser(user)}
                                    disabled={loading || user.id === currentUser.uid}
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                    </div>

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
            </div>
        </div>
    );
};

export default AdminDashboard;