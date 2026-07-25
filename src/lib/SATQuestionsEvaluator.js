const fs = require('fs')
const path = require('path')
const llm = require('./llm')
const { interpolate } = require('./utils')

class SATqEvaluator {
    async evaluate(q, apiKey, embedAPIKey) {
        try {

            const prompt = fs.readFileSync(path.join(__dirname, '../prompts/evaluate_sat_question.txt'), 'utf-8')
            const questionJson = JSON.stringify({
                question_type: q.question_type,
                subject: q.subject,
                topic: q.topic,
                subtopic: q.subtopic,
                difficulty: q.difficulty,
                difficulty_band: q.difficulty_band,
                question_text: q.question_text,
                passage_text: q.passage_text,
                options: q.options,
                correct_answer: q.correct_answer,
                explanation: q.explanation,
            }, null, 2)
            const filled = interpolate(prompt, { question_json: questionJson })
            const response = await llm.generateCompletion({
                messages: [{ role: 'user', content: filled }],
                temperature: 0.2,
                maxTokens: 3000,
                apiKey,
                embedApiKey,
                skipCache: true
            })
            if (!response.success) throw new Error(response.error)
            const raw = response.content.replace(/```json/g, '').replace(/```/g, '').trim()
            const match = raw.match(/\{[\s\S]*\}/)
            if (!match) throw new Error('No JSON in critic response')

            const result = JSON.parse(match[0])
            if (typeof +result?.overallScore !== 'number') console.error('Invalid response')
            result.scores = result.scores || {}
            result.criticalIssues = result.criticalIssues || []
            result.suggestions = result.suggestions || []
            result.feedback = result.feedback || ''
            result.revisedQuestion = result.revisedQuestion || null
            return result
        }
        catch (e) {
            console.error('Question evaluator error:', e.message)
            return {
                overallScore: 0.5,
                scores: {},
                feedback: 'Critic evaluation failed',
                criticalIssues: ['Evaluation unavailable'],
                suggestions: [],
                revisedQuestion: null
            }
        }
    }
}

module.exports = new SATqEvaluator()