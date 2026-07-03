const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const supabase = require('../lib/supabase');

const router = Router();

router.get('/', requireAuth, async (req, res) => {
    const userId = req.user.id;

    const [quizzes, dueReviews, wordsLearned, allQuizzes, totalEntries, avgQuality, feedbackData] = await Promise.all([
        supabase.from('quiz_attempts').select('*').eq('user_id', userId).order('completed_at', { ascending: false }).limit(5),
        supabase.from('spaced_repetition').select('*, vocab_entries!inner(word, definition)').eq('user_id', userId).lte('due_date', new Date().toISOString()).limit(10),
        supabase.from('user_vocab_progress').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('familiarity', 0.7),
        supabase.from('quiz_attempts').select('score').eq('user_id', userId).not('score', 'is', null),
        supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
        supabase.from('vocab_entries').select('quality_score'),
        supabase.from('feedback_events').select('satisfaction_score, helpful_components, comments, created_at, word_id')
            .order('created_at', { ascending: false }).limit(10),
    ]);
    const [practiceStats, recentAttempts] = await Promise.all([
        supabase.from('user_question_state').select('status, times_attempted, marked_for_review').eq('user_id', userId),
        supabase.from('user_question_attempts').select('*, sat_questions!inner(question_text, subject, topic)')
            .eq('user_id', userId).order('attempt_time', { ascending: false }).limit(5),
    ]);
    const avgScore = allQuizzes.data && allQuizzes.data.length > 0
        ? Math.round(allQuizzes.data.reduce((s, q) => s + q.score, 0) / allQuizzes.data.length)
        : null;

    const validScores = (avgQuality.data || []).filter(e => e.quality_score != null).map(e => e.quality_score);
    const avgQualityScore = validScores.length > 0
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
        : null;

    const feedbackRatings = (feedbackData.data || []).filter(f => f.satisfaction_score != null);
    const avgSatisfaction = feedbackRatings.length > 0
        ? (feedbackRatings.reduce((s, f) => s + f.satisfaction_score, 0) / feedbackRatings.length).toFixed(1)
        : null;

    let recentFeedback = [];
    if (feedbackData.data && feedbackData.data.length > 0) {
        const wordIds = [...new Set(feedbackData.data.filter(f => f.word_id).map(f => f.word_id))];
        const { data: words } = wordIds.length > 0
            ? await supabase.from('vocab_entries').select('id, word').in('id', wordIds)
            : { data: [] };
        const wordMap = Object.fromEntries((words || []).map(w => [w.id, w.word]));
        recentFeedback = feedbackData.data.map(f => ({ ...f, word: wordMap[f.word_id] || 'Unknown' }));
    }
    const attemptedQuestions = (practiceStats.data || []).filter(s => s.status !== 'unsolved');
    const correctCount = (practiceStats.data || []).filter(s => s.status === 'solved_correct').length;
    const markedCount = (practiceStats.data || []).filter(s => s.marked_for_review).length;
    const practiceAccuracy = attemptedQuestions.length > 0
        ? Math.round((correctCount / attemptedQuestions.length) * 100)
        : null;


    res.render('dashboard/progress', {
        user: req.user,
        quizzes: quizzes.data || [],
        dueReviews: dueReviews.data || [],
        wordsLearned: wordsLearned.count || 0,
        avgScore,
        totalEntries: totalEntries.count || 0,
        avgQualityScore,
        avgSatisfaction,
        recentFeedback: recentFeedback.slice(0, 10),
        practiceAttempted: attemptedQuestions.length,
        practiceAccuracy,
        practiceMarked: markedCount,
        recentPractice: recentAttempts.data || [],
    });
});

module.exports = router;