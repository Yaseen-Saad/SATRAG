const fs = require("fs")
const path = require("path")
const llm = require('./llm')
const { interpolate } = require('./utils')

class VocabularyEvaluator {
    async evaluateEntry(entry, targetWord, apiKey, embedApiKey) {
        try {
            const prompt = fs.readFileSync(path.join(__dirname, '../prompts/evaluate_vocab_entry.txt'), 'utf-8');
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
                messages: [{ role: 'user', content: filled }],
                temperature: 0.2,
                maxTokens: 800,
                apiKey: apiKey,
                embedApiKey: embedApiKey
            })
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in LLM response');
            const result = JSON.parse(jsonMatch[0]);
            if (!result || typeof result.isValid !== 'boolean' || typeof result.score !== 'number' || typeof result.feedback !== 'string') {
                throw new Error('Invalid JSON structure in LLM response');
            }
            result.overallScore = result.overallScore ?? 5;
            result.componentScores = result.componentScores ?? {};
            result.issues = result.issues ?? [];
            result.suggestions = result.suggestions ?? [];
            return result;
        } catch (err) {
            console.error('Error evaluating entry:', err);
            return {
                score: 0,
                feedback: 'Error evaluating entry'
            }
        }
    }
}
module.exports = new VocabularyEvaluator()