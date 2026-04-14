import express from 'express';
import db from "../db/connection.js";
import { sendMail } from '../utils/mailer.js';
const router = express.Router();

const FINE_LIMIT = 100; // Fine limit for a user

router.get('/search', async (req, res) => {
    try {
        const { field , value} = req.query;
        var query = ""
        switch (field)
        {
            case 'title':
                query = `
                    SELECT b.book_id, b.book_title, b.copies_available, c.category_name,
                            GROUP_CONCAT(a.author_name SEPARATOR ', ') AS authors 
                    FROM book as b 
                    JOIN category as c ON b.category_id = c.category_id 
                    JOIN book_author as ba ON ba.book_id = b.book_id 
                    JOIN author as a ON ba.author_id = a.author_id 
                    WHERE book_title LIKE ?
                    GROUP BY b.book_id, b.book_title, b.copies_available, c.category_name`
                break;
            case 'author':
                query = `
                    SELECT b.book_id, b.book_title, b.copies_available, c.category_name, 
                            GROUP_CONCAT(a.author_name SEPARATOR ', ') AS authors
                    FROM book AS b 
                    JOIN category AS c ON b.category_id = c.category_id 
                    JOIN book_author AS ba ON ba.book_id = b.book_id 
                    JOIN author AS a ON ba.author_id = a.author_id 
                    WHERE a.author_name LIKE ?
                    GROUP BY b.book_id, b.book_title, b.copies_available, c.category_name
                `;
                break;
            case 'category':
                query = `
                        SELECT b.book_id, b.book_title, b.copies_available, c.category_name,
                                GROUP_CONCAT(a.author_name SEPARATOR ', ') AS authors
                        FROM book as b 
                        JOIN category as c ON b.category_id = c.category_id 
                        JOIN book_author as ba ON ba.book_id = b.book_id 
                        JOIN author as a ON ba.author_id = a.author_id 
                        WHERE c.category_name LIKE ?
                        GROUP BY b.book_id, b.book_title, b.copies_available, c.category_name`
                break;
            default:
                return res.status(400).json({ message: 'Invalid search field' });
        }
        const [rows] = await db.query(query, ['%' + value + '%']);
        res.json(rows);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error searching for books' });
    }
})
// show all books user has currently issued.

router.get('/issued-books', async (req,res)=>{
    try{
        const { userId } = req.query;
        const query = `
                    SELECT b.book_id, b.book_title, bi.issue_date 
                    FROM book as b, book_issue as bi 
                    WHERE b.book_id = bi.book_id AND bi.user_id =? AND bi.return_status = 0`;

        const q = `
                SELECT b.book_id, b.book_title, b.copies_available, c.category_name, 
                GROUP_CONCAT(DISTINCT a.author_name ORDER BY a.author_name SEPARATOR ', ') AS author_names
                FROM book as b 
                JOIN category as c ON b.category_id = c.category_id 
                JOIN book_author as ba ON ba.book_id = b.book_id 
                JOIN author as a ON ba.author_id = a.author_id 
                JOIN book_issue as bi ON bi.book_id = b.book_id 
                WHERE bi.user_id = ? AND bi.return_status = 0
                GROUP BY b.book_id, b.book_title, b.copies_available, c.category_name`;
        const [rows] = await db.query(q, [userId]);
        res.json(rows);
    }
    catch(err){
        console.error(err);
        res.status(500).json({ message: 'Error retrieving books' });
    }
})

// 2. book issue.
router.post('/issue', async (req, res) => {
    try {
        const { bookId, userId } = req.body;
        if (!bookId || !userId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const bookExistsQuery = "SELECT book_id FROM book WHERE book_id = ?";
        const [bookExists] = await db.query(bookExistsQuery, [bookId]);

        if (bookExists.length === 0) {
            return res.status(404).json({ message: 'There is no book with the entered book ID' });
        }

        // ✅ Check whether this user has already issued this book
        const queryCheck = "SELECT book_id FROM book_issue WHERE book_id = ? AND user_id = ? AND return_status != 1";
        const [issuedResult] = await db.query(queryCheck, [bookId, userId]);

        if (issuedResult.length > 0) {
            return res.status(400).json({ message: 'This user has already issued this book' });
        }
        // Check whether this user has already requested this book in book_request table.
        const requestCheck = "SELECT * FROM book_request WHERE book_id = ? AND user_id = ?";
        const [requestResult] = await db.query(requestCheck, [bookId, userId]);
        if (requestResult.length > 0) {
            return res.status(400).json({ message: 'This user has already requested this book' });
        }
        // Calculate fine if any for this user and do not allow issue if it passes certain limit.
        const fine_query = `
            SELECT SUM(fine_amount) as total_fine 
            FROM fine_due 
            JOIN book_issue ON fine_due.fine_due_id = book_issue.issue_id 
            WHERE book_issue.user_id = ?`;
        const [fineResult] = await db.query(fine_query, [userId]);
        const totalFine = fineResult[0].total_fine;
        if (totalFine >= FINE_LIMIT) {
            return res.status(400).json({ message: 'This user has exceeded the fine limit' });
        }
        // ✅ Check book availability
        const availabilityCheck = "SELECT copies_available FROM book WHERE book_id = ?";
        const [availableResult] = await db.query(availabilityCheck, [bookId]);

        console.log("📖 Availability Check Result:", availableResult);

        if (availableResult.length === 0) {
            return res.status(404).json({ message: 'Book not found' });
        }

        const availableCopies = availableResult[0].copies_available;

        if (availableCopies > 0) {
            // ✅ Issue the book (Decrease available copies)
            const issueDate = new Date().toISOString().slice(0, 10);
            const updateQuery = "UPDATE book SET copies_available = copies_available - 1 WHERE book_id = ?";
            const issueQuery = "INSERT INTO book_issue (book_id, user_id, issue_date) VALUES (?, ?, ?)";

            await db.query(updateQuery, [bookId]);
            await db.query(issueQuery, [bookId, userId, issueDate]);

            console.log("✅ Book Issued Successfully!");
            return res.status(200).json({ message: 'Book issued successfully' });
        } else {
            // ✅ Add request to book_request table
            return res.status(200).json({ message: 'No copies available.'});
        }
    } catch (err) {
        console.error("❌ Error Issuing Book:", err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.post('/request', async (req, res) => {
    try {
        const { bookId, userId } = req.body;
        if (!bookId || !userId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        // Add request to book_request table
        const requestDate = new Date().toISOString().slice(0, 19).replace('T', ' '); 
        const requestQuery = "INSERT INTO book_request (book_id, user_id, request_date) VALUES (?, ?, ?)";
        await db.query(requestQuery, [bookId, userId, requestDate]);

        console.log("🚫 No copies available, added to request list.");
        return res.status(200).json({ message: 'Book requested successfully' });
    } catch (err) {
        console.error("❌ Error Requesting Book:", err);
        res.status(500).json({ message: 'Internal server error' });
    }

})


// router for user to request return.
router.post('/request-return', async (req, res) => {
    try {
        const { bookId, userId } = req.body;
        if (!bookId || !userId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check whether this book is issued by this user or not.
        const issue_check = "SELECT book_id FROM book_issue WHERE book_id = ? AND user_id = ? and return_status = 0";
        const [issueRes] = await db.query(issue_check, [bookId, userId]);

        if (issueRes.length === 0) {
            return res.status(200).json({ message: 'This book is not issued to you' });
        }

        // Check whether this user has already requested this book in book_return table.
        const requestCheck = "SELECT * FROM book_return WHERE book_id = ? AND user_id = ?";
        const [requestResult] = await db.query(requestCheck, [bookId, userId]);
        if (requestResult.length > 0) {
            return res.status(200).json({ message: 'This user has already requested return for this book' });
        }
        // Add request to book_return table
        const returnDate = new Date().toISOString().slice(0, 10); // Format as 'YYYY-MM-DD'
        const requestQuery = "INSERT INTO book_return (book_id, user_id, return_date) VALUES (?, ?, ?)";
        await db.query(requestQuery, [bookId, userId, returnDate]);

        console.log("📦 Return request submitted successfully!");
        return res.status(200).json({ message: 'Return request submitted successfully! Library Manager has to verify your return (You will be notified via email regarding the action taken)' });
    } catch (err) {
        console.error("❌ Error Requesting Return:", err);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// router to get top 5 books based on number of likes.
router.get('/most-liked', async (req, res) => {
    try {
        const query = `
            SELECT b.book_id, b.book_title, b.copies_available, c.category_name,
                    GROUP_CONCAT(a.author_name SEPARATOR ', ') AS authors 
            FROM book as b 
            JOIN category as c ON b.category_id = c.category_id 
            JOIN book_author as ba ON ba.book_id = b.book_id 
            JOIN author as a ON ba.author_id = a.author_id 
            WHERE b.no_of_likes > 0
            GROUP BY b.book_id, b.book_title, b.copies_available, c.category_name
            ORDER BY b.no_of_likes DESC
            LIMIT 5`;
        const [rows] = await db.query(query);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error retrieving most liked books' });
    }
});

export default router;
