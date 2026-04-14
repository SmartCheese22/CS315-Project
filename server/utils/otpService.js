const otpStore = new Map(); // Temporary OTP store (Use Redis in production)
import nodemailer from 'nodemailer';

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL,   
      pass: process.env.EMAIL_PASSWORD,      
    },
  });

// Generate and send OTP
async function sendOTP(email) {
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    otpStore.set(email, otp);

    const mailOptions = {
        from: process.env.EMAIL,
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP for registration is: ${otp}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending OTP:', error);
        return false;
    }
}

// Verify OTP
function verifyOTP(email, otp) {
    if (otpStore.get(email) == otp) {
        otpStore.delete(email); // Remove OTP after verification
        return true;
    }
    return false;
}

export { sendOTP, verifyOTP };
