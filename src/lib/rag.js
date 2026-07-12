const { service: supabase } = require('./supabase')
const llm = require('./llm')
const fs = require("fs")
const path = require("path")

class RAGEngine {
    async retrieveSimilar(word, topK = 3) {
        try {
            const embedding = await llm.generateEmbedding(word);
            const { data: similar, error } = await supabase.rpc('match_vocab_entries', {
                query_embedding: embedding,
                match_threshold: 0.5,
                match_count: topK
            });
            if (error) throw error;
            if (similar && similar.length > 0) return similar;
            throw new Error('No vector matches found');
        } catch (err) {
            console.error("Embedding search failed, using keyword fallback:", err.message);
            return this.keywordSearch(word, topK);
        }
    }

    async keywordSearch(word, topK) {
        try {
            const { data: all } = await supabase
                .from('vocab_entries')
                .select('*')
                .limit(200);
            if (!all || all.length === 0) return [];

            const w = word.toLowerCase();
            const scored = all.map(e => {
                let score = 0;
                const ew = (e.word || '').toLowerCase();
                const ed = (e.definition || '').toLowerCase();
                const es = (e.example_sentence || '').toLowerCase();
                if (ew === w) score += 10;
                else if (ew.includes(w) || w.includes(ew)) score += 5;
                if (ed.includes(w)) score += 3;
                if (es.includes(w)) score += 1;
                return { ...e, similarity: score };
            }).filter(e => e.similarity > 0).sort((a, b) => b.similarity - a.similarity).slice(0, topK);

            if (scored.length > 0) return scored;
            const { data } = await supabase
                .from('vocab_entries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(topK);
            return data || [];
        } catch {
            const { data } = await supabase.from('vocab_entries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(topK);
            return data || [];
        }
    }

    async getFeedbackContext(word) {
        const { data: wordEntry } = await supabase
            .from('vocab_entries')
            .select('id')
            .eq('word', word.toUpperCase())
            .limit(1)
            .single();
        if (!wordEntry) return [];
        const { data: feedback } = await supabase
            .from("feedback_events")
            .select('satisfaction_score, helpful_components, problematic_components, comments')
            .eq('word_id', wordEntry.id)
            .order('created_at', { ascending: false })
            .limit(5)
        return feedback || []
    }

    async addEntry(entry) {
        try {
            const embedding = await llm.generateEmbedding(`${entry.word} ${entry.definition} ${entry.example_sentence}`);
            const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding }).select().single();
            if (error) throw error;
            return data;
        } catch (err) {
            console.error("Embedding generation failed, inserting without embedding:", err.message);
            const { data, error } = await supabase.from('vocab_entries').insert({ ...entry, embedding: null }).select().single();
            if (error) throw error;
            return data;
        }
    }

    async findByWord(word) {
        const { data } = await supabase.from('vocab_entries')
            .select("*").eq('word', word).limit(1).single();
        return data;
    }

    async listRecent(limit = 10) {
        const { data } = await supabase.from('vocab_entries')
            .select("*")
            .order('created_at', { ascending: false }).limit(limit)
        if (!data) return []
        const seen = new Set()
        const result = []
        for (const entry of data) {
            const w = entry.word?.toUpperCase()
            if (seen.has(w)) continue
            if (!entry.definition || !entry.definition.trim()) continue
            seen.add(w)
            result.push(entry)
            if (result.length >= limit) break
        }
        return result
    }
    async findSATExamples({ subject, topic, difficulty, count = 5 }) {
        let query = supabase.from('sat_questions').select('*').eq("source", "collegeboard").limit(count);
        if (subject) query = query.eq('subject', subject);
        if (topic) query = query.eq('topic', topic);
        if (difficulty) query = query.eq('difficulty', difficulty);
        const { data } = await query;
        if (!data || !data.length) return []
        return [...data].sort(() => Math.random() - 0.5).slice(0, Math.min(count, data.length))
    }
    async generateSATQuestion({ subject, topic, difficulty }) {
        const examples = await this.findSATExamples({ subject, topic, difficulty, count: 3 });
        const prompt = require('fs').readFileSync(require('path').join(__dirname, '../prompts/generate_sat_question.txt'), 'utf-8');
        const messages = [{ role: 'system', content: prompt }, ...examples.map((ex, i) => ({
            role: 'user', content: `Example ${i + 1}:\n${JSON.stringify({
                question_type: ex.question_type, passage_text: ex.passage_text,
                question_text: ex.question_text, options: typeof ex.options === 'string' ? JSON.parse(ex.options) : ex.options,
                correct_answer: ex.correct_answer, explanation: ex.explanation,
                subject: ex.subject, topic: ex.topic, difficulty: ex.difficulty
            }, null, 2)}`
        })), { role: 'user', content: `Please generate 1 new SAT question in JSON format with the following constraints:\nSubject: ${subject || 'any'}\nTopic: ${topic || 'any'}\nDifficulty: ${difficulty || 'any'}\n NO MARKDOWN, ONLY THE SINGLE JSON OBJECT` }];
        const response = await llm.generateCompletion({ messages, temperature: 0.7, maxTokens: 8192 });
        if (!response.success) throw new Error(response.error)
        const raw = response.content.replace(/```json/g, '').replace(/```/g, "").trim();
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
            console.error('LLM raw response:', raw.slice(0, 500))
            throw new Error('No JSON in LLM response');
        }
        const result = JSON.parse(match[0].trim());
        if (result.question_text) {
            result.question_text = result.question_text.replace(/_{2,}blank/gi, '<span style="border-bottom:2px solid; display:inline-block; min-width:80px;">&nbsp;</span>').replace(/_{4,}/g, '<span style="border-bottom:2px solid; display:inline-block; min-width:80px;">&nbsp;</span>');
        }
        let opts = result.options;
        if (opts && typeof opts === 'object' && !Array.isArray(opts)) {
            opts = Object.entries(opts).map(([label, content]) => ({ label, content }));
        }
        return { ...result, options: opts ? JSON.stringify(opts) : null, tags: JSON.stringify([result.skill_code || "", result.subject]), source: "ai_generated", is_active: false };
    }
    async saveGeneratedQuestion(question) {
        const text = question.stem_plain_text || question.question_text || ""
        const embedding = text ? await llm.generateEmbedding(text) : null
        const { data, error } = await supabase.from('sat_questions').insert({ ...question, embedding }).select().single();
        if (error) throw error;
        return data;
    }
}

module.exports = new RAGEngine()
