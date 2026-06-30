const { Router } = require('express')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const feedback = require('../services/feedbackEngine')
const path = require('path')
const fs = require('fs')

const router = Router();

router.post('/submit', optionalAuth, async (req, res) => {
    try {
        const { wordId, satisfaction, helpfulComponents, problematicComponents, comments } = req.body;
        const userId = req.user ? req.user.id : null;
        const result = await feedback.recordFeedback({ userId, wordID: wordId, satisfaction: parseInt(satisfaction), helpfulComponents, problematicComponents, comments })
        if (req.headers['content-type']?.includes('json')) {
            res.json({ success: true, data: result })
        } else {
            res.redirect('/vocab')
        }
    } catch (err) { res.status(500).json({ success: false, error: err.message }) }
})
router.get('/:wordId', requireAuth, async (req, res) => {
    try {
        const data = await feedback.getWordFeedback(req.params.wordId)
        const avg = await feedback.getAvgSatisfaction(req.params.wordId)
        res.json({ data, averageSatisfaction: avg })
    } catch (err) { res.status(500).json({ error: err.message }) }
});

module.exports = router;