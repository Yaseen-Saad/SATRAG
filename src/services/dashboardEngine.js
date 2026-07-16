const supabase = require('../lib/supabase').service;

class DashboardEngine {

    async getUserDashboardData(userId) {
        try {
            const [vocabCountResult, qualityResult, feedbackData, practiceStates, recentAttempts] = await Promise.all([
                supabase.from('vocab_entries').select('*', { count: 'exact', head: true }),
                supabase.from('vocab_entries').select('quality_score').not('quality_score', 'is', null),
                supabase.from("feedback_events").select("satisfaction_score, helpful_components, comments, created_at, word_id").eq('user_id', userId).order("created_at", { ascending: false }).limit(10),
                supabase.from('user_question_state').select('status, times_attempted, question_id, marked_for_review').eq('user_id', userId),
                supabase.from('user_question_attempts').select('*, sat_questions!inner(question_text, subject, topic)').eq('user_id', userId).order('attempt_time', { ascending: false }).limit(10)
            ])

            const avgQuality = qualityResult?.data || [];
            const validScores = (avgQuality || []).filter(e => e.quality_score != null).map(e => e.quality_score);
            const avgQualityScore = validScores.length ? Math.round(validScores.reduce((acc, score) => acc + score, 0) / validScores.length) : null;
            const ratings = feedbackData?.data?.filter(feedback => feedback.satisfaction_score !== null) || [];
            const avgSatisfaction = ratings.length ? Math.round(ratings.reduce((acc, feedback) => acc + feedback.satisfaction_score, 0) / ratings.length) : null;
            return {
                avgQualityScore,
                avgSatisfaction,
                practiceStates: practiceStates || [],
                recentAttempts: recentAttempts || []
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            return { avgQualityScore: null, avgSatisfaction: null, practiceStates: [], recentAttempts: [] };
        }
    }

    async getPracticeStats(userId) {
        try {
            const { data: practiceStates, error } = await supabase
                .from('user_question_state')
                .select('status, times_attempted, question_id, marked_for_review')
                .eq('user_id', userId);
            if (error) throw error;
            const data = practiceStates || [];
            const attempted = data.filter(state => state.status !== 'unsolved');
            const correct = data.filter(state => state.status === 'solved_correct');
            const markedForReview = data.filter(state => state.marked_for_review);
            const accuracy = attempted.length > 0 ? (correct.length / attempted.length) * 100 : 0;
            return {
                attempted: attempted.length,
                markedForReview: markedForReview.length,
                accuracy,
                correct: correct.length,
            };
        } catch (error) {
            console.error('Error fetching practice stats:', error);
            return { attempted: 0, markedForReview: 0, accuracy: 0, correct: 0 };
        }
    }

    async getTopicBreakdown(userId) {
        const { data: attempts, error } = await supabase
            .from('user_question_attempts')
            .select('is_correct, sat_questions!inner(subject, topic)')
            .eq('user_id', userId);
        if (error) throw error;
        if (!attempts || attempts.length === 0) return [];
        const breakdown = {};
        for (const attempt of attempts) {
            const rawSubject = attempt.sat_questions.subject;
            const subject = (rawSubject === 'reading' || rawSubject === 'writing') ? 'reading_writing' : rawSubject;
            const key = `${subject}-${attempt.sat_questions.topic}`;
            if (!breakdown[key]) {
                breakdown[key] = { subject, topic: attempt.sat_questions.topic, correct: 0, incorrect: 0, total: 0 };
            }
            breakdown[key].total++
            if (attempt.is_correct) breakdown[key].correct++
        }
        return Object.entries(breakdown).map(([, g]) => ({ ...g, accuracy: g.correct / g.total * 100 })).sort((a, b) => a.accuracy - b.accuracy);
    }

    async getLeaderboard({ limit = 50, offset = 0, userId, sortBy = 'score', sortDir = 'desc', gradeFilter = '' }) {
        let query = supabase.from('public_profiles').select("id, first_name, last_name, grade").eq('participate_in_leaderboard', true)
        if (gradeFilter) query = query.eq('grade', gradeFilter)
        const { data: profiles } = await query
        if (!profiles || !profiles.length) return { entries: [], totalCount: 0, userRank: null }
        const userIds = profiles.map(p => p.id)
        const { data: attempts } = await supabase.from('user_question_attempts').select('user_id, is_correct').in('user_id', userIds);

        const stats = {}
        for (const a of attempts || []) {
            if (!stats[a.user_id]) stats[a.user_id] = { correct: 0, total: 0 }
            stats[a.user_id].total++;
            if (a.is_correct) stats[a.user_id].correct++;
        }
        const entries = profiles.map(p => {
            const s = stats[p.id] || { correct: 0, total: 0 }
            const accuracy = s.total ? Math.round((s.correct / s.total) * 100) : 0;
            return {
                userId: p.id,
                name: [p.first_name, p.last_name].filter(Boolean).join(" ") || 'Anonymous',
                grade: p.grade || '',
                correct: s.correct,
                total: s.total,
                score: s.correct,
                accuracy
            }
        })

        const sortKey = sortBy === 'accuracy' ? 'accuracy' : sortBy === 'correct' ? 'correct' : 'score'
        entries.sort((a, b) => sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey])
        entries.forEach((e, i) => e.rank = i + 1)

        const userRank = userId ? entries.find(e => e.userId === userId)?.rank || null : null
        return {
            entries: entries.slice(offset, offset + limit),
            totalCount: entries.length,
            userRank
        }
    }

    async getWeeklyActivity(userId) {

        const days = 7
        const since = new Date()
        since.setDate(since.getDate() - days)
        since.setHours(0, 0, 0, 0)
        const { data } = await supabase.from('user_question_attempts').select('attempt_time').eq('user_id', userId).gte('attempt_time', since.toISOString())
        const dayMap = {}
        for (let i = 0; i < days; i++) {
            const date = new Date()
            date.setDate(date.getDate() - i)
            const key = date.toISOString().split('T')[0]
            dayMap[key] = { date: key, count: 0 }
        }
        if (data) {
            for (const attempt of data) {
                const key = attempt.attempt_time.split('T')[0]
                if (dayMap[key]) {
                    dayMap[key].count++
                }
            }
        }
        return Object.values(dayMap).reverse()
    }

    async getSessionAnalytics(userId) {
        const { data: attempts } = await supabase.from('user_question_attempts').select('*, sat_questions!inner(subject,topic)').eq('user_id', userId).order('attempt_time', { ascending: true })
        if (!attempts || !attempts?.length) return []
        const sessions = []
        let current = { date: null, total: 0, correct: 0, timeMs: 0, questions: [] }
        for (const att of attempts) {
            const day = att.attempt_time.split("T")[0]
            if (current.date !== day) {
                if (current.date) sessions.push(current)
                current = { date: day, total: 0, correct: 0, timeMs: 0, questions: [] }
            }
            current.total++
            if (att.is_correct) current.correct++
            current.timeMs += att.time_taken_ms || 0
            current.questions.push(
                {
                    id: att.question_id,
                    subject: (att.sat_questions.subject === 'reading' || att.sat_questions.subject === 'writing') ? 'reading_writing' : att.sat_questions.subject,
                    topic: att.sat_questions.topic,
                    correct: att.is_correct
                }
            )

        }
        if (current.date) sessions.push(current)
        return sessions.slice(-30).map(session => ({ ...session, timeSec: Math.round(session.timeMs / 1000), accuracy: session.total ? Math.round(session.correct / session.total * 100) : 0 }))
    }

    async getStreak(userId) {
        const { data, error } = await supabase
            .from('user_question_attempts')
            .select('attempt_date:attempt_time::date')
            .eq('user_id', userId)
            .order('attempt_time', { ascending: false });
        if (error || !data?.length) return { currentStreak: 0, longestStreak: 0 };

        const uniqueDays = [...new Set(data.map(d => d.attempt_date))].sort();

        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        const todayStr = new Date().toISOString().split('T')[0]
        const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const hasActivityRecently = uniqueDays[uniqueDays.length - 1] === todayStr || uniqueDays[uniqueDays.length - 1] === yesterdayStr

        for (let i = 0; i < uniqueDays.length; i++) {
            if (i === 0) {
                tempStreak = 1;
            } else {
                const currentDay = new Date(uniqueDays[i]);
                const previousDay = new Date(uniqueDays[i - 1]);
                const diffTime = Math.abs(previousDay - currentDay);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    longestStreak = Math.max(longestStreak, tempStreak);
                    tempStreak = 1;
                }
            }
        }

        longestStreak = Math.max(longestStreak, tempStreak);
        currentStreak = hasActivityRecently ? tempStreak : 0;
        if (hasActivityRecently && uniqueDays[uniqueDays.length - 1] === todayStr && tempStreak === uniqueDays.length) {
            currentStreak = tempStreak;
        }

        return { currentStreak, longestStreak };
    }

    async getPerformanceTrend(userId) {
        const sessions = await this.getSessionAnalytics(userId)
        return sessions.map(session => ({
            date: session.date, accuracy: session.accuracy, total: session.total, correct: session.correct
        }))
    }

    async getTimeAnalytics(userId) {
        const { data: attempts } = await supabase.from('user_question_attempts').select('time_taken_ms, is_correct').eq('user_id', userId)
        if (!attempts || !attempts.length) return { totalTimeSec: 0, avgTimeSec: 0, totalQuestions: 0, fastestTimeSec: 0, slowestTimeSec: 0 }
        const times = attempts.map(att => att.time_taken_ms || 0).filter(t => t > 0)
        return {
            totalTimeSec: Math.round(times.reduce((acc, t) => acc + t, 0) / 1000),
            avgTimeSec: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 1000) : 0,
            totalQuestions: attempts.length,
            fastestTimeSec: times.length ? Math.round(Math.min(...times) / 1000) : 0,
            slowestTimeSec: times.length ? Math.round(Math.max(...times) / 1000) : 0
        }
    }

    async getRecentFeedback(userId) {
        const { data: feedback, error } = await supabase
            .from('feedback_events')
            .select('satisfaction_score, helpful_components, comments, created_at, word_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
        if (error) throw error;
        if (!feedback?.length) return [];
        const wordIDs = [...new Set(feedback.map(f => f.word_id))];
        const { data: words, error: wordError } = wordIDs.length ? await supabase
            .from('vocab_entries')
            .select('id, word')
            .in('id', wordIDs) : { data: [], error: null };
        if (wordError) throw wordError;
        const wordsMap = Object.fromEntries(words.map(w => [w.id, w.word]));
        return feedback.map(f => ({ ...f, word: wordsMap[f.word_id] || 'Unknown' }));
    }

}
module.exports = new DashboardEngine();