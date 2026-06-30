// I will create just a simple demo, I want it to be much more complex but I will just create a simple demo
const supabase = require('../lib/supabase')
const fs = require('fs')
const path = require('path')
const llm = require('../lib/llm')
const rag = require('../lib/rag')


// This function is AI generated but it works :)
const interpolate = (tpl, args) => {
    const handler = new Function(...Object.keys(args), `return \`${tpl}\`;`);
    return handler(...Object.values(args));
};

class QuizEngine {
    async generateQuiz({ userId, type = "vocab", count = 5, word = null }) {
        let words = []
        if (word) {
            const entry = await rag.findByWord(word.toUpperCase())
            if (entry) { words = [entry] }
            else throw new Error(`Word "${word}" not found in the database.`)
        } else {
            const { data: dueWords } = await supabase
                .from('spaced_reptition').select("word_id").eq('user_id', userId)
                .lte('due_date', new Date().toISOString())
                .limit(count)
            if (dueWords && dueWords.length > 0) {
                const ids = dueWords.map(d => d.word_id)
                const { data: entries } = await supabase.from('vocab_entries').select("*")
                    .in('id', ids)
                words = entries || []
            }
            // this is only if no enoguh words in the db, probably wont be used ever lol
            if (words.length < count) {
                const { data: random } = await supabase
                    .from('vocab_entries')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(count - words.length);
                words = [...words, ...(random || [])];
            }
            words = words.slice(0, count)
        }
        if (words.length === 0) throw new Error('No words available for quiz');

        // Generate questions via LLM
        const questions = [];
        for (const entry of words) {
            const q = await this.generateQuestion(entry);
            questions.push(q);
        }

        const { data: attempt, error } = await supabase.from('quiz_attempts').insert({
            user_id: userId,
            quiz_type: type,
            total_questions: questions.length,
        }).select().single();

        if (error) throw error;

        const questionRows = questions.map((q, i) => ({
            attempt_id: attempt.id,
            word_id: q.wordId,
            question_type: q.type,
            prompt: q.prompt,
            options: q.options,
            correct_index: q.correctIndex,
        }));

        const { data: savedQuestions, error: qError } = await supabase
            .from('quiz_questions')
            .insert(questionRows)
            .select();

        if (qError) throw qError;

        return { attempt, questions: savedQuestions };

    }
    async generateQuestion(entry) {
        const prompt = interpolate(fs.readFileSync(path.join(__dirname, '../prompts/vocab_question_generation.txt'), 'utf8'), { entry });
        const response = await llm.generateCompletion({ messages: [{ role: 'user', content: prompt }], temperature: 0.7, maxTokens: 500 });
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid response format');
        const question = JSON.parse(jsonMatch[0]);
        return { wordId: entry.id, type: "vocab", prompt: question.prompt, options: question.options, correctIndex: question.correctIndex };
    }

}