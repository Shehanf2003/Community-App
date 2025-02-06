import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { getFirestore, collection, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Environment configuration
const GMAIL_CONFIG = {
  clientId: process.env.GMAIL_CLIENT_ID,
  clientSecret: process.env.GMAIL_CLIENT_SECRET,
  redirectUri: "https://developers.google.com/oauthplayground",
  refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  user: process.env.GMAIL_USER,
  fromName: process.env.SENDER_NAME || 'System Administrator'
};

// Email validation
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email);
};

// OAuth2 client setup
const oauth2Client = new google.auth.OAuth2(
  GMAIL_CONFIG.clientId,
  GMAIL_CONFIG.clientSecret,
  GMAIL_CONFIG.redirectUri
);

oauth2Client.setCredentials({ refresh_token: GMAIL_CONFIG.refreshToken });

// Token refresh utility
const refreshAccessToken = async () => {
  try {
    const { tokens } = await oauth2Client.refreshToken(GMAIL_CONFIG.refreshToken);
    return tokens.access_token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw new Error('Failed to refresh access token');
  }
};

// Email transport creation
const createTransport = async () => {
  const accessToken = await refreshAccessToken();
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: GMAIL_CONFIG.user,
      clientId: GMAIL_CONFIG.clientId,
      clientSecret: GMAIL_CONFIG.clientSecret,
      refreshToken: GMAIL_CONFIG.refreshToken,
      accessToken
    }
  });
};

// Batch processing utility
const batchEmails = (emails, batchSize = 50) => {
  const batches = [];
  for (let i = 0; i < emails.length; i += batchSize) {
    batches.push(emails.slice(i, i + batchSize));
  }
  return batches;
};

// Main email sending function
export const sendBulkEmail = async ({ 
  recipients = null,
  subject,
  content,
  isHtml = true,
  trackDelivery = false,
  announcementId = null
}) => {
  const db = getFirestore();
  try {
    // Get recipients from database if not provided
    let recipientEmails = recipients;
    if (!recipientEmails) {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      recipientEmails = usersSnapshot.docs
        .map(doc => doc.data().email)
        .filter(isValidEmail);
    }

    // Validate recipients
    if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      throw new Error('No valid recipient emails provided');
    }
    recipientEmails = recipientEmails.filter(isValidEmail);

    // Initialize transport
    const transport = await createTransport();
    const batches = batchEmails(recipientEmails);
    const results = [];

    // Process email batches
    for (const batch of batches) {
      const batchPromises = batch.map(async (to) => {
        const mailOptions = {
          from: `${GMAIL_CONFIG.fromName} <${GMAIL_CONFIG.user}>`,
          to,
          subject,
          ...(isHtml ? { html: content } : { text: content })
        };

        try {
          const result = await transport.sendMail(mailOptions);
          return {
            success: true,
            email: to,
            messageId: result.messageId
          };
        } catch (error) {
          console.error(`Failed to send email to ${to}:`, error);
          return {
            success: false,
            email: to,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay between batches
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const deliveryResults = {
      totalSent: successful.length,
      totalFailed: failed.length,
      failedEmails: failed.map(f => f.email),
      successful: successful.map(s => s.email),
      messageIds: successful.map(s => s.messageId)
    };

    // Track delivery status if requested
    if (trackDelivery && announcementId) {
      await trackDeliveryStatus(announcementId, deliveryResults);
    }

    return deliveryResults;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send emails: ${error.message}`);
  }
};

// Delivery tracking function
const trackDeliveryStatus = async (announcementId, results) => {
  const db = getFirestore();
  try {
    const announcementRef = doc(db, 'announcements', announcementId);
    await updateDoc(announcementRef, {
      emailDeliveryStatus: {
        ...results,
        sentAt: serverTimestamp()
      }
    });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    throw new Error(`Failed to track delivery status: ${error.message}`);
  }
};

export default sendBulkEmail;




  