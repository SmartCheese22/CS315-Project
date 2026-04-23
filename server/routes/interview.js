import express from 'express';
import db from '../db/connection.js';

const router = express.Router();

// GET all rounds for an application
router.get('/application/:app_id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM INTERVIEW_ROUND WHERE app_id = ? ORDER BY round_no',
            [req.params.app_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST add an interview round to an application
router.post('/', async (req, res) => {
    try {
        const { app_id, round_no, round_type, result, round_date } = req.body;
        if (!app_id || !round_no || !round_type) {
            return res.status(400).json({ error: 'app_id, round_no and round_type are required' });
        }
        const [result_] = await db.query(
            'INSERT INTO INTERVIEW_ROUND (app_id, round_no, round_type, result, round_date) VALUES (?, ?, ?, ?, ?)',
            [app_id, round_no, round_type, result || 'pending', round_date || null]
        );
        res.status(201).json({ message: 'Round added', round_id: result_.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update round result (pass / fail / pending)
router.put('/:round_id/result', async (req, res) => {
    try {
        const { result } = req.body;
        if (!['pending', 'pass', 'fail'].includes(result)) {
            return res.status(400).json({ error: 'result must be pending, pass or fail' });
        }
        await db.query(
            'UPDATE INTERVIEW_ROUND SET result = ? WHERE round_id = ?',
            [result, req.params.round_id]
        );
        res.json({ message: `Round result updated to '${result}'` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
