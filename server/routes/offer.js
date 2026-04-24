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
// POST create a new offer for a student
router.post('/', async (req, res) => {
    try {
        const { student_id, role_id, package_offered } = req.body;
        if (!student_id || !role_id || !package_offered) {
            return res.status(400).json({ error: 'student_id, role_id and package_offered are required' });
        }

        // Check application exists
        const [[app]] = await db.query(
            'SELECT status FROM APPLICATION WHERE student_id = ? AND role_id = ?',
            [student_id, role_id]
        );
        if (!app) {
            return res.status(400).json({ error: 'Student has no application for this role' });
        }

        // Block rejected applicants
        if (app.status === 'rejected') {
            return res.status(400).json({ error: 'Cannot create offer for a rejected applicant' });
        }

        // Block duplicate offers
        const [[existing]] = await db.query(
            'SELECT offer_id FROM OFFER WHERE student_id = ? AND role_id = ?',
            [student_id, role_id]
        );
        if (existing) {
            return res.status(400).json({ error: 'An offer already exists for this student and role' });
        }

        const today = new Date().toISOString().slice(0, 10);
        const [result] = await db.query(
            'INSERT INTO OFFER (student_id, role_id, package_offered, offer_date) VALUES (?, ?, ?, ?)',
            [student_id, role_id, package_offered, today]
        );

        // Update the application status to 'offered'
        await db.query(
            "UPDATE APPLICATION SET status = 'offered' WHERE student_id = ? AND role_id = ?",
            [student_id, role_id]
        );

        res.status(201).json({ message: 'Offer created successfully', offer_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT accept an offer — calls the stored procedure instead of a raw UPDATE
// The procedure handles:
//   1. Accepting this offer (which fires trg_auto_reject_on_acceptance)
//   2. Declining all other pending offers for the same student
//   Both steps run inside a single transaction inside the procedure.
router.put('/:offer_id/accept', async (req, res) => {
    try {
        const offerId = parseInt(req.params.offer_id);

        // Guard: prevent double-accepts
        const [[current]] = await db.query(
            'SELECT acceptance_status, student_id FROM OFFER WHERE offer_id = ?',
            [offerId]
        );
        if (!current) {
            return res.status(404).json({ error: 'Offer not found.' });
        }
        if (current.acceptance_status === 'accepted') {
            return res.status(400).json({ error: 'This offer has already been accepted.' });
        }

        // Call the stored procedure — this is the only SQL needed
        await db.query('CALL accept_placement_offer(?)', [offerId]);

        // Fetch details for the confirmation email
        const [[offerDetails]] = await db.query(`
            SELECT s.name AS student_name, s.email,
                   c.name AS company_name, jr.title AS role_title,
                   o.package_offered
            FROM OFFER o
            JOIN STUDENT  s  ON o.student_id  = s.student_id
            JOIN JOB_ROLE jr ON o.role_id      = jr.role_id
            JOIN COMPANY  c  ON jr.company_id  = c.company_id
            WHERE o.offer_id = ?
        `, [offerId]);

        // Send confirmation email (non-blocking)
        if (offerDetails?.email) {
            try {
                await sendMail({
                    to: offerDetails.email,
                    subject: `🎉 Offer Accepted — ${offerDetails.company_name}`,
                    text: `Dear ${offerDetails.student_name},\n\nYour acceptance for the ${offerDetails.role_title} role at ${offerDetails.company_name} (${offerDetails.package_offered} LPA) has been recorded.\n\nAll other pending applications have been automatically withdrawn as per CDC policy.\n\nCongratulations!`
                });
            } catch (_) { /* mail failure must not break the response */ }
        }

        res.json({ message: '✅ Offer accepted! Triggers fired and other offers declined.' });

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

// GET offers for a specific student (student dashboard)
router.get('/my/:student_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.offer_id, o.acceptance_status, o.package_offered, o.offer_date,
                   c.name AS company, jr.title AS role
            FROM OFFER o
            JOIN JOB_ROLE jr ON o.role_id      = jr.role_id
            JOIN COMPANY  c  ON jr.company_id  = c.company_id
            WHERE o.student_id = ?
            ORDER BY o.offer_date DESC
        `, [req.params.student_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET eligible applicants for a specific role (used by the cascading offer modal)
router.get('/applicants/:role_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.student_id, s.name, s.roll_no, s.branch, s.cpi, a.status
            FROM APPLICATION a
            JOIN STUDENT s ON a.student_id = s.student_id
            WHERE a.role_id = ?
              AND a.status IN ('applied', 'shortlisted')
              AND s.eligible = TRUE
            ORDER BY s.cpi DESC
        `, [req.params.role_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
