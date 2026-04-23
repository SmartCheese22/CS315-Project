import { sendMail } from './mailer.js';

const otpStore = new Map(); // Temporary in-memory OTP store

export async function sendOTP(email) {
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    otpStore.set(email, otp.toString());

    const success = await sendMail({
        to: email,
        subject: '🎓 IITK Placement Portal - Login OTP',
        text: `Your OTP for login is: ${otp}. Do not share this with anyone.`
    });
    return success;
}

export function verifyOTP(email, otp) {
    if (otpStore.get(email) === otp.toString()) {
        otpStore.delete(email); // Delete after successful use for security
        return true;
    }
    return false;
}
