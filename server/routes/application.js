import express from 'express';
import db from '../db/connection.js';
const router = express.Router();

// Get branch-wise placement dashboard (Uses View 1)
router.get('/dashboard', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM placement_dashboard');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
