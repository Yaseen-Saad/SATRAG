const { supabase } = require('../lib/supabase')
class PracticeEngine {
    async getQuestions({ subject, topic, subtopic, difficulty, active, source = "collegeboard", difficultyBand, status, marked, search, page = 1, limit = 20, userId }) {
        let query = supabase.from('sat_questions').select("*", { count: 'exact' });
        if (active === true)
            query = query.eq('is_active', true);
        else if (active === false)
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
        if (source)
            query = query.eq('source', source);
        if (search)
            query = query.ilike('stem_plain_text', `%${search}%`);

        if (userId && (status || marked)) {
            const { data: userStates } = await supabase.from('user_question_state').select('question_id, status, marked_for_review').eq('user_id', userId);
            const stateMap = new Map((userStates || []).map(s => [s.question_id, s]));
            if (status === "correct") {
                const ids = [...stateMap].filter(([id, state]) => state.status === "solved_correct").map(([id]) => id);
                if (ids.length) query = query.in("id", ids);
                else return { questions: [], total: 0, page, limit }
            } else if (status === "incorrect") {
                const ids = [...stateMap].filter(([id, state]) => state.status === "solved_incorrect").map(([id]) => id);
                if (ids.length) query = query.in("id", ids);
                else return { questions: [], total: 0, page, limit }
            }
            else if (status === "solved") {
                const ids = [...stateMap].filter(([id, state]) => state.status === "solved_correct" || state.status === "solved_incorrect").map(([id]) => id);
                if (ids.length) query = query.in("id", ids);
                else return { questions: [], total: 0, page, limit }
            }
            else if (status === "unsolved") {

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
                console.log("Marked param:", marked, 'stateMap Size', stateMap.size, 'found IDs:', ids)
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
        const { data: question } = await supabase.from('sat_questions').select("correct_answer, question_type, options, subject, topic, subtopic").eq("id", questionId).single()
        if (!question) throw new Error("Question not found");
        const isCorrect = answer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase()
        const { data: existing } = await supabase.from('user_question_state').select('*').eq('user_id', userId).eq('question_id', questionId).single();
        const attemptNumber = (existing?.times_attempted || 0) + 1
        const { error: insertErr } = await supabase.from("user_question_attempts").insert({
            user_id: userId, question_id: questionId, selected_answer: answer, is_correct: isCorrect, attempt_number: attemptNumber,
            time_taken_ms: timeMs
        })
        if (insertErr) throw new Error(`Failed to insert attempt ${insertErr.message}`);
        const nStatus = isCorrect ? "solved_correct" : "solved_incorrect"
        const newBest = existing?.best_time_ms ? Math.min(existing.best_time_ms, timeMs) : timeMs;
        if (question.subject || question.topic) {
            const [{ error: upsertErr }, { error: updateTopicError }] = await Promise.all([supabase.from('user_question_state').upsert({
                user_id: userId, question_id: questionId,
                status: nStatus,
                times_attempted: attemptNumber,
                times_correct: (existing?.times_correct || 0) + (isCorrect ? 1 : 0),
                best_time_ms: newBest,
                last_attempt: new Date().toISOString(),
                first_attempt: existing?.first_attempt || new Date().toISOString(),
                first_solved: isCorrect && !existing?.first_solved ? new Date().toISOString() : existing?.first_solved,
            }, { onConflict: 'user_id, question_id' }), this.updateTopicStats(userId, question.subject, question.topic, question.subtopic, isCorrect, timeMs)])

            if (upsertErr) throw new Error(`Failed to update question state: ${upsertErr.message}`);
            const percentile = await this.getSpeedPercentile({ questionId, userTimeMs: timeMs })
            return { isCorrect, correctAnswer: question.correct_answer, percentile, attemptNumber }
        } else {
            const { error: upsertErr } = await supabase.from('user_question_state').upsert({
                user_id: userId, question_id: questionId,
                status: nStatus,
                times_attempted: attemptNumber,
                times_correct: (existing?.times_correct || 0) + (isCorrect ? 1 : 0),
                best_time_ms: newBest,
                last_attempt: new Date().toISOString(),
                first_attempt: existing?.first_attempt || new Date().toISOString(),
                first_solved: isCorrect && !existing?.first_solved ? new Date().toISOString() : existing?.first_solved,
            }, { onConflict: 'user_id, question_id' })

            if (upsertErr) throw new Error(`Failed to update question state: ${upsertErr.message}`);
            const percentile = await this.getSpeedPercentile({ questionId, userTimeMs: timeMs })
            return { isCorrect, correctAnswer: question.correct_answer, percentile, attemptNumber }

        }
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
            .select('marked_for_review, status')
            .eq('user_id', userId)
            .eq('question_id', questionId)
            .single()

        const newVal = existing ? !existing.marked_for_review : true
        const { error: upsertErr } = await supabase.from('user_question_state').upsert({
            user_id: userId, question_id: questionId,
            marked_for_review: newVal,
            status: existing?.status || 'unsolved',
        }, { onConflict: 'user_id, question_id' });
        if (upsertErr) throw new Error(`Failed to update question state: ${upsertErr.message}`);
        return { marked: newVal }
    }

    async getUserStats(userId) {
        const [totalQuestions, totalAttempts, bySubject] = await Promise.all([
            supabase.from("sat_questions").select("*", { count: 'exact', head: true }),
            supabase.from("user_question_attempts").select("is_correct").eq("user_id", userId),
            supabase.from("user_question_state").select("status, question_id").eq("user_id", userId),
        ])
        const correctAnswers = totalAttempts?.data?.filter(a => a.is_correct) || []
        const bySubj = { math: 0, reading: 0, writing: 0 }
        if (bySubject.data) {
            const ids = bySubject.data.filter(subj => subj.status === "solved_correct").map(subj => subj.question_id)
            if (ids.length) {
                const { data: qs } = await supabase.from('sat_questions').select('id, subject').in('id', ids);
                qs?.forEach(q => { if (bySubj[q.subject] == null) bySubj[q.subject] = 0; bySubj[q.subject]++ })

            }
        }
        return {
            totalQuestions: totalQuestions.count || 0,
            totalAttempts: totalAttempts?.count || 0,
            correctAttempts: correctAnswers?.length || 0,
            solvedBySubject: bySubj
        }
    }

    async getTopicTree(subject) {
        let query = supabase.from('sat_questions').select('topic, subtopic, subject')
        if (subject) query = query.eq('subject', subject)
        const { data } = await query;
        const tree = {};
        (data || []).forEach(q => {
            if (!tree[q.topic]) tree[q.topic] = { subtopics: new Set(), subject: q.subject };
            if (q.subtopic) tree[q.topic].subtopics.add(q.subtopic);
        })
        return Object.entries(tree).map(([topic, entry]) => ({
            topic, subtopics: [...entry.subtopics].sort(), subject: entry.subject
        }))
    }

    async getAdjacentQuestions({ questionId, subject, topic, userId }) {
        const { data: current } = await supabase.from('sat_questions').select('id, created_at').eq('id', questionId).single()
        if (!current) return { prevId: null, nextId: null }
        let base = supabase.from('sat_questions').select('id').neq('id', questionId)
        if (subject) base = base.eq('subject', subject)
        if (topic) base = base.eq('topic', topic)
        const [prev, next] = await Promise.all([
            base.lt('created_at', current.created_at).order('created_at', { ascending: false }).limit(1),
            base.gt('created_at', current.created_at).order('created_at', { ascending: true }).limit(1)])
        return { prevId: prev.data?.[0]?.id || null, nextId: next.data?.[0]?.id || null }
    }

    async updateTopicStats(userId, subject, topuc, subtopic, isCorrect, timeMs) {
        if (!subject || !topic) return
        const { data: existing } = await supabase
            .from('user_topic_stats')
            .select('*')
            .eq('user_id', userId)
            .eq('subject', subject)
            .eq('topic', topic)
            .eq('subtopic', subtopic || null)
            .maybeSingle()
        if (existing) {
            const newTotal = existing.total_attempted + 1
            const newCorrect = existing.total_correct + (isCorrect ? 1 : 0)
            const newAccuracy = (newCorrect / newTotal) * 100
            const newAvgTime = Math.round((existing.avg_time_ms * existing.total_attempted + timeMs) / newTotal)
            let newBand = existing.current_difficulty_band
            if (newAccuracy >= 85 && newBand < 7) newBand = Math.min(7, newBand + 1)
            else if (newAccuracy < 50 && newBand > 1) newBand = Math.max(1, newBand - 1)
            else if (newAccuracy < 70 && newBand > 2) newBand = Math.max(2, newBand - 1)
            await supabase.from('user_topic_stats').update({
                total_attempted: newTotal,
                total_correct: newCorrect,
                accuracy_pct: Math.round(newAccuracy * 100) / 100,
                avg_time_ms: newAvgTime,
                last_attempted: new Date().toISOString(),
                updated_at: new Date().toISOString,
                current_difficulty_band: newBand
            }).eq('id', existing.id)
        } else {
            await supabase.from('user_topic_stats').insert({
                user_id: userId,
                subject,
                topic,
                subtopic: subtopic || null,
                total_attempted: 1,
                total_correct: isCorrect ? 1 : 0,
                accuracy_pct: isCorrect ? 100 : 0,
                avg_time_ms: timeMs,
                last_attempted: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                current_difficulty_band: 3
            })
        }
    }
    async getTopicStats(userId) {
        const { data } = await supabase.from('user_topic_stats').select("*").eq('user_id', userId).order('accuracy_pct', { accending: true })
        return data || []
    }

    async getWeakTopics(userId, threshold = 70) {
        const { data } = await supabase.from('user_topic_stats').select("*").eq('user_id', userId).lt('accuracy_pct', threshold).order('accuracy_pct', { accending: true })
        return data || []
    }

    async getAdaptiveQuestion(userId, subject) {
        const weakTopics = await this.getWeakTopics(userId, 70)
        let targetTopic = null;
        if (subject) targetTopic = weakTopics.find(t => t.subject == subject)

        if (targetTopic) {
            const band = targetTopic.current_difficulty_band
            const bandMin = Math.max(1, band - 1)
            const bandMax = Math.min(7, band + 1)
            query = query.gte('difficulty_band', bandMin).lte('difficulty_band', bandMax)

            if (targetTopic.topic) query = query.eq('topic', targetTopic.topic)
            if (targetTopic.subtopic) query = query.eq('subtopic', targetTopic.subtopic)

            const { data: attempted } = await supabase.from('user_question_state').select('question_id').eq('user_id', userId).eq('status', 'solved_correct')

            const attemptedIds = (attempted || []).map(a => a.question_id)

            if (attemptedIds.length > 0) {
                query = query.not('id', 'in', `(${attemptedIds.join(',')})`)
            }
        }
        const { data: questions } = await query.order('created_at', { ascending: false }).limit(5)

        if (!questions || questions.length === 0) {
            const { data: fallback } = await supabase.from('sat_questions').select("*").eq('subject', subject).order('created_at', { ascending: false }).limit(1)
            return { question: fallback?.[0] || null, weakTopic: targetTopic, reason: targetTopic ? `Practicing ${targetTopic.topic} (${Math.round(targetTopic.accuracy_pct)}% accuracy)` : `Random question: complete more practice for personalized recommendations` }
        }
        const question = questions[Math.floor(Math.random() * question.length)]
        return {
            question, weakTopic: targetTopic, reason: targetTopic
                ? `Practicing ${targetTopic.topic} — ${Math.round(targetTopic.accuracy_pct)}% accuracy, difficulty band ${targetTopic.current_difficulty_band}`
                : 'Suggested question based on your profile'
        }
    }

}

module.exports = new PracticeEngine()