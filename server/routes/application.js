import express from 'express';
import db from '../db/connection.js';

const router = express.Router();

// GET placement dashboard (uses VIEW placement_dashboard)
router.get('/dashboard', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM placement_dashboard');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all applications (with joins for readability)
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT a.app_id, s.name AS student_name, s.roll_no,
                   c.name AS company_name, jr.title AS role_title,
                   jr.package_lpa, a.status, a.applied_date
            FROM APPLICATION a
            JOIN STUDENT s   ON a.student_id = s.student_id
            JOIN JOB_ROLE jr ON a.role_id    = jr.role_id
            JOIN COMPANY c   ON jr.company_id = c.company_id
            ORDER BY a.applied_date DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST student applies for a role (trigger fires here for CPI check)
router.post('/', async (req, res) => {
    try {
        const { student_id, role_id } = req.body;
        if (!student_id || !role_id) {
            return res.status(400).json({ error: 'student_id and role_id are required' });
        }
        const today = new Date().toISOString().slice(0, 10);
        await db.query(
            'INSERT INTO APPLICATION (student_id, role_id, applied_date) VALUES (?, ?, ?)',
            [student_id, role_id, today]
        );
        res.status(201).json({ message: 'Application submitted successfully' });
    } catch (err) {
        // Trigger will throw SQLSTATE 45000 with our custom message
        if (err.sqlState === '45000') {
            return res.status(400).json({ error: err.sqlMessage });
        }
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Student has already applied to this role' });
        }
        res.status(500).json({ error: err.message });
    }
});

// PUT update application status (shortlist / reject)
router.put('/:app_id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['applied', 'shortlisted', 'rejected', 'offered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        await db.query(
            'UPDATE APPLICATION SET status = ? WHERE app_id = ?',
            [status, req.params.app_id]
        );
        res.json({ message: `Application status updated to '${status}'` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET interesting query 1: students who passed technical but failed HR
router.get('/queries/tech-pass-hr-fail', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT DISTINCT s.name, s.roll_no, s.branch, s.cpi,
                   c.name AS company_name, jr.title AS role_title
            FROM INTERVIEW_ROUND ir
            JOIN APPLICATION a   ON ir.app_id    = a.app_id
            JOIN STUDENT s       ON a.student_id = s.student_id
            JOIN JOB_ROLE jr     ON a.role_id    = jr.role_id
            JOIN COMPANY c       ON jr.company_id = c.company_id
            WHERE ir.round_type = 'Technical' AND ir.result = 'pass'
              AND a.app_id IN (
                  SELECT app_id FROM INTERVIEW_ROUND
                  WHERE round_type = 'HR' AND result = 'fail'
              )
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET interesting query 2: students with 3+ applications but no offer
router.get('/queries/no-offer', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.name, s.roll_no, s.branch, s.cpi,
                   COUNT(a.app_id) AS total_applications
            FROM STUDENT s
            JOIN APPLICATION a ON s.student_id = a.student_id
            WHERE s.student_id NOT IN (
                SELECT student_id FROM OFFER WHERE acceptance_status = 'accepted'
            )
            GROUP BY s.student_id, s.name, s.roll_no, s.branch, s.cpi
            HAVING COUNT(a.app_id) >= 3
            ORDER BY total_applications DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET interesting query 3: company-wise rank of students using window function
router.get('/queries/company-ranking/:company_id', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT s.name, s.roll_no, s.branch, s.cpi,
                   jr.title AS role_title,
                   a.status,
                   RANK() OVER (PARTITION BY jr.role_id ORDER BY s.cpi DESC) AS cpi_rank
            FROM APPLICATION a
            JOIN STUDENT s   ON a.student_id = s.student_id
            JOIN JOB_ROLE jr ON a.role_id    = jr.role_id
            WHERE jr.company_id = ?
            ORDER BY jr.role_id, cpi_rank
        `, [req.params.company_id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
