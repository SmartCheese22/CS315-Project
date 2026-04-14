import express from 'express';
import db from '../db/connection.js';
const router = express.Router();

// Get company-wise offer statistics (Uses View 4)
router.get('/stats', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM company_stats');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
