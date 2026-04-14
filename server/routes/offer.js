import express from 'express';
import db from '../db/connection.js';
const router = express.Router();

// GET all offers (This is what your UI needs to fill that empty table!)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT o.offer_id, s.name as student_name, c.name as company, j.title as role, o.package_offered, o.acceptance_status
            FROM OFFER o
            JOIN STUDENT s ON o.student_id = s.student_id
            JOIN JOB_ROLE j ON o.role_id = j.role_id
            JOIN COMPANY c ON j.company_id = c.company_id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accept an offer (Triggers auto-reject of other apps)
router.put('/:offer_id/accept', async (req, res) => {
    try {
        await db.query(`UPDATE OFFER SET acceptance_status = 'accepted' WHERE offer_id = ?`, [req.params.offer_id]);
        res.json({ message: "Success! DB Triggers fired: Pending apps rejected & role capacity updated." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
