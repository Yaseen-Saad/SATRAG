const { Router } = require('express')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase')
const practice = require('../services/practiceEngine')
const router = Router()

router.get('/', requireAuth, async (req, res) => {
    try {
        const { subject, topic, subtopic, excludeActive, difficulty, difficultyBand, status, marked, search, page = 1, limit = 20 } = req.query;
        const result = await practice.getQuestions({ subject, excludeActive, topic, subtopic, difficulty, difficultyBand, status, marked, search, page: parseInt(page), limit: parseInt(limit), userId: req.user.id });
        const topicTree = await practice.getTopicTree(subject);
        res.render('practice/index', {
            user: req.user, error: null, questions: result.questions, total: result.total,
            page: result.page, limit: result.limit, topicTree,
            filters: { subject, topic, subtopic, excludeActive, difficulty, difficultyBand, status, marked, search }
        })
    } catch (err) {
        res.status(500).render('practice/index', { user: req.user, error: 'Error fetching questions', questions: [], total: 0, page: 1, limit: 20, topicTree: [], filters: {} })
        console.error(err)
    }
})
router.get('/question/:id', requireAuth, async (req, res) => {
    try {
        const { question, uState, attempts } = await practice.getQuestion({ questionId: req.params.id, userId: req.user.id })
        if (!question) return res.status(404).render('practice/question', { user: req.user, error: 'Question not found', question: null, uState: null, attempts: [] })
        res.render('practice/question', { user: req.user, error: null, question, uState, attempts })
    } catch (err) {
        res.status(500).render('practice/question', { user: req.user, error: 'Error fetching question', question: null, uState: null, attempts: [] })
    }
})
router.post('/question/:id/answer', requireAuth, async (req, res) => {
    try {
        const { answer, timeMs } = req.body
        const result = await practice.submitAnswer({ questionId: req.params.id, userId: req.user.id, answer, timeMs: parseInt(timeMs) })
        res.json({ success: true, ...result })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})


router.get('/question/:id/mark', requireAuth, async (req, res) => {
    try {
        const result = await practice.toggleMarkForReview(req.user.id, req.params.id)
        res.json({ success: true, ...result })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message })
    }
})

module.exports = router