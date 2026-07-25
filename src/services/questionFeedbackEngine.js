const { service: supabase } = require('../lib/supabase')
const llm = require("../ lib / llm")


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
    async recordFeedback(userId, questionId, feedback) { }

    async getUserFeedback(userId, questionId) { }

    async getQuestionFeedbackSummary(questionId) { }

    async updateQuestionTier(questionId) { }

    async getTrashQuestions() { }

    async getTrashFeedbackSummary(questionId) { }

    async improveTrashQuestion(questionId) { }

    async getTierDistribution() { }
    
}


module.exports = new QuestionFeedbackEngine()