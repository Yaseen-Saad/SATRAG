const { service: supabase } = require('../lib/supabase.js');

class StatsEngine {
    async getStats() {
        const [
            { count: totalWords, error: totalWordsError },
            { count: totalUsers, error: totalUsersError },
            { count: totalQuestions, error: totalQuestionsError },
            { count: totalQuestionAttempts, error: totalQuestionAttemptsError },
            { count: totalLists, error: totalListsError }
        ] = await Promise.all([
            supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
            supabase.from('public_profiles').select('*', { count: 'exact', head: true }),
            supabase.from('sat_questions').select('*', { count: 'exact', head: true }),
            supabase.from('user_question_attempts').select('*', { count: 'exact', head: true }),
            supabase.from('word_lists').select('*', { count: 'exact', head: true })
        ]);

        console.log({ totalWords, totalUsers, totalQuestions, totalQuestionAttempts, totalLists });
        if (totalWordsError || totalUsersError || totalQuestionsError) {
            return {
                error: 'Error fetching stats',
                details: { totalWordsError, totalUsersError, totalQuestionsError }
            };
        }

        return {
            totalWords,
            totalUsers,
            totalQuestions,
            totalLists,
            totalQuestionAttempts
        };
    }
}

module.exports = new StatsEngine();