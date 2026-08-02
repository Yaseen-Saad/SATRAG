const { Router } = require('express')
const { requireAuth } = require('../middleware/auth')
const engine = require('../services/questionFeedbackEngine')

const router = Router()

router.get('/trash/list', requireAuth, async (req, res) => {
    try {
        const trash = await engine.getTrashQuestions()
        res.json({ success: true, count: trash.length, questions: trash.map(q => ({ id: q.id, question_text: q.question_text?.substring(0, 120), quality_score: q.quality_score, feedback_count: q.feedback_count, positive_ratio: q.positive_ratio })) })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/stats/distribution', requireAuth, async (req, res) => {
    try {
        const dist = await engine.getTierDistribution()
        res.json({ success: true, distribution: dist })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.post('/trash/improve', requireAuth, async (req, res) => {
    try {
        const result = await engine.batchImproveTrash(req.user.id)
        res.json({ success: true, ...result })
    } catch (err) {
        console.error('Trash improve error:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/:questionId', requireAuth, async (req, res) => {
    try {
        const summary = await engine.getQuestionFeedbackSummary(req.params.questionId)
        const userFeedback = await engine.getUserFeedback(req.user.id, req.params.questionId)
        res.json({ success: true, ...summary, userFeedback })
    } catch (err) {
        console.error('Get feedback error:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})

router.post('/:questionId', requireAuth, async (req, res) => {
    try {
        const { satisfaction, isPositive, comment } = req.body
        if (isPositive === undefined || isPositive === null) {
            return res.status(400).json({ success: false, error: 'isPositive is required' })
        }
        const sat = satisfaction != null ? Math.min(10, Math.max(1, parseInt(satisfaction) || 5)) : null
        const result = await engine.recordFeedback(req.user.id, req.params.questionId, {
            satisfaction: sat,
            isPositive: !!isPositive,
            comment: comment || null
        })
        const summary = await engine.getQuestionFeedbackSummary(req.params.questionId)
        res.json({ success: true, feedback: result, tier: summary.tier, avgSatisfaction: summary.avgSatisfaction, positiveRatio: summary.positiveRatio, feedbackCount: summary.feedbackCount })
    } catch (err) {
        console.error('Record feedback error:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/:questionId/all', requireAuth, async (req, res) => {
    try {
        const summary = await engine.getQuestionFeedbackSummary(req.params.questionId)
        res.json({ success: true, ...summary })
    } catch (err) {
        console.error('Get all feedback error:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})

module.exports = router