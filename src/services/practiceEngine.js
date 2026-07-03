const supabase = require('../lib/supabase')
class PracticeEngine {
    async getQuestions({ subject, topic, subtopic, difficulty, active, difficultyBand, status, marked, search, page = 1, limit = 20, userId }) {
        let query = supabase.from('sat_questions').select("*", { count: 'exact' });
        if (active)
            query = query.eq('is_active', false);
        if (subject)
            query = query.eq('subject', subject);
        if (topic)
            query = query.eq('topic', topic);
        if (subtopic)
            query = query.eq('subtopic', subtopic);
        if (difficulty)
            query = query.eq('difficulty', difficulty);
        if (difficultyBand)
            query = query.eq('difficulty_band', difficultyBand);
        if (search)
            query = query.ilike('stem_plain_text', `%${search}%`);

        if (userId && (status || marked)) {
            const { data: userStates } = await supabase.from('user_question_state').select('question_id, status, marked_for_review').eq('user_id', userId);
            const stateMap = new Map((userStates || []).map(s => [s.question_id, s]));
            if (status === "solved") {
                const ids = [...stateMap].filter(([id, state]) => state.status === "solved_correct").map(([id]) => id);
                if (ids.length) query = query.in("id", ids);
                else return { questions: [], total: 0, page, limit }
            } else if (status === "unsolved") {
                if (stateMap.size === 0) {
                    // No state yet → all questions are unsolved, no filter needed
                } else {
                    const { data: all } = await supabase.from('sat_questions').select('id');
                    const solved = new Set([...stateMap].filter(([_, s]) => s.status !== 'unsolved').map(([id]) => id));
                    const ids = (all || []).filter(q => !solved.has(q.id)).map(q => q.id);
                    if (ids.length) query = query.in('id', ids); else return { questions: [], total: 0, page, limit };
                }
            }
            if (marked) {
                const ids = [...stateMap].filter(([_, s]) => s.marked_for_review).map(([id]) => id)
                if (ids.length) query = query.in('id', ids); else return { questions: [], total: 0, page, limit };
            }
        }
        const from = (page - 1) * limit
        const { data, count, error } = await query.range(from, from + limit - 1).order('created_at', {
            ascending: false
        })
        if (error) throw error;
        let questions = data || [];
        if (userId && questions.length) {
            const ids = questions.map(q => q.id)
            const { data: states } = await supabase.from('user_question_state').select('*').eq('user_id', userId).in('question_id', ids);
            const byQuestionId = Object.fromEntries((states || []).map(s => [s.question_id, s]));
            questions = questions.map(q => ({ ...q, user_state: byQuestionId[q.id] || null }))
        }
        return { questions, total: count || 0, page, limit };
    }
    async getQuestion({ questionId, userId }) {
        const { data: question, error } = await supabase.from("sat_questions").select("*").eq('id', questionId).single();
        if (error) throw error;
        let uState = null;
        let attempts = []
        if (userId) {
            const [state, atemptsresults] = await Promise.all([supabase.from('user_question_state').select('*').eq('user_id', userId).eq('question_id', questionId).single(), supabase.from("user_question_attempts").select("*").eq('user_id', userId).eq('question_id', questionId).order('attempt_time', { ascending: false })])
            if (!state.error) uState = state.data;
            if (!atemptsresults.error) attempts = atemptsresults.data || [];
        }
        return { question, uState, attempts };
    }

    async submitAnswer({ userId, questionId, answer, timeMs }) {
        const { data: question } = await supabase.from('sat_questions').select("correct_answer, question_type, options").eq("id", questionId).single()
        if (!question) throw new Error("Question not found");
        const isCorrect = answer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase()
        const { data: existing } = await supabase.from('user_question_state').select('*').eq('user_id', userId).eq('question_id', questionId).single();
        const attemptNumber = (existing?.times_attempted || 0) + 1
        await supabase.from("user_question_attempts").insert({
            user_id: userId, question_id: questionId, selected_answer: answer, is_correct: isCorrect, attempt_number: attemptNumber,
            time_taken_ms: timeMs
        })
        const nStatus = isCorrect ? "solved_correct" : "solved_incorrect"
        const newBest = existing?.best_time_ms ? Math.min(existing.best_time_ms, timeMs) : timeMs;
        await supabase.from('user_question_state').upsert({
            user_id: userId, question_id: questionId,
            status: nStatus,
            times_attempted: attemptNumber,
            times_correct: (existing?.times_correct || 0) + (isCorrect ? 1 : 0),
            best_time_ms: newBest,
            last_attempt: new Date().toISOString(),
            first_attempt: existing?.first_attempt || new Date().toISOString(),
            first_solved: isCorrect && !existing?.first_solved ? new Date().toISOString() : existing?.first_solved,
        })
        const percentile = await this.getSpeedPercentile({ questionId, userTimeMs: timeMs })
        return { isCorrect, correctAnswer: question.correct_answer, percentile, attemptNumber }
    }

    async getSpeedPercentile({ questionId, userTimeMs }) {
        const { data } = await supabase.from('user_question_attempts').select('time_taken_ms').eq('question_id', questionId).eq('is_correct', true)
        if (!data || data.length < 5) return null;
        const faster = data.filter(a => a.time_taken_ms < userTimeMs).length;
        return Math.round((faster / data.length) * 100)
    }

    async toggleMarkForReview(userId, questionId) {
        const { data: existing } = await supabase
            .from('user_question_state')
            .select('marked_for_review')
            .eq('user_id', userId)
            .eq('question_id', questionId)
            .single()

        const newVal = existing ? !existing.marked_for_review : true
        await supabase.from('user_question_state').upsert({
            user_id: userId, question_id: questionId,
            marked_for_review: newVal,
            status: existing?.status || 'unsolved',
        });
        return { marked: newVal }
    }

    async getUserStats(userId) {
        const [totalQuestions, totalAnaswers, bySubject] = await Promise.all([
            supabase.from("sat_questions").select("*", { count: 'exact', head: true }),
            supabase.from("user_question_attempts").select("*", { count: 'exact', head: true }).eq("user_id", userId),
            supabase.from("user_question_state").select("*", { count: 'exact', head: true }).eq("user_id", userId),
        ])
        const correctAnswers = totalAnaswers.data.map(a => a.is_correct).filter(Boolean)
        const bySubj = { math: 0, reading: 0, writing: 0 }
        if (bySubject.data) {
            const ids = bySubject.data.filter(subj => subj.status === "solved_correct").map(subj => subj.question_id)
            if (ids.length) {
                const { data: qs } = await supabase.from('sat_questions').select('id, subject').in('id', ids);
                qs?.forEach(q => { bySubj[q.subject] ? bySubj[q.subject]++ : bySubj[q.subject] = 1 })

            }
        }
        return {
            totalQuestions: totalQuestions.count || 0,
            totalAttempts: totalAnaswers.count || 0,
            correctAttempts: correctAnswers.length || 0,
            solvedBySubject: bySubj
        }
    }

    async getTopicTree(subject) {
        let query = supabase.from('sat_questions').select('topic, subtopic')
        if (subject) query = query.eq('subject', subject)
        const { data } = await query;
        const tree = {};
        (data || []).forEach(q => {
            if (!tree[q.topic]) tree[q.topic] = new Set();
            if (q.subtopic) tree[q.topic].add(q.subtopic);
        })
        return Object.entries(tree).map(([topic, subtopics]) => ({
            topic, subtopics: [...subtopics].sort()
        }))
    }

}

module.exports = new PracticeEngine()