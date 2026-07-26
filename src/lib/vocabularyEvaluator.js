const fs = require("fs")
const path = require("path")
const llm = require('./llm')
const { interpolate, readFile } = require('./utils')

class VocabularyEvaluator {
    async evaluateEntry(entry, targetWord, apiKey, embedApiKey, userId) {
        try {
            const prompt = readFile('prompts/evaluate_vocab_entry.txt');
            const filled = interpolate(prompt, {
                word: targetWord,
                pronunciation: entry.pronunciation || '',
                part_of_speech: entry.part_of_speech || '',
                definition: entry.definition || '',
                mnemonic_type: entry.mnemonic_type || '',
                mnemonic_phrase: entry.mnemonic_phrase || '',
                picture_story: entry.picture_story || '',
                other_forms: entry.other_forms || '',
                example_sentence: entry.example_sentence || '',
            });
            const response = await llm.generateCompletion({
                userId,
                messages: [{ role: 'user', content: filled }],
                temperature: 0.2,
                maxTokens: 800,
                apiKey: apiKey,
                embedApiKey: embedApiKey
            })
            if (!response.success || !response.content) {
                return {
                    isValid: false,
                    overallScore: 0,
                    score: 0,
                    feedback: response.error || 'Empty LLM response',
                    componentScores: {},
                    issues: ['LLM returned empty response'],
                    suggestions: []
                }
            }
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in LLM response');
            const result = JSON.parse(jsonMatch[0]);
            if (!result || typeof result.isValid !== 'boolean' || typeof result.overallScore !== 'number') {
                throw new Error('Invalid JSON structure in LLM response');
            }
            result.componentScores = result.componentScores ?? {};
            result.issues = result.issues ?? [];
            result.suggestions = result.suggestions ?? [];
            return result;
        } catch (err) {
            if (err.message !== "No JSON in LLM response")
                console.error('Error evaluating entry:', err);
            return {
                isValid: false,
                overallScore: 0,
                score: 0,
                feedback: 'Error evaluating entry',
                componentScores: {},
                issues: ['Evaluation failed due to an error'],
                suggestions: []
            }
        }
    }
}
module.exports = new VocabularyEvaluator()