const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const supabase = require('../lib/supabase');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    const userId = req.user.id;

    const { data: quizzes } = await supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('completed_at', { ascending: false }).limit(5)

    const { data: dueReviews } = await supabase.from('spaced_repetition').select('*, vocab_entries!inner(word, definition)').eq('user_id', userId).lte('due_date', new Date().toISOString()).limit(10)

    const { count: wordsLearned } = await supabase
        .from('user_vocab_progress').select('*', { count: 'exact', head: true })
        .eq('user_id', userId).gte('familiarity', 0.7)

    const { data: allQuizzes } = await supabase
        .from('quiz_attempts').select('score').eq('user_id', userId)
        .not('score', 'is', null);

    const avgScore = allQuizzes && allQuizzes.length > 0
        ? Math.round(allQuizzes.reduce((s, q) => s + q.score, 0) / allQuizzes.length)
        : null;

    res.render('dashboard/progress', {
        user: req.user, quizzes: quizzes || [], dueReviews: dueReviews || [], wordsLearned: wordsLearned || 0, avgScore,
    });
});

module.exports = router;