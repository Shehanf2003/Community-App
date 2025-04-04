// server.js - Express server for handling Firebase user deletion
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Initialize Firebase Admin
// First, try to use environment variables if available
let adminConfig;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    adminConfig = { credential: admin.credential.cert(serviceAccount) };
  } catch (error) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT:', error);
  }
} else {
  // Fallback to local service account file
  try {
    const serviceAccount = require('./serviceAccountKey.json');
    adminConfig = { credential: admin.credential.cert(serviceAccount) };
  } catch (error) {
    console.error('Error loading serviceAccountKey.json:', error);
    console.error('Please make sure you have a valid service account key file');
    process.exit(1);
  }
}

admin.initializeApp(adminConfig);

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173', // Default Vite dev server port
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check endpoint - maintain both versions for compatibility
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Define the delete user endpoint at both paths for compatibility
const handleDeleteUser = async (req, res) => {
  try {
    const { userId, idToken } = req.body;
    
    if (!userId || !idToken) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }
    
    // Verify the admin's ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Check if user is an admin in Firestore
    const adminDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
    
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Not authorized. Only admins can delete users.' 
      });
    }
    
    // Get user data before deletion
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (userDoc.exists) {
      // Archive user in deleted_users collection for audit purposes
      await admin.firestore().collection('deleted_users').doc(userId).set({
        ...userDoc.data(),
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedBy: decodedToken.uid
      });
      
      // Delete from Firestore
      await admin.firestore().collection('users').doc(userId).delete();
      
      // Delete from Authentication
      await admin.auth().deleteUser(userId);
      
      return res.json({ 
        success: true, 
        message: 'User successfully deleted from both Firestore and Authentication' 
      });
    } else {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found in Firestore' 
      });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    // Provide more helpful error messages for common errors
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Your session has expired. Please log in again.';
      statusCode = 401;
    } else if (error.code === 'auth/id-token-revoked') {
      errorMessage = 'Your session has been revoked. Please log in again.';
      statusCode = 401;
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'User does not exist in Authentication.';
      statusCode = 404;
    } else if (error.code === 'auth/invalid-uid') {
      errorMessage = 'Invalid user ID format.';
      statusCode = 400;
    }
    
    return res.status(statusCode).json({ 
      success: false, 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Register the handler at both paths
app.post('/deleteUser', handleDeleteUser);
app.post('/api/deleteUser', handleDeleteUser);

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`User Management service running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health and http://localhost:${PORT}/api/health`);
  console.log(`Delete user endpoint available at: http://localhost:${PORT}/deleteUser and http://localhost:${PORT}/api/deleteUser`);
});