import emailjs from '@emailjs/browser';

emailjs.init("rnu7xzpqcoqL_gqdK"); // Initialize with your EmailJS public key

export const sendAnnouncementEmail = async (announcement, userEmails) => {
    try {
        const emailPromises = userEmails.map(email => {
            const templateParams = {
                to_email: email,
                announcement_content: announcement
            };
            
            return emailjs.send(
                'service_s0zaiaf',
                'template_d4rmqcd',
                templateParams
            );
        });
        
        await Promise.all(emailPromises);
        return true;
    } catch (error) {
        console.error('Error sending emails:', error);
        throw error;
    }
};