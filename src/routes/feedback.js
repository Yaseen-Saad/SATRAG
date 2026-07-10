const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const feedback = require('../services/feedbackEngine')

const router = Router();

router.post('/submit', requireAuth, async (req, res) => {
    try {
        const { wordId, satisfaction, helpfulComponents, problematicComponents, comments } = req.body;
        const result = await feedback.recordFeedback({ userId: req.user.id, wordID: wordId, satisfaction_score: parseInt(satisfaction), helpfulComponents, problematicComponents, comments })
        if (req.headers['content-type']?.includes('json')) {
            return res.json({ success: true, data: result })
        }
        res.redirect('/vocab')
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