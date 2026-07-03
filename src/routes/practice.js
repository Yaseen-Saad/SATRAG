const { Router } = require('express')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase')
const practice = require('../services/practiceEngine')
const rag = require('../lib/rag')
const router = Router()

router.get('/', requireAuth, async (req, res) => {
    try {
        const { subject, topic, subtopic, active, difficulty, difficultyBand, status, marked, search, page = 1, limit = 20 } = req.query;
        const excludeActive = active === 'inactive' ? true : active === 'active' ? false : undefined;
        const result = await practice.getQuestions({ subject, excludeActive, topic, subtopic, difficulty, difficultyBand, status, marked, search, page: parseInt(page), limit: parseInt(limit), userId: req.user.id });
        const topicTree = await practice.getTopicTree(subject);
        res.render('practice/index', {
            user: req.user, error: null, questions: result.questions, total: result.total,
            page: result.page, limit: result.limit, topicTree, active: active, subject, topic, subtopic, difficulty, difficultyBand, status, marked, search,
            filters: { subject, topic, subtopic, excludeActive, active, difficulty, difficultyBand, status, marked, search }
        })
    } catch (err) {
        res.status(500).render('practice/index', { user: req.user, error: 'Error fetching questions', questions: [], total: 0, page: 1, limit: 20, topicTree: [], filters: {} })
        console.error(err)
    }
})
router.get('/generate', requireAuth, async (req, res) => {
    try {
        const topicTree = await practice.getTopicTree();
        res.render('practice/generate', { user: req.user, error: null, topicTree, generated: null })
    } catch (err) {
        res.status(500).render('practice/generate', { user: req.user, error: 'Error loading page', topicTree: [], generated: null })
    }
})
router.post('/generate', requireAuth, async (req, res) => {
    try {
        const { subject, topic, difficulty, count = 1 } = req.body
        const questions = []
        for (let i = 0; i < Math.min(parseInt(count), 5); i++) {
            const generated = await practice.generateQuestion({ subject, topic, difficulty })
            if (generated) questions.push(generated)
        }
        const topicTree = await practice.getTopicTree();
        res.render('practice/generate', { user: req.user, error: null, topicTree, generated: questions })
    } catch (err) {
        const topicTree = await practice.getTopicTree();
        res.render('practice/generate', { user: req.user, error: 'Error generating questions', topicTree, generated: null })
    }
});

router.post('/generate/save', requireAuth, async (req, res) => {
    try {
        const saved = await rag.saveGeneratedQuestion(req.body)
        res.json({ success: true, questionId: saved.id })
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error saving generated question' })
    }
});

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