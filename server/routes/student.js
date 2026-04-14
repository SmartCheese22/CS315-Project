import express from 'express';
import db from '../db/connection.js';
const router = express.Router();

// Get all students
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM STUDENT');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a specific student's application tracker (Uses View 2)
router.get('/:roll_no/tracker', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM application_tracker WHERE roll_no = ?', [req.params.roll_no]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
