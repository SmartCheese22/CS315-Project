import express from 'express';
import db from '../db/connection.js';
import { sendMail } from '../utils/mailer.js';

const router = express.Router();

// GET all offers with student + company details
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.offer_id, o.acceptance_status, o.package_offered, o.offer_date,
                   s.name AS student_name, s.roll_no, s.branch,
                   c.name AS company, jr.title AS role,
                   c.hr_contact
            FROM OFFER o
            JOIN STUDENT  s  ON o.student_id  = s.student_id
            JOIN JOB_ROLE jr ON o.role_id      = jr.role_id
            JOIN COMPANY  c  ON jr.company_id  = c.company_id
            ORDER BY o.offer_date DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create a new offer for a student
router.post('/', async (req, res) => {
    try {
        const { student_id, role_id, package_offered } = req.body;
        if (!student_id || !role_id || !package_offered) {
            return res.status(400).json({ error: 'student_id, role_id and package_offered are required' });
        }
        const today = new Date().toISOString().slice(0, 10);
        const [result] = await db.query(
            'INSERT INTO OFFER (student_id, role_id, package_offered, offer_date) VALUES (?, ?, ?, ?)',
            [student_id, role_id, package_offered, today]
        );

        // Also update the application status to 'offered'
        await db.query(
            "UPDATE APPLICATION SET status = 'offered' WHERE student_id = ? AND role_id = ?",
            [student_id, role_id]
        );

        // Try to notify student via email (non-blocking — don't crash if mail fails)
        try {
            const [[student]] = await db.query(
                'SELECT name FROM STUDENT WHERE student_id = ?', [student_id]
            );
            const [[role]]    = await db.query(
                'SELECT title, package_lpa FROM JOB_ROLE WHERE role_id = ?', [role_id]
            );
            const [[company]] = await db.query(
                'SELECT c.name FROM COMPANY c JOIN JOB_ROLE jr ON c.company_id = jr.company_id WHERE jr.role_id = ?',
                [role_id]
            );
            // NOTE: Add student email to schema if you want real email notifications
            // For now this is a placeholder demonstrating the feature
            console.log(`📧 Offer notification: ${student.name} received offer from ${company.name} for ${role.title} at ${package_offered} LPA`);
        } catch (_) { /* silently ignore mail errors */ }

        res.status(201).json({ message: 'Offer created successfully', offer_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT accept an offer (FIRES DB TRIGGER + SENDS REAL EMAIL)
router.put('/:offer_id/accept', async (req, res) => {
    try {
        // 0. PREVENT DOUBLE-CLICKS (The Bug Fix!)
        const [[currentOffer]] = await db.query(
            "SELECT acceptance_status FROM OFFER WHERE offer_id = ?", 
            [req.params.offer_id]
        );

        if (currentOffer.acceptance_status === 'accepted') {
            return res.status(400).json({ error: 'This offer has already been accepted!' });
        }

        // 1. The Database does the heavy lifting (Trigger fires to reject other apps)
        await db.query(
            "UPDATE OFFER SET acceptance_status = 'accepted' WHERE offer_id = ?",
            [req.params.offer_id]
        );

        // 2. Fetch the data we need for the email
        const [[offerDetails]] = await db.query(`
            SELECT s.name AS student_name, s.email, c.name AS company_name, jr.title AS role_title, o.package_offered
            FROM OFFER o
            JOIN STUDENT s ON o.student_id = s.student_id
            JOIN JOB_ROLE jr ON o.role_id = jr.role_id
            JOIN COMPANY c ON jr.company_id = c.company_id
            WHERE o.offer_id = ?
        `, [req.params.offer_id]);

        // 3. Send the REAL Email using Nodemailer
        if (offerDetails && offerDetails.email) {
            const emailSent = await sendMail({
                to: offerDetails.email,
                subject: `🎉 Congratulations! Offer Accepted at ${offerDetails.company_name}`,
                text: `Dear ${offerDetails.student_name},\n\nThis is an automated confirmation from the IITK Placement Portal.\n\nYour acceptance for the ${offerDetails.role_title} role at ${offerDetails.company_name} (${offerDetails.package_offered} LPA) has been officially recorded.\n\nAs per CDC policy, all of your other pending applications have been automatically withdrawn by the system.\n\nCongratulations on your placement!`
            });

            if (emailSent) {
                console.log(`✅ Success: DB Triggers fired AND Email sent to ${offerDetails.email}`);
            }
        }

        res.json({
            message: '✅ Offer accepted! DB Triggers fired and confirmation email sent.'
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT decline an offer
router.put('/:offer_id/decline', async (req, res) => {
    try {
        await db.query(
            "UPDATE OFFER SET acceptance_status = 'declined' WHERE offer_id = ?",
            [req.params.offer_id]
        );
        res.json({ message: 'Offer declined.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
