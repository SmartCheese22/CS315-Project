import express from 'express';
import db from '../db/connection.js';
import { sendOTP, verifyOTP } from '../utils/otpService.js';

const router = express.Router();

// ADD ALL ADMIN EMAILS HERE
const ADMIN_EMAILS = [
    'smartcheese176@gmail.com',
    'gvaman10@gmail.com',
];

// 1. Send OTP — works for both admin and students
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    try {
        // Check if it's an admin
        if (ADMIN_EMAILS.includes(email)) {
            const otpSent = await sendOTP(email);
            if (!otpSent) return res.status(500).json({ error: 'Failed to send OTP. Check Gmail App Password.' });
            return res.status(200).json({ message: 'OTP sent to admin email' });
        }
        // Otherwise check student table
        const [student] = await db.query('SELECT * FROM STUDENT WHERE email = ?', [email]);
        if (student.length === 0) {
            return res.status(404).json({ error: 'No student found with this email.' });
        }
        const otpSent = await sendOTP(email);
        if (!otpSent) return res.status(500).json({ error: 'Failed to send OTP. Check Gmail App Password.' });
        res.status(200).json({ message: 'OTP sent to ' + email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Verify OTP & return user info + role
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });
    try {
        const isValid = verifyOTP(email, otp);
        if (!isValid) return res.status(400).json({ error: 'Invalid or expired OTP' });

        // Admin login
        if (ADMIN_EMAILS.includes(email)) {
            return res.status(200).json({
                message: 'Admin login successful',
                user: { name: 'CDC Admin', email: email, role: 'admin' }
            });
        }
        // Student login
        const [rows] = await db.query(
            'SELECT student_id, roll_no, name, branch, cpi, email, eligible, grad_year FROM STUDENT WHERE email = ?',
            [email]
        );
        res.status(200).json({
            message: 'Login successful',
            user: { ...rows[0], role: 'student' }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
