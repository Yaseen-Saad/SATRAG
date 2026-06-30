const supabase = require('../lib/supabase')

class FeedbackEngine {
    async recordFeedback({ userId, wordID, satisfaction, helpfulComponents, problematicComponents, comments }) {
        const { data, error } = await supabase.from('feedback_events').insert({
            user_id: userId,
            word_id: wordID,
            satisfaction,
            helpful_components: helpfulComponents || [],
            problematic_components: problematicComponents || [],
            comments
        }).select().single();
        if (error) {
            console.error(error)
            return data
        }
    }
    async getWordFeedback(wordID) {
        const { data, error } = await supabase.from('feedback_events')
            .select('*').eq('word_id', wordID)
            .order('created_at', { ascending: false });
        if (error) {
            console.error(error)
            return null
        }
        return data || []
    }

    async getAvgSatisfaction(wordId) {
        const { data } = await supabase.from('feedback_events')
            .select('satisfaction').eq('word_id', wordId)
        if (!data || data.length === 0) return null;
        const avg = data.reduce((sum, entry) => sum + entry.satisfaction, 0) / data.length;
        return Math.round(avg * 10) / 10;
    }

    async getTopRated(limit = 5) {
        const { data } = await supabase.from('feedback_events')
            .select('word_id, satisfaction').order('satisfaction', { ascending: false }).limit(limit)
        return data || [];

    }
}
module.export = new FeedbackEngine();