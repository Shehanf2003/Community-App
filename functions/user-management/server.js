// server.js - Express server with enhanced email notification functionality
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

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

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
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

// Email helper functions
async function sendEmail(options) {
  try {
    const { to, bcc, subject, html, from } = options;
    
    const mailOptions = {
      from: from || `Sunshine Heights Apartments <${process.env.EMAIL_USER}>`,
      subject,
      html,
    };
    
    // Add recipients - either direct 'to' or BCC for mass emails
    if (to) mailOptions.to = to;
    if (bcc) mailOptions.bcc = bcc;
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Get admin details for email signature
async function getAdminDetails(adminUid) {
  try {
    const adminDoc = await admin.firestore().collection('users').doc(adminUid).get();
    if (adminDoc.exists) {
      return {
        name: adminDoc.data().fullName || adminDoc.data().username || 'Admin',
        email: adminDoc.data().email || process.env.EMAIL_USER
      };
    }
    return { name: 'Admin', email: process.env.EMAIL_USER };
  } catch (error) {
    console.error('Error getting admin details:', error);
    return { name: 'Admin', email: process.env.EMAIL_USER };
  }
}

// 1. Send user credentials after registration
app.post('/api/sendUserCredentials', async (req, res) => {
  try {
    const { idToken, newUserId, password } = req.body;

    if (!idToken || !newUserId || !password) {
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
        error: 'Not authorized. Only admins can send credential emails.' 
      });
    }
    
    // Get new user details from Firestore
    const newUserDoc = await admin.firestore().collection('users').doc(newUserId).get();
    
    if (!newUserDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'New user not found in database' 
      });
    }
    
    const userData = newUserDoc.data();
    const userEmail = userData.email;
    const username = userData.username || '';
    const fullName = userData.fullName || username;
    
    if (!userEmail) {
      return res.status(400).json({ 
        success: false, 
        error: 'New user has no email address' 
      });
    }

    // Get admin details for signature
    const adminDetails = await getAdminDetails(decodedToken.uid);

    // Create and send welcome email with credentials
    const emailSubject = 'Your Sunshine Heights Apartment Portal Account';
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Welcome to Sunshine Heights Apartment Portal</h2>
        <p>Hello ${fullName},</p>
        <p>Your account has been created by an administrator. You can now log in to the Sunshine Heights Apartment Portal with the following credentials:</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Username/Email:</strong> ${userEmail}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>
        <p><strong>Important:</strong> For security reasons, please change your password after your first login.</p>
        <p>If you have any questions, please contact the building management.</p>
        <p>Best regards,<br>${adminDetails.name}<br>Sunshine Heights Management</p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: userEmail,
      subject: emailSubject,
      html: emailHtml,
      from: `Sunshine Heights Apartments <${adminDetails.email}>`
    });
    
    if (emailResult.success) {
      return res.json({ success: true, message: 'Credentials email sent successfully' });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send email', 
        details: emailResult.error 
      });
    }
  } catch (error) {
    console.error('Error sending user credentials:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 2. Send announcement notifications
app.post('/api/sendAnnouncementNotification', async (req, res) => {
  try {
    const { idToken, announcementId } = req.body;

    if (!idToken || !announcementId) {
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
        error: 'Not authorized. Only admins can send announcement emails.' 
      });
    }
    
    // Get announcement details
    const announcementDoc = await admin.firestore().collection('announcements').doc(announcementId).get();
    
    if (!announcementDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Announcement not found' 
      });
    }
    
    const announcement = announcementDoc.data();
    
    // Get admin details for signature
    const adminDetails = await getAdminDetails(decodedToken.uid);

    // Prepare email content
    const emailSubject = `Announcement: ${announcement.title || 'New Announcement'}`;
    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">${announcement.title || 'Announcement from Sunshine Heights'}</h2>
      
      ${announcement.imageUrl ? `
        <div style="margin: 15px 0;">
          <img src="${announcement.imageUrl}" alt="Announcement Image" style="max-width: 100%; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
        </div>
      ` : ''}
      
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="white-space: pre-line;">${announcement.content}</p>
      </div>
      
      <p style="font-size: 0.9em; color: #6b7280;">Posted by: ${adminDetails.name}</p>
      <p style="font-size: 0.9em; color: #6b7280;">Date: ${new Date().toLocaleDateString()}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 0.8em; color: #6b7280;">This is an automated message from the Sunshine Heights Apartment Portal. Please do not reply to this email.</p>
    </div>
    `;

    // Send to appropriate recipients
    let recipientEmails = [];
    
    if (announcement.targetType === 'all') {
      // Send to all users
      const usersSnapshot = await admin.firestore().collection('users').get();
      recipientEmails = usersSnapshot.docs.map(doc => doc.data().email).filter(Boolean);
    } else if (announcement.targetType === 'specific' && Array.isArray(announcement.targetUsers) && announcement.targetUsers.length > 0) {
      // Send to specific users
      const promises = announcement.targetUsers.map(uid => 
        admin.firestore().collection('users').doc(uid).get()
      );
      const userDocs = await Promise.all(promises);
      recipientEmails = userDocs.map(doc => doc.exists ? doc.data().email : null).filter(Boolean);
    }

    if (recipientEmails.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid recipient emails found' 
      });
    }

    // Use BCC for privacy when sending to multiple recipients
    const emailResult = await sendEmail({
      from: `Sunshine Heights Apartments <${adminDetails.email}>`,
      subject: emailSubject,
      html: emailHtml,
      bcc: recipientEmails.join(',')
    });
    
    if (emailResult.success) {
      return res.json({ 
        success: true, 
        message: `Announcement email sent to ${recipientEmails.length} recipients` 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send announcement emails', 
        details: emailResult.error 
      });
    }
  } catch (error) {
    console.error('Error sending announcement notification:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 3. Send maintenance request reply notification
app.post('/api/sendMaintenanceReplyNotification', async (req, res) => {
  try {
    const { idToken, requestId, commentId } = req.body;

    if (!idToken || !requestId || !commentId) {
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
        error: 'Not authorized. Only admins can send maintenance reply emails.' 
      });
    }

    // Get admin's name
    const adminName = adminDoc.data().fullName || adminDoc.data().username || 'Admin';

    // Get maintenance request details
    const requestDoc = await admin.firestore().collection('maintenance_requests').doc(requestId).get();
    
    if (!requestDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Maintenance request not found' 
      });
    }
    
    const request = requestDoc.data();
    
    // Find the specific comment
    const comment = request.comments?.find(c => c.id === commentId);
    
    if (!comment) {
      return res.status(404).json({ 
        success: false, 
        error: 'Comment not found in request' 
      });
    }
    
    // Get user's email
    const userDoc = await admin.firestore().collection('users').doc(request.userId).get();
    
    if (!userDoc.exists || !userDoc.data().email) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found or has no email address' 
      });
    }

    const userEmail = userDoc.data().email;
    const userName = userDoc.data().fullName || userDoc.data().username || 'Resident';

    // Get admin details for signature
    const adminDetails = await getAdminDetails(decodedToken.uid);

    // Prepare email content
    const emailSubject = `Update on Your Maintenance Request: ${request.title || `Request #${requestId.slice(0, 8)}`}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Maintenance Request Update</h2>
        <p>Hello ${userName},</p>
        <p>There is an update on your maintenance request: <strong>${request.title || `Request #${requestId.slice(0, 8)}`}</strong></p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Response from Maintenance Staff:</h3>
          <p style="white-space: pre-line;">${comment.content}</p>
        </div>
        
        <p>You can log in to the Sunshine Heights Apartment Portal to view all details and updates regarding your request.</p>
        <p>If you have any questions, please don't hesitate to contact the management office.</p>
        <p>Best regards,<br>${adminDetails.name}<br>Sunshine Heights Maintenance</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="font-size: 0.8em; color: #6b7280;">This is an automated message from the Sunshine Heights Apartment Portal. Please do not reply to this email.</p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: userEmail,
      subject: emailSubject,
      html: emailHtml,
      from: `Sunshine Heights Apartments <${adminDetails.email}>`
    });
    
    if (emailResult.success) {
      return res.json({ success: true, message: 'Maintenance reply notification sent successfully' });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to send maintenance reply notification', 
        details: emailResult.error 
      });
    }
  } catch (error) {
    console.error('Error sending maintenance reply notification:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
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
  console.log(`Email notification endpoints are now configured`);
});