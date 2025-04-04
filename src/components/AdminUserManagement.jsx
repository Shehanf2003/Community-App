import React, { useState, useEffect } from 'react';
import { getAuth, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Trash2, Edit2 } from "lucide-react";

const UserManagement = ({ currentUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('user');
    const [address, setAddress] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [deleteUserPassword, setDeleteUserPassword] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [serverStatus, setServerStatus] = useState('unknown');
    
    // New states for edit functionality
    const [editMode, setEditMode] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [editUsername, setEditUsername] = useState('');
    const [editFullName, setEditFullName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editAddress, setEditAddress] = useState('');

    // Generate apartment addresses programmatically
    const generateApartmentAddresses = () => {
        const addresses = [];
        const buildings = ['A', 'B', 'C'];
        
        for (const building of buildings) {
            // First floor apartments (101-105)
            for (let i = 1; i <= 5; i++) {
                addresses.push(`Apt 10${i}, Building ${building}, Sunshine Heights`);
            }
            
            // Second floor apartments (201-205)
            for (let i = 1; i <= 5; i++) {
                addresses.push(`Apt 20${i}, Building ${building}, Sunshine Heights`);
            }
            
            // Only Building C has a third floor
            if (building === 'C') {
                for (let i = 1; i <= 5; i++) {
                    addresses.push(`Apt 30${i}, Building ${building}, Sunshine Heights`);
                }
            }
        }
        
        return addresses;
    };
    
    const apartmentAddresses = generateApartmentAddresses();

    const auth = getAuth();
    const db = getFirestore();

    // Check backend server status on component mount
    useEffect(() => {
        checkBackendStatus();
        fetchUsers();
    }, []);

    // Function to check backend server status with more robust error handling
    const checkBackendStatus = async () => {
        try {
            const response = await fetch('/api/health', { 
                method: 'GET',
                // Add timeout to prevent long waits
                signal: AbortSignal.timeout(5000) 
            });
            
            if (response.ok) {
                setServerStatus('online');
            } else {
                console.warn('Health check returned non-OK status:', response.status);
                setServerStatus('error');
            }
        } catch (err) {
            console.error('Error checking backend status:', err);
            setServerStatus('offline');
        }
    };

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

        if (!fullName.trim()) {
            setError('Full name is required');
            setLoading(false);
            return;
        }

        if (!address) {
            setError('Address is required');
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

            // Check if address is already assigned
            const addressAssigned = usersSnapshot.docs.some(
                doc => doc.data().address === address
            );

            if (addressAssigned) {
                setError('This apartment address is already assigned to another user');
                setLoading(false);
                return;
            }

            // Create new user
            const userCredential = await auth.createUserWithEmailAndPassword(
                email,
                password
            );

            // Add user details to Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email,
                username,
                fullName,
                address,
                role,
                createdBy: currentUser.uid,
                createdAt: new Date().toISOString()
            });

            setSuccess('User registered successfully!');
            setEmail('');
            setPassword('');
            setUsername('');
            setFullName('');
            setRole('user');
            setAddress('');
            fetchUsers();
        } catch (err) {
            setError('Failed to register user: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // New function to initiate edit mode
    const initiateEditUser = (user) => {
        setUserToEdit(user);
        setEditUsername(user.username || '');
        setEditFullName(user.fullName || '');
        setEditRole(user.role || 'user');
        setEditAddress(user.address || '');
        setEditMode(true);
        setError('');
        setSuccess('');
    };

    // New function to handle user edit submission
    const handleEditUser = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        if (!editUsername.trim()) {
            setError('Username is required');
            setLoading(false);
            return;
        }

        if (!editFullName.trim()) {
            setError('Full name is required');
            setLoading(false);
            return;
        }

        if (!editAddress) {
            setError('Address is required');
            setLoading(false);
            return;
        }

        try {
            // Check if the new username already exists (excluding the current user)
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usernameExists = usersSnapshot.docs.some(
                doc => doc.id !== userToEdit.id && 
                      doc.data().username?.toLowerCase() === editUsername.toLowerCase()
            );

            if (usernameExists) {
                setError('Username already exists');
                setLoading(false);
                return;
            }

            // Check if the new address is already assigned (excluding the current user)
            if (editAddress !== userToEdit.address) {
                const addressAssigned = usersSnapshot.docs.some(
                    doc => doc.id !== userToEdit.id && doc.data().address === editAddress
                );

                if (addressAssigned) {
                    setError('This apartment address is already assigned to another user');
                    setLoading(false);
                    return;
                }
            }

            // Update user in Firestore
            await updateDoc(doc(db, 'users', userToEdit.id), {
                username: editUsername,
                fullName: editFullName,
                address: editAddress,
                role: editRole,
                updatedBy: currentUser.uid,
                updatedAt: new Date().toISOString()
            });

            setSuccess('User updated successfully!');
            setEditMode(false);
            setUserToEdit(null);
            fetchUsers();
        } catch (err) {
            setError('Failed to update user: ' + err.message);
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
            
            // Try to perform database-only deletion first to validate permissions
            try {
                // Test permission by writing to deleted_users collection
                const testDocRef = doc(db, 'deleted_users', 'test_' + new Date().getTime());
                await setDoc(testDocRef, { 
                    test: true,
                    createdAt: new Date().toISOString()
                });
                await deleteDoc(testDocRef);
                
                console.log('Permission test passed - admin can write to deleted_users collection');
            } catch (permErr) {
                if (permErr.code === 'permission-denied') {
                    setError(
                        'Permission denied. Your Firestore rules need to be updated to allow admins ' +
                        'to write to the deleted_users collection. Error details: ' + permErr.message
                    );
                    setLoading(false);
                    return;
                }
                // Other errors can be ignored as they might be related to the test document itself
                console.warn('Permission test error (non-critical):', permErr);
            }
            
            // Proceed with actual deletion
            if (serverStatus === 'offline') {
                // Fallback if the backend server is not available
                try {
                    // Archive user in deleted_users collection
                    await setDoc(doc(db, 'deleted_users', userToDelete.id), {
                        ...userToDelete,
                        deletedAt: new Date().toISOString(),
                        deletedBy: currentUser.uid
                    });
                    
                    // Delete from Firestore
                    await deleteDoc(doc(db, 'users', userToDelete.id));
                    
                    setSuccess(
                        'User deleted from database. IMPORTANT: Backend server is offline. ' +
                        'You must manually delete this user from Firebase Authentication. ' +
                        'User email: ' + userToDelete.email
                    );
                } catch (err) {
                    console.error('Error in database operations:', err);
                    if (err.code === 'permission-denied') {
                        setError(
                            'Permission denied. Make sure your Firestore rules allow admins to write to the deleted_users collection. ' +
                            'Error details: ' + err.message
                        );
                    } else {
                        setError('Failed to delete user: ' + err.message);
                    }
                    setLoading(false);
                    return;
                }
            } else {
                // Backend server is available, use it to delete the user
                // Get the admin's ID token for backend authentication
                const idToken = await currentUser.getIdToken(true);
                
                try {
                    // Call the backend API to delete the user with timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                    
                    // Try to determine the correct API URL
                    let apiUrl = '/api/deleteUser';
                    
                    // First, try the client-side API path
                    try {
                        console.log('Attempting to use API endpoint:', apiUrl);
                        const response = await fetch(apiUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                userId: userToDelete.id,
                                idToken: idToken
                            }),
                            signal: controller.signal
                        });
                        
                        clearTimeout(timeoutId);
                        
                        // Process the response
                        if (response.ok) {
                            try {
                                const data = await response.json();
                                setSuccess(data.message || 'User deleted successfully!');
                            } catch (jsonErr) {
                                // Even if we can't parse JSON, the operation may have succeeded
                                setSuccess('User deletion request was processed successfully.');
                            }
                        } else if (response.status === 404) {
                            throw new Error('API endpoint not found at ' + apiUrl);
                        } else {
                            try {
                                const errorData = await response.json();
                                throw new Error(errorData.error || `Failed with status ${response.status}`);
                            } catch (jsonErr) {
                                throw new Error(`Failed with status ${response.status}`);
                            }
                        }
                    } catch (apiError) {
                        // If the first attempt fails with a 404, try the server-side path
                        if (apiError.message.includes('API endpoint not found')) {
                            console.log('First API attempt failed, trying alternate endpoint');
                            apiUrl = '/deleteUser'; // Try the alternate path
                            
                            try {
                                const controller2 = new AbortController();
                                const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
                                
                                const response = await fetch(apiUrl, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        userId: userToDelete.id,
                                        idToken: idToken
                                    }),
                                    signal: controller2.signal
                                });
                                
                                clearTimeout(timeoutId2);
                                
                                if (response.ok) {
                                    try {
                                        const data = await response.json();
                                        setSuccess(data.message || 'User deleted successfully!');
                                    } catch (jsonErr) {
                                        setSuccess('User deletion request was processed successfully.');
                                    }
                                } else if (response.status === 404) {
                                    throw new Error('Alternate API endpoint also not found');
                                } else {
                                    try {
                                        const errorData = await response.json();
                                        throw new Error(errorData.error || `Failed with status ${response.status}`);
                                    } catch (jsonErr) {
                                        throw new Error(`Failed with status ${response.status}`);
                                    }
                                }
                            } catch (altApiError) {
                                // If both attempts fail, fall back to database-only deletion
                                console.error('Both API endpoints failed:', altApiError);
                                console.log('Falling back to database-only deletion');
                                
                                // Archive user in deleted_users collection
                                await setDoc(doc(db, 'deleted_users', userToDelete.id), {
                                    ...userToDelete,
                                    deletedAt: new Date().toISOString(),
                                    deletedBy: currentUser.uid
                                });
                                
                                // Delete from Firestore
                                await deleteDoc(doc(db, 'users', userToDelete.id));
                                
                                setSuccess(
                                    'User deleted from database. IMPORTANT: API endpoints not available. ' +
                                    'You must manually delete this user from Firebase Authentication. ' +
                                    'User email: ' + userToDelete.email
                                );
                            }
                        } else {
                            // If it's not a 404 error, rethrow for the outer catch
                            throw apiError;
                        }
                    }
                } catch (err) {
                    console.error('Error in handleDeleteUser:', err);
                    
                    if (err.name === 'AbortError') {
                        setError('Request timed out. Please try again or use manual deletion.');
                    } else if (err.message.includes('network') || err.message.includes('Failed to fetch')) {
                        setServerStatus('offline');
                        setError('Backend server is offline. Please try the manual deletion method.');
                    } else {
                        setError('Failed to delete user: ' + err.message);
                    }
                    setLoading(false);
                    return;
                }
            }
            
            setShowDeleteConfirm(false);
            setDeleteUserPassword('');
            setUserToDelete(null);
            fetchUsers();
        } catch (err) {
            console.error('Error in authentication:', err);
            
            if (err.code === 'auth/wrong-password') {
                setError('Incorrect admin password. Please try again.');
            } else {
                setError('Authentication error: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Render edit form
    const renderEditForm = () => {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 max-w-xl w-full">
                    <h3 className="text-lg font-medium mb-4">Edit User</h3>
                    <form onSubmit={handleEditUser} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Email (cannot be changed)
                            </label>
                            <input
                                type="email"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-100"
                                value={userToEdit?.email || ''}
                                disabled
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
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Full Name
                            </label>
                            <input
                                type="text"
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={editFullName}
                                onChange={(e) => setEditFullName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Role
                            </label>
                            <select
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value)}
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Apartment Address
                            </label>
                            <select
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={editAddress}
                                onChange={(e) => setEditAddress(e.target.value)}
                                required
                            >
                                <option value="">Select an apartment</option>
                                {apartmentAddresses.map((apt, index) => (
                                    <option key={index} value={apt}>{apt}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end space-x-3 pt-2">
                            <button
                                type="button"
                                className="px-4 py-2 text-gray-600"
                                onClick={() => {
                                    setEditMode(false);
                                    setUserToEdit(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                            >
                                {loading ? 'Updating...' : 'Update User'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    return (
        <div>
            {serverStatus === 'offline' && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                    <p className="font-bold">Backend Service Offline</p>
                    <p>The user management service is currently offline. You can still delete users from the database, but you'll need to manually delete them from Firebase Authentication.</p>
                </div>
            )}
            
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                Full Name
                            </label>
                            <input
                                type="text"
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
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

                        <div>
                            <label className="block text-sm font-medium text-gray-700">
                                Apartment Address
                            </label>
                            <select
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                required
                            >
                                <option value="">Select an apartment</option>
                                {apartmentAddresses.map((apt, index) => (
                                    <option key={index} value={apt}>{apt}</option>
                                ))}
                            </select>
                        </div>
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

            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-xl font-semibold mb-4">Registered Users</h3>
                {users.length > 0 ? (
                    users.map((user) => (
                        <div 
                            key={user.id} 
                            className="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-2"
                        >
                            <div>
                                <span className="font-medium">{user.username}</span> - <span className="text-sm">{user.fullName || 'No name'}</span>
                                <div className="text-sm text-gray-500">Email: {user.email}</div>
                                <div className="text-sm text-gray-500">Role: {user.role}</div>
                                <div className="text-sm text-gray-500">Address: {user.address || 'No address'}</div>
                            </div>
                            <div className="flex space-x-2">
                                <button 
                                    className="text-blue-600 hover:text-blue-900"
                                    onClick={() => initiateEditUser(user)}
                                    disabled={loading}
                                >
                                    <Edit2 className="h-5 w-5" />
                                </button>
                                <button 
                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                    onClick={() => initiateDeleteUser(user)}
                                    disabled={loading || user.id === currentUser.uid}
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500">No users found.</p>
                )}
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
                        {serverStatus === 'offline' && (
                            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 mb-4">
                                <p className="text-yellow-700 text-sm">
                                    <strong>Note:</strong> Backend server is offline. User will be removed from the database, 
                                    but you'll need to manually delete them from Firebase Authentication.
                                </p>
                            </div>
                        )}
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

            {/* Edit User Modal */}
            {editMode && renderEditForm()}
        </div>
    );
};

export default UserManagement;