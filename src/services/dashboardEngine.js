const supabase = require('../lib/supabase');

class DashboardEngine {
    async getUserDashboardData(userId) {
        try {
            // Fetch user data from Supabase
            const { wordsLearned, allQuizzes, avgQuality, feedbackData, practiceStates, recentAttempts } = await Promise.all([
                supabase
                    .from('user_vocab_progress')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('familiarity', 0.7),
                supabase
                    .from('quiz_attempts')
                    .select('score, total_questions, attempt_time')
                    .eq('user_id', userId).not('score', 'is', null),
                supabase
                    .from('vocab_entries')
                    .select('*', { count: 'exact', head: true }),
                supabase
                    .from('vocab_entries')
                    .select('quality_score'),
                supabase.from("feedback_events").select("satisfaction_score, helpful_components, comments, created_at, word_id").order("created_at", { ascending: false }).limit(10),
                supabase.from('user_question_state').select('status, times_attempt, question_id, marked_for_review').eq('user_id', userId),
                supabase.from('user_question_attempts').select('*, sat_questions!inner(question_text, subject, topic)').eq('user_id', userId).order('attempt_time', { ascending: false }).limit(10)
            ]);

            const avgScore = allQuizzes.data?.length ? Math.round(allQuizzes.data.reduce((acc, quiz) => acc + quiz.score, 0) / (allQuizzes.data.length)) : null;
            const validScores = (avgQuality.data || []).filter(e => e.quality_score != null).map(e => e.quality_score);
            const avgQualityScore = validScores.length ? Math.round(validScores.reduce((acc, score) => acc + score, 0) / validScores.length) : null;
            const ratings = feedbackData.data?.filter(feedback => feedback.satisfaction_score !== null);
            const avgSatisfaction = ratings?.length ? Math.round(ratings.reduce((acc, feedback) => acc + feedback.satisfaction_score, 0) / ratings.length) : null;
            return {
                wordsLearned: wordsLearned.count || 0,
                avgScore,
                avgQualityScore,
                avgSatisfaction,
                totalEntries: totalEntries.count || 0,
                practiceStates: practiceStates.data || [],
                recentAttempts: recentAttempts.data || []
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }


    async getPracticeStats(userId) {
        try {
            const { data: practiceStates, error } = await supabase
                .from('user_question_state')
                .select('status, times_attempt, question_id, marked_for_review')
                .eq('user_id', userId);
            if (error) throw error;
            const data = practiceStates.data || [];
            const attempted = data.filter(state => state.status !== 'unsolved');
            const correct = data.filter(state => state.status === 'solved_correct');
            const markedForReview = data.filter(state => state.marked_for_review);
            const accuracy = attempted.length > 0 ? (correct.length / attempted.length) * 100 : 0;
            return {
                attempted: attempted.length,
                markedForReview: markedForReview.length,
                accuracy,
                correct: correct.length,
            };
        } catch (error) {
            console.error('Error fetching practice stats:', error);
        }
    }
    async getTopicBreakdown(userId) {
        const { data: attempts, error } = await supabase
            .from('user_question_attempts')
            .select('is_correct, sat_questions!inner(subject, topic)')
            .eq('user_id', userId);
        if (error) throw error;
        if (!attempts || attempts.length === 0) return [];
        const breakdown = {};
        for (const attempt of attempts) {
            const key = `${attempt.sat_questions.subject}-${attempt.sat_questions.topic}`;
            if (!breakdown[key]) {
                breakdown[key] = { subject: attempt.sat_questions.subject, topic: attempt.sat_questions.topic, correct: 0, incorrect: 0 };
            }
            breakdown[key].total++
            if (attempt.is_correct) breakdown[key].correct++
        }
        return Object.entries(breakdown).map(g => ({ ...g, accuracy: g.correct / g.total * 100 })).sort((a, b) => a.accuracy - b.accuracy);
    }


}