class PracticeEngine {
    async getQuestions({ subject, topic, subtopic, difficulty, excludeActive, difficultyBand, status, marked, search, page = 1, limit = 20, userId }) {
        let query = supabase.from('sat_questions').select("*", { count: 'exact' });
        if (excludeActive)
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
        if (status)
            query = query.eq('status', status);
        if (marked)
            query = query.eq('marked', marked);
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
                const { data: all } = await supabase.from('sat_questions').select('id');
                const solved = new Set([...stateMap].filter(([_, s]) => s.status !== 'unsolved').map(([id]) => id));
                const ids = (all || []).filter(q => !solved.has(q.id)).map(q => q.id);
                if (ids.length) query = query.in('id', ids); else return { questions: [], total: 0, page, limit };
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
    async getQuestion({ questionId, userID }) {
        const { data: question, error } = await supabase.from("sat_questions").select("*").eq('id', questionId).single();
        if (error) throw error;
        let uState = null;
        let attempts = []
        if (userId) {
            const [state, atemptsresults] = await Promise.all([supabase.from('user_question_state').select('*').eq('user_id', userId).eq('question_id', questionId).single(), supabase.fromt("user_question_attempts").select("*").eq('user_id', userId).eq('question_id', questionId).order('attempt_time', { ascending: false })])
            if (!state.error) uState = state.data;
            if (!atemptsresults.error) attempts = atemptsresults.data || [];
        }
        return { question, uState, attempts };
    }

    async submitAnswer({ userId, questionId, answer, timeMs }) {

    }

    async getSpeedPercentile({ questionID, userTimeMs }) { }

    async toggleMarkForReview({ userId, questionId }) { }

    async getUserStats(userID) {

    }

    async getTopicTree(subject) { }

}

module.exports = new PracticeEngine()