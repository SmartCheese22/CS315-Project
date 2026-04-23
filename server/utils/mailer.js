import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD, // Your 16-letter App Password
    },
});

export const sendMail = async ({ to, subject, text }) => {
    try {
        const mailOptions = { from: process.env.EMAIL, to, subject, text };
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("❌ Email Error:", error);
        return false;
    }
};
