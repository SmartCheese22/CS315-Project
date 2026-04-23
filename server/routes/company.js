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

export default router;
