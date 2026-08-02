const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const feedback = require('../services/vocabFeedbackEngine')

const router = Router();

router.post('/submit', requireAuth, async (req, res) => {
    try {
        const result = await feedback.recordFeedback({ userId: req.user.id, wordID: wordId, satisfaction_score: Math.min(5, Math.max(1, parseInt(satisfaction) || 5)), helpfulComponents, problematicComponents, comments })
        const tierSummary = await feedback.getWordTierSummary(wordId)
        if (req.headers['content-type']?.includes('json')) {
            return res.json({ success: true, data: result, tier: tierSummary })
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