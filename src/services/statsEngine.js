const supabase = require('../lib/supabase.js');

class StatsEngine {
    async getStats() {
        const [
            { count: totalWords, error: totalWordsError },
            { count: totalUsers, error: totalUsersError },
            { count: totalQuestions, error: totalQuestionsError },
        ] = await Promise.all([
            supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
            supabase.from('public_profiles').select('*', { count: 'exact', head: true }),
            supabase.from('sat_questions').select('*', { count: 'exact', head: true }),
          ]);

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
        };
    }
}

module.exports = new StatsEngine();