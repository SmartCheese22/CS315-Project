import express from 'express';
import bcrypt from 'bcrypt';
import db from "../db/connection.js";
import { sendOTP, verifyOTP } from '../utils/otpService.js';


const router = express.Router();

// Send OTP to user email
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email is required' });

        // Generate to send OTP
        const otpSent = await sendOTP(email);
        if (!otpSent) return res.status(500).json({ message: 'Failed to send OTP' });

        res.status(200).json({ message: 'OTP sent successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error sending OTP' });
    }
});

// Verify OTP before proceeding with registration
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

        const isValid = await verifyOTP(email, otp);
        if (!isValid) return res.status(400).json({ message: 'Invalid OTP' });

        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error verifying OTP' });
    }
});

// Register user after OTP verification
router.post('/register', async (req, res) => {
    try {
        const { first_name, last_name, email, password, mobile_no } = req.body;
        if (!first_name || !last_name || !email || !password || !mobile_no) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Combine first and last name because they have only one field for name in database(SAD).
        const name = `${first_name} ${last_name}`;

        // Check if email or mobile number exists
        try {
            const [existingUser] = await db.query('SELECT email FROM user WHERE email =?', [email]);
            if (existingUser.length > 0) return res.status(400).json({ message: 'Email already exists' });

            const [existingMobile] = await db.query('SELECT mobile_no FROM user WHERE mobile_no =?', [mobile_no]);
            if (existingMobile.length > 0) return res.status(400).json({ message: 'Mobile number already exists' });
        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error checking for existing email or mobile number' });
        }

        // Hash the password before storing it
        // const hashedPassword = await bcrypt.hash(password, 10);
        await db.query('INSERT INTO user (name, email, password, mobile_no) VALUES (?, ?, ?, ?)', 
            // [name, email, hashedPassword, mobile_no]);
            [name, email, password, mobile_no]);

        res.status(200).json({ message: `User ${name} has been registered successfully. Please log in to continue.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error registering... Possibly due to duplicate mobile_no/email' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Fetch user from the database
        let [rows] = await db.query('SELECT * FROM user WHERE email = ?', [email]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Email does not exist! Please register...' });
        }

        const user = rows[0];

        // Compare hashed password using bcrypt
        // const match = await bcrypt.compare(password, user.password);

        // if (!match) {
        //     return res.status(400).json({ message: 'Incorrect password' });
        // }

        if (password !== user.password) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        // Successful login response
        return res.status(200).json({ userId: user.user_id, username: user.name });

    } catch (err) {
        console.error("Error during login:", err);
        res.status(500).json({ message: 'Error logging in' });
    }
});


router.get('/fine', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        const query = `
                    SELECT book.book_title, book.book_id, fine_due.fine_amount, fine_due.fine_due_id 
                    FROM book_issue 
                    JOIN fine_due ON book_issue.issue_id = fine_due.fine_due_id 
                    JOIN book ON book_issue.book_id = book.book_id WHERE fine_due.user_id = ?`
        const [rows] = await db.query(query, [userId]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error retrieving fine' });
    }
});

router.post('/pay-fine', async (req, res) => {
    try {
        const { userId, fineIds } = req.body;
        if (!userId && !fineIds) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        // If there is only userId is present, clear all his fines. else if fineIds are also present, clear fines with those id's.
        if (!fineIds) {
            // Just delete all those fines curresponding to this userId.
            await db.query('DELETE FROM fine_due WHERE user_id =?', [userId]);
            return res.status(200).json({ message: 'Payment successful for all fines' });
        }
        else
        {
            const query = "DELETE FROM fine_due WHERE fine_due_id IN (?)";
            await db.query(query,[fineIds]);
            return res.status(200).json({ message: 'Payment successful for fines with given ids' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error paying fine' });
    }
})


router.post('/recommendations', async (req, res) => {

    const {userId} = req.query;

    try {
        const [results] = await db.query(`CALL get_recommendations(?)`, [userId]);

        const collaborative = results[0];
        const categoryBased = results[1];

        res.json({
            collaborative,
            categoryBased
        });

    } catch (err) {
        console.error('Error fetching recommendations:', err);
        res.status(500).json({ error: 'Failed to get recommendations.' });
    }
});

router.post('/like', async (req, res) => {
    const { user_id, book_id } = req.body;

    if (!user_id || !book_id) {
        return res.status(400).json({ error: 'Missing user_id or book_id' });
    }

    try {
        await db.query(`CALL like_book_if_issued(?, ?)`, [user_id, book_id]);
        return res.status(200).json({ message: 'Book liked successfully!' });

    } catch (error) {
        // Custom SIGNAL from procedure shows up here
        const message = error.sqlMessage || error.message;

        if (message.includes('must have issued the book')) {
            return res.status(403).json({ error: 'You must issue the book before liking it.' });
        }

        if (message.includes('already liked')) {
            return res.status(409).json({ error: 'You have already liked this book.' });
        }

        console.error('Error liking book:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// router to dislike some liked book.
router.post('/dislike', async (req, res) => {
    const { user_id, book_id } = req.body;

    if (!user_id || !book_id) {
        return res.status(400).json({ error: 'Missing user_id or book_id' });
    }

    try {
        await db.query(`CALL dislike_book(?, ?)`, [user_id, book_id]);
        return res.status(200).json({ message: 'Book disliked successfully!' });

    } catch (error) {
        // Custom SIGNAL from procedure shows up here
        const message = error.sqlMessage || error.message;
        
        if (message.includes('must have liked the book')) {
            return res.status(403).json({ error: 'You must like the book before disliking it.' });
        }
        console.error('Error disliking book:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});


router.get('/requested-books', async (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    try {
        const query = `
        SELECT b.book_id, b.book_title, b.copies_available, c.category_name,
                GROUP_CONCAT(a.author_name SEPARATOR ', ') AS authors 
        FROM book as b 
        JOIN book_request as br ON b.book_id = br.book_id
        JOIN category as c ON b.category_id = c.category_id 
        JOIN book_author as ba ON ba.book_id = b.book_id 
        JOIN author as a ON ba.author_id = a.author_id 
        WHERE br.user_id = ?
        GROUP BY b.book_id, b.book_title, b.copies_available, c.category_name`;

        const [rows] = await db.query(query, [userId]);
        return res.status(200).json(rows);

    } catch (error) {
        console.error('Error fetching requested books:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// A user can cancel his requested book from the request queue (i.e., in request_book table)
router.post('/cancel-request', async (req, res) => {
    const { userId, bookId } = req.body;

    if (!userId || !bookId) {
        return res.status(400).json({ error: 'Missing userId or bookId' });
    }

    try {
        // Check if the request exists
        const checkQuery = `SELECT * FROM book_request WHERE user_id = ? AND book_id = ?`;
        const [checkResult] = await db.query(checkQuery, [userId, bookId]);
        if (checkResult.length === 0) {
            return res.status(406).json({ message: 'Request not found with that bookID' });
        }

        const query = `DELETE FROM book_request WHERE user_id = ? AND book_id = ?`;
        await db.query(query, [userId, bookId]);
        return res.status(200).json({ message: 'Request cancelled successfully!' });

    } catch (error) {
        console.error('Error cancelling request:', error);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

export default router;