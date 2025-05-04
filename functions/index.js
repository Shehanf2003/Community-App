const functions = require('firebase-functions');
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: functions.config().email.user,
        pass: functions.config().email.password
    },
    tls: {
        rejectUnauthorized: false
    }
});

exports.sendAnnouncementEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { announcement, recipients } = data;

    try {
        await Promise.all(recipients.map(async (email) => {
            const mailOptions = {
                from: functions.config().email.user,
                to: email,
                subject: 'New Announcement',
                html: `
                    <h2>New Announcement</h2>
                    <p>${announcement}</p>
                    <p>Best regards,<br>Your Admin Team</p>
                `
            };

            await transporter.sendMail(mailOptions);
        }));

        return { success: true };
    } catch (error) {
        console.error('Error sending emails:', error);
        throw new functions.https.HttpsError('internal', 'Error sending emails');
    }
});