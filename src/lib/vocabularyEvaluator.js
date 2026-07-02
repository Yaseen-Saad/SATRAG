const fs = require("fs")
const path = require("path")
const llm = require('./llm')


// This function is AI generated but it works :)
const interpolate = (tpl, args) => {
    const handler = new Function(...Object.keys(args), `return \`${tpl}\`;`);
    return handler(...Object.values(args));
};

class VocabularyEvaluator {
    async evaluateEntry(entry, targetWord) {
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
                maxTokens: 800
            })
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in LLM response');
            const result = JSON.parse(jsonMatch[0]);
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