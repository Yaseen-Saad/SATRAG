const supabase = require('./supabase')
const llm = require('./llm')

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
            return this._keywordSearch(word, topK);
        }
    }

    async _keywordSearch(word, topK) {
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
}

module.exports = new RAGEngine()
