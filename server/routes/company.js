import express from 'express';
import db from '../db/connection.js';

const router = express.Router();

// GET all companies
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM COMPANY ORDER BY name');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET company stats (uses VIEW company_stats)
router.get('/stats', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM company_stats');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all job roles for a company
router.get('/:company_id/roles', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM JOB_ROLE WHERE company_id = ?',
            [req.params.company_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all open job roles across all companies
router.get('/roles/open', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT jr.*, c.name AS company_name, c.sector, c.min_cpi
            FROM JOB_ROLE jr
            JOIN COMPANY c ON jr.company_id = c.company_id
            WHERE jr.is_open = TRUE
            ORDER BY jr.package_lpa DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add a new company
router.post('/', async (req, res) => {
    try {
        const { name, sector, hr_contact, min_cpi } = req.body;
        if (!name) return res.status(400).json({ error: 'Company name is required' });
        const [result] = await db.query(
            'INSERT INTO COMPANY (name, sector, hr_contact, min_cpi) VALUES (?, ?, ?, ?)',
            [name, sector || null, hr_contact || null, min_cpi || 0]
        );
        res.status(201).json({ message: 'Company added', company_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add a job role to a company
router.post('/:company_id/roles', async (req, res) => {
    try {
        const { title, package_lpa, location, openings } = req.body;
        if (!title || !package_lpa || !openings) {
            return res.status(400).json({ error: 'title, package_lpa and openings are required' });
        }
        const [result] = await db.query(
            'INSERT INTO JOB_ROLE (company_id, title, package_lpa, location, openings) VALUES (?, ?, ?, ?, ?)',
            [req.params.company_id, title, package_lpa, location || null, openings]
        );
        res.status(201).json({ message: 'Job role added', role_id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a company
router.delete('/:company_id', async (req, res) => {
    try {
        // Find students placed via this company
        const [placedStudents] = await db.query(
            `SELECT DISTINCT o.student_id 
             FROM OFFER o
             JOIN JOB_ROLE jr ON o.role_id = jr.role_id
             WHERE jr.company_id = ? AND o.acceptance_status = 'accepted'`,
            [req.params.company_id]
        );

        // Find all roles for this company to restore rejected applications
        const [roles] = await db.query(
            'SELECT role_id FROM JOB_ROLE WHERE company_id = ?',
            [req.params.company_id]
        );

        await db.query('DELETE FROM COMPANY WHERE company_id = ?', [req.params.company_id]);

        // Reset eligible for placed students
        for (const s of placedStudents) {
            await db.query(
                'UPDATE STUDENT SET eligible = TRUE WHERE student_id = ?',
                [s.student_id]
            );
        }

        // Restore rejected applications for all this company's roles
        for (const r of roles) {
            await db.query(
                `UPDATE APPLICATION SET status = 'applied'
                 WHERE role_id = ? AND status = 'rejected'`,
                [r.role_id]
            );
        }

        res.json({ message: 'Company deleted, affected students re-eligible, applications restored' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a job role
router.delete('/roles/:role_id', async (req, res) => {
    try {
        // Find students placed via this role
        const [placedStudents] = await db.query(
            `SELECT student_id FROM OFFER 
             WHERE role_id = ? AND acceptance_status = 'accepted'`,
            [req.params.role_id]
        );

        await db.query('DELETE FROM JOB_ROLE WHERE role_id = ?', [req.params.role_id]);

        // Reset eligible for affected students
        for (const s of placedStudents) {
            await db.query(
                'UPDATE STUDENT SET eligible = TRUE WHERE student_id = ?',
                [s.student_id]
            );
        }

        // No need to restore applications — they're cascade deleted with the role

        res.json({ message: 'Role deleted, affected students re-eligible' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
