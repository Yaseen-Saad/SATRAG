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


    async updateSpacedRepetition({ userId, wordId, isCorrect }) {
        const { data: existing } = await supabase.from('spaced_reptition').select('*').eq('user_id', userId).eq('word_id', wordId).single();
        let easeFactor = 2.5;
        let intervalDays = 0;
        if (existing) {
            easeFactor = parseFloat(existing.ease_factor)
            intervalDays = existing.interval_days
        }
        if (isCorrect) {
            if (intervalDays === 0) intervalDays = 1
            else if (intervalDays === 1) intervalDays = 6
            else intervalDays = Math.round(intervalDays * easeFactor)
            easeFactor = Math.min(3.0, easeFactor + 0.1)
        } else {
            intervalDays = 0;
            easeFactor = Math.max(1.3, easeFactor - 0.2)
        }
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + intervalDays)

        await supabase.from('spaced_repetition').upsert({
            user_id: userId,
            word_id: wordId,
            ease_factor: easeFactor,
            interval_days: intervalDays,
            due_date: dueDate.toISOString(),
        });
        const { data: progress } = await supabase.from('user_vocab_progress').select("*").eq('user_id', userId).eq('word_id', wordId).single();

        if (progress) {
            await supabase.from('user_vocab_progress').update({
                times_seen: progress.times_seen + 1,
                times_correct: progress.times_correct + (isCorrect ? 1 : 0),
                familiarity: Math.min(1.0, (progress.times_correct + (isCorrect ? 1 : 0)) / (progress.times_seen + 1)),
                last_reviewed: new Date().toISOString(),
                next_review: dueDate.toISOString(),
            }).eq('id', progress.id);
        } else {
            await supabase.from('user_vocab_progress').insert({
                user_id: userId,
                word_id: wordId,
                times_seen: 1,
                times_correct: isCorrect ? 1 : 0,
                familiarity: isCorrect ? 1.0 : 0.0,
                last_reviewed: new Date().toISOString(),
                next_review: dueDate.toISOString(),
            });
        }
    }

    async submitAnswer({ questionId, answerIndex, userId }) {
        const { data: question } = await supabase
            .from('quiz_questions')
            .select('*, quiz_attempts!inner(user_id)')
            .eq('id', questionId)
            .single();
        if (!question) throw new Error('Question not found');
        if (question.quiz_attempts.user_id !== userId) throw new Error('Unauthorized');
        const isCorrect = answerIndex === question.correct_index
        await supabase.from('quiz_questions').update({ user_answer_index: answerIndex, is_correct: isCorrect }).eq('id', questionId);
        if (question.word_id) {
            await this.updateSpacedRepetition({ userId, wordId: question.word_id, isCorrect });
        }
        return { isCorrect, correctIndex: question.correct_index };
    }
    async completeQuiz(attemptId, userId) {
        const { data: questions } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('attempt_id', attemptId);

        const total = questions.length;
        const correct = questions.filter(q => q.is_correct).length;
        const score = Math.round((correct / total) * 100);

        await supabase.from('quiz_attempts').update({
            score,
            completed_at: new Date().toISOString(),
        }).eq('id', attemptId);

        return { score, correct, total, questions };
    }
}

module.exports = new QuizEngine()