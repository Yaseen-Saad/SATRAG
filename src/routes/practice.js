const { Router } = require('express')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase')
const practice = require('../services/practiceEngine')
const router = Router()

router.get('/', requireAuth, async (req, res) => {
    try {
        const { subject, topic, subtopic, excludeActive, difficulty, difficultyBand, status, marked, search, page = 1, limit = 20 } = req.query;
        const result = await practice.getQuestions({ subject, excludeActive, topic, subtopic, difficulty, difficultyBand, status, marked, search, page: parseInt(page), limit: parseInt(limit), userId: req.user.id });
        res.json(result);
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal Server Error' })
    }
})