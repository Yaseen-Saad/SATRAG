const supabase = require('../lib/supabase')

class FeedbackEngine {
    async recordFeedback({ userId, wordID, satisfaction_score, helpfulComponents, problematicComponents, comments }) {
        if (!userId) {
            // Store anonymously without user reference
            const { data, error } = await supabase.from('feedback_events').insert({
                word_id: wordID,
                satisfaction_score,
                helpful_components: helpfulComponents || [],
                problematic_components: problematicComponents || [],
                comments
            }).select().single();
            if (error) {
                console.error(error)
                return null
            }
            return data
        }
        const { data, error } = await supabase.from('feedback_events').insert({
            user_id: userId,
            word_id: wordID,
            satisfaction_score,
            helpful_components: helpfulComponents || [],
            problematic_components: problematicComponents || [],
            comments
        }).select().single();
        if (error) {
            console.error(error)
            return null
        }

        // Also store in rag_feedback_examples for RAG context
        try {
            const { data: wordEntry } = await supabase.from('vocab_entries').select('word').eq('id', wordID).single()
            if (wordEntry) {
                if (problematicComponents && problematicComponents.length > 0) {
                    await supabase.from('rag_feedback_examples').insert({
                        word: wordEntry.word,
                        type: "negative",
                        content: `NEGATIVE FEEDBACK FOR ${wordEntry.word}:\nIssues: ${problematicComponents.join(', ')}\nComments: ${comments || ''}`
                    })
                }
                if (satisfaction_score >= 7) {
                    await supabase.from('rag_feedback_examples').insert({
                        word: wordEntry.word,
                        type: "positive",
                        content: `POSITIVE FEEDBACK FOR ${wordEntry.word}:\n${satisfaction_score}/10 Satisfied.\nHelpful: ${(helpfulComponents || []).join(', ')}`
                    })
                }
            }
        } catch (e) {
            // non-critical, don't fail the main operation
        }

        return data
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
            .select('satisfaction_score').eq('word_id', wordId)
        if (!data || data.length === 0) return null;
        const avg = data.reduce((sum, entry) => sum + (entry.satisfaction_score || 0), 0) / data.length;
        return Math.round(avg * 10) / 10;
    }

    async getTopRated(limit = 5) {
        const { data } = await supabase.from('feedback_events')
            .select('word_id, satisfaction_score').order('satisfaction_score', { ascending: false }).limit(limit)
        return data || [];

    }
}
module.exports = new FeedbackEngine();