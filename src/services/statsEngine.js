const { service: supabase } = require('../lib/supabase.js');
const tokenTracker = require('./tokenTracker.js');
class StatsEngine {
    async getStats() {
        const [
            { count: totalWords, error: totalWordsError },
            { count: totalUsers, error: totalUsersError },
            { count: totalQuestions, error: totalQuestionsError },
            { count: totalQuestionAttempts, error: totalQuestionAttemptsError },
            { count: totalLists, error: totalListsError },
            totalTokens, thisMonthTokens
        ] = await Promise.all([
            supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
            supabase.from('public_profiles').select('*', { count: 'exact', head: true }),
            supabase.from('sat_questions').select('*', { count: 'exact', head: true }),
            supabase.from('user_question_attempts').select('*', { count: 'exact', head: true }),
            supabase.from('word_lists').select('*', { count: 'exact', head: true }),
            tokenTracker.allTokens(),
            tokenTracker.monthlyTokens(),
        ]);

        console.log({ totalWords, totalUsers, totalQuestions, totalQuestionAttempts, totalLists, totalTokens, thisMonthTokens });
        if (totalWordsError || totalUsersError || totalQuestionsError || totalQuestionAttemptsError || totalListsError) {
            return {
                error: 'Error fetching stats',
                details: { totalWordsError, totalUsersError, totalQuestionsError, totalQuestionAttemptsError, totalListsError, totalTokensError }
            };
        }

        return {
            totalWords,
            totalUsers,
            totalQuestions,
            totalQuestionAttempts,
            totalLists,
            totalTokens,
            thisMonthTokens
        };
    }
}

module.exports = new StatsEngine();