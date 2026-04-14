import express from 'express';
import db from '../db/connection.js';
import { sendMail } from '../utils/mailer.js';

const router = express.Router();


// Manager login router.
router.post('/login',async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        let [rows] = await db.query('SELECT * FROM manager WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Email does not exist! Please get yourself registered...' });
        }
        const manager = rows[0];
        // Compare hashed password using bcrypt
        // const match = await bcrypt.compare(password, user.password);
        // if (!match) {
            // return res.status(401).json({ message: 'Invalid credentials' });
        // }
        if(password !== manager.password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        // Successful login response
        res.json({ message: 'Manager logged in successfully', manager });

        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
        
    }

});

// Manager can add managers to the database. He needs to provid email, password, mobile number, and name.
router.post('/add-manager', async (req, res) => {
    const { email, password, mobile_number, name } = req.body;
    if (!email || !password || !mobile_number || !name) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    // Check if the email or mobile number already exists in the database
    const checkQuery = "SELECT * FROM manager WHERE email = ? OR mobile_no = ?";
    const [existingManagers] = await db.query(checkQuery, [email, mobile_number]);
    if (existingManagers.length > 0) {
        return res.status(400).json({ message: 'Email or mobile number already exists' });
    }

    // bcrypt the password before inserting it into the database
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new manager into the database
    let new_manager_id = "";
    const query = "INSERT INTO manager (email, password, mobile_no, name) VALUES (?, ?, ?, ?)";
    await db.query(query, [email, password, mobile_number, name], (err, result) => {
        if (err) throw err;
        new_manager_id = result.insertId;
    });
    res.json({ message: 'Manager added successfully', new_manager_id });
});

// Search user with user_id.
router.get('/user', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        return res.status(400).json({ message: 'Missing required fields' });
    }
    const query = "SELECT * FROM user WHERE user_id = ?";
    const [rows] = await db.query(query, [user_id]);
    if (rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
});

// Manager logout router.
router.post('/logout', (req, res) => {
    // Invalidate the manager's JWT token.
    // For demonstration purposes, we're just returning a success message.
    res.json({ message: 'Manager logged out successfully' });
});

// Manager dashboard router.
router.get('/dashboard', async (req, res) => {
    // Return manager dashboard data.
    // For demonstration purposes, we're just returning a hardcoded response.
    let query_users = "SELECT COUNT(*) AS total_users FROM user";
    let query_books = "SELECT COUNT(*) AS total_books FROM book";
    let query_issues = "SELECT COUNT(*) AS total_issues FROM book_issue WHERE return_status = 0";

    const [total_users] = await db.query(query_users);
    const [total_books] = await db.query(query_books);
    const [total_current_issues] = await db.query(query_issues);

    res.json({users: total_users[0], books: total_books[0], current_issues: total_current_issues[0]});
});


// Manager could add books.
router.post('/add-book', async (req, res) => {
    try {
        const { title, authors, category, publication_year, publisher_name, publication_language, 
                floor_no, shelf_no, copies_total } = req.body;
        const copies_available = copies_total;

        if (!title || !authors || !Array.isArray(authors) || authors.length === 0 || 
            !category || !publication_year || !floor_no || !shelf_no || !copies_total
            || !publisher_name || !publication_language) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if the book already exists in the database
        const checkQuery = "SELECT * FROM book WHERE book_title = ?";
        const [existingBooks] = await db.query(checkQuery, [title]);
        if (existingBooks.length > 0) {
            return res.status(400).json({ message: 'Book already exists' });
        }

        // Check if the specified location is available
        const checkLocationQuery = "SELECT * FROM location WHERE floor_no = ? AND shelf_no = ?";
        const [existingLocations] = await db.query(checkLocationQuery, [floor_no, shelf_no]);
        if (existingLocations.length > 0) {
            return res.status(400).json({ message: 'Specified location is already taken' });
        }
        const insertLocationQuery = "INSERT INTO location (floor_no, shelf_no) VALUES (?, ?)";
        const [locationResult] = await db.query(insertLocationQuery, [floor_no, shelf_no]);
        const location_id = locationResult.insertId;

        // Check or insert the category
        const checkCategoryQuery = "SELECT * FROM category WHERE category_name = ?";
        const [existingCategories] = await db.query(checkCategoryQuery, [category]);
        let category_id;
        if (existingCategories.length === 0) {
            const insertCategoryQuery = "INSERT INTO category (category_name) VALUES (?)";
            const [categoryResult] = await db.query(insertCategoryQuery, [category]);
            category_id = categoryResult.insertId;
        } else {
            category_id = existingCategories[0].category_id;
        }

        let publisher_id;
        const checkPublisherQuery = "SELECT * FROM publisher WHERE publisher_name = ? AND publication_language = ?";
        const [existingPublishers] = await db.query(checkPublisherQuery, [publisher_name, publication_language]);

        if (existingPublishers.length === 0) {
            const insertPublisherQuery = "INSERT INTO publisher (publisher_name, publication_language) VALUES (?, ?)";
            const [publisherResult] = await db.query(insertPublisherQuery, [publisher_name, publication_language]);
            publisher_id = publisherResult.insertId;
        } else {
            publisher_id = existingPublishers[0].publisher_id;
        }

        // Insert the new book
        const insertBookQuery = "INSERT INTO book (book_title, category_id, publisher_id, publication_year, location_id, copies_total, copies_available) VALUES (?, ?, ?, ?, ?, ?, ?)";
        const [bookResult] = await db.query(insertBookQuery, [title, category_id, publisher_id, publication_year, location_id, copies_total, copies_available]);
        const book_id = bookResult.insertId;

        // Process each author
        for (const authorName of authors) {
            // Check if author exists
            const checkAuthorQuery = "SELECT * FROM author WHERE author_name = ?";
            const [existingAuthors] = await db.query(checkAuthorQuery, [authorName]);

            let author_id;
            if (existingAuthors.length === 0) {
                const insertAuthorQuery = "INSERT INTO author (author_name) VALUES (?)";
                const [authorResult] = await db.query(insertAuthorQuery, [authorName]);
                author_id = authorResult.insertId;
            } else {
                author_id = existingAuthors[0].author_id;
            }

            // Link book and author
            const insertBookAuthorQuery = "INSERT INTO book_author (book_id, author_id) VALUES (?, ?)";
            await db.query(insertBookAuthorQuery, [book_id, author_id]);
        }

        res.json({ message: 'Book added successfully', book_id });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// Manager could look at all the users who have not returned any book.
router.get('/not-returned', async (req, res) => {
    // Return all users who have not returned any book.
    let query =  `SELECT u.user_id, u.email, u.mobile_no, bi.book_id, bi.return_date 
                  FROM user AS u
                  JOIN book_issue AS bi ON u.user_id = bi.user_id
                  WHERE bi.return_status = 0`;
    const [usersNotReturned] = await db.query(query);

    res.json(usersNotReturned);
});

// router for viewing all the return requests made by users.
router.get('/return-requests', async (req, res) => {
    try {
        // Fetch all return requests from the database
        const query = "SELECT * FROM book_return";
        const [returnRequests] = await db.query(query);
        if (returnRequests.length === 0) {
            return res.status(404).json({ message: 'No return requests found' });
        }
        res.json(returnRequests);
    } catch (error) {
        console.error("❌ Error fetching return requests:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// router for manager to accept or reject return request.
router.post('/manage-return', async (req, res) => {
    try {
        const { returnId, action } = req.body;
        if (!returnId || !action) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check if the return request exists
        const checkQuery = "SELECT * FROM book_return WHERE return_id = ?";
        const [checkResult] = await db.query(checkQuery, [returnId]);

        if (checkResult.length === 0) {
            return res.status(404).json({ message: 'Return request not found' });
        }

        // If accepted, update the book_issue table and delete from book_return table
        if (action === 'approve') {
            const { book_id, user_id, return_date } = checkResult[0];

            const get_id = "SELECT * FROM book_issue as b WHERE b.return_status = ? AND b.book_id = ? AND b.user_id = ?";
            const [issueIdRes] = await db.query(get_id, [0, book_id, user_id]);
            const issueId = issueIdRes[0].issue_id;
            
            const issueUpdateQuery = "UPDATE book_issue SET return_date = ?, return_status = ? WHERE book_id = ? AND user_id = ? and return_status != 1";
            await db.query(issueUpdateQuery, [return_date, 1, book_id, user_id]);

            // Delete from book_return table
            const deleteQuery = "DELETE FROM book_return WHERE return_id = ?";
            await db.query(deleteQuery, [returnId]);

            // Update the book's copies_available.
            const increment_query = "UPDATE book SET copies_available = copies_available + 1 WHERE book_id = ?";
            await db.query(increment_query, [book_id]);

            // Get fine amount
            const fine_query = `
                SELECT fine_amount 
                FROM fine_due 
                JOIN book_issue ON fine_due.fine_due_id = book_issue.issue_id
                WHERE book_issue.issue_id = ?`;
            const [fineRes] = await db.query(fine_query, [issueId]);

            const fine = fineRes.length > 0 ? fineRes[0].fine_amount : 0;
            // const fine = fineRes[0].fine_amount;

            //Now check in the book_request table whether anyone has requested this book. In case of multiple requests, pick the one with least request_date
            const request_query = "SELECT * FROM book_request WHERE book_id =? ORDER BY request_date ASC LIMIT 1";
            const [requestRes] = await db.query(request_query, [book_id]);
            //Insert this data as an issue int the book_issue table.
            if (requestRes.length > 0) {
                const nextRequest = requestRes[0];
                const nextUserId = nextRequest.user_id;
                // const requestId = nextRequest.request_id;

                // ✅ Notify the next user via email
                const getEmailQuery = "SELECT email, name FROM user WHERE user_id = ?";
                const [userRes] = await db.query(getEmailQuery, [nextUserId]);

                if (userRes.length > 0) {
                    const email = userRes[0].email;
                    const name = userRes[0].name;

                    const bookQuery = "SELECT book_title FROM book WHERE book_id = ?";
                    const [bookRes] = await db.query(bookQuery, [book_id]);
                    const bookTitle = bookRes.length > 0 ? bookRes[0].book_title : "a book";

                    const message = `
                    Hi ${name},

                    Good news! The book "${bookTitle}" you requested has just become available and has been automatically issued to your account.

                    Please make sure to collect the book from the library.

                    Thank you,
                    Library Management System
                    `;


                    try {
                        await sendMail({
                            to: email,
                            subject: `📚 Book Available: ${bookTitle}`,
                            text: message
                        });
                        console.log("📧 Email sent to next user:", email);
                    } catch (emailErr) {
                        console.error("❌ Failed to send email:", emailErr);
                    }
                }

                // Decrease the available copies again (book has just been returned and issued again)
                const decrement_query = "UPDATE book SET copies_available = copies_available - 1 WHERE book_id = ?";
                await db.query(decrement_query, [book_id]);

                // Issue the book to the next requester
                const newIssueDate = new Date().toISOString().slice(0, 10);
                const issueQuery = "INSERT INTO book_issue (book_id, user_id, issue_date) VALUES (?, ?, ?)";
                await db.query(issueQuery, [book_id, nextUserId, newIssueDate]);

                // Delete the request from the book_request table
                const deleteRequestQuery = "DELETE FROM book_request WHERE user_id = ? AND book_id = ?";
                await db.query(deleteRequestQuery, [nextUserId, book_id]);

                console.log("📖 Book issued to next requester:", nextUserId);

            }

            console.log("✅ Return request accepted and processed successfully!");
            // Notify the user via email regarding the acceptance of return request and his fine.
            const getEmailQuery = "SELECT email, name FROM user WHERE user_id = ?";
            const [userRes] = await db.query(getEmailQuery, [user_id]);
            if (userRes.length > 0) {
                const email = userRes[0].email;
                const name = userRes[0].name;

                const bookQuery = "SELECT book_title FROM book WHERE book_id = ?";
                const [bookRes] = await db.query(bookQuery, [book_id]);
                const bookTitle = bookRes.length > 0 ? bookRes[0].book_title : "a book";

                const message = `
                Hi ${name},

                Your return request for the book "${bookTitle}" has been accepted and processed successfully.

                Your fine for this book is ${fine}.

                Thank you,
                Library Management System
                `;
                try {
                    await sendMail({
                        to: email,
                        subject: `📚 Return Request Accepted: ${bookTitle}`,
                        text: message
                    });
                    console.log("📧 Email sent to user:", email);
                } catch (emailErr) {
                    console.error("❌ Failed to send email:", emailErr);
                }
            }
            return res.status(200).json({ message: 'Return request accepted and processed successfully' });
        } else if(action === 'reject') {
            // If rejected, delete from book_return table
            const deleteQuery = "DELETE FROM book_return WHERE return_id = ?";
            await db.query(deleteQuery, [returnId]);

            console.log("❌ Return request rejected successfully!");
            // Notify the user via email regarding the rejection of return request.
            const getEmailQuery = "SELECT email, name FROM user WHERE user_id = ?";
            const [userRes] = await db.query(getEmailQuery, [checkResult[0].user_id]);
            if (userRes.length > 0) {
                const email = userRes[0].email;
                const name = userRes[0].name;

                const bookQuery = "SELECT book_title FROM book WHERE book_id = ?";
                const [bookRes] = await db.query(bookQuery, [checkResult[0].book_id]);
                const bookTitle = bookRes.length > 0 ? bookRes[0].book_title : "a book";

                const message = `
                Hi ${name},

                Your return request for the book "${bookTitle}" has been rejected (probably because you did not return the phisical book yet). Please contact the library staff for further assistance.

                Thank you,
                Library Management System
                `;
                try {
                    await sendMail({
                        to: email,
                        subject: `📚 Return Request Rejected: ${bookTitle}`,
                        text: message
                    });
                    console.log("📧 Email sent to user:", email);
                } catch (emailErr) {
                    console.error("❌ Failed to send email:", emailErr);
                }
            }
            return res.status(200).json({ message: 'Return request rejected successfully' });
        }
        else
        {
            return res.status(400).json({ message: 'Invalid status' });
        }
    } catch (err) {
        console.error("❌ Error Managing Return Request:", err);
        res.status(500).json({ message: 'Internal server error' });
    }
});





export default router;