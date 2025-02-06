import emailjs from '@emailjs/browser';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

// Initialize EmailJS with your public key
emailjs.init("rnu7xzpqcoqL_gqdK");

export const sendAnnouncementEmail = async (announcement, userEmails) => {
    const db = getFirestore();
    
    try {
        // Verify that we have valid user emails
        if (!userEmails || userEmails.length === 0) {
            // Fetch all users from Firebase if no emails provided
            const usersSnapshot = await getDocs(collection(db, 'users'));
            userEmails = usersSnapshot.docs.map(doc => doc.data().email);
        }

        // Filter out any invalid emails
        const validEmails = userEmails.filter(email => email && typeof email === 'string');

        if (validEmails.length === 0) {
            throw new Error('No valid email addresses found');
        }

        // Create batch of email sending promises
        const emailPromises = validEmails.map(async (email) => {
            const templateParams = {
                to_email: email,
                from_name: 'Community Admin',
                announcement_content: announcement,
                reply_to: '', // Add a default reply-to address if needed
                user_platform: 'Web Platform',
                user_browser: 'System Browser',
                user_version: '1.0.0',
                user_country: 'Default'
            };

            try {
                const result = await emailjs.send(
                    'service_s0zaiaf',
                    'template_d4rmqcd',
                    templateParams
                );
                
                return {
                    success: true,
                    email,
                    result
                };
            } catch (error) {
                return {
                    success: false,
                    email,
                    error: error.message
                };
            }
        });

        // Send emails in batches to avoid rate limiting
        const batchSize = 5;
        const results = [];
        
        for (let i = 0; i < emailPromises.length; i += batchSize) {
            const batch = emailPromises.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch);
            results.push(...batchResults);
            
            // Add a small delay between batches
            if (i + batchSize < emailPromises.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Process results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (failed.length > 0) {
            console.warn('Some emails failed to send:', failed);
        }

        return {
            totalSent: successful.length,
            totalFailed: failed.length,
            failedEmails: failed.map(f => f.email)
        };

    } catch (error) {
        console.error('Error in sendAnnouncementEmail:', error);
        throw new Error('Failed to send announcement emails: ,${error.message}');
    }
};

// Helper function to validate email format
const isValidEmail = (email) => {
    return email && 
           typeof email === 'string' && 
           /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Function to update the announcement tracking in Firebase
export const trackAnnouncementDelivery = async (announcementId, emailResults) => {
    const db = getFirestore();
    
    try {
        const announcementRef = doc(db, 'announcements', announcementId);
        await updateDoc(announcementRef, {
            emailDeliveryStatus: {
                sentCount: emailResults.totalSent,
                failedCount: emailResults.totalFailed,
                failedEmails: emailResults.failedEmails,
                sentAt: serverTimestamp()
            }
        });
    } catch (error) {
        console.error('Error updating announcement delivery status:', error);
    }
};