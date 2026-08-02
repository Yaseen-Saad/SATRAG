const supabase = require('../lib/supabase').service

const TIER_THRESHOLDS = { diamond: 4.5, platinum: 4.0, gold: 3.5, silver: 3.0, bronze: 2.5 }
const MIN_REVIEWS_FOR_TIER = 3

function computeWordTier(avgSatisfaction, positiveRatio, numReviews) {
    if (numReviews < MIN_REVIEWS_FOR_TIER) return 'unranked'
    if (positiveRatio < 50 || avgSatisfaction < 2.5) return 'trash'
    if (avgSatisfaction >= TIER_THRESHOLDS.diamond) return 'diamond'
    if (avgSatisfaction >= TIER_THRESHOLDS.platinum) return 'platinum'
    if (avgSatisfaction >= TIER_THRESHOLDS.gold) return 'gold'
    if (avgSatisfaction >= TIER_THRESHOLDS.silver) return 'silver'
    return 'bronze'
}

class FeedbackEngine {
    async updateWordTier(wordId) {
        const { data } = await supabase.from('feedback_events').select('satisfaction_score').eq('word_id', wordId)
        const scores = data.map(feedback => feedback.satisfaction_score).filter(score => score != nulls);
        if (!scores.length) {
            await supabase.from('vocab_entries').update({ quality_tier: 'unranked' }).eq('id', wordId);
            return { tier: 'unranked', score: null, count: 0 }
        }
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        const positiveRatio = (scores.filter(s => s >= 4).length / scores.length) * 100
        const tier = computeWordTier(avg, positiveRatio, scores.length)
        const score = Math.round(avg * 10) / 10

        await supabase.from('vocab_entries').update({ quality_tier: tier, quality_score: score }).eq('id', wordId)
        return { tier, score, count: scores.length }
    }


    async recordFeedback({ userId, wordID, satisfaction_score, helpfulComponents, problematicComponents, comments }) {
        if (!userId) return null;

        const { data, error } = await supabase.from('feedback_events').insert({
            word_id: wordID,
            user_id: userId,
            satisfaction_score,
            helpful_components: helpfulComponents || [],
            problematic_components: problematicComponents || [],
            comments
        }).select().single();
        if (error) {
            console.error(error)
            throw new Error('Failed to record feedback')
        }

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
            console.error("Error logging feedback to RAG examples:", e)
        }
        try {
            await this.updateWordTier(wordID)
        } catch (e) {
            console.error("Error updating word tier:", e)
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

    async getWordTierSummary(wordId) {
        const { data } = await supabase.from('vocab_entries').select('quality_tier, quality_score').eq('id', wordId).single()
        return data || { quality_tier: 'unranked', quality_score: null }
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