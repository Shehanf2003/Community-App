import { getFunctions, httpsCallable } from 'firebase/functions';

export const sendAnnouncementEmail = async (announcement, userEmails) => {
  const functions = getFunctions();
  const sendEmailFunction = httpsCallable(functions, 'sendAnnouncementEmail');
  
  try {
    await sendEmailFunction({ 
      announcement, 
      recipients: userEmails 
    });
    return true;
  } catch (error) {
    console.error('Error sending announcement email:', error);
    throw error;
  }
};