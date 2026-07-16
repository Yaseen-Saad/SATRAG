const { Router } = require('express')
const { requireAuth, optionalAuth } = require('../middleware/auth')
const supabase = require('../lib/supabase').service
const practice = require('../services/practiceEngine')
const vocabEngine = require('../services/vocabEngine')
const { checkAPIKeys, incrementGenCount } = require('../middleware/useFreeModels')
const rag = require('../lib/rag')
const router = Router()

router.get('/', requireAuth, async (req, res) => {
    try {
        let { subject, topic, subtopic, active, source, difficulty, difficultyBand, status, marked, search, page = 1, limit = 20 } = req.query;
        const activeFilter = active === 'active' ? true : active === 'inactive' ? false : undefined;
        const topicTree = await practice.getTopicTree(subject);
        const validTopics = topicTree.map(t => t.topic)
        if (topic && !validTopics.includes(topic)) {
            topic = undefined; subtopic = undefined;
        }
        const selectedTopicEntry = topicTree.find(t => t.topic === topic)
        const subtopics = selectedTopicEntry ? selectedTopicEntry.subtopics : []
        if (topic && subtopic && !subtopics.includes(subtopic)) {
            subtopic = undefined;
        }
        const result = await practice.getQuestions({ subject, source, active: activeFilter, topic, subtopic, difficulty, difficultyBand, status, marked, search, page: parseInt(page), limit: parseInt(limit), userId: req.user.id });
        res.render('practice/index', {
            user: req.user, error: null, questions: result.questions, total: result.total,
            page: result.page, limit: result.limit, topicTree, active, subject, topic, subtopic, source, difficulty, difficultyBand, status, marked, search,
            filters: { subject, topic, subtopic, source, activeFilter, active, difficulty, difficultyBand, status, marked, search, subtopics }
            , currentUrl: req.originalUrl
        })
    } catch (err) {
        console.error(err)
        res.status(500).render('practice/index', { user: req.user, error: 'Error fetching questions', questions: [], total: 0, page: 1, limit: 20, topicTree: [], filters: {}, subject, topic, subtopic, source, difficulty, difficultyBand, status, marked, search, currentUrl: req.originalUrl })
    }
})

router.get('/generate', requireAuth, async (req, res) => {
    try {
        const topicTree = await practice.getTopicTree();
        res.render('practice/generate', { user: req.user, error: null, subject: undefined, topic: undefined, subtopic: undefined, difficulty: undefined, count: undefined, topicTree, generated: null })
    } catch (err) {
        console.error(err)
        res.status(500).render('practice/generate', { user: req.user, error: 'Error loading page', topicTree: [], generated: null })
    }
})

router.post('/generate', requireAuth, checkAPIKeys, async (req, res) => {
    try {
        const { subject, topic, subtopic, difficulty, count = 1 } = req.body
        const genSubject = subject === 'reading_writing' ? (Math.random() > 0.5 ? 'reading' : 'writing') : subject;
        let maxIter = Math.min(parseInt(count), 5);
        if (req.user.useFreeModels) {
            maxIter = Math.min(maxIter, 5 - (req.user.genCount || 0));
        }
        const questions = []
        for (let i = 0; i < maxIter; i++) {
            const generated = await rag.generateSATQuestion({ subject: genSubject, topic, subtopic, difficulty })
            if (generated) {
                questions.push(generated)
                await incrementGenCount(req.user)
            }
        }
        const topicTree = await practice.getTopicTree(subject);
        res.render('practice/generate', { user: req.user, error: null, topicTree, generated: questions, subject, topic, subtopic, difficulty, count })
    } catch (err) {
        console.error(err)
        const { subject, topic, subtopic, difficulty, count } = req.body
        const topicTree = await practice.getTopicTree();
        res.render('practice/generate', { user: req.user, error: 'Error generating questions', topicTree, generated: null, subject, topic, subtopic, difficulty, count })
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
        const adjacent = await practice.getAdjacentQuestions({ questionId: req.params.id, subject: question.subject, topic: question.topic, userId: req.user.id })
        const returnTo = req.query.from || '/practice'
        res.render('practice/question', { user: req.user, error: null, question, uState, attempts, prevId: adjacent.prevId, nextId: adjacent.nextId, returnTo })
    } catch (err) {
        console.error(err)
        res.status(500).render('practice/question', { user: req.user, error: 'Error fetching question', question: null, uState: null, attempts: [] })
    }
})

router.post('/question/:id/answer', requireAuth, async (req, res) => {
    try {
        const { answer, timeMs } = req.body
        const result = await practice.submitAnswer({ questionId: req.params.id, userId: req.user.id, answer, timeMs: parseInt(timeMs) })
        let isWIC = false;
        if (!result.isCorrect) {
            const { data: questionData } = await supabase.from('sat_questions')
                .select('passage_text, subject, topic, options, correct_answer, question_text, subtopic, skill_description')
                .eq('id', req.params.id)
                .single()
            if (questionData) {
                const isRW = questionData.subject === 'reading' || questionData.subject === 'writing' || questionData.subject === 'reading_writing'
                const skill = (questionData.skill_description || questionData.subtopic || "").toLowerCase()
                isWIC = isRW && skill.includes('words in context')
            }
        }
        res.json({ success: true, ...result, isWIC })
    } catch (err) {
        console.error('Answer error:', err)
        res.status(500).json({ success: false, error: err.message })
    }
})


router.post('/question/:id/add-mistakes', requireAuth, checkAPIKeys, async (req, res) => {
    try {
        const { data: qData } = await supabase.from('sat_questions').select('passage_text, subject, topic, options, correct_answer, question_text, subtopic, skill_description').eq('id', req.params.id).single()
        if (!qData) return res.status(404).json({ success: false, error: 'Question not found' })
        const result = await vocabEngine.addWICWordsToMistakes(req.user, qData)
        res.json({ success: true, ...result })
    } catch (err) {
        console.error('Answer error:', err)
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

router.get('/history', requireAuth, async (req, res) => {
    try {
        const { data: attempts } = await supabase.from('user_question_attempts').select('*, sat_questions!inner(question_text, subject, topic)').eq('user_id', req.user.id).order('attempt_time', { ascending: false }).limit(req.query.limit || 20)
        res.render('practice/history', { user: req.user, error: null, attempts: attempts || [], questionId: req.query.questionId || null })
    } catch (err) {
        console.error('History error:', err);
        res.render('practice/history', { user: req.user, error: 'Error loading history', attempts: [], questionId: null })
    }
})


router.get('/adaptive', requireAuth, async (req, res) => {
    try {
        const { subject } = req.query
        const topicStats = await practice.getTopicStats(req.user.id)
        const weakTopics = topicStats.filter(topic => topic.accuracy_pct < 70)

        if (req.query.json === "true") {
            const result = await practice.getAdaptiveQuestion(req.user.id, subject)
            return res.json(result)
        }
        res.render('practice/adaptive', {
            user: req.user, topicStats, weakTopics, subject, question: null, reason: null, error: null
        })

    } catch (error) {
        console.error('Adaptive practice error:', error)
        res.redirect('/practice')
    }
})

router.post('/adaptive/next', requireAuth, async (req, res) => {
    try {
        const { subject } = req.body
        const topicStats = await practice.getTopicStats(req.user.id)
        const weakTopics = topicStats.filter(topic => topic.accuracy_pct < 70)
        const result = await practice.getAdaptiveQuestion(req.user.id, subject)
        if (result.question && typeof result.question.options === 'string') {
            try { result.question.options = JSON.parse(result.question.options); } catch (e) { }
        }

        res.render('practice/adaptive', {
            user: req.user, topicStats, weakTopics, subject, question: result.question, reason: result.reason, error: result.question ? null : "No questions available. Please try a different subject or complete more practice questions first."
        })

    } catch (error) {
        console.error('Adaptive practice error:', error)
        res.redirect('/practice/adaptive')
    }
})

module.exports = router