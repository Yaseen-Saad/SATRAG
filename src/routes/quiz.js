const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const quiz = require('../services/quizEngine');
const supabase = require('../lib/supabase');

const router = Router();

router.get('/start', requireAuth, (req, res) => {
    const word = req.query.word || null
    res.render('quiz/start', { user: req.user, word, error: null })
})

router.post('/create', requireAuth, async (req, res) => {
    try {
        const { count = 5, word } = req.body
        const result = await quiz.generateQuiz({
            userId: req.user.id,
            count: parseInt(count),
            word: word || null
        })
        res.redirect(`quiz/take/${result.attempt.id}`)
    } catch (err) {
        res.render('quiz/start', { user: req.user, word: null, error: err.message })
    }
})
router.get('/take/:id', requireAuth, async (req, res) => {
    try {
        const { data: attempt } = await supabase
            .from('quiz_attempts')
            .select('*')
            .eq('id', req.params.id)
            .single();
        if (!attempt) return res.status(404).send('Quiz not found')
        if (attempt.completed_at) return res.redirect(`/quiz/results/${attempt.id}`)
        const { data: questions } = await supabase
            .from('quiz_quwestions')
            .select('*')
            .eq('attempt_id', attempt.id)
        res.render('quiz/take', { user: req.user, attempt, questions, error: null })
    } catch (err) {
        res.render('quiz/start', { user: req.user, word: null, error: err.message })
    }
})

router.post('/answer', requireAuth, async (req, res) => {
    try {
        const { questionId, answerIndex } = req.body
        const result = await quiz.submitAnswer({
            questionId,
            answerIndex: parseInt(answerIndex),
            userId: req.user.id,
        });
        res.json({ success: true, ...result })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/complete/:id', requireAuth, async (req, res) => {
    try {
        const result = await quiz.completeQuiz(req.params.id, req.user.id)
        res.json({ success: true, ...result })
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});


router.get('/results/:id', requireAuth, (req, res) => {
    const { data: attempt } = await supabase.from('quiz_attempts').select('*').eq('id', req.params.id).single()
    if (!attempt) return res.status(404).send('Quiz not found');
    const { data: questions } = await supabase.from('quiz_questions').select("*").eq('attempt_id', attempt.id)
    res.render('quiz/results', { user: req.user, attempt, questions })
})
module.exports = router