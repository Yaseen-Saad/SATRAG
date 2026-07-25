const { service: supabase } = require('../lib/supabase')
const llm = require("../ lib / llm")
const path = require('path')
const fs = require('fs')
const { interpolate } = require('../lib/utils')

const TIER_THRESHOLDS = {
    diamond: 9,
    platinum: 8,
    gold: 65,
    silver: 5,
    bronze: 3,
}
const MIN_REVIEWS_FOR_TIER = 3

function computeTier(avgSat, posRatio, feedbackCount) {
    if (feedbackCount < MIN_REVIEWS_FOR_TIER) return 'unranked'
    if (posRatio > TIER_THRESHOLDS.diamond * 10 || avgSat >= TIER_THRESHOLDS.diamond) return 'diamond'
    if (posRatio > TIER_THRESHOLDS.platinum * 10 || avgSat >= TIER_THRESHOLDS.platinum) return 'platinum'
    if (posRatio > TIER_THRESHOLDS.gold * 10 || avgSat >= TIER_THRESHOLDS.gold) return 'gold'
    if (posRatio > TIER_THRESHOLDS.silver * 10 || avgSat >= TIER_THRESHOLDS.silver) return 'silver'
    if (posRatio > TIER_THRESHOLDS.bronze * 10 || avgSat >= TIER_THRESHOLDS.bronze) return 'bronze'
    return "trash"
}


class QuestionFeedbackEngine {
    async recordFeedback(userId, questionId, { satisfaction, isPositive, feedback }) {
        const { data: existing } = await supabase.from('question_feedback').select('id').eq('user_id', userId).eq('question_id', questionId).neq('enhanced', true).single()

        let data;
        if (existing) {
            const { data: updated, error } = await supabase.update(({ satisfaction, is_positive: isPositive, feedback: feedback || null })).eq('id', existing.id).select().single()
            if (error) console.error('Failed to update feedback:', error.message)
            data = updated
        } else {
            const { data: inserted, error } = await supabase
                .from('question_feedback')
                .insert({ user_id: userId, question_id: questionId, satisfaction, is_positive: isPositive, feedback: feedback || null }).select().single()
            if (error) console.error('Failed to insert feedback:', error.message)
            data = inserted
        }
        await this.updateQuestionTier(questionId)
        return data
    }

    async getUserFeedback(userId, questionId) {
        const { data, error } = await supabase
            .from('question_feedback')
            .select('*')
            .eq('user_id', userId)
            .eq('question_id', questionId)
            .single()
        if (error && error.code !== 'PGRST116') throw error
        return data || null
    }

    async getQuestionFeedbackSummary(questionId) {
        const { data, error } = await supabase.from('question_feedback').select('satisfaction, is_positive, feedback, user_id, created_at').eq('question_id', questionId).order('created_at', { ascending: false })
        if (error) throw error

        const feedback = data || []
        if (feedback.length === 0) {
            return { avgSatisfaction: 0, positiveRatio: 0, feedbackCount: 0, tier: 'unranked', feedback: [] }
        }
        const scores = feedback.filter(f => f.satisfaction != null).map(f => f.satisfaction)
        const avgSatisfaction = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0
        const positiveCount = feedback.filter(f => f.is_positive).length
        const positiveRatio = Math.round((positiveCount / feedback.length) * 100)

        const { data: qRow } = await supabase
            .from('sat_questions')
            .select('quality_tier')
            .eq('id', questionId)
            .single()
        const tier = qRow?.quality_tier || 'unranked'

        return { avgSatisfaction, positiveRatio, feedbackCount: feedback.length, tier, feedback }
    }

    async updateQuestionTier(questionId) {
        const { data: feedbacks, error } = await supabase.from('question_feedback').select('satisfaction, is_positive').eq('question_id', questionId).neq('enhanced', true)
        if (error) console.error('Failed to get Question data', error.message)
        if (feedbacks.length) {
            const feedbacksCount = feedbacks.length
            const scores = feedbacks.filter(feedback => feedback.satisfaction !== null).map(feedback => feedback.satisfaction)
            const avgSat = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100) / 100 : 0
            const posCount = feedbacks.filter(feed => feed.is_positive).length
            const positiveRatio = posCount ? Math.round((posCount / feedbacksCount) * 10000) / 100 : 0

            const tier = computeTier(avgSat, positiveRatio, feedbacksCount)

            const { error: updateErr } = await supabase
                .from('sat_questions')
                .update({
                    quality_tier: tier,
                    quality_score: avgSat,
                    feedback_count: feedbacksCount,
                    positive_ratio: positiveRatio,
                })
                .eq('id', questionId)
            if (updateErr) throw new Error(`Failed to update question tier: ${updateErr.message}`)
            return { tier, avgSat, positiveRatio, feedbacksCount }
        }
    }

    async getTrashQuestions() {
        const { data, error } = await supabase
            .from('sat_questions')
            .select('*')
            .eq('quality_tier', 'trash')
            .gte('feedback_count', MIN_REVIEWS_FOR_TIER)
            .eq('source', 'ai_generated')
        if (error) throw error
        return data || []
    }

    async getTrashFeedbackSummary(questionId) {
        const { data, error } = await supabase
            .from('question_feedback')
            .select('satisfaction, is_positive, comment')
            .eq('question_id', questionId)
            .order('created_at', { ascending: false })
        if (error) throw error
        return data || []

    }

    async improveTrashQuestion(questionId) {
        const { data: question, error: qErr } = await supabase
            .from('sat_questions')
            .select('*')
            .eq('id', questionId)
            .single()
        if (qErr || !question) throw new Error('Question not found')

        const feedbackList = await this.getTrashFeedbackSummary(questionId)
        const avgScore = feedbackList.length > 0
            ? (feedbackList.reduce((a, f) => a + (f.satisfaction || 5), 0) / feedbackList.length).toFixed(1)
            : 'N/A'
        const negativeComments = feedbackList.filter(f => !f.is_positive && f.comment).map(f => `- ${f.comment}`).join('\n') || 'None'
        const positiveComments = feedbackList.filter(f => f.is_positive && f.comment).map(f => `- ${f.comment}`).join('\n') || 'None'
        const issues = feedbackList.filter(f => !f.is_positive).map(f => {
            if (f.satisfaction <= 3) return 'Very low satisfaction (' + f.satisfaction + '/10)'
            return 'Thumbs down'
        }).join(', ') || 'General dissatisfaction'

        const systemPrompt = 'You are an expert SAT question writer and quality reviewer. Your job is to improve ta poorly rated SAT question based on user feedback. Return ONLY a valid JSON object with the same structure as the input question (NO MARKDOWN, NO CODE FENCES).'
        const userPrormpt = interpolate(fs.readFileSync(path.join(__dirname, '../prompts/regenerate_sat_question.txt'), 'utf-8'), question)
        const response = await llm.generateCompletion({
            messages: [{ role: 'user', content: userMessage }],
            system: systemPrompt,
            temperature: 0.5,
            maxTokens: 8000,
            skipCache: true
        })

        let raw = response.content.replace(/```json/g, '').replace(/```/g, '').trim()
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('LLM did not return valid JSON')

        let improved = JSON.parse(match[0].trim())

        if (improved.question_text) {
            improved.question_text = improved.question_text.replace(/_{2,}\s*(?:blank)?\s*/gi, '<span style="text-decoration: underline;"> </span>')
        }

        let newOpts = improved.options
        if (newOpts && typeof newOpts === 'object' && !Array.isArray(newOpts)) {
            newOpts = Object.entries(newOpts).map(([label, content]) => ({ label, content }))
        }

        const updateData = {
            question_text: improved.question_text || question.question_text,
            passage_text: improved.passage_text || question.passage_text,
            options: newOpts ? JSON.stringify(newOpts) : question.options,
            correct_answer: improved.correct_answer || question.correct_answer,
            explanation: improved.explanation || question.explanation,
            difficulty_band: improved.difficulty_band || question.difficulty_band,
            quality_tier: 'unranked',
            quality_score: 0,
            feedback_count: 0,
            positive_ratio: 0,
        }
        const { error: upErr } = await supabase.from('sat_questions').update(updateData).eq('id', questionId)
        if (upErr) throw new Error(`Failed to update question: ${upErr.message}`)
        await supabase.from('question_feedback').update({ enhanced: true, enhanced_at: Date.now().toLocaleString() })
        // I don't want to delete the feedback after enhancing, I want to keep it but ignore it everywhere in the code, just keep it for further tests and keep the database rich
        const textForEmbed = improved.stem_plain_text || improved.question_text || ''
        if (textForEmbed) {
            try {
                const embedding = await llm.generateEmbedding(textForEmbed)
                await supabase
                    .from('sat_questions')
                    .update({ embedding })
                    .eq('id', questionId)
            } catch (e) {
                console.error('Re-embedding failed:', e.message)
            }
        }
        return { questionId, previousTier: 'trash', newTier: 'unranked' }
    }

    async getTierDistribution() {
        const { data, error } = await supabase.from('sat_questions').select('quality_tier').eq('source', 'ai_generated')
        if (error) throw error
        const dist = { diamond: 0, platinum: 0, gold: 0, silver: 0, bronze: 0, trash: 0, unranked: 0 }
        for (const row of (data || [])) {
            const tier = row.quality_tier || 'unranked'
            if (dist[tier] !== undefined) dist[tier]++
            else dist.unranked++
        }
        return dist
    }
}


module.exports = new QuestionFeedbackEngine()